import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

// --- Supabase Configuration ---
// Ensure these environment variables are set in your shell or a .env file
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'; // Replace with your Supabase URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY'; // Replace with your Service Role Key

if (supabaseUrl === 'YOUR_SUPABASE_URL' || supabaseServiceRoleKey === 'YOUR_SUPABASE_SERVICE_ROLE_KEY') {
  console.error("ERROR: Supabase URL or Service Role Key not configured. Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false, // No session persistence needed for a script
  },
});

// --- Constants ---
const BASE_URL = 'https://chabadlibrary.org/books/';
const SLEEP_TIME_MS = 1000; // 1 second delay between requests

// --- Helper for Hebrew Gematria (simple conversion for single letters and common two-letter combinations) ---
const hebrewToNumber: { [key: string]: number } = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
  'יא': 11, 'יב': 12, 'יג': 13, 'יד': 14, 'טו': 15, 'טז': 16, 'יז': 17, 'יח': 18, 'יט': 19, 'כ': 20,
  'כא': 21, 'כב': 22, 'כג': 23, 'כד': 24, 'כה': 25, 'כו': 26, 'כז': 27, 'כח': 28, 'כט': 29, 'ל': 30,
  'לא': 31, 'לב': 32, 'לג': 33, 'לד': 34, 'לה': 35, 'לו': 36, 'לז': 37, 'לח': 38, 'לט': 39, 'מ': 40,
  'מא': 41, 'מב': 42, 'מג': 43, 'מד': 44, 'מה': 45, 'מו': 46, 'מז': 47, 'מח': 48, 'מט': 49, 'נ': 50,
  'נא': 51, 'נב': 52, 'נג': 53, // Likutei Amarim has 53 chapters
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
  const { error } = await supabase
    .from('scraping_errors')
    .insert({
      url,
      error_message: errorMessage,
      stack_trace: stackTrace,
      level,
    });
  if (error) {
    console.error('Failed to log scraping error:', error);
  }
}

async function fetchPage(url: string): Promise<cheerio.CheerioAPI | null> {
  console.log(`Fetching: ${url}`);
  await sleep(SLEEP_TIME_MS); // Rate limiting

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = `HTTP error! Status: ${response.status} - ${response.statusText}`;
      await logError(url, errorText, 'fetch');
      return null;
    }

    // Attempt to decode with cp1255 if content-type suggests it or if it looks like mojibake
    const contentType = response.headers.get('content-type');
    let htmlBuffer: Buffer;
    if (contentType && (contentType.includes('charset=windows-1255') || contentType.includes('charset=iso-8859-8'))) {
      htmlBuffer = await response.buffer();
      const decodedHtml = iconv.decode(htmlBuffer, 'cp1255');
      return cheerio.load(decodedHtml);
    } else {
      // Try UTF-8 first, then fallback to cp1255 if it seems like mojibake
      const text = await response.text();
      // Simple heuristic for mojibake: check for common replacement characters or non-UTF8 patterns
      if (text.includes('�') || !/[\u0590-\u05FF]/.test(text)) { // If contains replacement char or no Hebrew
        console.warn(`Potential mojibake detected for ${url}, attempting cp1255 decode.`);
        htmlBuffer = await response.buffer();
        const decodedHtml = iconv.decode(htmlBuffer, 'cp1255');
        return cheerio.load(decodedHtml);
      }
      return cheerio.load(text);
    }
  } catch (e: any) {
    await logError(url, e.message, 'fetch', e.stack);
    return null;
  }
}

function cleanText(html: string): string {
  // Remove inline styles
  let cleaned = html.replace(/style="[^"]*"/g, '');
  // Replace &nbsp; with a regular space
  cleaned = cleaned.replace(/&nbsp;/g, ' ');
  // Remove other common HTML entities (e.g., &quot;, &amp;)
  cleaned = cheerio.load(cleaned).text(); // Use cheerio to decode entities
  return cleaned.trim();
}

// --- Scraper Logic ---

async function scrapeChabadLibrary() {
  console.log("Starting Chabad Library Scraper...");

  // Level 1: Main Index (Authors/Categories)
  const $ = await fetchPage(BASE_URL);
  if (!$) {
    console.error("Failed to fetch main index page. Exiting.");
    return;
  }

  const authorSections = $('div#text_content > h2'); // Assuming H2 elements are author/category titles
  console.log(`Found ${authorSections.length} potential author sections.`);

  for (const authorH2 of authorSections.toArray()) {
    const authorName = $(authorH2).text().trim();
    if (!authorName) continue;

    let authorId: string | null = null;
    try {
      // Check if author already exists
      let { data: existingAuthor, error: fetchAuthorError } = await supabase
        .from('authors')
        .select('id')
        .eq('name', authorName)
        .single();

      if (fetchAuthorError && fetchAuthorError.code !== 'PGRST116') { // PGRST116 means no rows found
        throw fetchAuthorError;
      }

      if (existingAuthor) {
        authorId = existingAuthor.id;
        console.log(`Author "${authorName}" already exists with ID: ${authorId}`);
      } else {
        const { data, error } = await supabase
          .from('authors')
          .insert({ name: authorName, original_link: null }) // original_link might not be available for authors
          .select('id')
          .single();
        if (error) throw error;
        authorId = data.id;
        console.log(`Inserted author: "${authorName}" with ID: ${authorId}`);
      }
    } catch (e: any) {
      await logError(BASE_URL, `Error processing author "${authorName}": ${e.message}`, 'author', e.stack);
      continue;
    }

    if (!authorId) continue;

    // Level 2: Book Index for this author
    let currentElement = $(authorH2).next();
    while (currentElement.length > 0 && !currentElement.is('h2')) {
      if (currentElement.is('ul')) {
        const bookLinks = currentElement.find('li > a');
        console.log(`Found ${bookLinks.length} books for author "${authorName}".`);

        for (const bookLink of bookLinks.toArray()) {
          const bookTitle = $(bookLink).text().trim();
          const bookUrl = $(bookLink).attr('href');

          if (!bookTitle || !bookUrl) continue;

          const absoluteBookUrl = new URL(bookUrl, BASE_URL).href;
          let bookId: string | null = null;

          try {
            // Check if book already exists
            let { data: existingBook, error: fetchBookError } = await supabase
              .from('books')
              .select('id')
              .eq('original_link', absoluteBookUrl)
              .single();

            if (fetchBookError && fetchBookError.code !== 'PGRST116') {
              throw fetchBookError;
            }

            if (existingBook) {
              bookId = existingBook.id;
              console.log(`Book "${bookTitle}" already exists with ID: ${bookId}`);
            } else {
              const { data, error } = await supabase
                .from('books')
                .insert({
                  author_id: authorId,
                  title: bookTitle,
                  category: authorName, // Use author name as category for now
                  original_link: absoluteBookUrl,
                })
                .select('id')
                .single();
              if (error) throw error;
              bookId = data.id;
              console.log(`Inserted book: "${bookTitle}" with ID: ${bookId}`);
            }
          } catch (e: any) {
            await logError(absoluteBookUrl, `Error processing book "${bookTitle}": ${e.message}`, 'book', e.stack);
            continue;
          }

          if (!bookId) continue;

          // Level 3: Table of Contents (Chapters)
          const bookPage$ = await fetchPage(absoluteBookUrl);
          if (!bookPage$) {
            await logError(absoluteBookUrl, `Failed to fetch book page for "${bookTitle}"`, 'chapter_index');
            continue;
          }

          const chapterLinks = bookPage$('div#text_content a, div.book-content a, ul.book-toc a, nav.toc a');
          console.log(`Found ${chapterLinks.length} potential chapter links for book "${bookTitle}".`);

          let chapterSequence = 0;
          for (const chapterLink of chapterLinks.toArray()) {
            const chapterLabel = $(chapterLink).text().trim();
            const chapterUrl = $(chapterLink).attr('href');

            // Filter out navigation links and ensure it looks like a chapter
            if (!chapterLabel || !chapterUrl || chapterLabel.length > 20 || chapterLabel.includes('הבא') || chapterLabel.includes('הקודם')) {
              continue;
            }

            const absoluteChapterUrl = new URL(chapterUrl, absoluteBookUrl).href;
            const chapterNumber = getChapterNumberFromLabel(chapterLabel);
            if (chapterNumber === 0 && !chapterLabel.includes('הקדמה')) { // Only skip if it's not a recognized chapter number and not an introduction
                continue;
            }
            chapterSequence++; // Increment sequence for all valid chapters

            let chapterId: string | null = null;
            try {
              // Check if chapter already exists
              let { data: existingChapter, error: fetchChapterError } = await supabase
                .from('chapters')
                .select('id')
                .eq('original_link', absoluteChapterUrl)
                .single();

              if (fetchChapterError && fetchChapterError.code !== 'PGRST116') {
                throw fetchChapterError;
              }

              if (existingChapter) {
                chapterId = existingChapter.id;
                console.log(`Chapter "${chapterLabel}" already exists with ID: ${chapterId}`);
              } else {
                const { data, error } = await supabase
                  .from('chapters')
                  .insert({
                    book_id: bookId,
                    title: chapterLabel,
                    sequence_number: chapterNumber || chapterSequence, // Use parsed number or general sequence
                    original_link: absoluteChapterUrl,
                  })
                  .select('id')
                  .single();
                if (error) throw error;
                chapterId = data.id;
                console.log(`Inserted chapter: "${chapterLabel}" with ID: ${chapterId}`);
              }
            } catch (e: any) {
              await logError(absoluteChapterUrl, `Error processing chapter "${chapterLabel}": ${e.message}`, 'chapter', e.stack);
              continue;
            }

            if (!chapterId) continue;

            // Level 4: The Content (Segments)
            const chapterContentPage$ = await fetchPage(absoluteChapterUrl);
            if (!chapterContentPage$) {
              await logError(absoluteChapterUrl, `Failed to fetch chapter content for "${chapterLabel}"`, 'segment_content');
              continue;
            }

            const contentDiv = chapterContentPage$('div#text_content, div.book-content, article.main-text, .text-body').first();
            if (contentDiv.length === 0) {
              await logError(absoluteChapterUrl, `Could not find main content div for chapter "${chapterLabel}"`, 'segment_content');
              continue;
            }

            const rawHtml = contentDiv.html();
            if (!rawHtml) {
                await logError(absoluteChapterUrl, `Empty HTML content for chapter "${chapterLabel}"`, 'segment_content');
                continue;
            }

            // Segmenting logic: Split by <p>, <br>, or </div>
            const segments = rawHtml.split(/(<p[^>]*>|<\/p>|<br\s*\/?>|<\/div>)/i);
            let segmentSequence = 0;
            for (const segmentHtml of segments) {
              const cleanedSegment = cleanText(segmentHtml);
              if (cleanedSegment.length > 5) { // Only insert meaningful segments
                segmentSequence++;
                try {
                  // Check for existing segment to prevent duplicates on re-runs
                  const { data: existingSegment, error: fetchSegmentError } = await supabase
                    .from('segments')
                    .select('id')
                    .eq('chapter_id', chapterId)
                    .eq('sequence_number', segmentSequence)
                    .single();

                  if (fetchSegmentError && fetchSegmentError.code !== 'PGRST116') {
                    throw fetchSegmentError;
                  }

                  if (!existingSegment) {
                    const { error } = await supabase
                      .from('segments')
                      .insert({
                        chapter_id: chapterId,
                        sequence_number: segmentSequence,
                        hebrew_text: cleanedSegment,
                      });
                    if (error) throw error;
                    // console.log(`Inserted segment ${segmentSequence} for chapter "${chapterLabel}"`);
                  } else {
                    // console.log(`Segment ${segmentSequence} for chapter "${chapterLabel}" already exists.`);
                  }
                } catch (e: any) {
                  await logError(absoluteChapterUrl, `Error inserting segment ${segmentSequence} for chapter "${chapterLabel}": ${e.message}`, 'segment', e.stack);
                }
              }
            }
          }
        }
      }
      currentElement = currentElement.next();
    }
  }

  console.log("Scraping complete!");
}

// Run the scraper
scrapeChabadLibrary().catch(console.error);