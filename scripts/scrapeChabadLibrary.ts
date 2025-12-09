import { createClient } from '@supabase/supabase-js';
import puppeteer, { Page } from 'puppeteer';

// --- Configuration ---
const BASE_URL = 'https://chabadlibrary.org/books/';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes('YOUR_')) {
  console.error("❌ Error: Supabase credentials missing.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// --- Database Wrappers ---

async function getOrInsertAuthor(name: string, url: string) {
  const { data } = await supabase.from('authors').select('id').eq('name', name).single();
  if (data) return data.id;
  const { data: newAuth } = await supabase.from('authors').insert({ name, original_link: url }).select('id').single();
  return newAuth?.id;
}

async function getOrInsertBook(authorId: string, title: string, url: string) {
  const { data } = await supabase.from('books').select('id').eq('original_link', url).single();
  if (data) return data.id;
  const { data: newBook } = await supabase.from('books').insert({ author_id: authorId, title, category: 'General', original_link: url }).select('id').single();
  return newBook?.id;
}

async function getOrInsertChapter(bookId: string, fullPathTitle: string, url: string, sequence: number) {
  const { data } = await supabase.from('chapters').select('id').eq('original_link', url).single();
  if (data) return data.id;
  
  const { data: newChap } = await supabase.from('chapters').insert({ 
    book_id: bookId, 
    title: fullPathTitle, 
    sequence_number: sequence, 
    original_link: url 
  }).select('id').single();
  return newChap?.id;
}

async function insertSegments(chapterId: string, text: string) {
  // Split by newlines or <br> to create segments
  const segments = text.split(/(?:\r\n|\r|\n|<br>)/).map(s => s.trim()).filter(s => s.length > 5);
  let seq = 1;
  for (const seg of segments) {
    if (!/[\u0590-\u05FF]/.test(seg)) continue; // Must contain Hebrew
    
    // Low-overhead insert (ignore duplicates)
    const { error } = await supabase.from('segments').insert({ chapter_id: chapterId, sequence_number: seq, hebrew_text: seg });
    if (!error) seq++;
  }
  return seq - 1;
}

// --- Analysis Logic ---

type PageType = 'CONTENT' | 'INDEX' | 'EMPTY';

async function analyzePage(page: Page, excludeUrls: string[]) {
    return page.evaluate((excludeList) => {
        const currentUrl = window.location.href;

        // 1. Check for Text Content (The "Page" View)
        // We look for a container that has high Hebrew density
        const candidates = Array.from(document.querySelectorAll('div, table, article, td, span'));
        let bestTextEl: HTMLElement | null = null;
        let maxHebrewCount = 0;

        candidates.forEach(el => {
            // Ignore navigation/menus
            if (el.closest('nav') || el.className.includes('menu') || el.className.includes('sidebar')) return;
            
            const txt = (el as HTMLElement).innerText;
            if (txt.length < 50) return;

            const hebrewCount = (txt.match(/[\u0590-\u05FF]/g) || []).length;
            const linkCount = el.querySelectorAll('a').length;
            
            // "Content" usually has many Hebrew chars per link. 
            // "Index" usually has few Hebrew chars per link (just titles).
            const ratio = linkCount > 0 ? hebrewCount / linkCount : hebrewCount;

            if (hebrewCount > 100 && ratio > 50) {
                if (hebrewCount > maxHebrewCount) {
                    maxHebrewCount = hebrewCount;
                    bestTextEl = el as HTMLElement;
                }
            }
        });

        // 2. Check for "Next" Button (Linear Navigation)
        // Look for links with "<<" or "Next" or specific classes
        const nextLinkEl = Array.from(document.querySelectorAll('a')).find(a => 
            a.innerText.includes('<<') || // Standard Hebrew Next
            a.innerText.includes('הבא') || 
            (a.innerText.includes('>>') && document.dir !== 'rtl') // Fallback
        );
        const nextUrl = nextLinkEl ? (nextLinkEl as HTMLAnchorElement).href : null;


        // 3. Check for Index Links (The "Folder" View)
        const subLinks = Array.from(document.querySelectorAll('a'))
            .map(a => ({ text: a.innerText.trim(), href: a.href }))
            .filter(l => 
                l.href.includes('/books/') && 
                !excludeList.includes(l.href) &&
                l.href !== currentUrl &&
                l.text.length > 0 &&
                !l.text.includes('דף הבית') &&
                !l.text.includes('הקודם') &&
                !l.text.includes('הבא') &&
                !l.text.includes('<<') &&
                !l.text.includes('>>')
            );

        // DECISION:
        if (bestTextEl) {
            return { type: 'CONTENT', text: bestTextEl.innerText, nextUrl };
        }
        if (subLinks.length > 0) {
            return { type: 'INDEX', links: subLinks };
        }
        return { type: 'EMPTY' };

    }, excludeUrls);
}

// --- The "Surf" Mode (Linear Crawl) ---
async function surfLinear(page: Page, startUrl: string, bookId: string, baseTitle: string, startSeq: number) {
    let currentUrl: string | null = startUrl;
    let sequence = startSeq;

    console.log(`      🏄 Starting Linear Surf from: ${baseTitle}`);

    while (currentUrl) {
        try {
            await page.goto(currentUrl, { waitUntil: 'networkidle2' });
            
            // Re-analyze just to get text and next link
            const analysis = await analyzePage(page, []); // No exclude list needed for surf
            
            if (analysis.type === 'CONTENT' && analysis.text) {
                // Title is tricky in linear mode, we append sequence
                const title = `${baseTitle} - Part ${sequence}`; 
                
                const chapId = await getOrInsertChapter(bookId, title, currentUrl, sequence);
                const count = await insertSegments(chapId, analysis.text);
                console.log(`        📄 Saved Part ${sequence} (${count} segments)`);
                
                sequence++;
                
                // MOVE TO NEXT
                if (analysis.nextUrl && analysis.nextUrl !== currentUrl) {
                    currentUrl = analysis.nextUrl;
                } else {
                    console.log("        🛑 End of Book (No 'Next' link found).");
                    currentUrl = null;
                }
            } else {
                console.log("        ⚠️ Lost the text trail. Stopping surf.");
                currentUrl = null;
            }

        } catch (e) {
            console.error(`Error surfing: ${e}`);
            currentUrl = null;
        }
    }
}


// --- The "Drill" Mode (Recursive Search) ---
async function drillRecursive(
    page: Page, 
    url: string, 
    bookId: string, 
    breadcrumbPath: string[], 
    sidebarUrls: string[],
    visitedUrls: Set<string>
) {
    if (visitedUrls.has(url)) return;
    visitedUrls.add(url);

    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        
        const analysis = await analyzePage(page, sidebarUrls);

        if (analysis.type === 'CONTENT') {
            // FOUND TEXT! Switch to Surf Mode.
            console.log(`    🎯 Hit content at: ${breadcrumbPath.join(' > ')}`);
            
            // We launch the linear surfer starting here
            await surfLinear(page, url, bookId, breadcrumbPath.slice(1).join(' - '), 1);
            
            // After surfing, we DO NOT continue recursion for this branch
            // because the surfer theoretically covered the whole book from this point.
            return; 

        } else if (analysis.type === 'INDEX' && analysis.links) {
            console.log(`    📂 Index: ${breadcrumbPath.slice(-1)[0]} (${analysis.links.length} items)`);
            
            // Drill down into children
            // Important: We need to update sidebarUrls to include THIS page's links
            // so we don't accidentally click back to them? 
            // Actually, visitedUrls handles that.
            
            for (const link of analysis.links) {
                await drillRecursive(
                    page, 
                    link.href, 
                    bookId, 
                    [...breadcrumbPath, link.text], 
                    sidebarUrls, 
                    visitedUrls
                );
                
                // If we returned from a successful surf, we might want to stop? 
                // Depends if the book has multiple disjoint sections. 
                // For safety, we let it continue exploring other folders.
            }
        }

    } catch (e) {
        console.error(`Error drilling: ${e}`);
    }
}

// --- Main ---

async function runScraper() {
  console.log("🚀 Starting Hybrid Drill-and-Surf Scraper...");
  
  const browser = await puppeteer.launch({ 
      headless: false, 
      defaultViewport: null, 
      args: ['--start-maximized'] 
  });
  const page = await browser.newPage();

  try {
    // 1. Get Sidebar (Global Ignore List)
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    const sidebarLinks = await page.evaluate(() => 
        Array.from(document.querySelectorAll('a'))
            .filter(a => a.href.includes('/books/'))
            .map(a => a.href)
    );
    // Add Base URL
    sidebarLinks.push(BASE_URL);

    // Get Authors
    const authors = await page.evaluate(() => 
        Array.from(document.querySelectorAll('a'))
             .map(a => ({ text: a.innerText.trim(), href: a.href }))
             .filter(l => l.href.includes('/books/') && l.text.length > 2 && !l.text.includes('בית'))
    );

    console.log(`Found ${authors.length} Authors.`);

    for (const author of authors) {
        console.log(`\n👤 Author: ${author.text}`);
        const authorId = await getOrInsertAuthor(author.text, author.href);

        // Go to Author Page
        await page.goto(author.href, { waitUntil: 'networkidle2' });
        
        // Get Books
        // We filter out links that are in the GLOBAL sidebar list
        const books = await page.evaluate((sidebar) => 
            Array.from(document.querySelectorAll('a'))
                .map(a => ({ text: a.innerText.trim(), href: a.href }))
                .filter(l => l.href.includes('/books/') && !sidebar.includes(l.href) && l.text.length > 2),
            sidebarLinks
        );

        console.log(`   Found ${books.length} Books.`);

        for (const book of books) {
            const bookId = await getOrInsertBook(authorId, book.text, book.href);
            
            // Create a visited set for this book
            const visited = new Set<string>();
            // Note: We DO NOT add book.href to visited here. 
            // We let the recursive function handle it.
            
            // Start Drilling
            await drillRecursive(
                page, 
                book.href, 
                bookId, 
                [book.text], 
                sidebarLinks, // Pass global sidebar to ignore
                visited
            );
        }
    }

  } catch (error) {
    console.error("Fatal:", error);
  } finally {
    console.log("Done.");
  }
}

runScraper();