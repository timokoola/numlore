// Dictionary build pipeline.
//
// Reads vendored sources from data/dictionaries/_sources/ and writes three
// compiled artifacts to data/dictionaries/compiled/:
//
//   - words.json           — full unified table (build-time only, large)
//   - mnemonic-index.json  — Major skeleton → top N ranked candidates
//                            (bundled with the SSR worker)
//   - search-words.json    — slim top-N words for client-side typeahead
//
// Inputs:
//   - cmudict.dict                     ARPAbet pronunciations
//   - google-10000-english-usa.txt     top-10k rank-by-frequency word list
//
// Ranking score (v1, simplified from the spec):
//   score = zipf
//   zipf  = max(1.0, 8.0 - log10(rank))   for in-list words
//   zipf  = 1.0                            for everything else
//
// POS and concreteness weights are deferred until we vendor SUBTLEX-US and
// the Brysbaert ratings. The score field is multiplicative so they slot
// in without changing the rest of the pipeline.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arpabetToMajor } from './encoders';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SOURCES_DIR = join(ROOT, 'data', 'dictionaries', '_sources');
const COMPILED_DIR = join(ROOT, 'data', 'dictionaries', 'compiled');

const MAX_CANDIDATES_PER_KEY = 20;
const MAX_SEARCH_WORDS = 20_000;
const MIN_SCORE = 1.5;          // drop low-quality entries from the index

interface WordRow {
  lemma: string;
  phonemes: string[];
  major: string;
  rank: number | null;
  zipf: number;
  score: number;
}

const STOPWORDS = new Set<string>([
  // The closed-class words that would otherwise dominate the index for
  // short skeletons. Each is high-frequency but useless as a mnemonic.
  'the', 'of', 'and', 'a', 'to', 'in', 'is', 'it', 'i', 'for', 'on',
  'with', 'as', 'at', 'by', 'this', 'that', 'an', 'or', 'be', 'are',
  'was', 'were', 'has', 'have', 'had', 'will', 'would', 'could', 'should',
  'do', 'does', 'did', 'but', 'so', 'if', 'not', 'no', 'yes', 'all',
  'any', 'some', 'one', 'two', 'who', 'what', 'when', 'where', 'why',
  'how', 'which', 'than', 'then', 'there', 'their', 'they', 'them',
  'his', 'her', 'him', 'she', 'he', 'we', 'us', 'our', 'you', 'your',
  'me', 'my', 'mine', 'its', 'from', 'into', 'about', 'over', 'under',
  'between', 'because', 'while', 'after', 'before', 'just', 'also',
  'such', 'only', 'more', 'most', 'can', 'may', 'might', 'must', 'shall',
]);

function parseCmudict(raw: string): WordRow[] {
  const out: WordRow[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';;;')) continue;

    const [head, ...rest] = trimmed.split(/\s+/);
    if (!head || rest.length === 0) continue;

    // Strip variant marker "WORD(2)" → "WORD"
    const lemma = head.replace(/\(\d+\)$/, '').toLowerCase();

    // Skip non-alphabetic headwords (apostrophes, punctuation, numerals).
    if (!/^[a-z][a-z'-]*$/.test(lemma)) continue;
    if (lemma.length < 3) continue;

    // The cmudict.dict format may include a trailing "#" comment.
    const phonemes: string[] = [];
    for (const tok of rest) {
      if (tok === '#') break;
      phonemes.push(tok);
    }
    if (phonemes.length === 0) continue;

    const major = arpabetToMajor(phonemes);
    if (!major) continue; // all-vowel pronunciations have no Major skeleton

    out.push({
      lemma,
      phonemes,
      major,
      rank: null,
      zipf: 1.0,
      score: 0,
    });
  }
  return out;
}

function parseFrequencyList(raw: string): Map<string, number> {
  const rank = new Map<string, number>();
  let i = 0;
  for (const line of raw.split('\n')) {
    const w = line.trim().toLowerCase();
    if (!w) continue;
    i++;
    if (!rank.has(w)) rank.set(w, i);
  }
  return rank;
}

function scoreWord(row: WordRow): number {
  // Apply stopword penalty and length floor.
  if (STOPWORDS.has(row.lemma)) return 0;
  if (row.lemma.length < 3) return 0;
  return row.zipf;
}

async function main() {
  await mkdir(COMPILED_DIR, { recursive: true });

  const [cmudictRaw, freqRaw] = await Promise.all([
    readFile(join(SOURCES_DIR, 'cmudict.dict'), 'utf8').catch(() => ''),
    readFile(join(SOURCES_DIR, 'google-10000-english-usa.txt'), 'utf8').catch(() => ''),
  ]);

  if (!cmudictRaw) {
    console.warn('dictionary/build: cmudict.dict not found; writing empty artifacts.');
    await writeFile(join(COMPILED_DIR, 'words.json'), '[]\n');
    await writeFile(join(COMPILED_DIR, 'mnemonic-index.json'), '{}\n');
    await writeFile(join(COMPILED_DIR, 'search-words.json'), '[]\n');
    return;
  }

  console.log('dictionary/build: parsing CMU pronouncing dictionary…');
  const rows = parseCmudict(cmudictRaw);
  console.log(`  ${rows.length} pronunciations after filtering`);

  if (freqRaw) {
    console.log('dictionary/build: joining frequency list…');
    const rankMap = parseFrequencyList(freqRaw);
    let withRank = 0;
    for (const r of rows) {
      const rank = rankMap.get(r.lemma);
      if (rank) {
        r.rank = rank;
        // Synthetic Zipf: 8 - log10(rank) for top-10k; clamped to [1, 8].
        r.zipf = Math.max(1.0, 8.0 - Math.log10(rank));
        withRank++;
      }
    }
    console.log(`  ${withRank} pronunciations matched the top-${rankMap.size} frequency list`);
  }

  for (const r of rows) r.score = scoreWord(r);

  // ── words.json ─────────────────────────────────────────────────────────
  // Sorted by score descending, then lemma — easier for downstream tooling.
  const wordsOut = rows
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.lemma.localeCompare(b.lemma));
  await writeFile(
    join(COMPILED_DIR, 'words.json'),
    JSON.stringify(wordsOut, null, 0) + '\n',
  );

  // ── mnemonic-index.json ─────────────────────────────────────────────────
  // Major skeleton → top N candidates by score. Dedupes the same lemma
  // across pronunciation variants for the same skeleton.
  const byKey = new Map<string, WordRow[]>();
  for (const r of rows) {
    if (r.score < MIN_SCORE) continue;
    const arr = byKey.get(r.major) ?? [];
    if (!arr.some((x) => x.lemma === r.lemma)) arr.push(r);
    byKey.set(r.major, arr);
  }
  const mnemonicIndex: Record<string, Array<{ word: string; phonemes: string; zipf: number }>> = {};
  let totalCandidates = 0;
  for (const [key, arr] of byKey) {
    arr.sort((a, b) => b.score - a.score);
    mnemonicIndex[key] = arr.slice(0, MAX_CANDIDATES_PER_KEY).map((r) => ({
      word: r.lemma,
      phonemes: r.phonemes.join(' '),
      zipf: Math.round(r.zipf * 100) / 100,
    }));
    totalCandidates += mnemonicIndex[key].length;
  }
  await writeFile(
    join(COMPILED_DIR, 'mnemonic-index.json'),
    JSON.stringify(mnemonicIndex) + '\n',
  );
  console.log(`  mnemonic-index: ${Object.keys(mnemonicIndex).length} skeletons, ${totalCandidates} candidates`);

  // ── search-words.json ───────────────────────────────────────────────────
  // Top-N words ranked by score, slim record for client-side typeahead.
  // Dedupe lemmas across pronunciation variants.
  const seen = new Set<string>();
  const searchRows: Array<{ word: string; major: string; zipf: number }> = [];
  for (const r of [...rows].sort((a, b) => b.score - a.score)) {
    if (r.score < MIN_SCORE) continue;
    if (seen.has(r.lemma)) continue;
    seen.add(r.lemma);
    searchRows.push({
      word: r.lemma,
      major: r.major,
      zipf: Math.round(r.zipf * 100) / 100,
    });
    if (searchRows.length >= MAX_SEARCH_WORDS) break;
  }
  await writeFile(
    join(COMPILED_DIR, 'search-words.json'),
    JSON.stringify(searchRows) + '\n',
  );
  console.log(`  search-words: ${searchRows.length} entries`);

  console.log('dictionary/build: done.');
}

main().catch((err) => {
  console.error('dictionary/build: failed', err);
  process.exit(1);
});
