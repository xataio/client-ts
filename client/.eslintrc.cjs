module.exports = {
  ignorePatterns: ["dist"],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: 'client/tsconfig.json'
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-floating-promises': 'error',
  }
};
