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
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'web',
          root: 'apps/web',
          environment: 'node',
          // The component library's stylesheets are read as text by its own checks, and Vitest hands any
          // stylesheet it is not told about over as an empty string, `?raw` or not.
          css: { include: [/\/src\/ui\/.*\.css/] },
          // `vite/` too: the dev server's own code decides which port a worktree answers on, and that
          // is a rule two things depend on rather than a detail of a config.
          include: ['src/**/*.test.{ts,tsx}', 'vite/**/*.test.ts'],
        },
      },
    ],
  },
});
