// Runtime mnemonics lookup. Resolves a number or word to its mappings and
// tier (curated, notable, longtail).
//
// This module is intentionally side-effect-free at module load. Curated and
// notable data is read from the compiled artifacts under
// data/dictionaries/compiled/ which are produced by scripts/dictionary/build.ts
// and committed.

export type System = 'cultural' | 'major' | 'keypad' | 'leet';
export type Tier = 'curated' | 'notable' | 'longtail';

export interface Mapping {
  system: System;
  to: string;
  note?: string;
}

export interface NumberResult {
  number: string;
  tier: Tier;
  summary: string;
  mappings: Mapping[];
}

export interface WordResult {
  word: string;
  tier: Tier;
  summary: string;
  mappings: Mapping[];
}

export interface CategoryResult {
  slug: string;
  title: string;
  description: string;
  includes: string[];
}

export async function resolveNumber(raw: string): Promise<NumberResult> {
  const number = raw.trim();
  // Placeholder resolver — will be replaced by a real lookup against
  // data/entries/, scripts/notable.ts, and data/dictionaries/compiled/.
  return {
    number,
    tier: 'longtail',
    summary: `Lookup view for the number ${number}.`,
    mappings: [],
  };
}

export async function resolveWord(raw: string): Promise<WordResult> {
  const word = raw.trim().toLowerCase();
  return {
    word,
    tier: 'longtail',
    summary: `Lookup view for the word "${word}".`,
    mappings: [],
  };
}

export async function listCategorySlugs(): Promise<string[]> {
  return [];
}

export async function loadCategory(slug: string): Promise<CategoryResult> {
  return {
    slug,
    title: slug,
    description: 'Category page placeholder.',
    includes: [],
  };
}
