#!/usr/bin/env tsx
// Privacy audit. Runs as part of `pnpm build` (pre and post phases).
//
// Pre-build phase: static analysis of src/, functions/, workers/, scripts/
//   - Imports from analytics denylist
//   - fetch() calls to hosts outside src/lib/fetch-allowlist.ts
//   - console.log in functions/ or workers/ source
//   - KV.put / R2.put / D1.execute / caches.default.put outside the submit
//     route and review-queue module
//
// Post-build phase: scan dist/ for:
//   - External <script> or <link rel="stylesheet">
//   - Forbidden process-internal strings appearing in /privacy, /submit,
//     /about, /credits, or footer markup
//
// Exits non-zero on any violation. Deploy fails on red.

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FETCH_ALLOWLIST } from '../src/lib/fetch-allowlist';
import { SCRIPT_ALLOWLIST } from '../src/lib/script-allowlist';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const ANALYTICS_DENYLIST = [
  /^@sentry\//,
  /^posthog-/,
  /^plausible-tracker$/,
  /^mixpanel-/,
  /^@vercel\/analytics/,
  /(^|[^a-z])gtag([^a-z]|$)/,
  /^react-ga/,
];

const PERSISTENCE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bKV\.put\b/, label: 'KV.put' },
  { pattern: /\bR2\.put\b/, label: 'R2.put' },
  { pattern: /\bD1\.execute\b/, label: 'D1.execute' },
  { pattern: /\bcaches\.default\.put\b/, label: 'caches.default.put' },
];

const SUBMIT_FLOW_ALLOWED = new Set([
  'src/pages/submit.astro',
  'src/lib/review-queue.ts',
]);

// The audit script itself names the patterns it scans for. Exempt it from
// content-pattern checks so the audit doesn't trip over its own rule table.
const AUDIT_SELF_EXEMPT = new Set([
  'scripts/privacy-audit.ts',
]);

const WORKER_LOG_DIRS = ['functions', 'workers', 'src/pages/n', 'src/pages/og'];

const FORBIDDEN_PROCESS_STRINGS = [
  'pull request',
  'GitHub',
  'PR',
  'repository',
  'commit',
  'branch',
];

const USER_FACING_HTML = [
  'dist/privacy/index.html',
  'dist/about/index.html',
  'dist/credits/index.html',
  'dist/submit/index.html',
  'dist/index.html',
];

interface Violation {
  rule: string;
  file: string;
  detail: string;
}

const violations: Violation[] = [];

function violate(rule: string, file: string, detail: string) {
  violations.push({ rule, file, detail });
}

async function walk(dir: string, exts: string[]): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full, exts)));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

async function preAudit() {
  const sourceDirs = ['src', 'scripts', 'functions', 'workers'];
  const exts = ['.ts', '.tsx', '.js', '.mjs', '.astro'];

  const files: string[] = [];
  for (const dir of sourceDirs) {
    files.push(...(await walk(join(ROOT, dir), exts)));
  }

  for (const file of files) {
    const rel = relative(ROOT, file).split(sep).join('/');
    if (AUDIT_SELF_EXEMPT.has(rel)) continue;
    let content: string;
    try {
      content = await readFile(file, 'utf8');
    } catch {
      continue;
    }

    // Analytics denylist
    const importRegex = /^\s*(?:import|export)[^'"\n]*['"]([^'"]+)['"]/gm;
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(content))) {
      const spec = m[1];
      for (const deny of ANALYTICS_DENYLIST) {
        if (deny.test(spec)) {
          violate('analytics-import', rel, `import of "${spec}"`);
        }
      }
    }

    // fetch() to hosts outside the allowlist
    const fetchRegex = /fetch\(\s*['"`]([^'"`]+)['"`]/g;
    while ((m = fetchRegex.exec(content))) {
      const target = m[1];
      try {
        const host = new URL(target).host;
        if (host && !FETCH_ALLOWLIST.includes(host)) {
          violate('disallowed-fetch', rel, `fetch host "${host}" not in allowlist`);
        }
      } catch {
        // Not an absolute URL; same-origin or relative fetch is fine.
      }
    }

    // Persistence outside the submit flow
    for (const { pattern, label } of PERSISTENCE_PATTERNS) {
      if (pattern.test(content) && !SUBMIT_FLOW_ALLOWED.has(rel)) {
        violate('persistence-outside-submit-flow', rel, `${label} used outside submit flow`);
      }
    }

    // console.log in worker-shaped paths
    if (WORKER_LOG_DIRS.some((d) => rel.startsWith(d + '/'))) {
      if (/\bconsole\.log\s*\(/.test(content)) {
        violate('console-log-in-worker', rel, 'console.log present in worker/SSR source');
      }
    }
  }
}

async function postAudit() {
  const distDir = join(ROOT, 'dist');
  let exists = false;
  try {
    await stat(distDir);
    exists = true;
  } catch {
    // No dist/ yet — likely a dry run. Skip post-audit.
  }
  if (!exists) return;

  const htmlFiles = await walk(distDir, ['.html']);

  const externalScriptRe = /<script\b[^>]*\bsrc=["']([^"']+)["']/gi;
  const externalStyleRe = /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["']/gi;

  for (const file of htmlFiles) {
    const rel = relative(ROOT, file).split(sep).join('/');
    const content = await readFile(file, 'utf8');

    let sm: RegExpExecArray | null;
    while ((sm = externalScriptRe.exec(content))) {
      const src = sm[1];
      if (src.startsWith('/') && !src.startsWith('//')) continue; // same-origin
      if (SCRIPT_ALLOWLIST.includes(src)) continue;
      violate('external-script', rel, `script src="${src}" not on the allowlist`);
    }

    let lm: RegExpExecArray | null;
    while ((lm = externalStyleRe.exec(content))) {
      const href = lm[1];
      if (href.startsWith('/') && !href.startsWith('//')) continue; // same-origin
      violate('external-stylesheet', rel, `stylesheet href="${href}" loads from an off-origin URL`);
    }
  }

  for (const target of USER_FACING_HTML) {
    let content: string;
    try {
      content = await readFile(join(ROOT, target), 'utf8');
    } catch {
      continue;
    }
    for (const phrase of FORBIDDEN_PROCESS_STRINGS) {
      const re = new RegExp(`\\b${phrase}\\b`, 'i');
      if (re.test(stripTags(content))) {
        violate('process-string-in-user-copy', target, `"${phrase}" appears in user-facing markup`);
      }
    }
  }
}

function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ');
}

function parsePhase(): 'pre' | 'post' | 'both' {
  const arg = process.argv.find((a) => a.startsWith('--phase='));
  if (!arg) return 'both';
  const value = arg.split('=')[1];
  if (value === 'pre' || value === 'post') return value;
  return 'both';
}

async function main() {
  const phase = parsePhase();
  if (phase === 'pre' || phase === 'both') await preAudit();
  if (phase === 'post' || phase === 'both') await postAudit();

  if (violations.length === 0) {
    console.log(`privacy-audit: clean (phase=${phase})`);
    return;
  }

  console.error(`privacy-audit: ${violations.length} violation(s) — deploy MUST fail.`);
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.file}: ${v.detail}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('privacy-audit: crashed', err);
  process.exit(2);
});
