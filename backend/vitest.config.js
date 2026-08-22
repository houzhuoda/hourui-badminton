import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/db/seed.js', 'src/app.js'],
      thresholds: {
        lines: 80,
        functions: 70,
        branches: 75,
        statements: 80,
      },
    },
  },
});
