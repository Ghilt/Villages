import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'protocol',
          root: 'packages/protocol',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'client-core',
          root: 'packages/client-core',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'world',
          root: 'packages/world',
          environment: 'node',
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
          include: ['**/*.test.ts'],
        },
      },
      {
        test: {
          // The repository's own rules, which read the whole tree: the size ceilings. See docs/adr/0072.
          name: 'tools',
          root: 'tools',
          environment: 'node',
          include: ['**/*.test.ts'],
        },
      },
    ],
  },
});
