// Skeleton → ranked words. Pure helpers for the dictionary build.
//
// Given a Major-system skeleton (a digit string), return the top-N ranked
// candidate words. Used by scripts/dictionary/build.ts to assemble
// mnemonic-index.json.

export interface CandidateWord {
  word: string;
  zipf: number;
  concreteness: number;
  pos: 'noun' | 'verb' | 'adj' | 'other';
}

const POS_WEIGHT: Record<CandidateWord['pos'], number> = {
  noun: 1.0,
  verb: 0.7,
  adj: 0.5,
  other: 0.3,
};

export function scoreCandidate(c: CandidateWord): number {
  const concretenessWeight = 0.2 + ((c.concreteness - 1) / 4) * 0.8; // linear 1.0 (5) → 0.2 (1)
  return c.zipf * concretenessWeight * POS_WEIGHT[c.pos];
}

export function topN(candidates: CandidateWord[], n = 20): CandidateWord[] {
  return [...candidates]
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a))
    .slice(0, n);
}
