import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Include test files
    include: ['src/**/*.test.ts'],

    // Exclude platform-specific code that requires optional deps
    exclude: [
      'node_modules',
      'dist',
      'src/web/**/*',
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
