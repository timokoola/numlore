// Build-time loader for curated YAML entries.
//
// Entries under /data/entries/*.yaml are inlined into the bundle via Vite's
// import.meta.glob. The raw YAML strings are parsed on module load. This
// works in both the build-time prerender step and at the edge for the SSR
// number route, because there is no fs access in the worker runtime.

import { parse } from 'yaml';
import type { System } from './mnemonics';

export interface RawEntryMapping {
  system: System;
  to: string;
  note?: string;
}

export interface CuratedEntry {
  id: string;
  type: 'number' | 'word';
  display: string;
  mappings: RawEntryMapping[];
  phonetic_override?: string[];
}

// Vite inlines every matching YAML as a raw string at build time.
const RAW = import.meta.glob('/data/entries/*.yaml', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function loadAll(): CuratedEntry[] {
  const out: CuratedEntry[] = [];
  for (const [path, raw] of Object.entries(RAW)) {
    try {
      const parsed = parse(raw) as CuratedEntry;
      if (!parsed?.id || !parsed?.type) {
        console.warn(`entries: skipping malformed file ${path}`);
        continue;
      }
      out.push(parsed);
    } catch (err) {
      console.warn(`entries: failed to parse ${path}`, err);
    }
  }
  return out;
}

const ALL = loadAll();
const BY_NUMBER = new Map<string, CuratedEntry>();
const BY_WORD = new Map<string, CuratedEntry>();

for (const e of ALL) {
  if (e.type === 'number') BY_NUMBER.set(normalizeNumberId(e.id), e);
  else BY_WORD.set(normalizeWordId(e.id), e);
}

function normalizeNumberId(id: string): string {
  return id.trim();
}

function normalizeWordId(id: string): string {
  return id.trim().toLowerCase();
}

export function getCuratedNumber(id: string): CuratedEntry | undefined {
  return BY_NUMBER.get(normalizeNumberId(id));
}

export function getCuratedWord(id: string): CuratedEntry | undefined {
  return BY_WORD.get(normalizeWordId(id));
}

export function listCuratedNumberIds(): string[] {
  return [...BY_NUMBER.keys()];
}

export function listCuratedWordIds(): string[] {
  return [...BY_WORD.keys()];
}

export function listAllCurated(): CuratedEntry[] {
  return ALL;
}
