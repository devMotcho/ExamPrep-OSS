module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['unused-imports'],
  rules: {
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'warn',
      { 'vars': 'all', 'varsIgnorePattern': '^_', 'args': 'after-used', 'argsIgnorePattern': '^_' }
    ],
    '@typescript-eslint/no-unused-vars': 'off',
    'no-restricted-syntax': [
      'warn',
      {
        selector: "Literal[value=/^#([0-9a-fA-F]{3}){1,2}$/]",
        message: "Do not use hardcoded hex colors. Use the ConfigContext instead."
      }
    ]
  },
}
