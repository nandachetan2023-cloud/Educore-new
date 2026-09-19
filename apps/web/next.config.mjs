/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the active development build separate from an existing stale cache.
  distDir: '.next-runtime',
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api',
  },
};
export default nextConfig;
