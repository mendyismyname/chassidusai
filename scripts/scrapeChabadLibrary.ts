import { createClient } from '@supabase/supabase-js';
import puppeteer, { Browser, Page } from 'puppeteer';

// --- Configuration ---
const BASE_URL = 'https://chabadlibrary.org/books/';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes('YOUR_')) {
  console.error("❌ Error: Supabase credentials missing. Check your .env file.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// --- Helpers ---
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Simple gematria helper for Chapter numbers (can be expanded)
const hebrewToNumber: { [key: string]: number } = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
  'יא': 11, 'יב': 12, 'יג': 13, 'יד': 14, 'טו': 15, 'טז': 16, 'יז': 17, 'יח': 18, 'יט': 19, 'כ': 20
};

// --- Database Functions ---

async function getOrInsertAuthor(name: string, url: string) {
  const { data: existing } = await supabase.from('authors').select('id').eq('name', name).single();
  if (existing) return existing.id;

  const { data, error } = await supabase.from('authors').insert({ name, original_link: url }).select('id').single();
  if (error) throw error;
  return data.id;
}

async function getOrInsertBook(authorId: string, title: string, url: string) {
  const { data: existing } = await supabase.from('books').select('id').eq('original_link', url).single();
  if (existing) return existing.id;

  const { data, error } = await supabase.from('books').insert({ 
    author_id: authorId, 
    title, 
    category: 'General', 
    original_link: url 
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

async function getOrInsertChapter(bookId: string, title: string, url: string, sequence: number) {
  const { data: existing } = await supabase.from('chapters').select('id').eq('original_link', url).single();
  if (existing) return existing.id;

  const { data, error } = await supabase.from('chapters').insert({
    book_id: bookId,
    title,
    sequence_number: sequence,
    original_link: url
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

async function insertSegments(chapterId: string, text: string) {
  // Split by common delimiters to create "segments"
  // We split by newlines or specific end-of-sentence markers if needed
  const segments = text.split(/\n+/).map(s => s.trim()).filter(s => s.length > 5);
  
  let seq = 1;
  for (const segText of segments) {
    // Check for dupes (optional, but good for restartability)
    const { data: existing } = await supabase
      .from('segments')
      .select('id')
      .eq('chapter_id', chapterId)
      .eq('sequence_number', seq)
      .single();

    if (!existing) {
      await supabase.from('segments').insert({
        chapter_id: chapterId,
        sequence_number: seq,
        hebrew_text: segText
      });
    }
    seq++;
  }
  return seq - 1; // Return count
}

// --- Scraping Logic ---

async function scrapeContent(page: Page, chapterId: string, url: string) {
  console.log(`      Parsing content...`);
  // The content is usually in a generic container. 
  // Strategy: Find the element with the most Hebrew text.
  
  const content = await page.evaluate(() => {
    // Helper to count Hebrew chars
    const countHebrew = (str: string) => (str.match(/[\u0590-\u05FF]/g) || []).length;
    
    // Select candidates (divs, tables, articles)
    const candidates = Array.from(document.querySelectorAll('div, table, article, .text-content'));
    let bestEl = null;
    let maxScore = 0;

    candidates.forEach(el => {
      // Ignore nav elements
      if (el.tagName === 'NAV' || el.classList.contains('menu')) return;
      
      const txt = (el as HTMLElement).innerText;
      const score = countHebrew(txt);
      
      // We want high Hebrew count, but we also want to avoid huge parents (like "body") 
      // if a smaller child has the same content.
      // Simple heuristic: Max Hebrew count.
      if (score > maxScore) {
        maxScore = score;
        bestEl = el;
      }
    });

    return bestEl ? (bestEl as HTMLElement).innerText : null;
  });

  if (content) {
    const count = await insertSegments(chapterId, content);
    console.log(`      ✅ Saved ${count} segments.`);
  } else {
    console.warn(`      ⚠️ No content found for ${url}`);
  }
}

async function processBook(page: Page, bookId: string, bookUrl: string) {
  console.log(`  📖 Processing Book: ${bookUrl}`);
  await page.goto(bookUrl, { waitUntil: 'networkidle2' });
  await page.waitForSelector('a', { timeout: 10000 }).catch(() => null);

  // Extract Chapters
  const chapters = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .map(a => ({ text: a.innerText.trim(), href: a.href }))
      .filter(link => {
        // Filter logic: Must have href, usually contains Hebrew or "Chapter"
        // And is inside the books domain
        return link.href.includes('/books/') && link.text.length > 0 && link.text.length < 50;
      });
  });

  // Filter out Nav links ("Next", "Home", etc.)
  const validChapters = chapters.filter(c => 
    !c.text.includes('דף הבית') && 
    !c.text.includes('הקודם') && 
    !c.text.includes('הבא')
  );

  console.log(`    Found ${validChapters.length} potential chapters.`);
  
  let seq = 1;
  // Limit to first 3 chapters for testing? Remove .slice() for production
  for (const chap of validChapters) {
    const chapNum = hebrewToNumber[chap.text.split(' ')[1]] || seq; // Try to parse "Perek Aleph"
    console.log(`    Processing Chapter ${seq}: ${chap.text}`);
    
    try {
      const chapId = await getOrInsertChapter(bookId, chap.text, chap.href, seq);
      
      // Navigate to Chapter
      await page.goto(chap.href, { waitUntil: 'networkidle2' });
      await sleep(1000); // Let Angular render text
      
      await scrapeContent(page, chapId, chap.href);
      
      // Go back to book index is inefficient, so we just loop and goto next URL directly
    } catch (err: any) {
      console.error(`    ❌ Failed chap ${chap.text}: ${err.message}`);
    }
    seq++;
    await sleep(1000); // Be polite
  }
}

async function runScraper() {
  console.log("🚀 Starting Puppeteer Scraper for Chabad Library...");
  
  // Launch Browser (Visible for debugging)
  const browser = await puppeteer.launch({ 
    headless: false, // Set to "new" or true for background run
    defaultViewport: { width: 1280, height: 800 }
  });
  const page = await browser.newPage();

  try {
    // 1. Main Index
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    // Wait for Angular to hydrate
    await page.waitForSelector('a', { timeout: 15000 });

    // Extract Authors
    const authors = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => ({ text: a.innerText.trim(), href: a.href }))
        .filter(link => 
          link.href.includes('/books/') && 
          // Check for numeric ID pattern common for Authors (100000000, etc)
          // or just generally looks like a category link
          link.text.includes('ספרי')
        );
    });

    console.log(`Found ${authors.length} Authors/Categories.`);

    for (const author of authors) {
      console.log(`\n👤 Processing Author: ${author.text}`);
      const authorId = await getOrInsertAuthor(author.text, author.href);
      
      // 2. Go to Author Page
      await page.goto(author.href, { waitUntil: 'networkidle2' });
      await page.waitForSelector('a', { timeout: 10000 }).catch(() => null);

      // Extract Books
      const books = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
          .map(a => ({ text: a.innerText.trim(), href: a.href }))
          .filter(link => 
            link.href.includes('/books/') && 
            link.text.length > 2 &&
            !link.text.includes('דף הבית') // exclude home link
          );
      });

      console.log(`  Found ${books.length} Books.`);
      
      // Process each book
      for (const book of books) {
        // Skip if it's just a nav link back to main list
        if (book.href === BASE_URL) continue;

        const bookId = await getOrInsertBook(authorId, book.text, book.href);
        await processBook(page, bookId, book.href);
        
        // Return to Author page not needed since we navigate by URL
      }
    }

  } catch (error) {
    console.error("🔥 Fatal Scraper Error:", error);
  } finally {
    await browser.close();
    console.log("🏁 Scraper finished.");
  }
}

runScraper();