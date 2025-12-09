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

// Note: We accept a "Breadcrumb" string for the title to handle deep nesting
// e.g. "Vol 33 - Shelach - Sicha 2"
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
  // Split by common delimiters (newlines, breaks)
  const segments = text.split(/(?:\r\n|\r|\n|<br>)/).map(s => s.trim()).filter(s => s.length > 5);
  
  let seq = 1;
  for (const seg of segments) {
    if (!/[\u0590-\u05FF]/.test(seg)) continue; // Must contain Hebrew
    
    // Check dupe
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
        // 1. Get Text Content Density
        // Find the container with the most Hebrew text
        const candidates = Array.from(document.querySelectorAll('div, table, article, td'));
        let bestTextEl: HTMLElement | null = null;
        let maxHebrewCount = 0;

        candidates.forEach(el => {
            if (el.tagName === 'NAV' || el.className.includes('menu') || el.closest('nav')) return;
            
            // Heuristic: If this element contains many <a> tags, it's likely a container, not text.
            // But we must be careful: some text has footnotes (links).
            // We check the RATIO of Text Length to Link Count.
            
            const txt = (el as HTMLElement).innerText;
            const linkCount = el.querySelectorAll('a').length;
            const hebrewCount = (txt.match(/[\u0590-\u05FF]/g) || []).length;
            
            // If it has good Hebrew density
            if (hebrewCount > maxHebrewCount) {
                // If it's a huge list of links, it's an Index, not content.
                // Threshold: If > 50 chars of text per link, it's probably content. 
                // If < 20 chars of text per link, it's a menu.
                const density = linkCount > 0 ? txt.length / linkCount : 9999;
                
                if (density > 40) { // It's mostly text
                    maxHebrewCount = hebrewCount;
                    bestTextEl = el as HTMLElement;
                }
            }
        });

        // 2. Get Valid Sub-Links (for Index pages)
        const allLinks = Array.from(document.querySelectorAll('a'))
            .map(a => ({ text: a.innerText.trim(), href: a.href }))
            .filter(l => 
                l.href.includes('/books/') && 
                !excludeList.includes(l.href) &&
                l.text.length > 0 &&
                !l.text.includes('דף הבית') &&
                !l.text.includes('הקודם') &&
                !l.text.includes('הבא')
            );

        // DECISION LOGIC
        // If we found a solid block of Hebrew text (> 100 chars), it is Content.
        if (bestTextEl && maxHebrewCount > 100) {
            return { type: 'CONTENT', text: bestTextEl.innerText };
        }
        
        // If we didn't find text, but we found valid links, it is an Index (Table of Contents).
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
    depth: number
) {
    // Indentation for logging based on depth
    const indent = " ".repeat(depth * 2);
    
    // Safety break for deep loops
    if (depth > 10) {
        console.warn(`${indent}⚠️ Max depth reached at ${url}`);
        return;
    }

    console.log(`${indent}📂 Visiting: ${breadcrumbPath.join(' > ')}`);
    
    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        await page.waitForSelector('a', { timeout: 5000 }).catch(() => null);

        // Analyze what we are looking at
        const analysis = await analyzePage(page, Array.from(sidebarUrls));

        if (analysis.type === 'CONTENT' && analysis.text) {
            console.log(`${indent}   📄 Found Text! Saving Chapter...`);
            
            // Combine breadcrumbs for the title: e.g. "Likutei Sichos > Vol 33 > Shelach > Sicha 2"
            // We remove the Author/Book name from the start to keep it clean in the Chapter title if preferred
            const title = breadcrumbPath.slice(1).join(' - '); 
            
            // Generate a deterministic sequence number based on depth and simple hashing or counter
            // For now, we use a placeholder or pass a counter if strictly needed. 
            // We use Date.now() strictly to ensure unique insertion order for this script run
            const chapId = await getOrInsertChapter(bookId, title, url, depth);
            
            const segCount = await insertSegments(chapId, analysis.text);
            console.log(`${indent}   ✅ Saved ${segCount} segments.`);

        } else if (analysis.type === 'INDEX' && analysis.links) {
            console.log(`${indent}   🔎 Found ${analysis.links.length} sub-sections.`);
            
            // Copy links to avoid reference issues
            const linksToVisit = [...analysis.links];
            
            // Limit for testing? Remove the slice for full production run.
            // const limitedLinks = linksToVisit.slice(0, 3); 
            const limitedLinks = linksToVisit; 

            for (const link of limitedLinks) {
                // RECURSION: Dive down!
                await crawlRecursive(
                    page, 
                    link.href, 
                    bookId, 
                    [...breadcrumbPath, link.text], // Add current link text to breadcrumbs
                    sidebarUrls, 
                    depth + 1
                );
            }
        } else {
            console.log(`${indent}   ⚠️ Empty or irrelevant page.`);
        }

    } catch (e: any) {
        console.error(`${indent}🔥 Error visiting ${url}: ${e.message}`);
    }
}


// --- Main Entry Point ---

async function runScraper() {
  console.log("🚀 Starting Recursive 'Infinite Depth' Scraper...");
  
  const browser = await puppeteer.launch({ 
      headless: false, 
      defaultViewport: null, 
      args: ['--start-maximized'] 
  });
  const page = await browser.newPage();

  try {
    // 1. Load Homepage to map the Sidebar (to ignore it later)
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('a');

    const authorLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
            .map(a => ({ text: a.innerText.trim(), href: a.href }))
            .filter(l => l.href.includes('/books/') && l.text.length > 2);
    });
    
    // The Sidebar blacklist
    const sidebarUrls = new Set(authorLinks.map(a => a.href));
    sidebarUrls.add(BASE_URL);

    console.log(`Found ${authorLinks.length} Authors.`);

    // 2. Iterate Authors
    for (const author of authorLinks) {
        if (author.text.includes('דף הבית')) continue;
        
        console.log(`\n👤 Processing Author: ${author.text}`);
        const authorId = await getOrInsertAuthor(author.text, author.href);

        // Go to Author Page
        await page.goto(author.href, { waitUntil: 'networkidle2' });
        await page.waitForSelector('a');

        // Find Books
        const bookLinks = await page.evaluate((excludeList) => {
            return Array.from(document.querySelectorAll('a'))
                .map(a => ({ text: a.innerText.trim(), href: a.href }))
                .filter(l => 
                    l.href.includes('/books/') && 
                    !excludeList.includes(l.href) &&
                    l.text.length > 2
                );
        }, Array.from(sidebarUrls));

        console.log(`   Found ${bookLinks.length} Books for ${author.text}`);

        // 3. Iterate Books and START RECURSION
        for (const book of bookLinks) {
            // Check if this book link is actually just a sidebar link we missed
            if (sidebarUrls.has(book.href)) continue;

            const bookId = await getOrInsertBook(authorId, book.text, book.href);
            
            // Add Author Page to sidebar exclusion for the context of this book
            const contextSidebar = new Set(sidebarUrls);
            contextSidebar.add(author.href);

            // 🚀 LAUNCH RECURSIVE CRAWLER
            await crawlRecursive(
                page, 
                book.href, 
                bookId, 
                [book.text], // Initial breadcrumb is Book Name
                contextSidebar, 
                1 // Start depth
            );
        }
    }

  } catch (error) {
    console.error("Fatal Error:", error);
  } finally {
    console.log("Done.");
    // await browser.close();
  }
}

runScraper();