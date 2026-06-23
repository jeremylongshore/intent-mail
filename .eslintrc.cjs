// ESLint config (ESLint 8 + @typescript-eslint 6).
//
// Scoped to the Node/TS backend under src (TypeScript). The React frontend
// under src/web is linted by its own toolchain (vite) and excluded here. Noisy
// stylistic rules are warnings, not errors, so the gate runs green while still
// surfacing real problems; genuine bugs (no-undef, no-unused-vars) stay errors.

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'src/web/', // React frontend — vite toolchain
    '**/*.d.ts',
    '.audit-harness/',
  ],
  rules: {
    // Real-bug rules stay as errors (from recommended): no-undef (TS-aware),
    // no-fallthrough, no-constant-condition, etc.

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
    // Pre-existing legacy patterns in a few modules — surfaced as warnings on
    // first lint introduction, to tighten to errors in a later cleanup pass.
    'no-case-declarations': 'warn',
    '@typescript-eslint/no-var-requires': 'warn',
    // Allow deliberate `while (true)` paging loops (they break internally);
    // still catch constant conditions in if-statements.
    'no-constant-condition': ['error', { checkLoops: false }],
  },
};
