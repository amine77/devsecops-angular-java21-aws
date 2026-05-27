/**
 * E2E — Dashboard Admin & CRUD Projets
 *
 * Couvre le flux complet admin :
 * - Accès au dashboard
 * - Création d'un projet via le formulaire
 * - Modification d'un projet existant
 * - Archivage (soft delete) d'un projet
 *
 * Précondition : backend Spring Boot + PostgreSQL démarrés,
 * utilisateur admin@portfolio.dev / Admin@2024! présent en DB.
 */
describe('Dashboard Admin — CRUD Projets', () => {
  const timestamp = Date.now();
  const testTitle = `[E2E] Projet Test ${timestamp}`;
  const testDescription = 'Description E2E suffisamment longue pour la validation (min 10 chars).';
  let createdProjectId: number;

  beforeEach(() => {
    cy.loginByApi();
    cy.visit('/admin');
    cy.contains('h1', 'Dashboard Admin', { timeout: 10000 }).should('be.visible');
  });

  context('Dashboard', () => {
    it('affiche le tableau des projets', () => {
      cy.get('.dashboard__table').should('be.visible');
      cy.get('.dashboard__table thead').within(() => {
        cy.contains('Titre').should('exist');
        cy.contains('Statut').should('exist');
        cy.contains('Actions').should('exist');
      });
    });

    it('affiche le bouton "+ Nouveau projet"', () => {
      cy.contains('a', '+ Nouveau projet')
        .should('be.visible')
        .and('have.attr', 'href', '/admin/projects/new');
    });

    it('affiche le nom de l\'admin connecté', () => {
      cy.contains('Bienvenue').should('be.visible');
    });
  });

  context('Création d\'un projet', () => {
    it('crée un nouveau projet via le formulaire et retourne au dashboard', () => {
      cy.contains('a', '+ Nouveau projet').click();
      cy.url().should('include', '/admin/projects/new');
      cy.contains('h1', 'Nouveau projet').should('be.visible');

      cy.get('#title').type(testTitle);
      cy.get('#description').type(testDescription);

      cy.contains('button', 'Sauvegarder').click();

      cy.url({ timeout: 10000 }).should('include', '/admin');
      cy.contains('td', testTitle).should('be.visible');

      // Récupérer l'ID pour le nettoyage
      cy.request({
        method: 'GET',
        url: `${Cypress.env('apiUrl') as string}/projects?size=50`,
      }).then((response) => {
        const projects = (response.body.data as { content: Array<{ id: number; title: string }> }).content;
        const created = projects.find((p) => p.title === testTitle);
        if (created) {
          createdProjectId = created.id;
        }
      });
    });

    it('affiche des erreurs de validation si titre vide', () => {
      cy.contains('a', '+ Nouveau projet').click();
      cy.contains('button', 'Sauvegarder').click();
      cy.contains('Le titre est obligatoire').should('be.visible');
    });

    it('affiche des erreurs de validation si description trop courte', () => {
      cy.contains('a', '+ Nouveau projet').click();
      cy.get('#title').type('Un titre valide');
      cy.get('#description').type('Court');
      cy.contains('button', 'Sauvegarder').click();
      cy.contains('Description obligatoire').should('be.visible');
    });
  });

  context('Modification d\'un projet', () => {
    let projectId: number;
    const updatedTitle = `[E2E] Projet Modifié ${timestamp}`;

    before(() => {
      cy.loginByApi();
      const token = () => window.localStorage.getItem('portfolio_jwt_token') ?? '';
      cy.request({
        method: 'POST',
        url: `${Cypress.env('apiUrl') as string}/projects`,
        headers: { Authorization: `Bearer ${token()}` },
        body: {
          title: `[E2E] Pour Modification ${timestamp}`,
          description: 'Description du projet à modifier en E2E.',
          featured: false,
          sortOrder: 99,
          skillIds: [],
        },
      }).then((response) => {
        projectId = (response.body.data as { id: number }).id;
      });
    });

    after(() => {
      cy.archiveProjectByApi(projectId);
    });

    it('modifie le titre d\'un projet et sauvegarde', () => {
      cy.contains('.dashboard__table tbody tr td', `[E2E] Pour Modification ${timestamp}`)
        .closest('tr')
        .contains('a', 'Modifier')
        .click();

      cy.url().should('match', /\/admin\/projects\/\d+\/edit/);
      cy.contains('h1', 'Modifier le projet').should('be.visible');

      cy.get('#title').clear().type(updatedTitle);
      cy.contains('button', 'Sauvegarder').click();

      cy.url({ timeout: 10000 }).should('include', '/admin');
      cy.contains('td', updatedTitle).should('be.visible');
    });
  });

  context('Archivage (soft delete) d\'un projet', () => {
    let projectId: number;

    before(() => {
      cy.loginByApi();
      const token = () => window.localStorage.getItem('portfolio_jwt_token') ?? '';
      cy.request({
        method: 'POST',
        url: `${Cypress.env('apiUrl') as string}/projects`,
        headers: { Authorization: `Bearer ${token()}` },
        body: {
          title: `[E2E] Pour Archivage ${timestamp}`,
          description: 'Description du projet à archiver en test E2E.',
          featured: false,
          sortOrder: 99,
          skillIds: [],
        },
      }).then((response) => {
        projectId = (response.body.data as { id: number }).id;
      });
    });

    it('archive un projet et le retire du tableau', () => {
      // Cypress accepte automatiquement window.confirm()
      cy.on('window:confirm', () => true);

      cy.contains('.dashboard__table tbody tr td', `[E2E] Pour Archivage ${timestamp}`)
        .closest('tr')
        .contains('button', 'Archiver')
        .click();

      cy.contains('td', `[E2E] Pour Archivage ${timestamp}`, { timeout: 8000 })
        .should('not.exist');
    });
  });

  after(() => {
    if (createdProjectId) {
      cy.archiveProjectByApi(createdProjectId);
    }
  });
});
