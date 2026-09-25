// ESLint flat config (ESLint 10 + typescript-eslint 8).
//
// Scoped to the Node/TS backend under src (TypeScript). The React frontend
// under src/web is linted by its own toolchain (vite) and excluded here. Noisy
// stylistic rules are warnings, not errors, so the gate runs green while still
// surfacing real problems; genuine bugs (no-unused-vars etc.) stay errors.
// Migrated from .eslintrc.cjs (ESLint 8 + @typescript-eslint 6) on 2026-09-25.

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'src/web/', // React frontend — vite toolchain
      '**/*.d.ts',
      '.audit-harness/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2021 },
    },
    rules: {
      // Unused vars: error, but allow intentional underscore-prefixed throwaways.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // `any` is sometimes pragmatic at MCP/Graph boundaries — warn, don't block.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Non-null assertions are used deliberately on provider clients — allow.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // The MCP server logs to stderr by design.
      'no-console': 'off',
      // TS empty functions / ts-comments occasionally appear — warn.
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      // Legacy patterns paid down 2026-06: case-declaration bodies wrapped in
      // blocks, lazy `require()`s converted to static ESM imports. Now errors.
      // (typescript-eslint 8 renamed no-var-requires to no-require-imports.)
      'no-case-declarations': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      // Allow deliberate `while (true)` paging loops (they break internally);
      // still catch constant conditions in if-statements.
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
);
