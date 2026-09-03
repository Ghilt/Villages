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
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
