/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run dev` serves the app on :5173 and forwards /api to the X server on :8787.
// `--mode single` bundles everything into one HTML file (used for the shareable preview).
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist', assetsInlineLimit: mode === 'single' ? 100000000 : 4096 },
  test: { environment: 'node' },
}));
