import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base so the build works on GitHub Pages under any repo name.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: { chunkSizeWarningLimit: 900 }, // Konva alone is ~300 kB
  test: { include: ['src/**/*.test.ts'] },
});
