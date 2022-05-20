/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    // TODO: Parallelize tests and mark integration tests as long-running
    testTimeout: 50000,
    hookTimeout: 120000
  }
});
