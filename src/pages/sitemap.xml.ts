// Sitemap. Curated + notable URLs only — longtail (algorithmic 5–6 digit
// pages) are deliberately excluded per the indexability rules.

import type { APIRoute } from 'astro';
import { listCuratedWordIds } from '../lib/entries';
import { listCategories } from '../lib/categories';
import { listPrebuiltNumberIds } from '../lib/mnemonics';

export const prerender = true;

const STATIC_PATHS = ['/', '/about', '/credits', '/privacy', '/submit', '/systems', '/n', '/w', '/c'];
const SYSTEM_SLUGS = ['major', 'keypad', 'leet', 'cultural'];

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL('https://numlore.com')).origin;

  const urls: string[] = [];
  urls.push(...STATIC_PATHS);
  urls.push(...SYSTEM_SLUGS.map((s) => `/systems/${s}`));
  urls.push(...listCategories().map((c) => `/c/${c.slug}`));
  urls.push(...listCuratedWordIds().map((w) => `/w/${encodeURIComponent(w)}`));
  urls.push(...listPrebuiltNumberIds().map((n) => `/n/${encodeURIComponent(n)}`));

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((path) => `  <url><loc>${xmlEscape(origin + path)}</loc></url>`).join('\n') +
    '\n</urlset>\n';

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
