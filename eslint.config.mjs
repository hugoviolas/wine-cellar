import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// `eslint-config-next/core-web-vitals` enregistre déjà le plugin
// `@typescript-eslint`, et ESLint refuse qu'un autre bloc le redéfinisse.
// On ne reprend donc des configs typescript-eslint que leurs `rules` — le
// plugin et le parser étant déjà en place — et on les applique aux mêmes
// fichiers que lui (`**/*.ts`, `**/*.tsx`), sans quoi ESLint cherche le
// plugin là où il n'est pas déclaré (fichiers `.mjs`/`.mts` de config).
//
// Pour la même raison `eslint-config-next/typescript` n'est plus repris :
// il n'activait que l'équivalent non type-aware des règles ci-dessous.
const typeScriptRules = tseslint.configs.recommendedTypeChecked.reduce((merged, config) => {
  return { ...merged, ...config.rules };
}, {});

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    files: ['**/*.ts', '**/*.tsx'],
    // Linting type-aware : ces règles (no-floating-promises,
    // no-misused-promises...) lisent le type réel de chaque expression, ce
    // qu'un parseur seul ne peut pas faire. D'où `projectService`, qui
    // fait charger le programme TypeScript par ESLint.
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: typeScriptRules,
  },
  // Désactive les règles de style qui entreraient en conflit avec Prettier.
  // Placé avant nos propres règles : `eslint-config-prettier` neutralise
  // `curly` (par prudence, pour sa variante "multi-line"), or la variante
  // "all" exigée par la convention ne gêne en rien le formatage.
  prettier,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        // Les callbacks passés à une API déjà typée (onClick, map, ...)
        // tirent leur type de la signature qui les reçoit : l'annotation y
        // serait du bruit, pas une information.
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      curly: ['error', 'all'],
      // `logger` (src/lib/logger.ts) plutôt que console : un point de
      // passage unique, taggable et remplaçable, au lieu d'écritures
      // directes dispersées dans les routes.
      'no-console': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  {
    // Les scripts CLI (bootstrap, migrations) écrivent dans un terminal :
    // c'est leur seule sortie, et le logger applicatif n'a rien à y faire.
    files: ['scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
