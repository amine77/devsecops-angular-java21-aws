/**
 * Jest Configuration — Remplace Karma/Jasmine (défaut Angular)
 *
 * Raisons de Jest plutôt que Karma :
 * - Exécution CLI sans navigateur (headless) → compatible CI/CD
 * - 2-3x plus rapide que Karma
 * - Watch mode intelligent (ne rejoue que les tests affectés)
 * - Snapshots testing
 * - Meilleur écosystème de matchers
 *
 * jest-preset-angular : configure Jest pour les composants Angular
 * (compilation des templates, décorateurs, etc.)
 */
import type { Config } from 'jest';

const config: Config = {
  preset: 'jest-preset-angular',

  // Fichier de setup exécuté APRÈS l'installation du framework de test.
  // Initialise jest-preset-angular (setup des zones, TestBed, etc.)
  // Propriété correcte : setupFilesAfterFramework (pas setupFiles)
  setupFilesAfterFramework: ['<rootDir>/src/setup-jest.ts'],

  // Patterns de fichiers de tests.
  // testMatch accepte des glob patterns (pas des regex).
  // Propriété config : testMatch (testPathPattern est réservé à la CLI)
  testMatch: ['<rootDir>/src/**/*.spec.ts'],

  collectCoverageFrom: [
    'src/app/**/*.ts',
    '!src/app/**/*.module.ts',
    '!src/app/**/*.routes.ts',
    '!src/main.ts',
    '!src/environments/**',
  ],

  // coverageThreshold (SINGULIER) — propriété correcte de Jest.
  // coverageThresholds (pluriel) est invalide et ignoré silencieusement.
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70,
    },
  },

  coverageReporters: ['text', 'lcov', 'html'],

  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/app/core/$1',
    '^@shared/(.*)$': '<rootDir>/src/app/shared/$1',
    '^@features/(.*)$': '<rootDir>/src/app/features/$1',
    '^@environments/(.*)$': '<rootDir>/src/environments/$1',
  },

  // Configuration du transformer jest-preset-angular.
  // Depuis jest-preset-angular 14.x + Jest 28+, on utilise "transform"
  // au lieu de "globals.ts-jest" (déprécié).
  transform: {
    // String.raw évite le double-échappement des backslash dans les regex.
    // String.raw`^.+\.(ts|js|mjs|html|svg)$` équivaut à '^.+\\.(ts|js|mjs|html|svg)$'
    [String.raw`^.+\.(ts|js|mjs|html|svg)$`]: [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: String.raw`\.(html|svg)$`,
      },
    ],
  },
};

export default config;
