# Architecture

## Hybrid static + edge SSR

Astro with `output: "hybrid"` on the Cloudflare adapter. Most routes are
prebuilt at deploy time; a small set is rendered on demand at the edge and
cached for one year via the Cloudflare Cache API.

### Prebuilt

- All curated YAML entries under `data/entries/`
- Every integer `0–9999` (full pages)
- "Notable" 5–6 digit numbers: years 1000–2100, repdigits, palindromes,
  ascending/descending sequences, common PINs, well-known codes
  (90210, 31337, …). Rules live in `scripts/notable.ts` for auditability.
- All category, word, and system pages

### On-demand (SSR Worker, edge-cached)

- `/n/[number]` for any 5–6 digit number not in the prebuilt set
- `/og/n/[number]` for longtail OG images

Both use the Cloudflare Cache API with one-year TTL and are purged on data
change.

## Tiering

Each number page resolves to one of:

| Tier     | Source              | Indexable | In sitemap | Page design |
| -------- | ------------------- | --------- | ---------- | ----------- |
| curated  | manual YAML         | yes       | yes        | full        |
| notable  | auto-flag rules     | yes       | yes        | full        |
| longtail | algorithmic only    | no        | no         | minimal     |

Tier is computed at build, not declared per entry.

## Dictionary pipeline

Vendored sources under `data/dictionaries/_sources/`. Never fetched at build
time. `pnpm dict:build` joins them and outputs three artifacts to
`data/dictionaries/compiled/`:

- `words.json` — unified table (build-time only, ~150k rows)
- `mnemonic-index.json` — Major skeleton → top 20 ranked candidate words
  (bundled with the SSR worker, ~500KB gz)
- `search-words.json` — slim top-20k for client search (~150KB gz, shipped to
  the browser)

The Major System encoder is a pure function in
`scripts/dictionary/encoders.ts`. ARPAbet → digit:

```
S, Z              → 0
T, D, TH, DH      → 1
N, NG             → 2
M                 → 3
R, ER             → 4
L                 → 5
SH, ZH, CH, JH    → 6
K, G              → 7
F, V              → 8
P, B              → 9
```

Vowels, W, Y, H ignored. Multiple pronunciations preserved as separate rows
with identical lemma.

### Ranking

```
score = zipf × concreteness_weight × pos_weight
concreteness_weight: linear, 1.0 (rating 5) down to 0.2 (rating 1)
pos_weight: noun 1.0, verb 0.7, adj 0.5, other 0.3
```

Top 20 per skeleton key are kept.

## Performance targets

- LCP < 1s on 4G for the home page
- ≤ 30KB gzipped client JS on detail pages (search shim only)
- All non-longtail pages prerendered
- Longtail SSR response < 50ms p50

## Privacy

The privacy contract is described in [PRIVACY.md](./PRIVACY.md) and enforced
by `scripts/privacy-audit.ts` as part of `pnpm build`.
