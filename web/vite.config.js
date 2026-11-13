import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dep = (name) => path.resolve(here, 'node_modules', name);

// Reutiliza htmlToMarkdown de la app de escritorio (../src/utils/markdown.ts); sus dependencias se resuelven aquí
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { turndown: dep('turndown'), marked: dep('marked') } },
  server: { port: 5174, proxy: { '/api': 'http://localhost:3000', '/health': 'http://localhost:3000' } },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
