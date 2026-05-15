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
//   - cmudict.dict                     ARPAbet pronunciations (CMU dict)
//   - brysbaert-conc-freq.tsv          Brysbaert/Warriner/Kuperman 2014;
//                                      word + Conc.M (concreteness, 1–5)
//                                      + SUBTLEX raw frequency
//   - google-10000-english-usa.txt     fallback frequency rank for words
//                                      not in the Brysbaert set
//
// Spec ranking:
//   score = zipf × pos_weight × concreteness_weight
//
// zipf:
//   - in Brysbaert: zipf = log10((freq + 1) / total_freq * 1e9)
//   - else if in top-10k rank: zipf = max(1.0, 8.0 - log10(rank))
//   - else: zipf = 1.0
//
// pos_weight (suffix-heuristic; canonical POS source would supersede):
//   noun 1.0, verb 0.7, adj 0.5, adv 0.4, other 0.3
//
// concreteness_weight:
//   linear from 1.0 (rating 5) down to 0.2 (rating 1)
//   defaults to 0.6 for words not in Brysbaert.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arpabetToMajor } from './encoders';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SOURCES_DIR = join(ROOT, 'data', 'dictionaries', '_sources');
const COMPILED_DIR = join(ROOT, 'data', 'dictionaries', 'compiled');

const MAX_CANDIDATES_PER_KEY = 20;
const MAX_SEARCH_WORDS = 20_000;
const MIN_SCORE = 1.0;

type POS = 'noun' | 'verb' | 'adj' | 'adv' | 'other';

interface WordRow {
  lemma: string;
  phonemes: string[];
  major: string;
  zipf: number;
  pos: POS;
  concreteness: number;     // 1.0–5.0, default 3.0 if unknown
  score: number;
}

const STOPWORDS = new Set<string>([
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

// ─── POS heuristic ────────────────────────────────────────────────────────
// Rough but useful: classifies the word by its suffix. A clean POS source
// (WordNet or SUBTLEX-US-with-PoS) would replace this without touching the
// rest of the pipeline.
function guessPos(word: string): POS {
  if (word.length <= 2) return 'other';
  if (/(ly)$/.test(word) && word.length >= 5) return 'adv';
  if (/(ing|ed)$/.test(word) && word.length >= 5) return 'verb';
  if (/(ize|ise|ate|ify)$/.test(word)) return 'verb';
  if (/(ful|less|ous|al|ic|ive|able|ible|ish|esque|ant|ent)$/.test(word) && word.length >= 5) return 'adj';
  if (/(tion|sion|ity|ness|ment|ship|hood|dom|ist|ism|er|or|ee|ery|ary|ory|ure|age)$/.test(word) && word.length >= 5) return 'noun';
  // Concrete one-syllable words (cat, dog, ball, …) most commonly read as nouns.
  return 'noun';
}

const POS_WEIGHT: Record<POS, number> = {
  noun: 1.0,
  verb: 0.7,
  adj: 0.5,
  adv: 0.4,
  other: 0.3,
};

function concretenessWeight(rating: number): number {
  // Linear from 1.0 (rating 5) down to 0.2 (rating 1).
  if (!Number.isFinite(rating) || rating <= 0) return 0.6;
  const r = Math.max(1, Math.min(5, rating));
  return 0.2 + ((r - 1) / 4) * 0.8;
}

// ─── Source parsers ──────────────────────────────────────────────────────

function parseCmudict(raw: string): WordRow[] {
  const out: WordRow[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';;;')) continue;

    const [head, ...rest] = trimmed.split(/\s+/);
    if (!head || rest.length === 0) continue;

    const lemma = head.replace(/\(\d+\)$/, '').toLowerCase();
    if (!/^[a-z][a-z'-]*$/.test(lemma)) continue;
    if (lemma.length < 3) continue;

    const phonemes: string[] = [];
    for (const tok of rest) {
      if (tok === '#') break;
      phonemes.push(tok);
    }
    if (phonemes.length === 0) continue;

    const major = arpabetToMajor(phonemes);
    if (!major) continue;

    out.push({
      lemma,
      phonemes,
      major,
      zipf: 1.0,
      pos: 'other',
      concreteness: 3.0,
      score: 0,
    });
  }
  return out;
}

interface BrysbaertRow {
  concreteness: number;
  freq: number;
}

function parseBrysbaert(raw: string): { rows: Map<string, BrysbaertRow>; totalFreq: number } {
  const rows = new Map<string, BrysbaertRow>();
  let totalFreq = 0;
  const lines = raw.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const word = parts[0].toLowerCase();
    const conc = Number(parts[1]);
    const freq = Number(parts[2]);
    if (!Number.isFinite(conc) || !Number.isFinite(freq)) continue;
    rows.set(word, { concreteness: conc, freq });
    totalFreq += freq;
  }
  return { rows, totalFreq };
}

function parseFrequencyRank(raw: string): Map<string, number> {
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

// ─── Score ────────────────────────────────────────────────────────────────

function finalScore(row: WordRow): number {
  if (STOPWORDS.has(row.lemma)) return 0;
  if (row.lemma.length < 3) return 0;
  return row.zipf * POS_WEIGHT[row.pos] * concretenessWeight(row.concreteness);
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  await mkdir(COMPILED_DIR, { recursive: true });

  const [cmudictRaw, brysbaertRaw, freqRaw] = await Promise.all([
    readFile(join(SOURCES_DIR, 'cmudict.dict'), 'utf8').catch(() => ''),
    readFile(join(SOURCES_DIR, 'brysbaert-conc-freq.tsv'), 'utf8').catch(() => ''),
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

  let brysbaert: { rows: Map<string, BrysbaertRow>; totalFreq: number } | null = null;
  if (brysbaertRaw) {
    brysbaert = parseBrysbaert(brysbaertRaw);
    console.log(`  Brysbaert: ${brysbaert.rows.size} entries, total freq ${brysbaert.totalFreq}`);
  }

  const rankMap = freqRaw ? parseFrequencyRank(freqRaw) : new Map<string, number>();

  let withConc = 0;
  let withZipf = 0;
  for (const r of rows) {
    r.pos = guessPos(r.lemma);

    if (brysbaert) {
      const b = brysbaert.rows.get(r.lemma);
      if (b) {
        r.concreteness = b.concreteness;
        withConc++;
        if (b.freq > 0 && brysbaert.totalFreq > 0) {
          r.zipf = Math.log10(((b.freq + 1) / brysbaert.totalFreq) * 1e9);
          withZipf++;
        }
      }
    }

    if (r.zipf <= 1.0) {
      const rank = rankMap.get(r.lemma);
      if (rank) {
        r.zipf = Math.max(1.0, 8.0 - Math.log10(rank));
        withZipf++;
      }
    }

    r.score = finalScore(r);
  }
  console.log(`  ${withConc} pronunciations matched Brysbaert concreteness`);
  console.log(`  ${withZipf} pronunciations got a Zipf score`);

  // ── words.json ─────────────────────────────────────────────────────────
  const wordsOut = rows
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.lemma.localeCompare(b.lemma));
  await writeFile(
    join(COMPILED_DIR, 'words.json'),
    JSON.stringify(wordsOut, null, 0) + '\n',
  );

  // ── mnemonic-index.json ─────────────────────────────────────────────────
  const byKey = new Map<string, WordRow[]>();
  for (const r of rows) {
    if (r.score < MIN_SCORE) continue;
    const arr = byKey.get(r.major) ?? [];
    if (!arr.some((x) => x.lemma === r.lemma)) arr.push(r);
    byKey.set(r.major, arr);
  }
  const mnemonicIndex: Record<string, Array<{ word: string; pos: POS; score: number }>> = {};
  let totalCandidates = 0;
  for (const [key, arr] of byKey) {
    arr.sort((a, b) => b.score - a.score);
    mnemonicIndex[key] = arr.slice(0, MAX_CANDIDATES_PER_KEY).map((r) => ({
      word: r.lemma,
      pos: r.pos,
      score: Math.round(r.score * 100) / 100,
    }));
    totalCandidates += mnemonicIndex[key].length;
  }
  await writeFile(
    join(COMPILED_DIR, 'mnemonic-index.json'),
    JSON.stringify(mnemonicIndex) + '\n',
  );
  console.log(`  mnemonic-index: ${Object.keys(mnemonicIndex).length} skeletons, ${totalCandidates} candidates`);

  // ── search-words.json ───────────────────────────────────────────────────
  const seen = new Set<string>();
  const searchRows: Array<{ word: string; major: string; score: number }> = [];
  for (const r of [...rows].sort((a, b) => b.score - a.score)) {
    if (r.score < MIN_SCORE) continue;
    if (seen.has(r.lemma)) continue;
    seen.add(r.lemma);
    searchRows.push({
      word: r.lemma,
      major: r.major,
      score: Math.round(r.score * 100) / 100,
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
