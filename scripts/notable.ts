#!/usr/bin/env tsx
// Auto-flag rules for "notable" 5–6 digit numbers. Owned here so the rules
// stay auditable and changeable. A number is notable if any of the rules
// below match. The build pipeline includes notable numbers in the prebuilt
// set, the sitemap, and the indexable page tier.

export type NotableReason =
  | 'year'
  | 'repdigit'
  | 'palindrome'
  | 'ascending'
  | 'descending'
  | 'common-pin'
  | 'wellknown-code';

const WELLKNOWN_CODES = new Set<string>([
  '90210', // Beverly Hills
  '31337', // "elite"
  '10000', // milestone
  '10001', // New York ZIP
  '12345', // common test code
]);

const COMMON_PINS = new Set<string>([
  '00000',
  '11111',
  '22222',
  '99999',
  '12345',
  '54321',
  '00007',
  '00911',
]);

export function isNotable(n: number): NotableReason | null {
  if (!Number.isInteger(n) || n < 10000 || n > 999999) return null;
  const s = String(n);

  if (n >= 1000 && n <= 2100 && s.length === 4) return 'year';
  // 5–6 digit year-like values (e.g., 02026 written as 5-digit) are not handled here.

  if (/^(\d)\1+$/.test(s)) return 'repdigit';
  if (s === s.split('').reverse().join('')) return 'palindrome';

  if (isMonotonic(s, 1)) return 'ascending';
  if (isMonotonic(s, -1)) return 'descending';

  if (COMMON_PINS.has(s)) return 'common-pin';
  if (WELLKNOWN_CODES.has(s)) return 'wellknown-code';

  return null;
}

function isMonotonic(s: string, step: 1 | -1): boolean {
  for (let i = 1; i < s.length; i++) {
    if (Number(s[i]) - Number(s[i - 1]) !== step) return false;
  }
  return true;
}

export function listNotable(min = 10000, max = 999999): Array<{ n: number; reason: NotableReason }> {
  const out: Array<{ n: number; reason: NotableReason }> = [];
  for (let n = min; n <= max; n++) {
    const reason = isNotable(n);
    if (reason) out.push({ n, reason });
  }
  return out;
}

// Runnable preview. Guarded so the module stays safe to import inside the
// Cloudflare worker runtime, which has no `process` global.
if (typeof process !== 'undefined' && process.argv && import.meta.url === `file://${process.argv[1]}`) {
  const sample = listNotable().slice(0, 50);
  console.log(`notable sample (first 50 of ${listNotable().length}):`);
  for (const { n, reason } of sample) console.log(`  ${n}  ${reason}`);
}
