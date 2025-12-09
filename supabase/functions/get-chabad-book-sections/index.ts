import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookUrl } = await req.json();

    if (!bookUrl) {
      return new Response(JSON.stringify({ error: 'bookUrl is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log(`Fetching book sections/links from: ${bookUrl}`);
    const response = await fetch(bookUrl);
    if (!response.ok) {
      console.error(`Failed to fetch book URL: ${response.statusText}`);
      return new Response(JSON.stringify({ error: `Failed to fetch book URL: ${response.statusText}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      });
    }

    const html = await response.text();
    const parser = new DOMParser();
    const document = parser.parseFromString(html, 'text/html');

    if (!document) {
      console.error('Failed to parse HTML');
      return new Response(JSON.stringify({ error: 'Failed to parse HTML' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Even broader selectors to find any meaningful <a> tags within the main content
    const allLinks = document.querySelectorAll(
      'main a, ' + // Any link within the main content area
      'div.content a, ' + // General content div
      'div.book-content a, ' +
      'div#text_content a, ' +
      'article.main-text a, ' +
      '.text-body a, ' +
      'ul.book-toc a, ' +
      'nav.toc a' // Added nav.toc for table of contents
    );
    
    console.log(`Found ${allLinks.length} potential links on the page with broad selectors.`);

    const linksData: { title: string; url: string }[] = [];

    allLinks.forEach((link) => {
      const title = link.textContent?.trim();
      const url = (link as HTMLAnchorElement).href;
      
      // Filter out empty titles, empty URLs, and internal anchor links (e.g., #top)
      if (title && url && url.length > 1 && !url.startsWith('#')) {
        // Ensure the URL is absolute
        const absoluteUrl = new URL(url, bookUrl).href;
        linksData.push({ title, url: absoluteUrl });
      }
    });

    console.log(`Extracted ${linksData.length} filtered links with title and URL.`);
    
    if (linksData.length === 0) {
        console.log("No links found after filtering. Full HTML content for debugging:");
        console.log(html); // Log the full HTML if no links are found
    }

    return new Response(JSON.stringify({ links: linksData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in get-chabad-book-sections Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});