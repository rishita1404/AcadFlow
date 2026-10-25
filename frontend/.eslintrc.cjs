module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': 'off',
    // React 18 + JSX transform — no need to import React
    'react/react-in-jsx-scope': 'off',
    // PropTypes not required in modern React with TypeScript-less projects
    'react/prop-types': 'off',
    // Allow unused vars only when prefixed with _
    'no-unused-vars': ['error', { vars: 'all', args: 'after-used', ignoreRestSiblings: true, varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
  },
};
