import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

// --- Supabase Configuration ---
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

if (supabaseUrl === 'YOUR_SUPABASE_URL' || supabaseServiceRoleKey === 'YOUR_SUPABASE_SERVICE_ROLE_KEY') {
  console.error("ERROR: Supabase URL or Service Role Key not configured.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

// --- Constants ---
const BASE_URL = 'https://chabadlibrary.org/books/';
const SLEEP_TIME_MS = 1000;

// --- Helper for Hebrew Gematria ---
const hebrewToNumber: { [key: string]: number } = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
  'יא': 11, 'יב': 12, 'יג': 13, 'יד': 14, 'טו': 15, 'טז': 16, 'יז': 17, 'יח': 18, 'יט': 19, 'כ': 20,
  'כא': 21, 'כב': 22, 'כג': 23, 'כד': 24, 'כה': 25, 'כו': 26, 'כז': 27, 'כח': 28, 'כט': 29, 'ל': 30,
  'לא': 31, 'לב': 32, 'לג': 33, 'לד': 34, 'לה': 35, 'לו': 36, 'לז': 37, 'לח': 38, 'לט': 39, 'מ': 40,
  'מא': 41, 'מב': 42, 'מג': 43, 'מד': 44, 'מה': 45, 'מו': 46, 'מז': 47, 'מח': 48, 'מט': 49, 'נ': 50,
  'נא': 51, 'נב': 52, 'נג': 53,
};

function getChapterNumberFromLabel(label: string): number {
  const match = label.match(/פרק\s+([\u05D0-\u05EA]{1,3})|סימן\s+([\u05D0-\u05EA]{1,3})|אגרת\s+([\u05D0-\u05EA]{1,3})/);
  if (match) {
    const hebrewNum = match[1] || match[2] || match[3];
    return hebrewToNumber[hebrewNum] || 0;
  }
  return 0;
}

// --- Utility Functions ---
async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function logError(url: string, errorMessage: string, level: string, stackTrace?: string) {
  // console.error(`[${level}] Error on ${url}: ${errorMessage}`);
  await supabase.from('scraping_errors').insert({
    url,
    error_message: errorMessage,
    stack_trace: stackTrace,
    level,
  });
}

async function fetchPage(url: string): Promise<cheerio.CheerioAPI | null> {
  console.log(`Fetching: ${url}`);
  await sleep(SLEEP_TIME_MS);

  try {
    // Added User-Agent to look like a real browser
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
        }
    });

    if (!response.ok) {
      const errorText = `HTTP error! Status: ${response.status} - ${response.statusText}`;
      await logError(url, errorText, 'fetch');
      return null;
    }

    const contentType = response.headers.get('content-type');
    let htmlBuffer = await response.buffer();
    let decodedHtml = '';

    // Force decode windows-1255 if detected or if it's likely Hebrew legacy
    if (contentType && (contentType.includes('charset=windows-1255') || contentType.includes('charset=iso-8859-8'))) {
      decodedHtml = iconv.decode(htmlBuffer, 'cp1255');
    } else {
      // Try UTF-8 first
      decodedHtml = htmlBuffer.toString('utf-8');
      // Heuristic: If we see "replacement characters" () or NO Hebrew characters, try cp1255
      if (decodedHtml.includes('') || !/[\u0590-\u05FF]/.test(decodedHtml)) {
        // console.warn(`Potential encoding issue for ${url}, retrying with cp1255...`);
        decodedHtml = iconv.decode(htmlBuffer, 'cp1255');
      }
    }
    
    return cheerio.load(decodedHtml);
  } catch (e: any) {
    await logError(url, e.message, 'fetch', e.stack);
    return null;
  }
}

function cleanText(html: string): string {
  if (!html) return '';
  let cleaned = html.replace(/style="[^"]*"/g, '');
  cleaned = cleaned.replace(/&nbsp;/g, ' ');
  cleaned = cheerio.load(cleaned).text();
  return cleaned.trim();
}

// --- Scraper Logic ---

async function scrapeChabadLibrary() {
  console.log("Starting Chabad Library Scraper...");

  // Level 1: Main Index
  const $ = await fetchPage(BASE_URL);
  if (!$) {
    console.error("Failed to fetch main index page.");
    return;
  }

  // --- FIX: Robust "Discovery" Mode instead of strict selectors ---
  // Find all links that might be authors (usually just links with Hebrew text on the main page)
  const allLinks = $('a').toArray();
  const validAuthorLinks = allLinks.filter(link => {
      const text = $(link).text().trim();
      const href = $(link).attr('href');
      // Must have Hebrew text and a valid link
      return text.length > 3 && /[\u0590-\u05FF]/.test(text) && href && !href.includes('javascript');
  });

  console.log(`Found ${validAuthorLinks.length} potential author/category links.`);

  // Use a Set to avoid processing the same link twice
  const processedUrls = new Set();

  for (const link of validAuthorLinks) {
    const authorName = $(link).text().trim();
    const href = $(link).attr('href');
    if (!href) continue;

    const absoluteAuthorUrl = new URL(href, BASE_URL).href;
    if (processedUrls.has(absoluteAuthorUrl)) continue;
    processedUrls.add(absoluteAuthorUrl);

    // --- Database: Insert Author ---
    let authorId: string | null = null;
    try {
      let { data: existingAuthor } = await supabase
        .from('authors')
        .select('id')
        .eq('name', authorName)
        .single();

      if (existingAuthor) {
        authorId = existingAuthor.id;
      } else {
        const { data, error } = await supabase
          .from('authors')
          .insert({ name: authorName, original_link: absoluteAuthorUrl })
          .select('id')
          .single();
        if (error) throw error;
        authorId = data.id;
        console.log(`>> Processing Author: ${authorName}`);
      }
    } catch (e: any) {
      console.error(`Skipping author ${authorName}: ${e.message}`);
      continue;
    }

    if (!authorId) continue;

    // Level 2: Books (Visit the Author Page)
    const authorPage$ = await fetchPage(absoluteAuthorUrl);
    if (!authorPage$) continue;

    // Look for book links on the author page
    // Strategy: Look for links inside tables or lists
    const bookLinks = authorPage$('table a, ul a, div a').toArray().filter(el => {
        const t = $(el).text().trim();
        const h = $(el).attr('href');
        // Filter out "Home", "Contact", etc. by length or keywords if necessary
        return t.length > 2 && /[\u0590-\u05FF]/.test(t) && h;
    });

    console.log(`   Found ${bookLinks.length} books for ${authorName}`);

    for (const bookLink of bookLinks) {
        const bookTitle = $(bookLink).text().trim();
        const bookHref = $(bookLink).attr('href');
        if (!bookHref) continue;

        const absoluteBookUrl = new URL(bookHref, absoluteAuthorUrl).href;
        if (processedUrls.has(absoluteBookUrl)) continue;
        processedUrls.add(absoluteBookUrl);

        // --- Database: Insert Book ---
        let bookId: string | null = null;
        try {
            let { data: existingBook } = await supabase
              .from('books')
              .select('id')
              .eq('original_link', absoluteBookUrl)
              .single();

            if (existingBook) {
              bookId = existingBook.id;
            } else {
              const { data, error } = await supabase
                .from('books')
                .insert({
                  author_id: authorId,
                  title: bookTitle,
                  category: authorName, 
                  original_link: absoluteBookUrl,
                })
                .select('id')
                .single();
              if (error) throw error;
              bookId = data.id;
              console.log(`   >> Processing Book: ${bookTitle}`);
            }
        } catch (e: any) {
            continue;
        }

        if (!bookId) continue;

        // Level 3 & 4: Chapters and Content
        // (This logic from your original script is mostly good, but we ensure we grab the right links)
        const bookPage$ = await fetchPage(absoluteBookUrl);
        if (!bookPage$) continue;

        const chapterLinks = bookPage$('a').toArray().filter(el => {
            const t = $(el).text().trim();
            // Match Hebrew letters (e.g., 'א', 'ב') or "Chapter X"
            return (t.length < 15 && /[\u0590-\u05FF]/.test(t)) || t.includes('פרק');
        });

        let chapterSequence = 0;
        for (const chapLink of chapterLinks) {
            const chapTitle = $(chapLink).text().trim();
            const chapHref = $(chapLink).attr('href');
            if(!chapHref) continue;

            // Skip navigation links
            if (chapTitle.includes('הבא') || chapTitle.includes('הקודם') || chapTitle.includes('תוכן')) continue;

            const absoluteChapUrl = new URL(chapHref, absoluteBookUrl).href;
            if (processedUrls.has(absoluteChapUrl)) continue;
            processedUrls.add(absoluteChapUrl);
            
            chapterSequence++;

            // --- Database: Insert Chapter ---
            let chapterId: string | null = null;
            try {
                let { data: existingChap } = await supabase.from('chapters').select('id').eq('original_link', absoluteChapUrl).single();
                
                if(existingChap) {
                    chapterId = existingChap.id;
                } else {
                    const { data, error } = await supabase.from('chapters').insert({
                        book_id: bookId,
                        title: chapTitle,
                        sequence_number: chapterSequence,
                        original_link: absoluteChapUrl
                    }).select('id').single();
                    if(error) throw error;
                    chapterId = data.id;
                }
            } catch(e) { continue; }

            if (!chapterId) continue;

            // Level 4: Get Text
            const contentPage$ = await fetchPage(absoluteChapUrl);
            if (!contentPage$) continue;

            // Broader selector for content (tables, divs, spans)
            // We look for the container with the most Hebrew text
            let bestContent = "";
            let maxLen = 0;
            
            contentPage$('body').find('div, table, td').each((i, el) => {
                const text = $(el).text();
                // Check if this element has a lot of Hebrew and isn't just the whole body
                if (text.length > maxLen && text.length < 50000 && /[\u0590-\u05FF]/.test(text)) {
                    // Check density (avoid navigation menus)
                    if (!$(el).find('a').length || text.length > 500) {
                        bestContent = $(el).html() || "";
                        maxLen = text.length;
                    }
                }
            });

            if (!bestContent) continue;

            // Segment and Save
            const segments = bestContent.split(/(<p[^>]*>|<\/p>|<br\s*\/?>|<\/div>|<\/tr>)/i);
            let segSeq = 0;
            for(const seg of segments) {
                const clean = cleanText(seg);
                if (clean.length > 10) { // arbitrary threshold for "real sentence"
                    segSeq++;
                    // Insert segment (fire and forget to speed up)
                    supabase.from('segments').insert({
                        chapter_id: chapterId,
                        sequence_number: segSeq,
                        hebrew_text: clean
                    }).then(({error}) => {
                        if (error && error.code !== '23505') console.error('Seg Error:', error.message);
                    });
                }
            }
            console.log(`      Saved ${segSeq} segments for ${chapTitle}`);
        }
    }
  }
  console.log("Scraping complete!");
}

scrapeChabadLibrary().catch(console.error);