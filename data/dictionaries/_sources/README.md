# Vendored dictionary sources

Place the following source files in this directory. They are committed to the
repository and **never fetched at build time**. Update them by running
`pnpm dict:fetch` (manual download) and committing the result.

- `cmudict-0.7b` — CMU Pronouncing Dictionary
- `wordnet-3.1/` — Princeton WordNet 3.1 release (data and index files)
- `brysbaert-2014.csv` — Concreteness ratings (Brysbaert, Warriner, & Kuperman, 2014)

Each source is attributed in `/NOTICE` and on `/credits`. Do not delete or
reorganize these files without updating both surfaces.
