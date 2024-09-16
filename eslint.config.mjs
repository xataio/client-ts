// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-var-requires": "off",
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      "@typescript-eslint/no-unused-expressions": "off",
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    }
  },
  {
    files: ['test/**/*.ts', '*.test.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 0
    }
  },
  {
    ignores: [
      'node_modules',
      'babel.config.js',
      'rollup.config.js',
      'dist',
      "**/dist",
      'bin',
      'packages/client/src/api/dataPlaneComponents.ts',
      'packages/client/src/api/controlPlaneComponents.ts'
    ]
  }
);
