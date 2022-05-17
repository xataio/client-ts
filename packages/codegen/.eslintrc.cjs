module.exports = {
  ignorePatterns: ["dist", "example", "scripts"],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: 'packages/codegen/tsconfig.json'
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-floating-promises': 'error',
    'import/extensions': ['error', 'always', { ignorePackages: true }]
  }
};
