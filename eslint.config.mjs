import eslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.astro/**', 'packages/redis/*.d.ts'],
  },
  {
    files: ['**/*.ts', '**/*.mts'],
    languageOptions: {
      parser,
      parserOptions: {
        projectService: {
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 20,
          allowDefaultProject: [
            '*.config.ts',
            '*.config.mts',
            'vitest.config.ts',
            'packages/*/vitest.config.ts',
            'scripts/*.ts',
            'packages/*/scripts/*.ts',
          ],
        },
      },
    },
    plugins: {
      '@typescript-eslint': eslint,
    },
    rules: {
      // Ban `any` everywhere
      '@typescript-eslint/no-explicit-any': 'error',

      // Enforce consistent type imports with verbatimModuleSyntax
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // General quality
      'no-console': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  // Ban Date.now() and Math.random() in @reqnx/core src (except clock.ts and tests)
  {
    files: ['packages/core/src/**/*.ts'],
    ignores: ['packages/core/src/clock.ts', 'packages/core/src/**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'Date',
          message: 'Use the Clock interface instead of Date.now(). Only clock.ts may use Date.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Math.random() is banned in core. Inject randomness if needed.',
        },
      ],
    },
  },
];
