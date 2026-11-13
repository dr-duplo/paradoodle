import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/', 'js/count-sounds.js'] },
  js.configs.recommended,
  {
    // The app's files are plain <script> tags that share one global scope, so a name
    // defined in one file is used in another. no-undef can't see across files, and
    // top-level names look unused from inside a single file.
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: { ...globals.browser, Vex: 'readonly', jspdf: 'readonly' },
    },
    rules: {
      'no-undef': 'off',
      // empty catch blocks are the deliberate fallbacks for blocked storage, clipboard and history
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-redeclare': ['error', { builtinGlobals: true }],
      'no-unused-vars': ['error', { vars: 'local', args: 'none', caughtErrors: 'none' }],
    },
  },
  {
    // the offline service worker runs on its own, with the service-worker globals
    files: ['sw.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: globals.serviceworker },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: { sourceType: 'module', globals: globals.node },
  },
];
