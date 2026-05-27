import { defineConfig } from 'cypress';

/**
 * Configuration Cypress — Phase 13 E2E Tests
 *
 * Prérequis pour npm run e2e :
 *   - Backend sur http://localhost:8080 (mvn spring-boot:run)
 *   - Frontend sur http://localhost:4200 (npm start)
 *   - PostgreSQL démarré (docker-compose dev-stack)
 */
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',

    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots',

    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,

    env: {
      apiUrl: 'http://localhost:8080',
      adminEmail: 'admin@portfolio.dev',
      adminPassword: 'Admin@2024!',
    },

    retries: {
      runMode: 1,
      openMode: 0,
    },
  },
});
