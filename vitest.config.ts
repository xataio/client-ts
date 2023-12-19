/// <reference types="vitest" />
import { defineConfig } from 'vite';

process.env.FORCE_COLOR = '0';

export default defineConfig({
  test: {
    // TODO: Parallelize tests and mark integration tests as long-running
    testTimeout: 120000,
    hookTimeout: 240000,
    pool: 'forks' // this is needed to do process.chdir() in tests.
  }
});
