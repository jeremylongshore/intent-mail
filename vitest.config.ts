import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Include test files
    include: ['src/**/*.test.ts'],

    // Exclude the browser front-end (.tsx, vite-specific). The Node-side web
    // API server under src/web/server IS tested.
    exclude: [
      'node_modules',
      'dist',
      'src/web/**/*.tsx',
    ],

    // Use Node environment
    environment: 'node',

    // TypeScript support
    typecheck: {
      enabled: false, // Tests are type-checked separately
    },

    // Globals for describe/it/expect
    globals: true,

    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      // Measure coverage over the code the suite exercises (default behaviour:
      // files imported by tests). Test/type/entrypoint files are excluded.
      exclude: [
        'node_modules/',
        'dist/',
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/web/**', // frontend (vite-built, not unit-tested here)
      ],
      // Floor pinned just below the 2026-06-23 baseline (stmts 69.4 / br 60.8 /
      // fn 69.4 / ln 69.6). Raising these is the ratchet; never lower without
      // engineer sign-off (tracked in tests/TESTING.md).
      thresholds: {
        statements: 65,
        branches: 55,
        functions: 60,
        lines: 65,
      },
    },
  },
});
