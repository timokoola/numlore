# Numlore

> **Engineering contract.** Numlore does not record individual choices that can be mapped back to a person. Aggregate page analytics run via Glyphex; nothing else third-party. The build pipeline hard-fails on any deviation.

A bidirectional number↔word mnemonic dictionary at **numlore.com**. Type a number, get its associations (cultural references, Major System mnemonics, T9 keypad letters, leet readings). Type a word, get the numbers it encodes to. Pages are prebuilt where curated or notable, rendered on demand at the edge otherwise.

## Stack

- Astro with the Cloudflare adapter, `output: "hybrid"` (prebuilt curated/notable, SSR longtail number pages)
- TypeScript strict
- TailwindCSS
- Cloudflare Pages hosting + Pages Functions / Workers for SSR
- Fuse.js for client-side typeahead over a precomputed slim index
- pnpm
- Satori for OG image generation
- Cloudflare Turnstile on the `/submit` form
- Glyphex for aggregate page analytics — the only third-party script on the site, and the only one the build audit permits
- Self-hosted fonts; no third-party fonts, no fingerprinters, no session recorders, no A/B tools

## Getting started

```sh
pnpm install
pnpm dev
```

Build and privacy audit:

```sh
pnpm build
```

The build runs `scripts/privacy-audit.ts` before and after Astro build. Deploy fails on red — see `docs/PRIVACY.md` for the full contract and the enforced rule set.

## Repository layout

```
data/         curated YAML entries, categories, vendored dictionary sources, compiled artifacts
scripts/      dictionary build pipeline, notable-flag rules, privacy audit
src/          Astro pages, layouts, components, libs
public/       self-hosted fonts, static assets
docs/         PRIVACY.md, ARCHITECTURE.md
NOTICE        third-party attributions
```

See `docs/ARCHITECTURE.md` for the full hybrid build + edge SSR description and `docs/PRIVACY.md` for the privacy contract.

## Tiering

Every number page is one of:

- **curated** — manual YAML entry. Indexable. In sitemap. Full page design.
- **notable** — auto-flagged significant (years 1000–2100, repdigits, palindromes, common PINs, well-known codes). Indexable. In sitemap. Full design.
- **longtail** — purely algorithmic. `noindex,follow`. Not in sitemap. Minimal design. Rendered on demand at the edge.

Tier is computed at build, not declared.

## Contributing

This is a Skadi Oy project. Standards live in [`skadicompanyassets`](https://github.com/timokoola/skadicompanyassets); local deltas should be pushed back via the sync skill in `.claude/skills/sync-skadicompanyassets/`.

## License

Internal Skadi Oy material. See `NOTICE` for third-party attributions (CMU Pronouncing Dictionary, Princeton WordNet, wordfreq, Brysbaert et al. 2014).
