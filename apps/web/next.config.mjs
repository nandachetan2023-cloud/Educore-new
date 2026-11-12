/**
 * Production builds use `.next`; the dev server uses `.next-runtime-dev`.
 * Sharing one distDir lets `next build` overwrite chunks the dev server has
 * in memory, which corrupts it (MODULE_NOT_FOUND on webpack chunk files).
 * NOTE: Next loads this config *before* setting process.env.NEXT_PHASE, so
 * the phase must come from the config-function argument (the documented API).
 * Phase literals are compared directly to avoid ESM resolution issues with
 * the `next/constants` subpath on this Next version.
 *
 * @param {string} phase
 * @returns {import('next').NextConfig}
 */
export default function config(phase) {
  const isProd = phase === 'phase-production-build' || phase === 'phase-production-server';
  // The API listens on its own origin (global `api` prefix, default port 4000).
  // Proxying same-origin `/api/*` through Next means the browser bundle never
  // bakes in an API host (the previous localhost:4000 fallback broke every
  // deployed login) and no CORS setup is needed.
  const apiOrigin = process.env.API_URL ?? 'http://localhost:4000';
  return {
    distDir: isProd ? '.next' : '.next-runtime-dev',
    reactStrictMode: true,
    images: {
      remotePatterns: [{ protocol: 'https', hostname: '**' }],
    },
    async rewrites() {
      return [
        { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
        // Uploaded files (logos, thumbnails, lesson resources) are stored by the
        // API and referenced as relative URLs — proxy them so they resolve from
        // whatever origin the storefront is served on instead of breaking with a
        // hard-coded API host.
        { source: '/uploads/:path*', destination: `${apiOrigin}/uploads/:path*` },
      ];
    },
  };
}
