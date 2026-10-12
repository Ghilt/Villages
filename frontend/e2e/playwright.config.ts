import { defineConfig } from '@playwright/test';

import { ROOT, testPorts } from './servers.ts';

const { web, game } = testPorts();

/**
 * The game end to end, in the Chrome on this machine rather than one Playwright downloads: a dev server and a game
 * server of the test's own, on this tree's ports a thousand up, the page pointed at the test's game server. What it
 * leaves behind - the report, and a trace of any test that failed - goes to .logs/e2e. See docs/TESTING.md.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.e2e.ts',
  timeout: 5 * 60_000,
  expect: { timeout: 30_000 },
  workers: 1,
  globalSetup: './setup.ts',
  globalTeardown: './teardown.ts',
  outputDir: `${ROOT}/.logs/e2e/results`,
  reporter: [['list'], ['html', { open: 'never', outputFolder: `${ROOT}/.logs/e2e/report` }]],
  use: {
    baseURL: `http://localhost:${web}`,
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 800 },
    // The map is WebGL 2, which a headless Chrome draws in software only when told it may.
    launchOptions: {
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
    },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite --port ${web} --strictPort`,
    cwd: `${ROOT}/frontend/apps/web`,
    url: `http://localhost:${web}`,
    env: { VITE_GATEWAY_URL: `ws://localhost:${game}/ws` },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
