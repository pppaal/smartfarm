// Flat ESLint config (ESLint 9+)
export default [
  {
    files: ['src/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-console': 'off',
      eqeqeq: ['warn', 'smart'],
      'prefer-const': 'warn',
    },
  },
];
