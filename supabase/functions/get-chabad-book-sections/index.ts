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

    // Select all <a> tags within common content containers
    // This is a broader selection to capture more links for inspection
    const allLinks = document.querySelectorAll(
      'div.book-content a, ' +
      'div#text_content a, ' +
      'article.main-text a, ' +
      '.text-body a, ' +
      'ul.book-toc a, ' +
      'div.content a' // Added a more general content div selector
    );
    
    console.log(`Found ${allLinks.length} potential links on the page.`);

    const linksData: { title: string; url: string }[] = [];

    allLinks.forEach((link) => {
      const title = link.textContent?.trim();
      const url = (link as HTMLAnchorElement).href;
      if (title && url) {
        // Ensure the URL is absolute
        const absoluteUrl = new URL(url, bookUrl).href;
        linksData.push({ title, url: absoluteUrl });
      }
    });

    console.log(`Extracted ${linksData.length} links with title and URL.`);
    return new Response(JSON.stringify({ links: linksData }), { // Changed 'sections' to 'links'
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