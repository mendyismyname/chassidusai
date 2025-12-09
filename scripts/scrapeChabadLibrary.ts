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

// --- INSERT (Now simplified because the input text is cleaner) ---
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

// --- PAGE ANALYSIS (DOM-Based Cleaning) ---
// --- Analysis Logic ---
type PageType = 'CONTENT' | 'INDEX' | 'EMPTY';

async function analyzePage(page: Page, excludeUrls: string[]) {
    return page.evaluate((excludeList) => {
        const currentUrl = window.location.href;

        // 0. Extract Page Title / Breadcrumb for Loop Detection
        // Look for the header path (usually in a specific div or title tag)
        const pageTitle = document.title || '';
        const breadcrumbText = document.querySelector('.breadcrumbs')?.textContent || 
                               document.querySelector('#path')?.textContent || 
                               document.body.innerText.substring(0, 200); // Fallback

        // 1. Text Content
        const candidates = Array.from(document.querySelectorAll('div, table, article, td, span'));
        let bestTextEl: HTMLElement | null = null;
        let maxHebrewCount = 0;

        candidates.forEach(el => {
            if (el.closest('nav') || el.className.includes('menu') || el.className.includes('sidebar')) return;
            const txt = (el as HTMLElement).innerText;
            if (txt.length < 50) return;

            const hebrewCount = (txt.match(/[\u0590-\u05FF]/g) || []).length;
            const linkCount = el.querySelectorAll('a').length;
            const ratio = linkCount > 0 ? hebrewCount / linkCount : hebrewCount;

            if (hebrewCount > 100 && ratio > 30) {
                if (hebrewCount > maxHebrewCount) {
                    maxHebrewCount = hebrewCount;
                    bestTextEl = el as HTMLElement;
                }
            }
        });

        // 2. DOM Cleaning & Extraction
        let cleanedSegments: string[] = [];
        if (bestTextEl) {
            const clone = bestTextEl.cloneNode(true) as HTMLElement;
            const headers = clone.querySelectorAll('h1, h2, h3, h4, h5, h6');
            headers.forEach(h => h.remove());
            const lists = clone.querySelectorAll('ul, ol, nav, .menu, .sidebar, .breadcrumbs');
            lists.forEach(l => l.remove());
            
            const allDivs = clone.querySelectorAll('div, span, p');
            allDivs.forEach(el => {
                const txt = (el as HTMLElement).innerText || '';
                if (txt.includes('ספרי הבעל שם טוב') && txt.includes('ספרי הרב המגיד')) el.remove();
                if (txt.includes('דף הבית') || txt.includes('תוכן העניינים')) el.remove();
            });

            const hrs = clone.querySelectorAll('hr');
            hrs.forEach(hr => hr.remove());

            let rawText = clone.innerText;
            // Robust Artifact Removal: Remove arrows + Chapter letters (e.g. >>Aleph)
            rawText = rawText.replace(/^.*?(?:<<|>>)\s*([א-ת]{1,4}(-[\u05D0-\u05EA])?)?(\s+)?/s, ''); 

            cleanedSegments = rawText.split(/\n/).map(s => s.trim()).filter(s => s.length > 0);
        }

        // 3. Next Button Logic
        const allAnchors = Array.from(document.querySelectorAll('a'));
        const nextLinkEl = allAnchors.find(a => {
            const t = a.innerText.trim();
            const matchesNext = t.includes('>>') || t.includes('הבא'); 
            const matchesPrev = t.includes('<<') || t.includes('הקודם');
            return matchesNext && !matchesPrev;
        });
        const nextUrl = nextLinkEl ? (nextLinkEl as HTMLAnchorElement).href : null;

        // 4. Index Links
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

        if (cleanedSegments.length > 0) {
            return { type: 'CONTENT', segments: cleanedSegments, nextUrl, pageTitle };
        }
        if (subLinks.length > 0) {
            return { type: 'INDEX', links: subLinks };
        }
        return { type: 'EMPTY' };

    }, excludeUrls);
}

// --- Surf Mode ---
// --- Surf Mode (With Loop Protection) ---
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
    const sessionVisited = new Set<string>(); // Local loop protection

    console.log(`      🏄 Starting Linear Surf from: ${baseTitle}`);

    while (currentUrl) {
        // 1. Global History Check
        if (globalVisited.has(currentUrl)) {
             console.log("        🔄 Page already visited (Global). Stopping surf.");
             break;
        }
        
        // 2. Session Loop Check (Immediate Cycle)
        if (sessionVisited.has(currentUrl)) {
             console.log("        🔄 Page loop detected (Session). Stopping surf.");
             break;
        }

        globalVisited.add(currentUrl);
        sessionVisited.add(currentUrl);

        try {
            await page.goto(currentUrl, { waitUntil: 'networkidle2' });
            const analysis = await analyzePage(page, []);
            
            if (analysis.type === 'CONTENT' && analysis.segments) {
                
                // --- 3. LOGIC LOOP CHECK: Did we jump back to the start? ---
                // If we are deep in the book (seq > 5) and the page title contains "Haskama" or "Chelek Rishon" 
                // when we were just in "Hosafos", it's a reset loop.
                const titleLower = (analysis.pageTitle || '').toLowerCase();
                const isStartPage = titleLower.includes('הסכמה') || titleLower.includes('introduction');
                
                if (sequence > 5 && isStartPage) {
                    console.log("        🛑 Loop detected: Jumped back to Introduction. Stopping.");
                    break;
                }
                // -----------------------------------------------------------

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
                console.log("        ⚠️ Text content lost or page is Index. Stopping surf.");
                currentUrl = null;
            }
        } catch (e) {
            console.error(`Error surfing: ${e}`);
            currentUrl = null;
        }
    }
}

// --- Drill Mode ---
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
  console.log("🚀 Starting DOM-Structure Scraper...");
  
  const browser = await puppeteer.launch({ 
      headless: false, 
      defaultViewport: null, 
      args: ['--start-maximized'] 
  });
  const page = await browser.newPage();

  try {
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