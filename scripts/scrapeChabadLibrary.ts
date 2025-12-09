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

// --- Database Helpers ---
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
  const { data: newChap } = await supabase.from('chapters').insert({ book_id: bookId, title: fullPathTitle, sequence_number: sequence, original_link: url }).select('id').single();
  return newChap?.id;
}

async function insertSegments(chapterId: string, segments: string[]) {
  let seq = 1;
  const rowsToInsert = [];
  for (const seg of segments) {
    if (seg.length < 2) continue;
    if (!/[\u0590-\u05FF]/.test(seg) && !/^[0-9*\[\]()]+$/.test(seg)) continue; 
    rowsToInsert.push({ chapter_id: chapterId, sequence_number: seq, hebrew_text: seg });
    seq++;
  }
  if (rowsToInsert.length > 0) {
      await supabase.from('segments').insert(rowsToInsert);
  }
  return rowsToInsert.length;
}

// --- VERBOSE ANALYSIS LOGIC ---
// --- VERBOSE ANALYSIS LOGIC (STRICT) ---
async function analyzePage(page: Page, excludeUrls: string[]) {
    return page.evaluate((excludeList) => {
        const currentUrl = window.location.href;
        const pageTitle = document.title || '';

        // 1. Aggressive DOM Cleaning (Before Analysis)
        // We clone the body so we don't break the page interaction
        const clone = document.body.cloneNode(true) as HTMLElement;
        
        // Remove known navigation/menu elements
        const junkSelectors = [
            'nav', 'header', 'footer', '.menu', '.sidebar', '.breadcrumbs', 
            '.toc', '#toc', 'ul', 'ol' // Remove lists entirely to see what real text remains
        ];
        junkSelectors.forEach(sel => {
            const els = clone.querySelectorAll(sel);
            els.forEach(e => e.remove());
        });

        // Remove divs that look like menus (contain keywords)
        const allDivs = clone.querySelectorAll('div, span, p');
        allDivs.forEach(el => {
            const txt = (el as HTMLElement).innerText || '';
            if (txt.includes('ספרי הבעל שם טוב') && txt.includes('ספרי הרב המגיד')) el.remove();
            if (txt.includes('דף הבית') && txt.includes('תוכן העניינים')) el.remove();
        });

        // 2. Text Content Detection on CLEANED DOM
        // Now that menus are gone, is there any text left?
        const candidates = Array.from(clone.querySelectorAll('div, table, article, td, span, p'));
        let bestTextEl: HTMLElement | null = null;
        let maxHebrewCount = 0;
        let diagnosticLog = "";

        candidates.forEach(el => {
            const txt = (el as HTMLElement).innerText;
            if (txt.length < 50) return;

            const hebrewCount = (txt.match(/[\u0590-\u05FF]/g) || []).length;
            const linkCount = el.querySelectorAll('a').length; // Should be low in content
            
            // KEY CHANGE: High Hebrew count, LOW link count
            // A page of text might have 5 footnotes (links), but 2000 chars.
            // An index might have 50 links and 1000 chars.
            const isContent = hebrewCount > 100 && (linkCount === 0 || hebrewCount / linkCount > 50);

            if (isContent) {
                if (hebrewCount > maxHebrewCount) {
                    maxHebrewCount = hebrewCount;
                    bestTextEl = el as HTMLElement;
                    diagnosticLog = `Found candidate: ${hebrewCount} chars, ${linkCount} links`;
                }
            }
        });

        // 3. Re-Clean the Best Element for Extraction
        let cleanedSegments: string[] = [];
        if (bestTextEl) {
            let rawText = bestTextEl.innerText;
            // Remove navigation artifacts
            rawText = rawText.replace(/^.*?(?:<<|>>)\s*([א-ת]{1,4}(-[\u05D0-\u05EA])?)?(\s+)?/s, ''); 
            cleanedSegments = rawText.split(/\n/).map(s => s.trim()).filter(s => s.length > 0);
        }

        // 4. Index Links (Use the original document, not the cleaned clone)
        const allAnchors = Array.from(document.querySelectorAll('a'));
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

        // DECISION LOGIC
        if (cleanedSegments.length > 0) {
            return { type: 'CONTENT', segments: cleanedSegments, nextUrl: null, pageTitle, diag: diagnosticLog };
        }
        
        // If we didn't find text content, do we have links?
        if (subLinks.length > 0) {
            return { type: 'INDEX', links: subLinks, diag: `Found ${subLinks.length} links` };
        }
        
        return { type: 'EMPTY', diag: "No text or links found" };

    }, excludeUrls);
}

// --- Recursive Driller (Test Mode) ---
async function drillRecursive(
    page: Page, 
    url: string, 
    bookId: string, 
    breadcrumbPath: string[], 
    sidebarUrls: string[],
    visitedUrls: Set<string>,
    depth: number
) {
    if (visitedUrls.has(url)) return;
    if (depth > 4) return; // Prevent deep spirals in test

    const indent = " ".repeat(depth * 2);
    // console.log(`${indent}Visiting: ${url}`);
    
    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        const analysis = await analyzePage(page, sidebarUrls);

        if (analysis.type === 'CONTENT') {
            console.log(`${indent}🎯 HIT CONTENT! (${analysis.segments.length} lines)`);
            console.log(`${indent}   Preview: ${analysis.segments[0].substring(0, 50)}...`);
            
            // SAVE IT
            const title = breadcrumbPath.join(' - ');
            const chapId = await getOrInsertChapter(bookId, title, url, 1);
            await insertSegments(chapId, analysis.segments);
            console.log(`${indent}   ✅ Saved to DB.`);
            
            // In test mode, we stop after finding content in this branch
            return; 

        } else if (analysis.type === 'INDEX') {
            console.log(`${indent}📂 Index (${analysis.links.length} items). Drilling...`);
            visitedUrls.add(url);

            // --- SMART LINK SELECTOR FOR TEST ---
            // Don't just take the first link (it might be "Haskama" which is tricky).
            // Try to find "Aleph" or "Beis" or a mid-range link to ensure we hit meat.
            let linksToTry = analysis.links;
            
            // Prefer links that are short (likely chapters "Aleph") over long titles
            const contentLinks = linksToTry.filter(l => l.text.length < 10);
            
            if (contentLinks.length > 0) {
                // Take the 5th one if available (middle of the pack), or the 1st
                const targetIndex = contentLinks.length > 4 ? 4 : 0;
                linksToTry = [contentLinks[targetIndex]];
                console.log(`${indent}   👉 Jumping to likely content: "${linksToTry[0].text}"`);
            } else {
                // Fallback to first 2 links
                linksToTry = linksToTry.slice(0, 2);
            }

            for (const link of linksToTry) {
                await drillRecursive(
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
             console.log(`${indent}⚠️ Empty/Unknown Page. (${analysis.diag})`);
             visitedUrls.add(url);
        }
    } catch (e: any) {
        console.error(`${indent}Error: ${e.message}`);
    }
}

async function runScraper() {
  console.log("🚀 Starting SMART DIAGNOSTIC Test...");
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null, args: ['--start-maximized'] });
  const page = await browser.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    const sidebarLinks = await page.evaluate(() => 
        Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('/books/')).map(a => a.href)
    );
    sidebarLinks.push(BASE_URL);

    let authors = await page.evaluate(() => 
        Array.from(document.querySelectorAll('a'))
             .map(a => ({ text: a.innerText.trim(), href: a.href }))
             .filter(l => l.href.includes('/books/') && l.text.length > 2 && !l.text.includes('בית'))
    );

    // Test specific authors: Baal Shem Tov (0), Alter Rebbe (3)
    authors = authors.filter((_, i) => [0, 3].includes(i)); 

    console.log(`Testing ${authors.length} Authors.`);

    for (const author of authors) {
        console.log(`\n👤 AUTHOR: ${author.text}`);
        const authorId = await getOrInsertAuthor(author.text, author.href);
        await page.goto(author.href, { waitUntil: 'networkidle2' });
        
        // Find books
        let books = await page.evaluate((sidebar) => 
            Array.from(document.querySelectorAll('a'))
                .map(a => ({ text: a.innerText.trim(), href: a.href }))
                .filter(l => l.href.includes('/books/') && !sidebar.includes(l.href) && l.text.length > 2),
            sidebarLinks
        );

        // Test only 2 books per author
        books = books.slice(0, 2);

        for (const book of books) {
            console.log(`  📖 BOOK: ${book.text}`);
            const bookId = await getOrInsertBook(authorId, book.text, book.href);
            const visited = new Set<string>();
            
            await drillRecursive(page, book.href, bookId, [book.text], sidebarLinks, visited, 1);
        }
    }

  } catch (error) { console.error("Fatal:", error); } 
  finally { console.log("🏁 Done."); }
}

runScraper();