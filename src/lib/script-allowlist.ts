// Allowlist of off-origin script URLs permitted in built HTML.
// The privacy audit hard-fails when built HTML contains any <script src=...>
// whose URL is not on this list. Same rule for <link rel="stylesheet">.
//
// Adding to this list is a load-bearing decision. Pair it with:
//   - CSP changes in src/middleware.ts (script-src / connect-src)
//   - /privacy copy update (the user-facing list of what we do and don't use)
//   - docs/PRIVACY.md update
//   - NOTICE entry attributing the third party

export const SCRIPT_ALLOWLIST: ReadonlyArray<string> = [
  'https://glyphex.io/tracker.js',
];

export function isAllowedScriptUrl(url: string): boolean {
  return SCRIPT_ALLOWLIST.includes(url);
}
