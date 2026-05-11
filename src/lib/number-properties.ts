// Programmatic detection of "calculation numbers" — numbers whose own
// digits encode a small piece of arithmetic. The detector surfaces hits
// as math-system mappings on every number page that has them.
//
// Pure functions, no I/O. Safe for the worker runtime.
//
// Patterns detected:
//   - Fibonacci-style digit sequence    (1235, 112358, 11235813, …)
//   - Three-part split a + b = c        (112: 1+1=2; 12345: 12+3=15? no — 123+45=168 no; etc)
//   - Three-part split a × b = c        (236: 2 × 3 = 6; 248: 2 × 4 = 8)
//   - Concatenation of two squares      (3625 = 36 ∥ 25 = 6² ∥ 5²)
//   - Narcissistic / Armstrong          (153 = 1³+5³+3³; 1634 = 1⁴+6⁴+3⁴+4⁴)
//   - Factorion                         (145 = 1!+4!+5!; 40585)
//   - Perfect number                    (6, 28, 496, 8128)

export interface CalcPattern {
  /** Short tag for grouping/styling. */
  kind: 'fib-digits' | 'sum-split' | 'product-split' | 'concat-squares' | 'narcissistic' | 'factorion' | 'perfect';
  /** Human-readable expansion shown to the user. */
  description: string;
}

const FACTORIAL = [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880];

/**
 * Find calculation-style patterns in the given digit string or integer.
 * Returns at most a handful of patterns; cheap enough to call per page.
 */
export function findCalculationPatterns(raw: string | number): CalcPattern[] {
  const digits = String(raw).replace(/[^0-9]/g, '');
  if (digits.length === 0) return [];

  const out: CalcPattern[] = [];
  const n = Number(digits);

  // ─── Fibonacci-style digit sequence ────────────────────────────────────
  if (digits.length >= 3) {
    let fibLike = true;
    for (let i = 2; i < digits.length; i++) {
      if (Number(digits[i]) !== Number(digits[i - 1]) + Number(digits[i - 2])) {
        fibLike = false; break;
      }
    }
    if (fibLike) {
      out.push({
        kind: 'fib-digits',
        description: `${digits.split('').join(', ')} — each digit is the sum of the previous two`,
      });
    }
  }

  // ─── Three-part splits: a + b = c, a × b = c ──────────────────────────
  const validPart = (s: string) => s.length === 1 || !s.startsWith('0');
  if (digits.length >= 3) {
    for (let i = 1; i < digits.length - 1; i++) {
      for (let j = i + 1; j < digits.length; j++) {
        const aStr = digits.slice(0, i);
        const bStr = digits.slice(i, j);
        const cStr = digits.slice(j);
        if (!validPart(aStr) || !validPart(bStr) || !validPart(cStr)) continue;
        const a = Number(aStr), b = Number(bStr), c = Number(cStr);
        if (a + b === c && a > 0 && b > 0) {
          out.push({ kind: 'sum-split', description: `${a} + ${b} = ${c}` });
        }
        if (a * b === c && a > 1 && b > 1) {
          out.push({ kind: 'product-split', description: `${a} × ${b} = ${c}` });
        }
      }
    }
  }

  // ─── Concatenation of two perfect squares (even length, halve) ────────
  if (digits.length >= 2 && digits.length % 2 === 0) {
    const mid = digits.length / 2;
    const left = digits.slice(0, mid);
    const right = digits.slice(mid);
    if (validPart(left) && validPart(right)) {
      const ln = Number(left), rn = Number(right);
      const lr = Math.sqrt(ln), rr = Math.sqrt(rn);
      if (Number.isInteger(lr) && Number.isInteger(rr) && lr > 0 && rr > 0) {
        out.push({
          kind: 'concat-squares',
          description: `${left} ∥ ${right} = ${lr}² ∥ ${rr}² — two squares concatenated`,
        });
      }
    }
  }

  // ─── Narcissistic / Armstrong: Σ dᵏ = n where k is digit count ────────
  if (digits.length >= 3 && n <= 1_000_000) {
    const k = digits.length;
    let sum = 0;
    for (const d of digits) sum += Math.pow(Number(d), k);
    if (sum === n) {
      const parts = [...digits].map((d) => `${d}^${k}`).join(' + ');
      out.push({
        kind: 'narcissistic',
        description: `${parts} = ${n} — narcissistic / Armstrong number`,
      });
    }
  }

  // ─── Factorion: Σ d! = n ──────────────────────────────────────────────
  if (digits.length >= 1 && n >= 1 && n <= 1_000_000) {
    let sum = 0;
    for (const d of digits) sum += FACTORIAL[Number(d)];
    if (sum === n && n > 9) {
      const parts = [...digits].map((d) => `${d}!`).join(' + ');
      out.push({
        kind: 'factorion',
        description: `${parts} = ${n} — factorion`,
      });
    }
  }

  // ─── Perfect number: sum of proper divisors equals n ──────────────────
  if (n >= 6 && n <= 1_000_000) {
    let sum = 1;
    for (let i = 2; i * i <= n; i++) {
      if (n % i === 0) {
        sum += i;
        if (i !== n / i) sum += n / i;
      }
    }
    if (sum === n) {
      out.push({
        kind: 'perfect',
        description: `sum of proper divisors equals ${n} — perfect number`,
      });
    }
  }

  return out;
}
