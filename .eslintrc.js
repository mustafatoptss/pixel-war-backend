// .eslintrc.js
module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true, // Add jest environment for test files
  },
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended', // Integrates Prettier
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    // Custom rules can be added here
  },
};
