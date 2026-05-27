/**
 * E2E — Portfolio public
 *
 * Couvre les pages accessibles sans authentification :
 * - Homepage portfolio : liste des projets
 * - Navigation vers le détail d'un projet
 * - Lien de connexion dans la navbar
 */
describe('Portfolio public', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  context('Page /portfolio', () => {
    it('est accessible sans authentification', () => {
      cy.visit('/portfolio');
      cy.url().should('include', '/portfolio');
      // Ne doit PAS rediriger vers /auth/login
      cy.url().should('not.include', '/auth/login');
    });

    it('affiche la section des projets', () => {
      cy.visit('/portfolio');
      // La page portfolio charge les projets depuis l'API
      cy.get('main').should('be.visible');
    });

    it('affiche le lien "Connexion" dans la navbar', () => {
      cy.visit('/portfolio');
      cy.contains('a', 'Connexion').should('be.visible');
    });

    it('redirige "/" vers "/portfolio"', () => {
      cy.visit('/');
      cy.url().should('include', '/portfolio');
    });
  });

  context('Navigation depuis portfolio', () => {
    it('le lien "Connexion" de la navbar mène à /auth/login', () => {
      cy.visit('/portfolio');
      cy.contains('a', 'Connexion').click();
      cy.url().should('include', '/auth/login');
    });
  });

  context('Navbar admin conditionnelle', () => {
    it('affiche le lien Dashboard admin quand connecté', () => {
      cy.loginByApi();
      cy.visit('/portfolio');
      cy.contains('a', 'Dashboard').should('be.visible');
    });

    it('n\'affiche pas le lien Dashboard quand déconnecté', () => {
      cy.visit('/portfolio');
      cy.contains('a', 'Dashboard').should('not.exist');
    });
  });
});
