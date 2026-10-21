import { defineConfig } from 'vitest/config';

/**
 * How long a test may run before it is called hung, twenty seconds, Adam's number of 2026-10-21, and a hook that
 * readies one sixty, because a hook loads cold what the tests then share; Vitest's own are five and ten. The limit is
 * there to catch a test that never ends, not to time one: how long the tests take is kept and charted by `check.ts
 * --record` (decision record 0106). Every tree on this machine shares its cores, and another tree's end-to-end test
 * draws the game in software on nine of them, which made a test of two seconds take six and fail for no fault of its
 * own, six of them in one run on 2026-10-21. See docs/TESTING.md.
 */
const PATIENCE = { testTimeout: 20_000, hookTimeout: 60_000 };

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'protocol',
          root: 'packages/protocol',
          environment: 'node',
          ...PATIENCE,
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'client-core',
          root: 'packages/client-core',
          environment: 'node',
          ...PATIENCE,
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'world',
          root: 'packages/world',
          environment: 'node',
          ...PATIENCE,
          // `bin/` too: how the tools treat a link, and what the world cache files a step under, are rules
          // every tree's world depends on rather than details of a tool.
          include: ['src/**/*.test.ts', 'bin/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'web',
          root: 'apps/web',
          environment: 'node',
          ...PATIENCE,
          // The stylesheets are read as text by the checks - the component library's, and the folder rule's,
          // which follows a stylesheet's imports - and Vitest hands any stylesheet it is not told about over
          // as an empty string, `?raw` or not.
          css: { include: [/\/src\/.*\.css/] },
          // `vite/` too: the dev server's own code decides which port a worktree answers on, and that
          // is a rule two things depend on rather than a detail of a config.
          include: ['src/**/*.test.{ts,tsx}', 'vite/**/*.test.ts'],
        },
      },
      {
        test: {
          // The performance tool's own reckoning: what a run of frames comes to, and where a tree keeps its levels.
          name: 'perf',
          root: 'perf',
          environment: 'node',
          ...PATIENCE,
          include: ['**/*.test.ts'],
        },
      },
      {
        test: {
          // The repository's own rules, which read the whole tree: the size ceilings. See docs/adr/0072.
          name: 'tools',
          root: 'tools',
          environment: 'node',
          ...PATIENCE,
          include: ['**/*.test.ts'],
        },
      },
    ],
  },
});
