import puppeteer from 'puppeteer';

const BASE_URL = 'https://chabadlibrary.org/books/';

async function scrapeWithPuppeteer() {
  console.log("Launching Headless Browser...");
  
  const browser = await puppeteer.launch({ 
    headless: "new" // Run in background
  });
  const page = await browser.newPage();

  try {
    console.log(`Navigating to ${BASE_URL}...`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for the specific container that holds the books list
    // We wait for ANY anchor tag to appear to ensure the App has hydrated
    await page.waitForSelector('a', { timeout: 10000 });

    console.log("Page loaded. Extracting data...");

    // Run this function INSIDE the browser context
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors
        .map(a => ({
          text: a.innerText.trim(),
          href: a.href
        }))
        .filter(link => link.text.length > 2 && link.href.includes('/books/'));
    });

    console.log(`Found ${links.length} links!`);
    
    // Print first 5 to verify they are real books
    console.log(links.slice(0, 5));

  } catch (error) {
    console.error("Scraping failed:", error);
  } finally {
    await browser.close();
  }
}

scrapeWithPuppeteer();