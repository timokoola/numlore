# Numlore — Build Specification

> **Engineering contract.** Numlore does not record individual choices that can be mapped back to a person. Aggregate page analytics run via Glyphex; nothing else third party. The build pipeline hard-fails on any deviation.

A bidirectional number↔word mnemonic dictionary at **numlore.com**. Type a number, get its associations (cultural references, Major System mnemonics, T9 keypad letters, leet readings). Type a word, get the numbers it encodes to. Pages are prebuilt where curated or notable, rendered on demand at the edge otherwise.

---

## Stack

- **Astro** with the Cloudflare adapter, `output: "hybrid"` (prebuild most routes, SSR longtail number pages)
- **TypeScript** strict
- **TailwindCSS**
- **Cloudflare Pages** hosting + Pages Functions / Workers for SSR
- **Fuse.js** for client-side typeahead over a precomputed slim index
- **pnpm**
- **Satori** for OG image generation (build-time for notable, on-demand Worker for longtail)
- **Cloudflare Turnstile** on the `/submit` form
- **Glyphex** for aggregate page analytics — the only third-party script the site loads, and the only one the build audit permits
- Self-hosted fonts; no third-party fonts, no fingerprinters, no session recorders, no A/B tools

---

## Repository structure

```
/data/
  entries/                   # curated YAML entries
  categories/                # pSEO category definitions
  dictionaries/
    _sources/                # vendored CMU, WordNet, Brysbaert (not fetched at build)
    compiled/                # build output, committed
      words.json
      mnemonic-index.json
      search-words.json
/scripts/
  dictionary/
    fetch.ts                 # one-time source acquisition
    build.ts                 # joins sources, outputs compiled artifacts
    encoders.ts              # ARPAbet → Major, T9, leet
    index.ts                 # skeleton → ranked words
  notable.ts                 # auto-flag rules for 5–6 digit numbers
  privacy-audit.ts           # CI check (see Privacy section)
/src/
  layouts/
  components/
  pages/
    index.astro
    n/[number].astro         # prerendered: curated, 0–9999, notable 5–6 digit
    n/[...rest].astro        # SSR longtail fallback (edge-cached 1y)
    w/[word].astro
    c/[category].astro
    systems/[slug].astro
    submit.astro
    privacy.astro
    about.astro
    credits.astro
  lib/
    fetch-allowlist.ts
    script-allowlist.ts
    review-queue.ts          # swappable backend for submissions
    mnemonics.ts
/public/
  fonts/                     # self-hosted fonts (currently shipped via @fontsource-variable)
/NOTICE                      # third-party attributions
/docs/
  SPEC.md                    # this file
  PRIVACY.md
  ARCHITECTURE.md
```

---

## Architecture: hybrid static + edge SSR

### Prebuild
- All curated YAML entries
- Every integer 0–9999 (full pages)
- "Notable" 5–6 digit numbers: years 1000–2100, repdigits, palindromes, ascending/descending sequences, common PINs, well-known codes (90210, 31337, etc.)
- All category, word, and system pages

`scripts/notable.ts` owns the auto-flag rules so they're auditable and changeable.

### On-demand (SSR Worker, edge-cached)
- `/n/[number]` for any 5–6 digit number not in the prebuilt set (handled by `src/pages/n/[...rest].astro`)
- `/og/n/[number]` for longtail OG images
- Both use the Cloudflare Cache API with 1-year TTL, purged on data change

### Tiering
Every number page is one of:
- **curated** — manual YAML entry. Indexable. In sitemap. Full page design.
- **notable** — auto-flagged significant. Indexable. In sitemap. Full design.
- **longtail** — purely algorithmic. `<meta name="robots" content="noindex,follow">`. Not in sitemap. Minimal design.

Tier is computed at build, not declared.

---

## Data model

### Entries: `/data/entries/*.yaml`

```yaml
id: "007"
type: number
display: "007"
mappings:
  - system: cultural
    to: "James Bond"
    note: "Ian Fleming's MI6 agent, 1953–"
  - system: major
    to: "sock"
    note: "0=s, 0=s, 7=k (silent vowels)"
  - system: keypad
    to: "..S"
```

```yaml
id: "money"
type: word
display: "money"
mappings:
  - system: keypad
    to: "66639"
    note: "T9 phone keypad: M-O-N-E-Y"
  - system: major
    to: "32"
    note: "M=3, N=2 (silent vowels)"
phonetic_override: ["M", "AH", "N", "IY"]   # optional, fixes homographs
```

### Categories: `/data/categories/*.yaml`

```yaml
slug: bond-numbers
title: "Numbers in James Bond"
description: "Codes, agent IDs, and recurring numbers from Ian Fleming's universe."
includes:
  - "007"
  - "008"
  - "0011"
```

---

## Dictionary build pipeline

Sources vendored under `/data/dictionaries/_sources/`. Never fetched at build time.

- **CMU Pronouncing Dictionary** — ARPAbet pronunciations (~134k words)
- **WordNet 3.1** — POS, semantic hierarchy
- **Brysbaert et al. 2014** — concreteness ratings (40k words)
- **wordfreq** — dev dependency only (MIT), used at build to compute Zipf frequency; not shipped

`pnpm dict:build` joins these and outputs:

- **`words.json`** — unified table (build-time only, ~150k rows)
- **`mnemonic-index.json`** — Major skeleton → top 20 ranked candidate words (bundled with SSR worker, ~500KB gz)
- **`search-words.json`** — slim top-20k for client search (~150KB gz, shipped to browser)

Build runs only when sources change. `pnpm build` reads compiled artifacts only — no network.

### Major System encoder

ARPAbet → digit mapping, pure function in `scripts/dictionary/encoders.ts`:

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

Vowels, W, Y, H ignored. Multiple pronunciations preserved as separate rows with identical lemma.

### Ranking for mnemonic candidates

```
score = zipf × concreteness_weight × pos_weight
concreteness_weight: linear, 1.0 (rating 5) down to 0.2 (rating 1)
pos_weight: noun 1.0, verb 0.7, adj 0.5, other 0.3
```

Keep top 20 per skeleton key.

---

## Routes

```
/                       Home: search-first hero, examples
/n/[number]             Number detail (prerendered set)
/n/[...rest]            Number detail SSR longtail fallback
/w/[word]               Word detail
/c/[category]           pSEO category page
/systems                Index of mnemonic systems
/systems/[slug]         Per-system explainer
/submit                 Submission form
/privacy
/about
/credits
/sitemap.xml            curated + notable only
/search-index.json      slim typeahead index
```

## Long number page design (5–6 digits)

- Multiple chunkings (2+2+2, 3+3) with Major encoding per chunk
- Phrase mnemonic candidates assembled from `mnemonic-index.json`
- T9 keypad letters
- Mathematical properties (prime, palindrome, factors)
- Adjacent links: n−1, n+1, divisors, related notables

---

## Design system

```css
/* Type */
--font-ui:   "Inter", system-ui, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, monospace;

/* Light */
--bg:        #FAFAF7;
--text:      #1A1A1A;
--text-dim:  #555;
--accent:    #2E6AFF;   /* electric blue */
--secondary: #F5A623;   /* amber for system chips */
--border:    #E8E6DD;

/* Dark */
--bg-dark:   #0E0E10;
--text-dark: #EFEFEC;

/* Layout */
--radius: 4px;
--gutter: 24px;
```

Hero is a split search: input on the left, result on the right, flip-direction arrow between them. Numbers in mono, words in Inter. System chips (small amber labels) on result cards. Generous whitespace, sharp corners, no rounded blobs. Dark mode respects `prefers-color-scheme`.

Self-host Inter and JetBrains Mono. Never link Google Fonts.

---

## Privacy contract (load-bearing — enforced in build)

Numlore does not record individual choices that can be mapped back to a person. Aggregate page-hit counts via Glyphex are the only telemetry.

### Rules
- **Glyphex** (`https://glyphex.io/tracker.js`) is the single permitted third-party script. Anything else off-origin is rejected by the audit — no error trackers, no A/B tools, no session recorders, no ad networks, no Cloudflare Web Analytics, no third-party fonts.
- Self-host all fonts.
- No cookies outside `/submit` (Turnstile only, transient).
- SSR Worker handlers for `/n/[number]`, `/w/[word]`, `/og/*` MUST NOT:
  - call `console.log` with any request data (URL, params, headers)
  - write to KV / R2 / D1 / Durable Objects / external services
  - fetch any URL outside `src/lib/fetch-allowlist.ts`
- Only `src/pages/submit.astro` and `src/lib/review-queue.ts` may persist user-provided data.

### Headers (set globally)
- `Referrer-Policy: same-origin`
- Strict CSP: `script-src 'self' https://glyphex.io`; `connect-src 'self' https://glyphex.io`. Inline scripts disallowed.
- No `Set-Cookie` outside the submit flow.

### Build-time enforcement: `scripts/privacy-audit.ts`

Runs as part of `pnpm build` (pre + post phases). Hard-fails on:
- Imports from analytics denylist (`@sentry/*`, `posthog-*`, `plausible-tracker`, `mixpanel-*`, `@vercel/analytics`, `gtag`, `react-ga*`)
- External `<script>` or `<link rel="stylesheet">` in built HTML whose URL is not on `src/lib/script-allowlist.ts` (currently: `https://glyphex.io/tracker.js`)
- `fetch()` calls to hosts not in `src/lib/fetch-allowlist.ts`
- `KV.put`, `R2.put`, `D1.execute`, `caches.default.put` outside `src/pages/submit.astro` and `src/lib/review-queue.ts`
- `console.log` in `functions/`, `workers/`, `src/pages/n/`, or `src/pages/og/` source
- The strings "pull request", "GitHub", "PR", "repository", "commit", "branch" appearing in built `/privacy`, `/submit`, `/about`, `/credits`, or footer markup

Adding a new permitted third party means editing the allowlist, the CSP, the `/privacy` copy, `NOTICE`, and `docs/PRIVACY.md` in the same change — the audit is designed to make the cost visible.

Deploy fails on red.

---

## Submission flow

User-visible contract: submissions go through editorial review; if accepted they are published on the site. That is the entire public promise. Do **not** describe the storage mechanism to users anywhere.

Implementation isolated behind `src/lib/review-queue.ts`:

```ts
export interface PendingEntry { /* mirror of the YAML schema */ }
export interface ReviewQueue {
  submit(entry: PendingEntry): Promise<void>;
}
```

v1 backend can write to whatever's convenient. Swappable without touching the route or user copy.

Form requirements:
- Required: `id`, `type` (number|word), at least one mapping
- Turnstile challenge
- Cloudflare per-IP rate limit

---

## User-facing copy (canonical, do not paraphrase)

### Footer (every page)
> We don't log what you look up. [Why →](/privacy)

### /privacy (canonical wording)

Lives at `src/pages/privacy.astro`. The page states:

- **The promise.** Numlore does not record individual choices that can be mapped back to a person. The numbers and words you type into the search box never leave your browser until you click through to a page.
- **What we measure.** Aggregate page hits via Glyphex — counts only, no identifier we can use to single anyone out.
- **What we record.** Entries you submit through the Submit form. Submissions are held for editorial review and, if accepted, published as entries on the site.
- **What our infrastructure sees.** Cloudflare for routing; we don't query its edge logs.
- **What we don't use.** Ad networks. Fingerprinting. Session recorders. A/B testing tools. Third-party fonts or assets. Any third-party script other than Glyphex. Cookies, except a transient anti-spam token on the submission form.
- **How this is enforced.** The build pipeline fails to deploy on any deviation.

### /submit consent banner (above the form)
> Submissions go through editorial review. Accepted entries are published publicly on the site. Don't include personal information.

---

## SEO

- Static `<title>` and `<meta description>` per page, templated from primary mapping
- Schema.org `DefinedTerm` for word/number pages, `ItemList` for category and system pages
- Sitemap auto-built; includes curated + notable only
- OG image per page (prebuilt for curated/notable, on-demand Worker for longtail)
- Internal linking: numerical adjacency on every number page; category backlinks on curated entries

---

## Performance targets

- LCP < 1s on 4G for the home page
- ≤ 30KB gzipped client JS on detail pages (search shim only)
- All non-longtail pages prerendered
- Longtail SSR response < 50ms p50

---

## Attribution

`NOTICE` file at repo root credits CMU Pronouncing Dictionary, Princeton WordNet, wordfreq, Brysbaert et al. (2014), and Glyphex. The same attributions render on `/credits`.
