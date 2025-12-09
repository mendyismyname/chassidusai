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

    console.log(`Fetching book sections from: ${bookUrl}`);
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

    // Refined selectors to find section links within common content containers
    const sectionLinks = document.querySelectorAll(
      'div.book-content a[href*=".html"], ' +
      'div#text_content a[href*=".html"], ' +
      'article.main-text a[href*=".html"], ' +
      '.text-body a[href*=".html"], ' +
      'ul.book-toc a[href*=".html"]' // Added a specific TOC selector
    );
    
    console.log(`Found ${sectionLinks.length} potential section links.`);

    const sections: { title: string; url: string }[] = [];

    sectionLinks.forEach((link) => {
      const title = link.textContent?.trim();
      const url = (link as HTMLAnchorElement).href;
      if (title && url) {
        // Ensure the URL is absolute
        const absoluteUrl = new URL(url, bookUrl).href;
        sections.push({ title, url: absoluteUrl });
      }
    });

    console.log(`Extracted ${sections.length} sections.`);
    return new Response(JSON.stringify({ sections }), {
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