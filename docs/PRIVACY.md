# Privacy contract (load-bearing)

Numlore does not log, store, or analyze user inputs except submissions to `/submit`.
This contract is enforced at build time by `scripts/privacy-audit.ts`. Deploys fail
on red.

## Rules

- No third-party scripts, ever. No analytics (including Cloudflare Web Analytics — it captures URLs). No error trackers. No A/B tools. No session recorders.
- Self-host all fonts.
- No cookies outside `/submit` (Turnstile only, transient).
- SSR Worker handlers for `/n/[number]`, `/w/[word]`, `/og/*` MUST NOT:
  - call `console.log` with any request data (URL, params, headers)
  - write to KV / R2 / D1 / Durable Objects / external services
  - fetch any URL outside `src/lib/fetch-allowlist.ts`
- Only `src/pages/submit.astro` and `src/lib/review-queue.ts` may persist user-provided data.

## Headers (set globally)

- `Referrer-Policy: same-origin`
- Strict CSP disallowing inline scripts and off-origin sources
- No `Set-Cookie` outside the submit flow

## Build-time enforcement

`scripts/privacy-audit.ts` runs as part of `pnpm build` and hard-fails on:

- Imports from analytics denylist (`@sentry/*`, `posthog-*`, `plausible-tracker`, `mixpanel-*`, `@vercel/analytics`, `gtag`, `react-ga*`)
- External `<script>` or `<link rel="stylesheet">` in built HTML
- `fetch()` calls to hosts not in `src/lib/fetch-allowlist.ts`
- `KV.put`, `R2.put`, `D1.execute`, `caches.default.put` outside `src/pages/submit.astro` and `src/lib/review-queue.ts`
- `console.log` in `functions/` or `workers/` source
- The strings "pull request", "GitHub", "PR", "repository", "commit", "branch" appearing in built `/privacy`, `/submit`, `/about`, `/credits`, or footer markup

## User-facing copy

The canonical user-facing privacy copy lives on `/privacy`. Do not paraphrase it
without updating this contract; the audit checks both surfaces against the rules
above.

## Submission flow

Submissions go through editorial review; accepted entries are published as YAML
entries in the repo. The storage mechanism behind `/submit` is implementation
detail and must not appear in user-facing copy. The interface is
`ReviewQueue` in `src/lib/review-queue.ts`; the v1 backend is swappable without
changing the route or copy.
