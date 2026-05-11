#!/usr/bin/env tsx
// One-time source acquisition.
//
// This script documents and (in the future) automates the download of the
// vendored dictionary sources into data/dictionaries/_sources/. It is NOT
// invoked by `pnpm build` — sources are committed to the repo and the build
// reads them directly. Run this only when a refresh is needed.
//
// Sources:
//   - CMU Pronouncing Dictionary (cmudict-0.7b)
//   - Princeton WordNet 3.1
//   - Brysbaert, Warriner, & Kuperman (2014) concreteness ratings
//
// Each source has its own license — see /NOTICE.

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SOURCES_DIR = join(ROOT, 'data', 'dictionaries', '_sources');

async function main() {
  await mkdir(SOURCES_DIR, { recursive: true });
  console.log('dictionary/fetch: source directory ensured at', SOURCES_DIR);
  console.log('dictionary/fetch: vendored sources are committed; no network fetches performed.');
  console.log('dictionary/fetch: to refresh, place updated source files under data/dictionaries/_sources/ manually.');
}

main().catch((err) => {
  console.error('dictionary/fetch: failed', err);
  process.exit(1);
});
