import type { Config } from 'tailwindcss';
import * as path from 'path';

// Content paths are anchored to this file (not process.cwd()), so styles
// build identically whether Next runs from apps/web (npm --prefix) or from
// the repo root (root `npm run dev:web`, which keeps npm-noise away).
const anchored = (glob: string) => path.join(__dirname, glob).replace(/\\/g, '/');

/**
 * Colors are wired to CSS variables so the whole theme re-skins from the
 * white-label `/api/branding` response at runtime — no rebuild needed.
 */
const config: Config = {
  content: [anchored('src/**/*.{ts,tsx}')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--brand-primary) / <alpha-value>)',
          soft: 'rgb(var(--brand-primary) / 0.12)',
        },
        accent: 'rgb(var(--brand-secondary) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      borderRadius: {
        xl: '0.9rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.15)',
        lift: '0 12px 40px -12px rgb(0 0 0 / 0.25)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};
export default config;
