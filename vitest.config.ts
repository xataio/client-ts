/// <reference types="vitest" />
import { defineConfig } from 'vite';

process.env.FORCE_COLOR = '0';

export default defineConfig({
  test: {
    // TODO: Parallelize tests and mark integration tests as long-running
    testTimeout: 60000,
    hookTimeout: 120000
  }
});
