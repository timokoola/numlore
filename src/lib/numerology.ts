// Pure-function numerology helpers. Used to compute the digital root of a
// number and the Pythagorean letter root of a word, and to label both with
// the conventional archetype names (1 = the initiator, 2 = the partner, etc).
//
// No randomness, no I/O, no claims about reality — just the arithmetic that
// the numerology tradition runs on, plus its standard labels.

export interface RootResult {
  /** Sequence of intermediate sums shown to the user, e.g. ["1+3+3+7=14", "1+4=5"]. */
  steps: string[];
  /** Final single-digit root, 0–9. (0 only when the input has no usable digits/letters.) */
  root: number;
}

const ARCHETYPE: Record<number, string> = {
  0: 'the cipher',
  1: 'the initiator',
  2: 'the partner',
  3: 'the speaker',
  4: 'the builder',
  5: 'the seeker',
  6: 'the harmoniser',
  7: 'the mystic',
  8: 'the powerful',
  9: 'the completer',
};

export function archetype(root: number): string {
  return ARCHETYPE[root] ?? 'the cipher';
}

/**
 * Recursive digital sum of the digits in `raw`. Non-digit characters
 * (commas, decimal points, minus signs) are ignored. Returns `null` if
 * there are no digits at all.
 */
export function digitalRoot(raw: string | number): RootResult | null {
  const digits = String(raw).replace(/[^0-9]/g, '');
  if (!digits) return null;

  const steps: string[] = [];
  let current = digits;
  while (current.length > 1) {
    const parts = current.split('');
    const sum = parts.reduce((acc, d) => acc + Number(d), 0);
    steps.push(`${parts.join('+')}=${sum}`);
    current = String(sum);
  }
  return { steps, root: Number(current) };
}

/**
 * Pythagorean letter cipher: A=1, B=2, …, I=9, J=1 again, … Z=8.
 * Returns null if `word` has no a–z letters.
 */
export function pythagoreanRoot(word: string): RootResult | null {
  const letters = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!letters) return null;

  const values = [...letters].map((c) => ((c.charCodeAt(0) - 97) % 9) + 1);
  const sumExpr = values.join('+');
  const sum = values.reduce((a, b) => a + b, 0);

  const steps: string[] = [`${sumExpr}=${sum}`];
  let current = String(sum);
  while (current.length > 1) {
    const parts = current.split('');
    const s = parts.reduce((acc, d) => acc + Number(d), 0);
    steps.push(`${parts.join('+')}=${s}`);
    current = String(s);
  }
  return { steps, root: Number(current) };
}
