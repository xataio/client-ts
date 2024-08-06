module.exports = {
  ignorePatterns: ['dist'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: 'packages/client/tsconfig.json'
  },
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/strict-boolean-expressions': ['error', { allowNullableString: true, allowNullableObject: true }],
  }
};
