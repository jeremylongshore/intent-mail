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
  },
});
