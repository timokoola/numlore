import { defineMiddleware } from 'astro:middleware';

// Glyphex is the only permitted third party. See src/lib/script-allowlist.ts
// and /privacy. Any addition to script-src or connect-src must be paired with
// an audit + copy update.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://glyphex.io",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://glyphex.io",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self' https://challenges.cloudflare.com",
].join('; ');

export const onRequest = defineMiddleware(async (context, next) => {
  // The auto-assigned *.pages.dev hostname is not the canonical site. Bots
  // (notably GPTBot on 2026-05-13) discover it and crawl the full /n/* corpus,
  // bypassing analytics on numlore.com. Send them away cheaply.
  const host = context.url.hostname;
  if (host.endsWith('.pages.dev')) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-robots-tag': 'noindex, nofollow',
        'cache-control': 'public, max-age=86400',
      },
    });
  }

  const response = await next();
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('Content-Security-Policy', CSP);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  return response;
});
