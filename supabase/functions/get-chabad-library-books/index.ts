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
    const libraryUrl = "https://chabadlibrary.org/books/";
    const response = await fetch(libraryUrl);

    if (!response.ok) {
      console.error(`Failed to fetch library URL: ${response.statusText}`);
      return new Response(JSON.stringify({ error: `Failed to fetch library URL: ${response.statusText}` }), {
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

    const booksData: { author: string; title: string; url: string }[] = [];
    const bookListItems = document.querySelectorAll('div.book-list-item');
    console.log(`Found ${bookListItems.length} book-list-item elements.`);

    bookListItems.forEach((item) => {
      const authorElement = item.querySelector('h2');
      const author = authorElement?.textContent?.trim() || 'Unknown Author';

      const bookLinks = item.querySelectorAll('ul > li > a');
      bookLinks.forEach((link) => {
        const title = link.textContent?.trim();
        const url = (link as HTMLAnchorElement).href;
        if (title && url) {
          const absoluteUrl = new URL(url, libraryUrl).href;
          booksData.push({ author, title, url: absoluteUrl });
        }
      });
    });

    console.log(`Extracted ${booksData.length} books.`);
    return new Response(JSON.stringify({ books: booksData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in get-chabad-library-books Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});