const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier');

module.exports = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
    },
    rules: {
      'no-undef': 'off',
    },
  },
  // VERTICE A3.1 / D1.4: cero hex sueltos en pantallas y componentes.
  // Todo sale de src/theme/tokens.ts (o de los excepciones documentadas abajo).
  {
    files: [
      'app/**/*.ts',
      'app/**/*.tsx',
      'src/components/**/*.ts',
      'src/components/**/*.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message: 'Hex suelto prohibido: usa los tokens de src/theme/tokens.ts (A3.1).',
        },
      ],
    },
  },
  // Excepciones documentadas (D1.4: colores de póster/datos de catálogo y logotipos;
  // fixtures de prueba; animaciones de slot; logo G oficial de Google).
  {
    files: [
      'src/components/ui/GoogleButton.tsx',
      'src/components/ui/Gallery.tsx',
      'src/components/features/Poster.tsx',
      'src/components/features/SlotReveal.tsx',
      'src/components/features/SwipeCard.tsx',
      'app/(onboarding)/welcome.tsx',
      'src/components/**/*.test.ts',
      'src/components/**/*.test.tsx',
      'app/**/*.test.ts',
      'app/**/*.test.tsx',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      '.expo/',
      'supabase/',
      'scripts/',
      'e2e/',
      'coverage/',
      'eslint.config.cjs',
      'babel.config.js',
      'jest.config.js',
      'metro.config.js',
    ],
  },
];
