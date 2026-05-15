// Related-pages helpers. Used by /n/<n> templates to surface 3–6 sibling
// numbers sharing the digital root — the cheapest topical cluster we have.
//
// Pure functions, memoized at module scope. Safe inside the worker runtime;
// the heavy enumeration of the prebuilt set is paid once per process.

import { listPrebuiltNumberIds } from './mnemonics';
import { digitalRoot } from './numerology';

let _byRoot: Map<number, string[]> | null = null;

function ensureByRoot(): Map<number, string[]> {
  if (_byRoot) return _byRoot;
  const map = new Map<number, string[]>();
  for (const id of listPrebuiltNumberIds()) {
    const r = digitalRoot(id);
    if (!r) continue;
    const arr = map.get(r.root) ?? [];
    arr.push(id);
    map.set(r.root, arr);
  }
  _byRoot = map;
  return map;
}

/**
 * Numbers from the prebuilt set sharing the digital root of `id`, excluding
 * `id` itself. Returns up to `limit` entries in the natural order of the
 * prebuilt enumeration (curated first, then 0–9999, then notable 5–6 digit).
 */
export function siblingsByRoot(id: string, limit = 5): string[] {
  const r = digitalRoot(id);
  if (!r) return [];
  const map = ensureByRoot();
  const arr = map.get(r.root) ?? [];
  const out: string[] = [];
  for (const x of arr) {
    if (x === id) continue;
    out.push(x);
    if (out.length >= limit) break;
  }
  return out;
}
