// Runtime mnemonics lookup. Resolves a number or word to its mappings and
// tier (curated, notable, longtail).
//
// Read order for numbers:  curated YAML  →  notable auto-flag rules  →  longtail algorithmic.
// Read order for words:    curated YAML  →  longtail algorithmic.
//
// The dictionary-backed Major-System mnemonic candidates are not wired here
// yet; they will draw from /data/dictionaries/compiled/mnemonic-index.json
// once the build pipeline produces real artifacts.

import { getCuratedNumber, getCuratedWord, listCuratedNumberIds } from './entries';
import { getCategory, listCategories } from './categories';
import { isNotable } from '../../scripts/notable';
import { digitsToLeet, wordToT9 } from '../../scripts/dictionary/encoders';

export type System = 'cultural' | 'major' | 'keypad' | 'leet' | 'math';
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

const INTEGER_RE = /^-?\d+$/;
const DECIMAL_RE = /^-?\d+\.\d+$/;

export async function resolveNumber(raw: string): Promise<NumberResult> {
  const number = raw.trim();

  const curated = getCuratedNumber(number);
  if (curated) {
    return {
      number,
      tier: 'curated',
      summary: curatedNumberSummary(curated.display),
      mappings: curated.mappings,
    };
  }

  if (INTEGER_RE.test(number)) {
    const asInt = Number(number);
    const reason = isNotable(asInt);
    if (reason) {
      return {
        number,
        tier: 'notable',
        summary: notableSummary(asInt, reason),
        mappings: algorithmicNumberMappings(number, asInt),
      };
    }
  }

  return {
    number,
    tier: 'longtail',
    summary: longtailNumberSummary(number),
    mappings: algorithmicNumberMappings(number, INTEGER_RE.test(number) ? Number(number) : null),
  };
}

export async function resolveWord(raw: string): Promise<WordResult> {
  const word = raw.trim().toLowerCase();

  const curated = getCuratedWord(word);
  if (curated) {
    return {
      word,
      tier: 'curated',
      summary: curatedWordSummary(curated.display),
      mappings: curated.mappings,
    };
  }

  return {
    word,
    tier: 'longtail',
    summary: longtailWordSummary(word),
    mappings: algorithmicWordMappings(word),
  };
}

export async function listCategorySlugs(): Promise<string[]> {
  return listCategories().map((c) => c.slug);
}

export async function loadCategory(slug: string): Promise<CategoryResult> {
  const c = getCategory(slug);
  if (!c) {
    return { slug, title: slug, description: 'Category not found.', includes: [] };
  }
  return { slug: c.slug, title: c.title, description: c.description, includes: c.includes };
}

export function listPrebuiltNumberIds(): string[] {
  // Curated number IDs plus 0–9999 plus all notable 5–6 digit numbers.
  // Used by sitemap emission and (eventually) build-time enumeration.
  const ids = new Set<string>(listCuratedNumberIds());
  for (let n = 0; n <= 9999; n++) ids.add(String(n));
  for (let n = 10000; n <= 999999; n++) {
    if (isNotable(n)) ids.add(String(n));
  }
  return [...ids];
}

// ---- summaries ---------------------------------------------------------------

function curatedNumberSummary(display: string): string {
  return `Curated entry for ${display}.`;
}

function curatedWordSummary(display: string): string {
  return `Curated entry for "${display}".`;
}

function notableSummary(n: number, reason: string): string {
  const labels: Record<string, string> = {
    year: 'a four-digit year',
    repdigit: 'a repdigit',
    palindrome: 'a palindrome',
    ascending: 'an ascending sequence',
    descending: 'a descending sequence',
    'common-pin': 'a commonly used PIN',
    'wellknown-code': 'a well-known code',
  };
  return `${n} is ${labels[reason] ?? 'notable'}.`;
}

function longtailNumberSummary(s: string): string {
  return `Algorithmic encodings for ${s}.`;
}

function longtailWordSummary(w: string): string {
  return `Algorithmic encodings for "${w}".`;
}

// ---- algorithmic mappings ----------------------------------------------------

function algorithmicNumberMappings(raw: string, asInt: number | null): Mapping[] {
  const out: Mapping[] = [];

  if (DECIMAL_RE.test(raw)) {
    out.push({ system: 'leet', to: digitsToLeet(raw.replace('.', '')), note: 'leet substitution on the digits, decimal point preserved' });
    return out;
  }

  if (!INTEGER_RE.test(raw)) return out;

  const digits = raw.replace(/^-/, '');

  out.push({ system: 'keypad', to: digitsToKeypadLetters(digits), note: 'T9 phone-keypad letter set per digit' });
  out.push({ system: 'leet', to: digitsToLeet(digits), note: 'leet substitution: 0=O, 1=I, 3=E, 4=A, 5=S, 7=T, etc.' });

  if (digits.length === 5 || digits.length === 6) {
    for (const chunked of chunkings(digits)) {
      out.push({
        system: 'leet',
        to: chunked.map(digitsToLeet).join(' '),
        note: `chunked ${chunked.map((c) => c.length).join('+')}, leet`,
      });
    }
  }

  if (asInt !== null && Number.isFinite(asInt) && asInt >= 2 && asInt <= 999999) {
    if (isPrime(asInt)) out.push({ system: 'math', to: 'prime', note: 'has no positive divisors other than 1 and itself' });
    if (isPalindrome(digits)) out.push({ system: 'math', to: 'palindrome', note: 'reads the same forwards and backwards' });
    if (asInt <= 99999) {
      const f = factorize(asInt);
      if (f.length > 1) {
        out.push({ system: 'math', to: f.join(' × '), note: 'prime factorization' });
      }
    }
  }

  return out;
}

function algorithmicWordMappings(word: string): Mapping[] {
  const out: Mapping[] = [];
  const t9 = wordToT9(word);
  if (t9.length > 0) {
    out.push({ system: 'keypad', to: t9, note: 'T9 phone keypad digits' });
  }
  return out;
}

function digitsToKeypadLetters(digits: string): string {
  const groups: Record<string, string> = {
    '0': '⌷',
    '1': '⌷',
    '2': 'ABC',
    '3': 'DEF',
    '4': 'GHI',
    '5': 'JKL',
    '6': 'MNO',
    '7': 'PQRS',
    '8': 'TUV',
    '9': 'WXYZ',
  };
  return digits.split('').map((d) => groups[d] ?? '⌷').join(' ');
}

function chunkings(digits: string): string[][] {
  const out: string[][] = [];
  if (digits.length === 5) {
    out.push([digits.slice(0, 2), digits.slice(2)]);
    out.push([digits.slice(0, 3), digits.slice(3)]);
  } else if (digits.length === 6) {
    out.push([digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]);
    out.push([digits.slice(0, 3), digits.slice(3)]);
  }
  return out;
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0) return false;
  const limit = Math.floor(Math.sqrt(n));
  for (let i = 3; i <= limit; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

function isPalindrome(s: string): boolean {
  return s.length > 1 && s === s.split('').reverse().join('');
}

function factorize(n: number): number[] {
  const out: number[] = [];
  let cur = n;
  for (let p = 2; p * p <= cur; p++) {
    while (cur % p === 0) {
      out.push(p);
      cur = cur / p;
    }
  }
  if (cur > 1) out.push(cur);
  return out;
}
