/**
 * Fichier support Cypress — chargé avant chaque spec.
 *
 * Contient les imports globaux et les hooks qui s'appliquent à tous les tests.
 */

import './commands';

// Désactive la gestion des exceptions non-capturées par l'app Angular
// (les erreurs de hydration ou console.error ne cassent pas les specs)
Cypress.on('uncaught:exception', (_err, _runnable) => {
  // Retourner false empêche Cypress de faire échouer le test
  return false;
});
