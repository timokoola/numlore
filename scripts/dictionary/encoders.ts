// ARPAbet → Major / T9 / leet encoders. Pure functions. No I/O.
//
// Major System mapping (ARPAbet phoneme → digit). Vowels, W, Y, H are ignored.
//   S, Z              → 0
//   T, D, TH, DH      → 1
//   N, NG             → 2
//   M                 → 3
//   R, ER             → 4
//   L                 → 5
//   SH, ZH, CH, JH    → 6
//   K, G              → 7
//   F, V              → 8
//   P, B              → 9

const ARPABET_TO_MAJOR: Record<string, string> = {
  S: '0', Z: '0',
  T: '1', D: '1', TH: '1', DH: '1',
  N: '2', NG: '2',
  M: '3',
  R: '4', ER: '4',
  L: '5',
  SH: '6', ZH: '6', CH: '6', JH: '6',
  K: '7', G: '7',
  F: '8', V: '8',
  P: '9', B: '9',
};

// Strip ARPAbet stress markers (e.g., AH0, IH1, ER2).
function stripStress(phoneme: string): string {
  return phoneme.replace(/[0-9]+$/, '').toUpperCase();
}

export function arpabetToMajor(phonemes: ReadonlyArray<string>): string {
  let out = '';
  for (const raw of phonemes) {
    const p = stripStress(raw);
    const digit = ARPABET_TO_MAJOR[p];
    if (digit !== undefined) out += digit;
  }
  return out;
}

const T9: Record<string, string> = {
  A: '2', B: '2', C: '2',
  D: '3', E: '3', F: '3',
  G: '4', H: '4', I: '4',
  J: '5', K: '5', L: '5',
  M: '6', N: '6', O: '6',
  P: '7', Q: '7', R: '7', S: '7',
  T: '8', U: '8', V: '8',
  W: '9', X: '9', Y: '9', Z: '9',
};

export function wordToT9(word: string): string {
  let out = '';
  for (const ch of word.toUpperCase()) {
    const digit = T9[ch];
    if (digit !== undefined) out += digit;
  }
  return out;
}

const LEET_DIGITS: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '2': 'Z',
  '3': 'E',
  '4': 'A',
  '5': 'S',
  '6': 'G',
  '7': 'T',
  '8': 'B',
  '9': 'P',
};

export function digitsToLeet(digits: string): string {
  let out = '';
  for (const d of digits) {
    out += LEET_DIGITS[d] ?? d;
  }
  return out;
}
