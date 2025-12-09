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

async function insertSegments(chapterId: string, segments: string[]) {
  let seq = 1;
  const rowsToInsert = [];

  for (const seg of segments) {
    if (seg.length < 2) continue;
    // Allow Hebrew or special markers (footnotes *, numbers)
    if (!/[\u0590-\u05FF]/.test(seg) && !/^[0-9*\[\]()]+$/.test(seg)) continue; 
    
    rowsToInsert.push({
        chapter_id: chapterId,
        sequence_number: seq,
        hebrew_text: seg
    });
    seq++;
  }

  if (rowsToInsert.length > 0) {
      const { error } = await supabase.from('segments').insert(rowsToInsert);
      if (error) console.error("Database Insert Error:", error.message);
  }
  return rowsToInsert.length;
}

// --- Analysis Logic (The Brain) ---
type PageType = 'CONTENT' | 'INDEX' | 'EMPTY';

async function analyzePage(page: Page, excludeUrls: string[]) {
    return page.evaluate((excludeList) => {
        const currentUrl = window.location.href;
        const pageTitle = document.title || '';

        // 1. Aggressive DOM Cleaning (Clone & Strip)
        // We work on a clone so we don't break the actual page navigation
        const clone = document.body.cloneNode(true) as HTMLElement;
        
        // Remove structural junk
        const junkSelectors = [
            'nav', 'header', 'footer', 
            '.menu', '.sidebar', '.breadcrumbs', '#path',
            '.toc', '#toc', 'ul', 'ol' // Remove lists to avoid confusing Index pages with Content
        ];
        junkSelectors.forEach(sel => {
            const els = clone.querySelectorAll(sel);
            els.forEach(e => e.remove());
        });

        // Remove divs that look like menus based on keywords
        const allDivs = clone.querySelectorAll('div, span, p');
        allDivs.forEach(el => {
            const txt = (el as HTMLElement).innerText || '';
            if (txt.includes('ספרי הבעל שם טוב') && txt.includes('ספרי הרב המגיד')) el.remove();
            if (txt.includes('דף הבית') || txt.includes('תוכן העניינים')) el.remove();
        });

        // Remove Headers & Separators
        const headers = clone.querySelectorAll('h1, h2, h3, h4, h5, h6, hr');
        headers.forEach(h => h.remove());

        // 2. Content Detection on Cleaned DOM
        const candidates = Array.from(clone.querySelectorAll('div, table, article, td, span, p'));
        let bestTextEl: HTMLElement | null = null;
        let maxHebrewCount = 0;

        candidates.forEach(el => {
            const txt = (el as HTMLElement).innerText;
            if (txt.length < 50) return;

            const hebrewCount = (txt.match(/[\u0590-\u05FF]/g) || []).length;
            const linkCount = el.querySelectorAll('a').length; 
            
            // KEY LOGIC: Content has lots of Hebrew and very few links.
            // Index pages have lots of links relative to text.
            const ratio = linkCount > 0 ? hebrewCount / linkCount : hebrewCount;
            
            if (hebrewCount > 100 && ratio > 50) { 
                if (hebrewCount > maxHebrewCount) {
                    maxHebrewCount = hebrewCount;
                    bestTextEl = el as HTMLElement;
                }
            }
        });

        // 3. Final Text Polish
        let cleanedSegments: string[] = [];
        if (bestTextEl) {
            let rawText = bestTextEl.innerText;
            // Remove artifacts: arrows + optional page numbers (e.g., >>25b or >>Aleph)
            rawText = rawText.replace(/^.*?(?:<<|>>)\s*([א-ת]{1,4}(-[\u05D0-\u05EA])?)?(\s+)?/s, ''); 
            cleanedSegments = rawText.split(/\n/).map(s => s.trim()).filter(s => s.length > 0);
        }

        // 4. Navigation & Index Links (From Original Doc)
        const allAnchors = Array.from(document.querySelectorAll('a'));
        
        // Find "Next" Button
        const nextLinkEl = allAnchors.find(a => {
            const t = a.innerText.trim();
            const matchesNext = t.includes('>>') || t.includes('הבא'); 
            const matchesPrev = t.includes('<<') || t.includes('הקודם');
            return matchesNext && !matchesPrev;
        });
        const nextUrl = nextLinkEl ? (nextLinkEl as HTMLAnchorElement).href : null;

        // Find Sub-Links
        const subLinks = allAnchors
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

        // DECISION
        if (cleanedSegments.length > 0) {
            return { type: 'CONTENT', segments: cleanedSegments, nextUrl, pageTitle };
        }
        if (subLinks.length > 0) {
            return { type: 'INDEX', links: subLinks };
        }
        return { type: 'EMPTY' };

    }, excludeUrls);
}

// --- Surf Mode (Linear Reader) ---
async function surfLinear(
    page: Page, 
    startUrl: string, 
    bookId: string, 
    baseTitle: string, 
    startSeq: number,
    globalVisited: Set<string>
) {
    let currentUrl: string | null = startUrl;
    let sequence = startSeq;
    const sessionVisited = new Set<string>(); 

    console.log(`      🏄 Starting Linear Surf from: ${baseTitle}`);

    while (currentUrl) {
        // Cycle Protections
        if (globalVisited.has(currentUrl)) {
             console.log("        🔄 Global visited check. Stopping surf.");
             break;
        }
        if (sessionVisited.has(currentUrl)) {
             console.log("        🔄 Session loop detected. Stopping surf.");
             break;
        }

        globalVisited.add(currentUrl);
        sessionVisited.add(currentUrl);

        try {
            await page.goto(currentUrl, { waitUntil: 'networkidle2' });
            const analysis = await analyzePage(page, []);
            
            if (analysis.type === 'CONTENT' && analysis.segments) {
                // Loop Breaker: If we jump back to "Introduction" after reading a while
                const titleLower = (analysis.pageTitle || '').toLowerCase();
                const isStartPage = titleLower.includes('הסכמה') || titleLower.includes('introduction') || titleLower.includes('חלק ראשון');
                
                if (sequence > 5 && isStartPage) {
                    console.log("        🛑 Loop detected: Back at start. Stopping.");
                    break;
                }

                const title = `${baseTitle} - Part ${sequence}`; 
                const chapId = await getOrInsertChapter(bookId, title, currentUrl, sequence);
                const count = await insertSegments(chapId, analysis.segments);
                console.log(`        📄 Saved Part ${sequence} (${count} segments)`);
                
                sequence++;
                
                if (analysis.nextUrl && analysis.nextUrl !== currentUrl) {
                    currentUrl = analysis.nextUrl;
                } else {
                    console.log("        🛑 End of Book (No 'Next' link found).");
                    currentUrl = null;
                }
            } else {
                console.log("        ⚠️ Lost text content (or hit Index). Stopping surf.");
                currentUrl = null;
            }
        } catch (e) {
            console.error(`Error surfing: ${e}`);
            currentUrl = null;
        }
    }
}

// --- Drill Mode (Recursive Explorer) ---
async function drillRecursive(
    page: Page, 
    url: string, 
    bookId: string, 
    breadcrumbPath: string[], 
    sidebarUrls: string[],
    visitedUrls: Set<string>
) {
    if (visitedUrls.has(url)) return;
    
    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        const analysis = await analyzePage(page, sidebarUrls);

        if (analysis.type === 'CONTENT') {
            console.log(`    🎯 Hit content at: ${breadcrumbPath.join(' > ')}`);
            // Hand off to Linear Surfer
            await surfLinear(page, url, bookId, breadcrumbPath.slice(1).join(' - '), 1, visitedUrls);
            return; 

        } else if (analysis.type === 'INDEX' && analysis.links) {
            console.log(`    📂 Index: ${breadcrumbPath.slice(-1)[0]} (${analysis.links.length} items)`);
            visitedUrls.add(url);

            for (const link of analysis.links) {
                await drillRecursive(
                    page, 
                    link.href, 
                    bookId, 
                    [...breadcrumbPath, link.text], 
                    sidebarUrls, 
                    visitedUrls
                );
            }
        } else {
             visitedUrls.add(url);
        }
    } catch (e) {
        console.error(`Error drilling: ${e}`);
    }
}

// --- Main ---
async function runScraper() {
  console.log("🚀 Starting Golden Master Scraper...");
  
  const browser = await puppeteer.launch({ 
      headless: false, // Set to true for background run
      defaultViewport: null, 
      args: ['--start-maximized'] 
  });
  const page = await browser.newPage();

  try {
    // 1. Initial Setup
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    const sidebarLinks = await page.evaluate(() => 
        Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('/books/')).map(a => a.href)
    );
    sidebarLinks.push(BASE_URL);

    const authors = await page.evaluate(() => 
        Array.from(document.querySelectorAll('a'))
             .map(a => ({ text: a.innerText.trim(), href: a.href }))
             .filter(l => l.href.includes('/books/') && l.text.length > 2 && !l.text.includes('בית'))
    );

    console.log(`Found ${authors.length} Authors.`);

    // 2. Iterate Authors
    for (const author of authors) {
        console.log(`\n👤 Author: ${author.text}`);
        const authorId = await getOrInsertAuthor(author.text, author.href);

        await page.goto(author.href, { waitUntil: 'networkidle2' });
        
        const books = await page.evaluate((sidebar) => 
            Array.from(document.querySelectorAll('a'))
                .map(a => ({ text: a.innerText.trim(), href: a.href }))
                .filter(l => l.href.includes('/books/') && !sidebar.includes(l.href) && l.text.length > 2),
            sidebarLinks
        );

        console.log(`   Found ${books.length} Books.`);

        // 3. Iterate Books
        for (const book of books) {
            const bookId = await getOrInsertBook(authorId, book.text, book.href);
            const visited = new Set<string>();
            
            await drillRecursive(
                page, 
                book.href, 
                bookId, 
                [book.text], 
                sidebarLinks, 
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