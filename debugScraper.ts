import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import fs from 'fs';

const BASE_URL = 'https://chabadlibrary.org/books/';

async function debugScraper() {
  console.log(`--- DEBUG MODE: Fetching ${BASE_URL} ---`);

  try {
    const response = await fetch(BASE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
      }
    });

    // 1. Check raw response
    console.log(`Status: ${response.status} ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`Raw Body Size: ${buffer.length} bytes`);

    // 2. Try Decoding (Windows-1255 is standard for this site)
    const decodedHtml = iconv.decode(buffer, 'cp1255');
    console.log(`Decoded Preview (First 200 chars):\n${decodedHtml.substring(0, 200)}\n...`);

    // 3. Save to file so you can inspect it visually
    fs.writeFileSync('debug_output.html', decodedHtml);
    console.log(`\nSaved full HTML to 'debug_output.html'. Please open this file in your browser to verify it looks correct.`);

    // 4. Parse with Cheerio
    const $ = cheerio.load(decodedHtml);
    const allLinks = $('a');
    console.log(`\nFound ${allLinks.length} total <a> tags.`);

    // 5. Print the first 10 links found (regardless of filter)
    console.log("\n--- First 10 Links Found ---");
    allLinks.slice(0, 10).each((i, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href');
      console.log(`[${i}] Text: "${text}" | Href: "${href}"`);
    });

  } catch (error) {
    console.error("Fatal Error:", error);
  }
}

debugScraper();