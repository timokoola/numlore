// Slim search index for the home-page typeahead. Emitted at build time;
// served from the origin as a static asset. Stays small enough to avoid
// inlining bloat (~one record per curated entry plus category and system
// pages). A larger dictionary-backed index will be loaded from the
// compiled artifacts in a follow-up.

import type { APIRoute } from 'astro';
import { listAllCurated } from '../lib/entries';
import { listCategories } from '../lib/categories';

export const prerender = true;

interface IndexRow {
  id: string;
  display: string;
  type: 'number' | 'word' | 'category' | 'system';
  path: string;
  keywords?: string;
}

export const GET: APIRoute = async () => {
  const rows: IndexRow[] = [];

  for (const e of listAllCurated()) {
    rows.push({
      id: e.id,
      display: e.display,
      type: e.type,
      path: e.type === 'number' ? `/n/${encodeURIComponent(e.id)}` : `/w/${encodeURIComponent(e.id)}`,
      keywords: e.mappings.map((m) => m.to).join(' '),
    });
  }

  for (const c of listCategories()) {
    rows.push({
      id: c.slug,
      display: c.title,
      type: 'category',
      path: `/c/${c.slug}`,
      keywords: c.description,
    });
  }

  const systems: Array<{ slug: string; title: string }> = [
    { slug: 'major', title: 'The Major System' },
    { slug: 'keypad', title: 'T9 phone keypad' },
    { slug: 'leet', title: 'Leet (1337-speak)' },
    { slug: 'cultural', title: 'Cultural references' },
  ];
  for (const s of systems) {
    rows.push({ id: s.slug, display: s.title, type: 'system', path: `/systems/${s.slug}` });
  }

  return new Response(JSON.stringify(rows), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
    },
  });
};
