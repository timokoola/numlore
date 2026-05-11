// Allowlist of external hosts the runtime is permitted to fetch from.
// The privacy audit hard-fails when build output contains fetch() calls to
// hosts outside this list. Keep the list minimal.
//
// Current allowlist: empty. The site does not call any external services at
// runtime. Adding a host here is a load-bearing decision; pair it with a
// PRIVACY.md update and a justification in the commit message.

export const FETCH_ALLOWLIST: ReadonlyArray<string> = [];

export function isAllowedHost(host: string): boolean {
  return FETCH_ALLOWLIST.includes(host);
}
