import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// The core of the client must stay free of the interface: no framework, no map, no renderer, no DOM.
// The DOM part is enforced by the compiler as well, because those packages are typechecked without DOM
// type definitions. See docs/ARCHITECTURE.md.
const CORE_MAY_NOT_IMPORT = ['react', 'react-*', 'react-dom', 'maplibre-gl', 'pixi.js', '@villages/web'];

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/playwright-report/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/client-core/**/*.ts', 'packages/protocol/**/*.ts', 'packages/world/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: CORE_MAY_NOT_IMPORT }],
    },
  },
  {
    // The page draws a world with what `@villages/world` hands it and nothing the world was made with: the
    // generator is `/build` and the worked examples are `/testing`, for the tools and the tests. See the
    // package's index.
    files: ['apps/web/src/**/*.ts', 'apps/web/src/**/*.tsx'],
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@villages/world/*'],
              message:
                'The page takes only what @villages/world hands it: /build and /testing are for tools and tests.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
