/**
 * E2E — Authentification
 *
 * Couvre :
 * - Redirection non-authentifiée vers /auth/login
 * - Affichage du formulaire de login
 * - Validation côté client (email invalide, mot de passe court)
 * - Erreur API avec mauvais credentials (401)
 * - Login réussi → redirection /admin
 * - Déconnexion → retour /auth/login
 */
describe('Authentification', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  context('Garde de route — accès non-authentifié', () => {
    it('redirige /admin vers /auth/login si non connecté', () => {
      cy.visit('/admin');
      cy.url().should('include', '/auth/login');
      cy.contains('Connexion').should('be.visible');
    });
  });

  context('Page /auth/login', () => {
    beforeEach(() => {
      cy.visit('/auth/login');
    });

    it('affiche le formulaire avec les champs email et password', () => {
      cy.get('#email').should('be.visible');
      cy.get('#password').should('be.visible');
      cy.contains('button', 'Se connecter').should('be.visible');
    });

    it('affiche une erreur de validation si email invalide et submit', () => {
      cy.get('#email').type('not-an-email');
      cy.get('#password').type('ValidPass1!');
      cy.contains('button', 'Se connecter').click();
      cy.get('[role="alert"]').should('be.visible');
    });

    it('affiche une erreur de validation si mot de passe trop court', () => {
      cy.get('#email').type('admin@portfolio.dev');
      cy.get('#password').type('ab');
      cy.contains('button', 'Se connecter').click();
      cy.get('[role="alert"]').should('be.visible');
    });

    it('affiche une erreur si les deux champs sont vides et submit', () => {
      cy.contains('button', 'Se connecter').click();
      cy.get('[role="alert"]').should('have.length.at.least', 1);
    });

    it('affiche une erreur API avec mauvais mot de passe', () => {
      cy.get('#email').type('admin@portfolio.dev');
      cy.get('#password').type('WrongPassword999!');
      cy.contains('button', 'Se connecter').click();
      cy.get('.alert-error', { timeout: 10000 })
        .should('be.visible')
        .and('contain.text', 'invalide');
    });

    it('connecte l\'admin et redirige vers /admin', () => {
      cy.get('#email').type('admin@portfolio.dev');
      cy.get('#password').type('Admin@2024!');
      cy.contains('button', 'Se connecter').click();
      cy.url({ timeout: 10000 }).should('include', '/admin');
      cy.contains('h1', 'Dashboard Admin').should('be.visible');
    });

    it('stocke le token JWT dans le localStorage après login réussi', () => {
      cy.get('#email').type('admin@portfolio.dev');
      cy.get('#password').type('Admin@2024!');
      cy.contains('button', 'Se connecter').click();
      cy.url({ timeout: 10000 }).should('include', '/admin');
      cy.window().then((win) => {
        expect(win.localStorage.getItem('portfolio_jwt_token')).to.not.be.null;
      });
    });
  });

  context('Déconnexion', () => {
    it('déconnecte l\'admin et redirige vers /auth/login', () => {
      cy.loginByApi();
      cy.visit('/admin');
      cy.contains('h1', 'Dashboard Admin').should('be.visible');
      cy.contains('button', 'Déconnexion').click();
      cy.url({ timeout: 8000 }).should('include', '/auth/login');
      cy.window().then((win) => {
        expect(win.localStorage.getItem('portfolio_jwt_token')).to.be.null;
      });
    });
  });
});
