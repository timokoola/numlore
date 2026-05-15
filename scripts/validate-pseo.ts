#!/usr/bin/env tsx
// Quality guard for the hand-authored pSEO surface.
//
// Runs the page-meta composers over every curated entry, category, and
// system slug — the places where a stale YAML or a regressed helper
// would silently produce duplicate or out-of-bounds titles and
// descriptions before a build catches it.
//
// Scope:
//   - 100+ curated number YAMLs
//   - 4 curated word YAMLs
//   - Every category in data/categories/
//   - The 4 system slugs (mirrored here)
//
// Not covered (yet):
//   - The 12K algorithmic /n/* pages — same composer, so a bug there
//     would also surface in curated validation. Sampling could be
//     added.
//   - Rendered HTML (would need a post-build dist walk).
//   - Hub and static index page metadata declared inline in .astro
//     route frontmatter. Hubs change rarely; mirroring them here
//     would just be a copy that goes stale.
//
// CI: exits 1 if any critical issue. Warnings don't fail the build.
//
// Run: pnpm validate:pseo

import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  numberPageMeta,
  wordPageMeta,
  categoryPageMeta,
  systemPageMeta,
  type PageMeta,
} from '../src/lib/page-meta';
import type { Mapping, NumberResult, WordResult } from '../src/lib/mnemonics';

interface CuratedEntry {
  id: string;
  type: 'number' | 'word';
  display: string;
  mappings: Mapping[];
}

interface Category {
  slug: string;
  title: string;
  description: string;
  includes: string[];
}

interface Issue {
  level: 'critical' | 'warning';
  page: string;
  message: string;
}

// ── Length policy ─────────────────────────────────────────────────────────
// Titles target 50-60 chars, descriptions 150-160. The thresholds below
// are guard rails — anything outside is flagged but only the floor/ceiling
// on the meta-renderer side (clamp at 70 / 170) is hard.
const TITLE_MIN = 12;   // hub titles can be very short
const TITLE_MAX = 70;
const DESC_MIN = 50;
const DESC_MAX = 170;

const issues: Issue[] = [];
function flag(level: Issue['level'], page: string, message: string): void {
  issues.push({ level, page, message });
}

// ── Loaders ───────────────────────────────────────────────────────────────

function loadCurated(): CuratedEntry[] {
  const dir = path.resolve('./data/entries');
  const out: CuratedEntry[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.yaml')) continue;
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    const parsed = parseYaml(raw) as Partial<CuratedEntry> | null;
    if (!parsed?.id || !parsed.type || !parsed.display) {
      flag('critical', `data/entries/${f}`, 'missing id, type, or display');
      continue;
    }
    if (!Array.isArray(parsed.mappings)) {
      flag('warning', `data/entries/${f}`, 'mappings field is missing or not an array');
      parsed.mappings = [];
    }
    out.push(parsed as CuratedEntry);
  }
  return out;
}

function loadCategories(): Category[] {
  const dir = path.resolve('./data/categories');
  const out: Category[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.yaml')) continue;
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    const parsed = parseYaml(raw) as Partial<Category> | null;
    if (!parsed?.slug || !parsed.title || !parsed.description || !Array.isArray(parsed.includes)) {
      flag('critical', `data/categories/${f}`, 'missing slug, title, description, or includes');
      continue;
    }
    if (parsed.includes.length === 0) {
      flag('warning', `data/categories/${f}`, 'empty includes array — page will render no items');
    }
    out.push(parsed as Category);
  }
  return out;
}

// Mirrors src/pages/systems/[slug].astro's `copy` map. Validator gets stale
// if that map changes — accept the duplication; the diff in code review will
// catch it next time.
const SYSTEMS: ReadonlyArray<{ slug: string; title: string; subtitle: string; body: string }> = [
  {
    slug: 'major',
    title: 'The Major System',
    subtitle: 'the phonetic cipher',
    body: 'A phonetic mnemonic technique that maps each digit 0–9 to a set of consonant sounds. Vowels, w, y, and h are free to insert, so any number can be rewritten as a pronounceable word.',
  },
  {
    slug: 'keypad',
    title: 'T9 phone keypad',
    subtitle: 'the tactile cipher',
    body: 'Legacy mobile phones mapped letters to digits 2–9. The system survives in vanity numbers and in mnemonic word ↔ number conversion.',
  },
  {
    slug: 'leet',
    title: 'Leet (1337-speak)',
    subtitle: 'the modern glyph',
    body: 'Numbers and symbols substituted for similar-looking letters: 0=O, 1=I, 3=E, 4=A, 5=S, 7=T. Common since the early 1980s BBS scene.',
  },
  {
    slug: 'cultural',
    title: 'Cultural references',
    subtitle: 'the named echoes',
    body: 'Numbers that mean something specific in a cultural or fictional context: 007 (James Bond), 451 (Fahrenheit 451), 90210 (Beverly Hills), 31337 (elite). Curated by hand.',
  },
];

// ── Probes ────────────────────────────────────────────────────────────────

interface PageProbe {
  page: string;
  meta: PageMeta;
}

function probeMeta(page: string, meta: PageMeta): PageProbe {
  if (!meta.title) {
    flag('critical', page, 'empty title');
  } else if (meta.title.length < TITLE_MIN) {
    flag('warning', page, `title length ${meta.title.length} below floor ${TITLE_MIN}: "${meta.title}"`);
  } else if (meta.title.length > TITLE_MAX) {
    flag('critical', page, `title length ${meta.title.length} above ceiling ${TITLE_MAX}: "${meta.title}"`);
  }
  if (!meta.description) {
    flag('critical', page, 'empty description');
  } else if (meta.description.length < DESC_MIN) {
    flag('warning', page, `description length ${meta.description.length} below floor ${DESC_MIN}: "${meta.description.slice(0, 70)}…"`);
  } else if (meta.description.length > DESC_MAX) {
    flag('critical', page, `description length ${meta.description.length} above ceiling ${DESC_MAX}: "${meta.description.slice(0, 70)}…"`);
  }
  return { page, meta };
}

function curatedNumberResult(e: CuratedEntry): NumberResult {
  return {
    number: e.id,
    tier: 'curated',
    summary: `Curated entry for ${e.display}.`,
    mappings: e.mappings,
  };
}

function curatedWordResult(e: CuratedEntry): WordResult {
  return {
    word: e.id,
    tier: 'curated',
    summary: `Curated entry for "${e.display}".`,
    mappings: e.mappings,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────

function main(): void {
  const curated = loadCurated();
  const categories = loadCategories();

  const probes: PageProbe[] = [];

  for (const e of curated) {
    if (e.type === 'number') {
      probes.push(probeMeta(`/n/${e.id}`, numberPageMeta(e.id, curatedNumberResult(e))));
    } else {
      probes.push(probeMeta(`/w/${e.id}`, wordPageMeta(e.id, curatedWordResult(e))));
    }
  }

  for (const c of categories) {
    probes.push(
      probeMeta(`/c/${c.slug}`, categoryPageMeta({
        title: c.title,
        description: c.description,
        count: c.includes.length,
      })),
    );
  }

  for (const s of SYSTEMS) {
    probes.push(
      probeMeta(`/systems/${s.slug}`, systemPageMeta({
        title: s.title,
        subtitle: s.subtitle,
        body: s.body,
      })),
    );
  }

  // ── Uniqueness across the probed surface ──────────────────────────────
  const titles = new Map<string, string[]>();
  const descs = new Map<string, string[]>();
  for (const p of probes) {
    const tList = titles.get(p.meta.title) ?? [];
    tList.push(p.page);
    titles.set(p.meta.title, tList);
    const dList = descs.get(p.meta.description) ?? [];
    dList.push(p.page);
    descs.set(p.meta.description, dList);
  }
  for (const [t, pages] of titles) {
    if (pages.length > 1) {
      flag('critical', pages.join(', '), `duplicate title "${t}" across ${pages.length} pages`);
    }
  }
  for (const [d, pages] of descs) {
    if (pages.length > 1) {
      flag('critical', pages.join(', '), `duplicate description "${d.slice(0, 60)}…" across ${pages.length} pages`);
    }
  }

  // ── Report ────────────────────────────────────────────────────────────
  const critical = issues.filter((i) => i.level === 'critical');
  const warnings = issues.filter((i) => i.level === 'warning');

  process.stdout.write(
    `validate-pseo: probed ${probes.length} pages — ${critical.length} critical, ${warnings.length} warning(s).\n`,
  );
  if (issues.length > 0) {
    process.stdout.write('\n');
    for (const i of issues) {
      process.stdout.write(`  [${i.level}] ${i.page}\n    ${i.message}\n`);
    }
  }
  process.exit(critical.length > 0 ? 1 : 0);
}

main();
