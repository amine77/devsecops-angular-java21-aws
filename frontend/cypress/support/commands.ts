/**
 * Commandes Cypress personnalisées.
 *
 * cy.loginByApi() — authentification programmatique via l'API (sans passer par l'UI).
 * Recommandé pour les tests qui ont besoin d'un état authentifié comme précondition :
 * évite de re-tester la page de login à chaque spec.
 */

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Authentifie un utilisateur via l'API backend et stocke le token JWT
       * dans le localStorage (identique à ce que fait l'application Angular).
       */
      loginByApi(email?: string, password?: string): Chainable<void>;

      /**
       * Crée un projet via l'API et retourne son ID (pour les tests CRUD).
       */
      createProjectByApi(title: string, description: string): Chainable<number>;

      /**
       * Archive un projet via l'API (nettoyage après test).
       */
      archiveProjectByApi(id: number): Chainable<void>;
    }
  }
}

Cypress.Commands.add(
  'loginByApi',
  (
    email = Cypress.env('adminEmail') as string,
    password = Cypress.env('adminPassword') as string,
  ) => {
    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl') as string}/auth/login`,
      body: { email, password },
      failOnStatusCode: true,
    }).then((response) => {
      const data = response.body.data as { token: string; user: unknown };
      window.localStorage.setItem('portfolio_jwt_token', data.token);
      window.localStorage.setItem('portfolio_user', JSON.stringify(data.user));
    });
  },
);

Cypress.Commands.add(
  'createProjectByApi',
  (title: string, description: string) => {
    cy.loginByApi().then(() => {
      const token = window.localStorage.getItem('portfolio_jwt_token') ?? '';
      cy.request({
        method: 'POST',
        url: `${Cypress.env('apiUrl') as string}/projects`,
        headers: { Authorization: `Bearer ${token}` },
        body: {
          title,
          description,
          featured: false,
          sortOrder: 99,
          skillIds: [],
        },
      }).then((response) => {
        const id = (response.body.data as { id: number }).id;
        return cy.wrap(id);
      });
    });
  },
);

Cypress.Commands.add('archiveProjectByApi', (id: number) => {
  const token = window.localStorage.getItem('portfolio_jwt_token') ?? '';
  cy.request({
    method: 'DELETE',
    url: `${Cypress.env('apiUrl') as string}/projects/${id}`,
    headers: { Authorization: `Bearer ${token}` },
    failOnStatusCode: false,
  });
});

export {};
