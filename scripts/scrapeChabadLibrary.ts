import { createClient } from '@supabase/supabase-js';
import puppeteer, { Page } from 'puppeteer';

// --- Configuration ---
const BASE_URL = 'https://chabadlibrary.org/books/';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes('YOUR_')) {
  console.error("❌ Error: Supabase credentials missing. Check your .env file.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// --- Helpers ---
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const hebrewToNumber: { [key: string]: number } = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
  'יא': 11, 'יב': 12, 'יג': 13, 'יד': 14, 'טו': 15, 'טז': 16, 'יז': 17, 'יח': 18, 'יט': 19, 'כ': 20
};

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

async function getOrInsertChapter(bookId: string, title: string, url: string, sequence: number) {
  const { data } = await supabase.from('chapters').select('id').eq('original_link', url).single();
  if (data) return data.id;
  const { data: newChap } = await supabase.from('chapters').insert({ book_id: bookId, title, sequence_number: sequence, original_link: url }).select('id').single();
  return newChap?.id;
}

async function insertSegments(chapterId: string, text: string) {
  // Split by typical sentence endings or newlines
  const segments = text.split(/(?:\r\n|\r|\n|<br>)/).map(s => s.trim()).filter(s => s.length > 5);
  let seq = 1;
  for (const seg of segments) {
    const { data } = await supabase.from('segments').select('id').eq('chapter_id', chapterId).eq('sequence_number', seq).single();
    if (!data) {
      await supabase.from('segments').insert({ chapter_id: chapterId, sequence_number: seq, hebrew_text: seg });
    }
    seq++;
  }
  return seq - 1;
}

// --- Visual Debugger ---
async function highlightElement(page: Page, href: string) {
  // Draws a red box around the element being processed so user can see it
  await page.evaluate((url) => {
    const el = document.querySelector(`a[href="${url}"]`);
    if (el) (el as HTMLElement).style.border = '4px solid red';
  }, href);
}

// --- Scraper Logic ---

// Phase 3: Content
async function scrapeContent(page: Page, chapterId: string) {
  console.log(`      📝 Extracting text...`);
  // Find the element with the most Hebrew text that ISN'T the sidebar
  const content = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('div, table, article, td'));
    let bestEl = null;
    let maxCount = 0;
    
    candidates.forEach(el => {
        // Skip small elements or nav bars
        if (el.tagName === 'NAV' || el.className.includes('menu')) return;
        const text = (el as HTMLElement).innerText;
        const hebrewCount = (text.match(/[\u0590-\u05FF]/g) || []).length;
        
        // We want a dense block of Hebrew
        if (hebrewCount > maxCount) {
            maxCount = hebrewCount;
            bestEl = el;
        }
    });
    return bestEl ? (bestEl as HTMLElement).innerText : null;
  });

  if (content) {
    const count = await insertSegments(chapterId, content);
    console.log(`      ✅ Saved ${count} segments.`);
  } else {
    console.warn(`      ⚠️ No text content found.`);
  }
}

// Phase 2: Books
async function processBook(page: Page, bookId: string, bookUrl: string, sidebarUrls: Set<string>) {
  console.log(`  📖 Opening Book: ${bookUrl}`);
  await page.goto(bookUrl, { waitUntil: 'networkidle2' });
  await page.waitForSelector('a', { timeout: 10000 }).catch(() => null);

  // Get all links that are NOT in the sidebar/author list
  const chapters = await page.evaluate((excludeList) => {
    return Array.from(document.querySelectorAll('a'))
      .map(a => ({ text: a.innerText.trim(), href: a.href }))
      .filter(link => {
        const isInternal = link.href.includes('/books/');
        const isNotSidebar = !excludeList.includes(link.href);
        const hasText = link.text.length > 0 && link.text.length < 80;
        return isInternal && isNotSidebar && hasText;
      });
  }, Array.from(sidebarUrls));

  // Additional filter for common UI elements
  const validChapters = chapters.filter(c => 
    !c.text.includes('דף הבית') && !c.text.includes('הקודם') && !c.text.includes('הבא')
  );

  console.log(`    Found ${validChapters.length} chapters.`);
  
  // LIMIT TO 3 CHAPTERS FOR TESTING - REMOVE SLICE FOR PRODUCTION
  let seq = 1;
  for (const chap of validChapters) {
    console.log(`    Processing Chapter ${seq}: ${chap.text}`);
    await highlightElement(page, chap.href); // VISUAL DEBUG
    
    const chapId = await getOrInsertChapter(bookId, chap.text, chap.href, seq);
    
    // Navigate to chapter, scrape, then GO BACK to book page to keep loop valid
    const currentBookPage = page.url();
    await page.goto(chap.href, { waitUntil: 'networkidle2' });
    await sleep(500);
    
    await scrapeContent(page, chapId);
    
    // Go back to the book index to find the next chapter link
    await page.goto(currentBookPage, { waitUntil: 'networkidle2' });
    await page.waitForSelector('a');
    
    seq++;
    if (seq > 3) break; // Remove this break to scrape WHOLE book
  }
}

// Phase 1: Main Loop
async function runScraper() {
  console.log("🚀 Starting Smart Scraper...");
  
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null, args: ['--start-maximized'] });
  const page = await browser.newPage();

  try {
    // 1. Get Global/Sidebar Links (Authors)
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('a');

    const authorLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => ({ text: a.innerText.trim(), href: a.href }))
        .filter(l => l.href.includes('/books/') && l.text.length > 2);
    });

    // We store these URLs to IGNORE them later (so we don't think they are books)
    const sidebarUrls = new Set(authorLinks.map(a => a.href));
    sidebarUrls.add(BASE_URL); // Ignore home link

    console.log(`Found ${authorLinks.length} Authors (Sidebar items).`);

    // 2. Iterate Authors
    for (const author of authorLinks) {
      if (author.text.includes('דף הבית')) continue;

      console.log(`\n👤 Author: ${author.text}`);
      const authorId = await getOrInsertAuthor(author.text, author.href);

      await page.goto(author.href, { waitUntil: 'networkidle2' });
      await page.waitForSelector('a');

      // 3. Find Books (Links present here that were NOT on home page)
      const bookLinks = await page.evaluate((excludeList) => {
        return Array.from(document.querySelectorAll('a'))
          .map(a => ({ text: a.innerText.trim(), href: a.href }))
          .filter(link => 
             link.href.includes('/books/') && 
             link.text.length > 2 && 
             !excludeList.includes(link.href) // CRITICAL: Exclude sidebar items
          );
      }, Array.from(sidebarUrls));

      console.log(`  Found ${bookLinks.length} unique Books.`);

      for (const book of bookLinks) {
        // Double check against sidebar just in case
        if (sidebarUrls.has(book.href)) continue;

        const bookId = await getOrInsertBook(authorId, book.text, book.href);
        
        // Add current author page to ignore list for the next level
        const currentContextUrls = new Set(sidebarUrls);
        currentContextUrls.add(author.href);
        
        await processBook(page, bookId, book.href, currentContextUrls);
        
        // Return to Author Page to continue loop
        await page.goto(author.href, { waitUntil: 'networkidle2' });
        await page.waitForSelector('a');
      }
    }

  } catch (error) {
    console.error("🔥 Error:", error);
  } finally {
    // await browser.close(); // Keep open for debugging
    console.log("Done.");
  }
}

runScraper();