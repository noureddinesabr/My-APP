import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#05040A', 900: '#0A0814', 850: '#0F0C1C', 800: '#151126', 700: '#1E1934', 600: '#2A2446' },
        violet: { 300: '#C4B5FD', 400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED' },
        indigo: { 400: '#818CF8', 500: '#6366F1' },
        cyan: { 300: '#67E8F9', 400: '#22D3EE' },
        mist: { 100: '#F4F2FF', 200: '#D9D5EE', 300: '#ABA5C8', 400: '#7F79A0', 500: '#5B5679' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        display: ['"Sora"', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        ar: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(167,139,250,.18), 0 10px 40px -10px rgba(124,58,237,.45)',
        card: '0 1px 0 0 rgba(255,255,255,.04) inset, 0 20px 50px -20px rgba(0,0,0,.7)',
      },
    },
  },
  plugins: [],
} satisfies Config;
