# Privacy contract (load-bearing)

Numlore does not record individual choices that can be mapped back to a
person. This contract is enforced at build time by
`scripts/privacy-audit.ts`. Deploys fail on red.

## What we measure

- Aggregate page analytics via **Glyphex** (`https://glyphex.io`).
- Pages we count: every prerendered route and every SSR number page.
- Search inputs typed into the home-page box never leave the browser unless
  the user clicks through to a results page; the lookup itself is a normal
  URL hit.

## Rules

- Glyphex is the only permitted third-party script. The audit rejects every
  other off-origin `<script>` or `<link rel="stylesheet">`.
- Self-host all fonts.
- No cookies outside `/submit` (Turnstile only, transient).
- SSR Worker handlers for `/n/[number]`, `/w/[word]`, `/og/*` MUST NOT:
  - call `console.log` with any request data (URL, params, headers)
  - write to KV / R2 / D1 / Durable Objects / external services
  - fetch any URL outside `src/lib/fetch-allowlist.ts`
- Only `src/pages/submit.astro` and `src/lib/review-queue.ts` may persist user-provided data.
- No fingerprinters, session recorders, A/B testing tools, or ad networks. Ever.

## Headers (set globally)

- `Referrer-Policy: same-origin`
- Strict CSP. `script-src` and `connect-src` allow `'self'` plus
  `https://glyphex.io`. Everything else stays locked down.
- No `Set-Cookie` outside the submit flow.

## Build-time enforcement

`scripts/privacy-audit.ts` runs as part of `pnpm build` and hard-fails on:

- Imports from the analytics denylist (`@sentry/*`, `posthog-*`, `plausible-tracker`, `mixpanel-*`, `@vercel/analytics`, `gtag`, `react-ga*`)
- External `<script>` or `<link rel="stylesheet">` in built HTML whose `src`/`href` is not on the allowlist (currently: `https://glyphex.io/tracker.js`)
- `fetch()` calls to hosts not in `src/lib/fetch-allowlist.ts`
- `KV.put`, `R2.put`, `D1.execute`, `caches.default.put` outside `src/pages/submit.astro` and `src/lib/review-queue.ts`
- `console.log` in `functions/` or `workers/` source
- The strings "pull request", "GitHub", "PR", "repository", "commit", "branch" appearing in built `/privacy`, `/submit`, `/about`, `/credits`, or footer markup

Adding a new permitted third party means editing the allowlist, the CSP,
the `/privacy` copy, and `NOTICE` in the same change — the audit is
designed to make the cost visible.

## User-facing copy

The canonical user-facing privacy copy lives on `/privacy`. Do not
paraphrase it without updating this contract.

## Submission flow

Submissions go through editorial review; accepted entries are published as
YAML entries in the repo. The storage mechanism behind `/submit` is
implementation detail and must not appear in user-facing copy. The
interface is `ReviewQueue` in `src/lib/review-queue.ts`; the v1 backend is
swappable without changing the route or copy.
