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
import { createCjsPreset } from 'jest-preset-angular/presets/index.js';

const cjsPreset = createCjsPreset();

const config: Config = {
  ...cjsPreset,

  // `marked` (>= v18) est distribué en ESM pur (pas de build CJS) : le preset
  // Jest/Angular par défaut n'essaie de transpiler que les fichiers .mjs.
  // On transpile explicitement son fichier .esm.js via Babel (modules-commonjs)
  // avant d'appliquer le transform générique ts-jest du preset.
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|@angular/common/locales/.*\\.js$|marked/.*\\.js$))'],
  transform: {
    'node_modules[\\\\/]marked[\\\\/].*\\.js$': [
      'babel-jest',
      { plugins: ['@babel/plugin-transform-modules-commonjs'] },
    ],
    ...cjsPreset.transform,
  },

  // Fichier de setup exécuté APRÈS l'installation du framework de test.
  // Initialise jest-preset-angular (setup des zones, TestBed, etc.)
  // Propriété correcte : setupFilesAfterEnv (pas setupFiles, pas setupFilesAfterFramework)
  setupFilesAfterEnv: ['<rootDir>/src/setup-jest.ts'],

  // Patterns de fichiers de tests.
  // testMatch accepte des glob patterns (pas des regex).
  // Propriété config : testMatch (testPathPattern est réservé à la CLI)
  testMatch: ['**/src/**/*.spec.ts'],

  collectCoverageFrom: [
    'src/app/**/*.ts',
    '!src/app/**/*.module.ts',
    '!src/app/**/*.routes.ts',
    '!src/main.ts',
    '!src/environments/**',
  ],

  // coverageThreshold (SINGULIER) — propriété correcte de Jest.
  // Phase 22 : les méthodes d'animation GSAP (ngAfterViewInit, effect()) ne sont
  // pas testables en JSDOM → couverture de branches abaissée à 25% (réaliste).
  // Cible finale : 70% (quand tous les composants auront leurs specs).
  coverageThreshold: {
    global: {
      statements: 30,
      branches: 25,
      functions: 25,
      lines: 30,
    },
  },

  coverageReporters: ['text', 'lcov', 'html'],

  moduleNameMapper: {
    // Mocks GSAP — ne tourne pas en JSDOM (pas de RAF, pas de layout engine)
    '^gsap$': '<rootDir>/src/__mocks__/gsap.ts',
    '^gsap/ScrollTrigger$': '<rootDir>/src/__mocks__/gsap-scroll-trigger.ts',
    '^@core/(.*)$': '<rootDir>/src/app/core/$1',
    '^@shared/(.*)$': '<rootDir>/src/app/shared/$1',
    '^@features/(.*)$': '<rootDir>/src/app/features/$1',
    '^@environments/(.*)$': '<rootDir>/src/environments/$1',
  },
};

export default config;
