// Per-page metadata composers. Build SERP-grade titles and descriptions
// from the same NumberResult / WordResult / Category / SystemCopy objects
// that drive the page body, so every page gets unique copy instead of the
// templated "Curated entry for X." that used to appear on 105 number pages.
//
// Pure functions. The output is consumed by BaseLayout via the `title` and
// `description` props, and also feeds the JSON-LD description fields.

import type { NumberResult, WordResult, Mapping, System } from './mnemonics';
import { digitalRoot, pythagoreanRoot, archetype } from './numerology';

const BRAND = 'Numlore';

// Length budgets — SERPs typically truncate titles past ~60 chars and
// descriptions past ~160 chars. We allow a small overshoot for graceful
// degradation in rich-results UIs that have more room.
const MAX_TITLE = 70;
const MAX_DESC = 170;
// Hooks of curated cultural mappings can run long (the /n/42 "to" is 73
// chars). For the title slot we shorten aggressively so the brand suffix
// still survives the SERP truncation at ~60 chars.
const TITLE_HOOK_MAX = 42;

export interface PageMeta {
  title: string;
  description: string;
}

function clamp(s: string, max: number): string {
  if (s.length <= max) return s;
  // Prefer to break at a word boundary.
  const slice = s.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const head = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return head.trimEnd().replace(/[,;:.\s]+$/, '') + '…';
}

// Drop a trailing period if present — we'll concatenate with our own.
function noDot(s: string): string {
  return s.replace(/\.$/, '');
}

function findMapping(mappings: Mapping[], system: System): Mapping | undefined {
  return mappings.find((m) => m.system === system);
}

function firstWord(commaList: string): string {
  return commaList.split(',')[0]?.trim() ?? '';
}

// notableSummary() emits sentences like "12321 is a palindrome." — for use
// in a description that already shows the number we drop the redundant
// leading phrase and recapitalise.
function stripLeadingNumber(summary: string, number: string): string {
  const prefix = `${number} is `;
  if (summary.startsWith(prefix)) {
    const rest = summary.slice(prefix.length).replace(/\.$/, '');
    return rest.length ? rest[0].toUpperCase() + rest.slice(1) : rest;
  }
  return summary.replace(/\.$/, '');
}

// ───── Numbers ───────────────────────────────────────────────────────────

export function numberPageMeta(number: string, data: NumberResult): PageMeta {
  const cultural = findMapping(data.mappings, 'cultural');
  const major    = findMapping(data.mappings, 'major');
  const math     = findMapping(data.mappings, 'math');
  const keypad   = findMapping(data.mappings, 'keypad');
  const root     = digitalRoot(number);

  // Title hook in priority order: cultural reference → curated/algorithmic
  // Major mnemonic → math property → notable kind → bare brand. Long
  // hooks are clamped to TITLE_HOOK_MAX so the brand suffix survives.
  let hook = '';
  if (cultural) {
    hook = clamp(cultural.to, TITLE_HOOK_MAX);
  } else if (major) {
    const w = firstWord(major.to);
    if (w) hook = data.tier === 'curated' ? `Major mnemonic ${w}` : `Major: ${w}`;
  } else if (math) {
    hook = math.to;
  } else if (data.tier === 'notable') {
    hook = clamp(stripLeadingNumber(data.summary, number), TITLE_HOOK_MAX);
  }

  const title = clamp(
    hook ? `${number} — ${hook} · ${BRAND}` : `${number} · ${BRAND}`,
    MAX_TITLE,
  );

  // Description: lead sentence (with curated note for context) + mapping
  // digest + root.
  const lead: string[] = [];
  if (data.tier === 'curated') {
    if (cultural) {
      lead.push(`${noDot(cultural.to)}.`);
      if (cultural.note) lead.push(`${noDot(cultural.note)}.`);
    } else {
      lead.push(`Curated mnemonic for ${number}.`);
    }
  } else if (data.tier === 'notable') {
    lead.push(stripLeadingNumber(data.summary, number) + '.');
  }
  // longtail: skip the lead, let the mapping digest speak.

  const digest: string[] = [];
  if (major) {
    const sample = major.to.split(',').slice(0, 2).map((s) => s.trim()).filter(Boolean).join(', ');
    if (sample) digest.push(`Major: ${sample}`);
  }
  if (keypad) {
    const kp = keypad.to.length > 36 ? keypad.to.slice(0, 34).trimEnd() + '…' : keypad.to;
    digest.push(`T9: ${kp}`);
  }
  if (math && (!major || data.tier !== 'curated')) {
    // Skip math for curated-with-major to avoid crowding; the math property
    // shows up on the page itself.
    digest.push(math.to);
  }

  const parts: string[] = [...lead];
  if (digest.length > 0) parts.push(digest.join(' · ') + '.');
  if (root) parts.push(`Root ${root.root} — ${archetype(root.root)}.`);

  return { title, description: clamp(parts.join(' '), MAX_DESC) };
}

// ───── Words ─────────────────────────────────────────────────────────────

export function wordPageMeta(word: string, data: WordResult): PageMeta {
  const cultural = findMapping(data.mappings, 'cultural');
  const major    = findMapping(data.mappings, 'major');
  const keypad   = findMapping(data.mappings, 'keypad');
  const root     = pythagoreanRoot(word);

  let hook = '';
  if (cultural) hook = clamp(cultural.to, TITLE_HOOK_MAX);
  else if (major && /^\d+$/.test(major.to)) hook = `Major ${major.to}`;
  else if (keypad && /^\d+$/.test(keypad.to)) hook = `T9 ${keypad.to}`;

  const title = clamp(
    hook ? `${word} — ${hook} · ${BRAND}` : `${word} · ${BRAND}`,
    MAX_TITLE,
  );

  const parts: string[] = [];
  if (cultural) {
    parts.push(`${noDot(cultural.to)}.`);
    if (cultural.note) parts.push(`${noDot(cultural.note)}.`);
  }

  const digest: string[] = [];
  if (major) digest.push(`Major ${major.to}`);
  if (keypad) digest.push(`T9 ${keypad.to}`);
  if (digest.length > 0) parts.push(digest.join(' · ') + '.');

  if (root) parts.push(`Pythagorean root ${root.root} — ${archetype(root.root)}.`);

  return { title, description: clamp(parts.join(' '), MAX_DESC) };
}

// ───── Categories ────────────────────────────────────────────────────────

export function categoryPageMeta(args: {
  title: string;
  description: string;
  count: number;
}): PageMeta {
  const title = clamp(`${args.title} — ${args.count} numbers · ${BRAND}`, MAX_TITLE);
  const desc = clamp(
    args.description.endsWith('.') ? args.description : `${args.description}.`,
    MAX_DESC,
  );
  return { title, description: desc };
}

// ───── Systems ───────────────────────────────────────────────────────────

export function systemPageMeta(args: {
  title: string;
  subtitle: string;
  body: string;
}): PageMeta {
  const title = clamp(`${args.title} — ${args.subtitle} · ${BRAND}`, MAX_TITLE);
  const desc = clamp(args.body, MAX_DESC);
  return { title, description: desc };
}
