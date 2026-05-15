// Build-time OG-card generator. Renders ~130 social cards covering
// the curated entries, hubs, categories, and systems and writes them
// into public/og/<...>.png so Astro's static copy ships them to /dist.
//
// Pages without a dedicated card fall back to public/og/default.png
// (the brand card), so every URL on the site has a valid og:image.
//
// Run via `pnpm og:build` (chained before `astro build`).

import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { renderOgCard, type CardSpec } from '../../src/lib/og-render';
import { digitalRoot, pythagoreanRoot, archetype } from '../../src/lib/numerology';

// src/lib/entries.ts and src/lib/categories.ts use Vite's import.meta.glob,
// which doesn't exist in plain Node. We re-implement the directory walks
// here so this script can run outside the Astro/Vite build pipeline.

interface CuratedMapping {
  system: 'cultural' | 'major' | 'keypad' | 'leet' | 'math';
  to: string;
  note?: string;
}

interface CuratedEntry {
  id: string;
  type: 'number' | 'word';
  display: string;
  mappings: CuratedMapping[];
}

interface Category {
  slug: string;
  title: string;
  description: string;
  includes: string[];
}

function loadCurated(): CuratedEntry[] {
  const dir = path.resolve('./data/entries');
  const out: CuratedEntry[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.yaml')) continue;
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const parsed = parseYaml(raw) as CuratedEntry | null;
    if (!parsed?.id || !parsed?.type) continue;
    out.push(parsed);
  }
  return out;
}

function loadCategories(): Category[] {
  const dir = path.resolve('./data/categories');
  const out: Category[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.yaml')) continue;
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const parsed = parseYaml(raw) as Category | null;
    if (!parsed?.slug) continue;
    out.push(parsed);
  }
  return out;
}

const OUT_DIR = path.resolve('./public/og');

interface CardJob {
  outPath: string;     // relative under public/og/
  spec: CardSpec;
}

const SYSTEMS: Array<{ slug: string; title: string; subtitle: string }> = [
  { slug: 'major',    title: 'The Major System', subtitle: 'phonetic cipher' },
  { slug: 'keypad',   title: 'T9 Keypad',        subtitle: 'tactile cipher' },
  { slug: 'leet',     title: 'Leet',             subtitle: 'modern glyph' },
  { slug: 'cultural', title: 'Cultural',         subtitle: 'named echoes' },
];

function collectJobs(): CardJob[] {
  const jobs: CardJob[] = [];

  // ── Brand default ──────────────────────────────────────────────────────
  jobs.push({
    outPath: 'default.png',
    spec: {
      hero: 'Numlore',
      caption: 'A bidirectional dictionary of numbers and the words they mean.',
      badge: 'curated · notable · algorithmic',
    },
  });

  // ── Home ───────────────────────────────────────────────────────────────
  jobs.push({
    outPath: 'home.png',
    spec: {
      hero: 'Numlore',
      kicker: '✦ a field guide',
      caption: 'Every number, every word, every cipher between them.',
      badge: 'numlore.com',
    },
  });

  // ── Hubs ───────────────────────────────────────────────────────────────
  jobs.push({
    outPath: 'n.png',
    spec: { hero: 'Numbers', kicker: 'index', caption: 'Every curated number Numlore knows.', badge: '105 entries' },
  });
  jobs.push({
    outPath: 'w.png',
    spec: { hero: 'Words', kicker: 'index', caption: 'Curated words and their Pythagorean roots.', badge: '4 entries' },
  });
  jobs.push({
    outPath: 'c.png',
    spec: { hero: 'Collections', kicker: 'index', caption: 'Hand-grouped themed sets.' },
  });
  jobs.push({
    outPath: 'systems.png',
    spec: { hero: 'Four spheres', kicker: 'index', caption: 'The mnemonic systems Numlore reads.' },
  });

  // ── Categories ─────────────────────────────────────────────────────────
  for (const c of loadCategories()) {
    jobs.push({
      outPath: `c/${c.slug}.png`,
      spec: {
        hero: c.title,
        kicker: 'collection',
        caption: c.description,
        badge: `${c.includes.length} entries`,
      },
    });
  }

  // ── Systems ────────────────────────────────────────────────────────────
  for (const s of SYSTEMS) {
    jobs.push({
      outPath: `systems/${s.slug}.png`,
      spec: {
        hero: s.title,
        kicker: 'system',
        caption: `— the ${s.subtitle} —`,
        badge: 'mnemonic system',
      },
    });
  }

  // ── Curated entries ────────────────────────────────────────────────────
  for (const e of loadCurated()) {
    if (e.type === 'number') {
      const root = digitalRoot(e.id);
      const cultural = e.mappings.find((m) => m.system === 'cultural');
      const major = e.mappings.find((m) => m.system === 'major');
      const caption = cultural?.to ?? (major ? `Major mnemonic: ${major.to}` : undefined);
      jobs.push({
        outPath: `n/${e.id}.png`,
        spec: {
          hero: e.display,
          kicker: cultural ? 'cultural' : major ? 'major' : 'curated',
          caption,
          badge: root ? `root ${root.root} · ${archetype(root.root)}` : undefined,
        },
      });
    } else {
      const root = pythagoreanRoot(e.id);
      const major = e.mappings.find((m) => m.system === 'major');
      const cultural = e.mappings.find((m) => m.system === 'cultural');
      const caption = cultural?.to ?? (major ? `Major ${major.to}` : undefined);
      jobs.push({
        outPath: `w/${e.id}.png`,
        spec: {
          hero: e.display,
          kicker: cultural ? 'cultural' : 'word',
          caption,
          badge: root ? `root ${root.root} · ${archetype(root.root)}` : undefined,
        },
      });
    }
  }

  return jobs;
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.join(OUT_DIR, 'n'), { recursive: true });
  fs.mkdirSync(path.join(OUT_DIR, 'w'), { recursive: true });
  fs.mkdirSync(path.join(OUT_DIR, 'c'), { recursive: true });
  fs.mkdirSync(path.join(OUT_DIR, 'systems'), { recursive: true });

  const jobs = collectJobs();
  const started = Date.now();
  let n = 0;
  for (const job of jobs) {
    const png = await renderOgCard(job.spec);
    fs.writeFileSync(path.join(OUT_DIR, job.outPath), png);
    n += 1;
    if (n % 20 === 0) {
      process.stdout.write(`  ${n}/${jobs.length}\n`);
    }
  }
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`og-cards: wrote ${n} png(s) to ${OUT_DIR} in ${elapsed}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
