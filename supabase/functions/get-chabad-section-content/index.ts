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
    const { sectionUrl } = await req.json();

    if (!sectionUrl) {
      return new Response(JSON.stringify({ error: 'sectionUrl is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const response = await fetch(sectionUrl);
    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch section URL: ${response.statusText}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      });
    }

    const html = await response.text();
    const parser = new DOMParser();
    const document = parser.parseFromString(html, 'text/html');

    if (!document) {
      return new Response(JSON.stringify({ error: 'Failed to parse HTML' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // --- ASSUMPTIONS FOR CHABADLIBRARY.ORG SECTION CONTENT STRUCTURE ---
    // Adjust these selectors based on the actual HTML structure of chabadlibrary.org
    const titleElement = document.querySelector('h1.book-title, h2.section-title, .book-header h1, .book-header h2');
    const contentElement = document.querySelector('div.book-content, div#text_content, article.main-text, .text-body');

    const title = titleElement?.textContent?.trim() || 'No Title Found';
    // Get innerHTML to preserve formatting like bold, italics, etc.
    const content = contentElement?.innerHTML?.trim() || 'No Content Found';

    return new Response(JSON.stringify({ title, content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in get-chabad-section-content Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});