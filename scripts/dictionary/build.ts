#!/usr/bin/env tsx
// Dictionary build pipeline.
//
// Joins the vendored sources under data/dictionaries/_sources/ and writes
// three artifacts to data/dictionaries/compiled/:
//   - words.json           — unified table (build-time only, ~150k rows)
//   - mnemonic-index.json  — Major skeleton → top 20 ranked candidate words
//                            (bundled with the SSR worker, ~500KB gz)
//   - search-words.json    — slim top-20k for client search
//                            (~150KB gz, shipped to the browser)
//
// Ranking:
//   score = zipf × concreteness_weight × pos_weight
//   concreteness_weight: linear, 1.0 (rating 5) down to 0.2 (rating 1)
//   pos_weight: noun 1.0, verb 0.7, adj 0.5, other 0.3
//
// The runtime build (`pnpm build`) reads the compiled artifacts only — no
// network, no source parsing. This script is invoked explicitly when sources
// change.
//
// Zipf frequency: the spec calls out the Python `wordfreq` package as a dev
// dependency. It is intentionally NOT in package.json — invoke it via a
// Python venv during the (future) full build, or use a JS port if/when one
// matures. Either way, frequency data lives under data/dictionaries/_sources
// after the run and is not refetched.

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SOURCES_DIR = join(ROOT, 'data', 'dictionaries', '_sources');
const COMPILED_DIR = join(ROOT, 'data', 'dictionaries', 'compiled');

async function main() {
  await mkdir(COMPILED_DIR, { recursive: true });

  let sourceFiles: string[] = [];
  try {
    sourceFiles = (await readdir(SOURCES_DIR)).filter((f) => !f.startsWith('.') && f !== 'README.md');
  } catch {
    sourceFiles = [];
  }

  if (sourceFiles.length === 0) {
    console.warn('dictionary/build: no source files found under data/dictionaries/_sources/.');
    console.warn('dictionary/build: writing empty artifacts so `pnpm build` stays green.');
    await writeFile(join(COMPILED_DIR, 'words.json'), '[]\n');
    await writeFile(join(COMPILED_DIR, 'mnemonic-index.json'), '{}\n');
    await writeFile(join(COMPILED_DIR, 'search-words.json'), '[]\n');
    return;
  }

  console.log('dictionary/build: TODO — implement join over', sourceFiles);
  console.log('dictionary/build: producing empty placeholder artifacts for now.');
  await writeFile(join(COMPILED_DIR, 'words.json'), '[]\n');
  await writeFile(join(COMPILED_DIR, 'mnemonic-index.json'), '{}\n');
  await writeFile(join(COMPILED_DIR, 'search-words.json'), '[]\n');
}

main().catch((err) => {
  console.error('dictionary/build: failed', err);
  process.exit(1);
});
