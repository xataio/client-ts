module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/ban-ts-comment': 'off'
  },
  overrides: [
    {
      files: ['codegen/src/**/*.ts'],
      rules: {
        'import/extensions': ['error', 'always', { ignorePackages: true }]
      }
    }
  ]
};
