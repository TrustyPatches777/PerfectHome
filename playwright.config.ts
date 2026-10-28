import { defineConfig } from '@playwright/test';

/**
 * The specs run against a production build (built once, served by `vite preview`): the dev server sends hundreds of separate modules on every page
 * load, which made a run of 150+ tests that reload the page very slow. Several workers run spec files side by side.
 *   E2E_DEV=1      use the dev server on :5173 instead (reused when it is already running), e.g. while editing a spec against live code
 *   E2E_WORKERS=n  number of parallel workers (default 4; use 1 when a timing-sensitive 3D test misbehaves on a busy machine)
 */
const dev = !!process.env.E2E_DEV;
const port = dev ? 5173 : 5174;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false, // files run in parallel, the tests inside a file one after another
  workers: Number(process.env.E2E_WORKERS) || 4,
  retries: 1, // a few specs steer a real-time 3D walker or wait on animations and can miss a beat when 4 browsers share the CPU; a retry that passes is reported as flaky
  expect: { timeout: 10_000 }, // the test browser draws 3D in software: a scene needs seconds to show when 4 of them share the CPU
  reporter: 'list',
  outputDir: 'e2e/.results',
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1440, height: 900 },
  },
  webServer: dev
    ? { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 }
    : { command: `npx vite build && npx vite preview --port ${port} --strictPort`, url: `http://localhost:${port}`, reuseExistingServer: false, timeout: 120_000 },
});
