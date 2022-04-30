module.exports = {
  ignorePatterns: ["dist", "example"],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: 'codegen/tsconfig.json'
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-floating-promises': 'error',
  }
};
