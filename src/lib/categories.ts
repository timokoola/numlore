// Build-time loader for category definitions under /data/categories/*.yaml.

import { parse } from 'yaml';

export interface Category {
  slug: string;
  title: string;
  description: string;
  includes: string[];
}

const RAW = import.meta.glob('/data/categories/*.yaml', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function loadAll(): Category[] {
  const out: Category[] = [];
  for (const [path, raw] of Object.entries(RAW)) {
    try {
      const parsed = parse(raw) as Category;
      if (!parsed?.slug) {
        console.warn(`categories: skipping malformed file ${path}`);
        continue;
      }
      out.push(parsed);
    } catch (err) {
      console.warn(`categories: failed to parse ${path}`, err);
    }
  }
  return out;
}

const ALL = loadAll();
const BY_SLUG = new Map<string, Category>(ALL.map((c) => [c.slug, c]));

export function getCategory(slug: string): Category | undefined {
  return BY_SLUG.get(slug);
}

export function listCategories(): Category[] {
  return ALL;
}
