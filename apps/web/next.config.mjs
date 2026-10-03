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
  return {
    distDir: isProd ? '.next' : '.next-runtime-dev',
    reactStrictMode: true,
    images: {
      remotePatterns: [{ protocol: 'https', hostname: '**' }],
    },
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api',
    },
  };
}
