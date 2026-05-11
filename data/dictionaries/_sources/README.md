# Dictionary sources (vendored)

These files are committed to the repository and **never re-fetched at
build time**, per the privacy contract in `/docs/PRIVACY.md`. To refresh
them, replace the file manually and re-run `pnpm dict:build`.

## Files

- **`cmudict.dict`** — CMU Pronouncing Dictionary, ARPAbet phonetic
  transcriptions for ~134k English words. Public-domain-style licence
  (see the upstream distribution). One pronunciation per line, alternates
  marked with `(2)`, `(3)`, etc. on the headword.
  Source: <https://github.com/cmusphinx/cmudict>

- **`google-10000-english-usa.txt`** — Top 10,000 English words by
  Google n-gram frequency, public-domain word list. Used to synthesise a
  Zipf-style score from word rank for the Major System ranking pass.
  Source: <https://github.com/first20hours/google-10000-english>

The compiled artifacts produced from these sources live under
`/data/dictionaries/compiled/`.

Attribution copy lives in `/NOTICE` and on `/credits`.
