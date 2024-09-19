module.exports = {
  ignorePatterns: ["dist"],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: 'cli/tsconfig.json'
  },
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
  }
};
