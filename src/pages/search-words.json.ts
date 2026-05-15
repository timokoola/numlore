// Public endpoint for the build-time dictionary slice. Re-emits the
// compiled search-words.json so the home-page Search component can lazy-
// fetch it on first input and route arbitrary word hits to /w/<word>.
//
// Roughly 900 KB uncompressed (~250 KB gzipped); deliberately NOT inlined
// into the page bundle. Only the home page loads it, and only after the
// user types.

import type { APIRoute } from 'astro';
import searchWords from '../../data/dictionaries/compiled/search-words.json';

export const prerender = true;

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify(searchWords), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
};
