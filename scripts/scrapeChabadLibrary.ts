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
  const segments = text.split(/(?:\r\n|\r|\n|<br>)/).map(s => s.trim()).filter(s => s.length > 5);
  let seq = 1;
  for (const seg of segments) {
    if (!/[\u0590-\u05FF]/.test(seg)) continue;
    
    // Simple dedupe check
    const { data } = await supabase.from('segments').select('id').eq('chapter_id', chapterId).eq('sequence_number', seq).single();
    if (!data) {
        await supabase.from('segments').insert({ chapter_id: chapterId, sequence_number: seq, hebrew_text: seg });
    }
    seq++;
  }
  return seq - 1;
}

// --- The Brain: Page Analyzer ---

type PageType = 'CONTENT' | 'INDEX' | 'EMPTY';
interface PageAnalysis {
    type: PageType;
    text?: string;
    links?: { text: string; href: string }[];
}

async function analyzePage(page: Page, excludeUrls: string[]): Promise<PageAnalysis> {
    return page.evaluate((excludeList) => {
        const currentUrl = window.location.href;

        // 1. Text Analysis (Is this a content page?)
        const candidates = Array.from(document.querySelectorAll('div, table, article, td, span'));
        let bestTextEl: HTMLElement | null = null;
        let maxHebrewCount = 0;

        candidates.forEach(el => {
            if (el.tagName === 'NAV' || el.className.includes('menu') || el.closest('nav')) return;
            
            const txt = (el as HTMLElement).innerText;
            const linkCount = el.querySelectorAll('a').length;
            const hebrewCount = (txt.match(/[\u0590-\u05FF]/g) || []).length;
            
            if (hebrewCount > maxHebrewCount) {
                // If text length per link is high, it's content. If low, it's a menu.
                const density = linkCount > 0 ? txt.length / linkCount : 9999;
                if (density > 50) { 
                    maxHebrewCount = hebrewCount;
                    bestTextEl = el as HTMLElement;
                }
            }
        });

        // 2. Link Analysis (Is this a navigation page?)
        const allLinks = Array.from(document.querySelectorAll('a'))
            .map(a => ({ text: a.innerText.trim(), href: a.href }))
            .filter(l => 
                l.href.includes('/books/') && 
                !excludeList.includes(l.href) &&
                l.href !== currentUrl && // CRITICAL: Do not link to self
                l.text.length > 0 &&
                !l.text.includes('דף הבית') &&
                !l.text.includes('הקודם') &&
                !l.text.includes('הבא') &&
                !l.text.includes('תוכן העניינים') // Ignore "Table of Contents" header links
            );

        // --- Decision ---
        // If solid block of Hebrew found (> 100 chars), prioritize Content
        if (bestTextEl && maxHebrewCount > 100) {
            return { type: 'CONTENT', text: bestTextEl.innerText };
        }
        
        // Otherwise, if we have valid links, it's an Index
        if (allLinks.length > 0) {
            return { type: 'INDEX', links: allLinks };
        }

        return { type: 'EMPTY' };

    }, excludeUrls);
}


// --- The Recursive Walker ---

async function crawlRecursive(
    page: Page, 
    url: string, 
    bookId: string, 
    breadcrumbPath: string[], 
    sidebarUrls: Set<string>,
    visitedUrls: Set<string>, // <-- NEW: History tracker
    depth: number
) {
    const indent = " ".repeat(depth * 2);
    
    // 1. Cycle Detection
    if (visitedUrls.has(url)) {
        // console.log(`${indent}🔄 Skipping visited URL: ${url}`);
        return;
    }
    visitedUrls.add(url); // Mark as visited

    if (depth > 10) {
        console.warn(`${indent}⚠️ Max depth reached at ${url}`);
        return;
    }

    console.log(`${indent}📂 Visiting: ${breadcrumbPath.join(' > ')}`);
    
    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        await page.waitForSelector('a', { timeout: 5000 }).catch(() => null);

        const analysis = await analyzePage(page, Array.from(sidebarUrls));

        if (analysis.type === 'CONTENT' && analysis.text) {
            console.log(`${indent}   📄 Found Text! Saving Chapter...`);
            const title = breadcrumbPath.slice(1).join(' - '); 
            
            // We use Date.now() + Depth to ensure sequence, or pass a counter if you prefer
            const chapId = await getOrInsertChapter(bookId, title, url, depth * 100);
            const count = await insertSegments(chapId, analysis.text);
            console.log(`${indent}   ✅ Saved ${count} segments.`);

        } else if (analysis.type === 'INDEX' && analysis.links) {
            // Filter: Ensure we don't visit links we've ALREADY visited in this chain
            const uniqueLinks = analysis.links.filter(l => !visitedUrls.has(l.href));

            if (uniqueLinks.length === 0) {
                console.log(`${indent}   🛑 No new links found (End of branch).`);
                return;
            }

            console.log(`${indent}   🔎 Found ${uniqueLinks.length} sub-sections.`);
            
            // Limit links for testing? Remove .slice() for production!
            // const linksToProcess = uniqueLinks.slice(0, 3);
            const linksToProcess = uniqueLinks;

            for (const link of linksToProcess) {
                // Pass the 'visitedUrls' set down the recursion
                // Note: We share the SAME Set object so history is global for this book
                await crawlRecursive(
                    page, 
                    link.href, 
                    bookId, 
                    [...breadcrumbPath, link.text], 
                    sidebarUrls, 
                    visitedUrls,
                    depth + 1
                );
            }
        } else {
            console.log(`${indent}   ⚠️ Empty page.`);
        }

    } catch (e: any) {
        console.error(`${indent}🔥 Error: ${e.message}`);
    }
}


// --- Main Entry Point ---

async function runScraper() {
  console.log("🚀 Starting Recursive Scraper (Loop Fixed)...");
  
  const browser = await puppeteer.launch({ 
      headless: false, 
      defaultViewport: null, 
      args: ['--start-maximized'] 
  });
  const page = await browser.newPage();

  try {
    // 1. Map Sidebar
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('a');

    const authorLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
            .map(a => ({ text: a.innerText.trim(), href: a.href }))
            .filter(l => l.href.includes('/books/') && l.text.length > 2);
    });
    
    const sidebarUrls = new Set(authorLinks.map(a => a.href));
    sidebarUrls.add(BASE_URL);

    console.log(`Found ${authorLinks.length} Authors.`);

    // 2. Process Authors
    for (const author of authorLinks) {
        if (author.text.includes('דף הבית')) continue;
        
        console.log(`\n👤 Processing Author: ${author.text}`);
        const authorId = await getOrInsertAuthor(author.text, author.href);

        await page.goto(author.href, { waitUntil: 'networkidle2' });
        await page.waitForSelector('a');

        // 3. Process Books
        const bookLinks = await page.evaluate((excludeList) => {
            return Array.from(document.querySelectorAll('a'))
                .map(a => ({ text: a.innerText.trim(), href: a.href }))
                .filter(l => 
                    l.href.includes('/books/') && 
                    !excludeList.includes(l.href) &&
                    l.text.length > 2
                );
        }, Array.from(sidebarUrls));

        console.log(`   Found ${bookLinks.length} Books.`);

        for (const book of bookLinks) {
            if (sidebarUrls.has(book.href)) continue;

            const bookId = await getOrInsertBook(authorId, book.text, book.href);
            
            const contextSidebar = new Set(sidebarUrls);
            contextSidebar.add(author.href);

            // Create a fresh visited set for this book
            const visitedUrls = new Set<string>();
            visitedUrls.add(book.href); // Mark book index as visited immediately

            await crawlRecursive(
                page, 
                book.href, 
                bookId, 
                [book.text], 
                contextSidebar, 
                visitedUrls, // Pass the history tracker
                1
            );
        }
    }

  } catch (error) {
    console.error("Fatal Error:", error);
  } finally {
    console.log("Done.");
  }
}

runScraper();