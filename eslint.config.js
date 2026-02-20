import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import prettierPlugin from 'eslint-plugin-prettier'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

const bunGlobals = {
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  Bun: 'readonly',
  Buffer: 'readonly',
  DOMException: 'readonly',
  ReadableStream: 'readonly',
  crypto: 'readonly',
  fetch: 'readonly',
  FormData: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  URL: 'readonly',
  WebSocket: 'readonly',
  console: 'readonly',
  process: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
}

const extensionGlobals = {
  ...bunGlobals,
  atob: 'readonly',
  btoa: 'readonly',
  Blob: 'readonly',
  chrome: 'readonly',
  Document: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  requestAnimationFrame: 'readonly',
  URL: 'readonly',
  window: 'readonly',
}

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '.npm-cache/**',
      'legacy/**',
      'extension/content.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsParser,
      globals: bunGlobals,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          trailingComma: 'all',
          semi: false,
          arrowParens: 'always',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
      'no-console': [
        'error',
        {
          allow: ['warn', 'error', 'info'],
        },
      ],
    },
  },
  {
    files: ['extension/**/*.ts', 'extension/**/*.tsx'],
    languageOptions: {
      globals: extensionGlobals,
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: bunGlobals,
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          trailingComma: 'all',
          semi: false,
          arrowParens: 'always',
        },
      ],
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
      'no-console': [
        'error',
        {
          allow: ['warn', 'error', 'info'],
        },
      ],
    },
  },
  {
    files: ['extension/**/*.js', 'extension/**/*.mjs'],
    languageOptions: {
      globals: extensionGlobals,
    },
  },
]
