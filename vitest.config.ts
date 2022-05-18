/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    // TODO: Parallelize tests and mark integration tests as long-running
    testTimeout: 50000,
    hookTimeout: 50000,
    exclude: [
      // Default values
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      // The CI is tested with mocha, so vitest must ignore it
      'cli/**'
    ]
  }
});
