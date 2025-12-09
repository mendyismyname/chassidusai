import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TANYA_BASE_URL = 'https://chabadlibrary.org/books/3400000000';

// Helper for Hebrew Gematria (simple conversion for single letters and common two-letter combinations)
const hebrewToNumber: { [key: string]: number } = {
  'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
  'יא': 11, 'יב': 12, 'יג': 13, 'יד': 14, 'טו': 15, 'טז': 16, 'יז': 17, 'יח': 18, 'יט': 19, 'כ': 20,
  'כא': 21, 'כב': 22, 'כג': 23, 'כד': 24, 'כה': 25, 'כו': 26, 'כז': 27, 'כח': 28, 'כט': 29, 'ל': 30,
  'לא': 31, 'לב': 32, 'לג': 33, 'לד': 34, 'לה': 35, 'לו': 36, 'לז': 37, 'לח': 38, 'לט': 39, 'מ': 40,
  'מא': 41, 'מב': 42, 'מג': 43, 'מד': 44, 'מה': 45, 'מו': 46, 'מז': 47, 'מח': 48, 'מט': 49, 'נ': 50,
  'נא': 51, 'נב': 52, 'נג': 53, // Likutei Amarim has 53 chapters
};

function getChapterNumberFromLabel(label: string): number {
  const match = label.match(/פרק\s+([\u05D0-\u05EA]{1,3})/); // Matches "פרק" followed by 1-3 Hebrew letters
  if (match && match[1]) {
    const hebrewNum = match[1];
    return hebrewToNumber[hebrewNum] || 0; // Return 0 if not found
  }
  return 0;
}

async function fetchAndParse(url: string): Promise<Document | null> {
  console.log(`Fetching: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Failed to fetch ${url}: ${response.statusText}`);
    return null;
  }
  const html = await response.text();
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

async function scrapeTanya() {
  const result: any[] = [];

  console.log("Starting Level 1: Scraping Tanya Index...");
  const indexDoc = await fetchAndParse(TANYA_BASE_URL);
  if (!indexDoc) {
    throw new Error("Failed to fetch Tanya index page.");
  }

  const sectionLinks = indexDoc.querySelectorAll('div#text_content a');
  const sectionsToScrape = [];

  const SECTION_TITLES_DEFINITIONS = [
    { hebrew: 'ליקוטי אמרים', order: 1 },
    { hebrew: 'שער היחוד והאמונה', order: 2 },
    { hebrew: 'אגרת התשובה', order: 3 },
    { hebrew: 'אגרת הקדש', order: 4 },
    { hebrew: 'קונטרס אחרון', order: 5 },
  ];

  for (const sectionTitleDef of SECTION_TITLES_DEFINITIONS) {
    for (const link of sectionLinks) {
      const title = link.textContent?.trim();
      const url = (link as HTMLAnchorElement).href;
      if (title && url && title.includes(sectionTitleDef.hebrew)) {
        sectionsToScrape.push({
          section_title: sectionTitleDef.hebrew,
          section_order: sectionTitleDef.order,
          url: new URL(url, TANYA_BASE_URL).href, // Ensure absolute URL
        });
        break; // Found the link for this section, move to next
      }
    }
  }

  // Sort sections by order to match the desired output
  sectionsToScrape.sort((a, b) => a.section_order - b.section_order);
  console.log(`Found ${sectionsToScrape.length} main sections.`);

  for (const section of sectionsToScrape) {
    console.log(`Starting Level 2: Scraping chapters for section "${section.section_title}" (${section.url})...`);
    const sectionResult: any = {
      section_title: section.section_title,
      section_order: section.section_order,
      chapters: [],
    };

    const sectionDoc = await fetchAndParse(section.url);
    if (!sectionDoc) {
      console.error(`Failed to fetch section page: ${section.url}`);
      continue;
    }

    const chapterLinks = sectionDoc.querySelectorAll('div#text_content a');
    const chaptersToScrape = [];

    for (const link of chapterLinks) {
      const label = link.textContent?.trim();
      const url = (link as HTMLAnchorElement).href;
      // Filter for actual chapter links (e.g., "פרק א") and not navigation (e.g., "הבא", "הקודם")
      if (label && url && label.startsWith('פרק') && !label.includes('הבא') && !label.includes('הקודם')) {
        chaptersToScrape.push({
          chapter_label: label,
          chapter_number: getChapterNumberFromLabel(label),
          url: new URL(url, section.url).href, // Resolve relative URL
        });
      }
    }

    // Sort chapters by number
    chaptersToScrape.sort((a, b) => a.chapter_number - b.chapter_number);
    console.log(`Found ${chaptersToScrape.length} chapters for "${section.section_title}".`);

    for (const chapter of chaptersToScrape) {
      console.log(`Starting Level 3: Scraping content for chapter "${chapter.chapter_label}" (${chapter.url})...`);
      const chapterDoc = await fetchAndParse(chapter.url);
      if (!chapterDoc) {
        console.error(`Failed to fetch chapter page: ${chapter.url}`);
        continue;
      }

      let content = '';
      const contentDiv = chapterDoc.querySelector('div#text_content');
      if (contentDiv) {
        // Iterate through children to get text, filter out navigation/title elements
        // Heuristic: Collect text from <p dir="rtl"> elements that are not clearly navigation/titles
        for (const child of contentDiv.children) {
          // Exclude the first <p> which often contains the chapter title/breadcrumbs
          // and any <p> that contains only links (likely navigation)
          if (child.tagName === 'P' && child.getAttribute('dir') === 'rtl' && !child.querySelector('a')) {
            let paragraphHtml = child.innerHTML;
            // Remove inline styles
            paragraphHtml = paragraphHtml.replace(/style="[^"]*"/g, '');
            // Replace <br> with space to keep sentences flowing, then normalize spaces
            paragraphHtml = paragraphHtml.replace(/<br\s*\/?>/g, ' ').replace(/\s+/g, ' ').trim();
            if (paragraphHtml) { // Only add if not empty after cleaning
              content += paragraphHtml + '\n\n'; // Add double newline for paragraph separation
            }
          }
        }
      }
      
      sectionResult.chapters.push({
        chapter_number: chapter.chapter_number,
        chapter_label: chapter.chapter_label,
        content: content.trim(),
      });
    }
    result.push(sectionResult);
  }
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const tanyaData = await scrapeTanya();
    return new Response(JSON.stringify(tanyaData, null, 2), { // Pretty print JSON
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in scrape-tanya Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});