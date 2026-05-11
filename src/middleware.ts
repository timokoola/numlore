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
  const response = await next();
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('Content-Security-Policy', CSP);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  return response;
});
