import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest';

export const EMBEDDED_KEY_MARKER = 'embedded-key-warning.txt';

/**
 * When a demo API key is baked into the build, drop a marker file into dist/ so `npm run zip`
 * can refuse to package it (see scripts/zip.mjs).
 */
function embeddedKeyMarker(hasKey: boolean): Plugin {
  return {
    name: 'sve-embedded-key-marker',
    apply: 'build',
    closeBundle() {
      if (!hasKey) return;
      mkdirSync('dist', { recursive: true });
      writeFileSync(
        resolve('dist', EMBEDDED_KEY_MARKER),
        'This build contains an embedded API key (VITE_EMBEDDED_API_KEY). Do not share, zip or publish it.\n',
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const hasEmbeddedKey = (env['VITE_EMBEDDED_API_KEY'] ?? '').trim() !== '';

  return {
    plugins: [react(), crx({ manifest }), embeddedKeyMarker(hasEmbeddedKey)],
    build: {
      target: 'es2022',
      rollupOptions: {
        input: {
          onboarding: 'src/onboarding/index.html',
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      hmr: { port: 5173 },
      cors: true,
    },
  };
});
