import type { Config } from 'tailwindcss';

const scale = (c: string) => Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((k) => [k, c]));

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Monochrome theme (white · grey · black). Accent names are kept so components need no rewrite:
      // every accent maps to black/grey, "white" means the main ink (black) and "snow" is real white.
      colors: {
        white: '#000000',
        black: '#FFFFFF',
        snow: '#FFFFFF',
        locate: '#276EF1',
        ink: { 950: '#FFFFFF', 900: '#F7F7F7', 850: '#F2F2F2', 800: '#EEEEEE', 700: '#E2E2E2', 600: '#D4D4D4' },
        mist: { 100: '#000000', 200: '#1F1F1F', 300: '#545454', 400: '#6B6B6B', 500: '#A3A3A3' },
        violet: scale('#000000'),
        indigo: scale('#000000'),
        cyan: scale('#000000'),
        amber: scale('#545454'),
        emerald: scale('#3A3A3A'),
        rose: scale('#3A3A3A'),
      },
      fontFamily: {
        sans: ['Inter', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        display: ['Inter', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        ar: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 8px 24px -12px rgba(0,0,0,.35)',
        card: '0 1px 2px rgba(0,0,0,.06), 0 16px 40px -18px rgba(0,0,0,.25)',
      },
    },
  },
  plugins: [],
} satisfies Config;
