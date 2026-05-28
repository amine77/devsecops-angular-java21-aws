# Phase 13 — Tests E2E Cypress

## Vue d'ensemble

| Aspect | Détail |
|--------|--------|
| Framework | Cypress 13 |
| Tests | 3 fichiers spec, ~20 scénarios |
| Mode CI | Headless (sans navigateur visible) |
| Mode dev | GUI interactive (`cypress open`) |
| Authentification | `cy.loginByApi()` — bypass UI via API |
| Nettoyage | `cy.archiveProjectByApi()` — cleanup après test |

---

## 1. Scénarios couverts

### `01-auth.cy.ts` — Authentification

| Test | Description |
|------|-------------|
| Redirection non-auth | `/admin` → `/auth/login` si non connecté |
| Affichage formulaire | Champs email, password, bouton Se connecter |
| Validation email invalide | Message d'erreur client-side |
| Validation password trop court | Message d'erreur client-side |
| Champs vides | Erreurs sur tous les champs |
| Erreur API 401 | Message "invalide" visible |
| Login réussi | Redirection vers `/admin`, `h1 Dashboard Admin` |
| Token JWT stocké | `localStorage.getItem('portfolio_jwt_token')` non null |
| Déconnexion | Redirection `/auth/login`, token supprimé du localStorage |

### `02-admin.cy.ts` — CRUD Projets

| Contexte | Tests |
|----------|-------|
| Dashboard | Tableau projets visible, colonnes Titre/Statut/Actions, bouton "+ Nouveau projet" |
| Création | Formulaire saisi → retour dashboard avec nouveau projet visible |
| Validation création | Titre vide → erreur, description courte → erreur |
| Modification | Formulaire pré-rempli → sauvegarde → titre mis à jour |
| Archivage (soft delete) | Confirmation → projet retiré du tableau |

**Isolation des données** : chaque test `before()` crée son propre projet via `cy.request()`, `after()` l'archive — pas de dépendance entre les tests.

### `03-portfolio.cy.ts` — Vue publique

| Test | Description |
|------|-------------|
| Accès sans auth | `/` accessible sans login |
| Navbar conditionnelle | Bouton "Admin" visible si connecté, absent sinon |
| Liste des projets | Projets actifs visibles |

---

## 2. Commandes Cypress personnalisées

Définies dans `cypress/support/commands.ts` :

### `cy.loginByApi()`

Bypass le formulaire de login — appelle directement `POST /auth/login` via `cy.request()` et stocke le token dans `localStorage`.

```typescript
Cypress.Commands.add('loginByApi', () => {
    cy.request({
        method: 'POST',
        url: `${Cypress.env('apiUrl')}/auth/login`,
        body: {
            email: 'admin@portfolio.dev',
            password: 'Admin@2024!',
        },
    }).then((response) => {
        window.localStorage.setItem(
            'portfolio_jwt_token',
            response.body.data.token
        );
    });
});
```

**Pourquoi bypasser le formulaire ?** Les tests de création/modification/archivage ne testent PAS le login — ils testent le CRUD. Passer par le formulaire à chaque `beforeEach` ralentirait chaque test de 3-5s et créerait une dépendance fragile.

### `cy.archiveProjectByApi(projectId)`

Archive un projet via API — utilisé en `after()` pour nettoyer les projets créés pendant les tests.

```typescript
Cypress.Commands.add('archiveProjectByApi', (projectId: number) => {
    const token = window.localStorage.getItem('portfolio_jwt_token') ?? '';
    cy.request({
        method: 'DELETE',
        url: `${Cypress.env('apiUrl')}/projects/${projectId}`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
    });
});
```

### `cy.createProjectByApi(body)`

Crée un projet via API — utilisé dans `before()` pour préparer les données de test.

---

## 3. Configuration (`cypress.config.ts`)

```typescript
export default defineConfig({
    e2e: {
        baseUrl: 'http://localhost:4200',
        env: {
            apiUrl: 'http://localhost:8080',
        },
        viewportWidth: 1280,
        viewportHeight: 720,
        video: false,              // Pas de vidéo en CI (espace disque)
        screenshotOnRunFailure: true,
        defaultCommandTimeout: 10000,
        specPattern: 'cypress/e2e/**/*.cy.ts',
    },
});
```

---

## 4. Lancement

### Prérequis

La stack complète doit être démarrée avant les tests Cypress :

```powershell
# 1. Stack de support (Postgres + Redis)
docker compose -f docker/docker-compose.dev-stack.yml up -d

# 2. Backend Spring Boot
$env:JWT_SECRET = "dev-secret-key-minimum-256-bits-for-hmac-sha256-algorithm"
mvn spring-boot:run -f backend/pom.xml -Dspring-boot.run.profiles=dev

# 3. Frontend Angular
cd frontend && npm start
```

### Commandes Cypress

```powershell
# Mode headless (CI)
cd frontend && npm run e2e
# ou : npx cypress run

# Mode GUI interactif (dev — ouvre le navigateur Cypress)
cd frontend && npm run e2e:open
# ou : npx cypress open

# Spec unique
npx cypress run --spec "cypress/e2e/02-admin.cy.ts"
```

---

## 5. En CI (GitHub Actions)

Cypress est déclenché manuellement ou dans le workflow `ci-frontend.yml` en option.

Le workflow utilise une image avec Chrome/Electron headless intégré :

```yaml
- name: Run Cypress E2E tests
  uses: cypress-io/github-action@v6
  with:
    working-directory: frontend
    start: npm start
    wait-on: 'http://localhost:4200'
    wait-on-timeout: 120
    browser: chrome
    headless: true
```

---

## 6. Décisions techniques

### Pourquoi des timestamps dans les titres de projets de test ?

```typescript
const timestamp = Date.now();
const testTitle = `[E2E] Projet Test ${timestamp}`;
```

Chaque run crée un titre unique. Si plusieurs runs s'exécutent en parallèle (ou si un run précédent a mal nettoyé), les données ne se mélangent pas. Le prefix `[E2E]` permet de distinguer facilement les données de test en base de données.

### Pourquoi `cy.on('window:confirm', () => true)` pour l'archivage ?

```typescript
cy.on('window:confirm', () => true);
```

Le bouton "Archiver" affiche une confirmation `window.confirm()` native. Cypress interceptionne automatiquement les dialogs natifs — sans cette ligne, le test se bloquerait sur la fenêtre de confirmation.

### Pourquoi `failOnStatusCode: false` dans `archiveProjectByApi` ?

Le nettoyage `after()` doit s'exécuter même si le projet a déjà été archivé (ex: le test lui-même l'a archivé). `failOnStatusCode: false` évite un échec du cleanup sur un 404 ou 409.

---

## 7. Fichiers créés

| Fichier | Description |
|---------|-------------|
| `frontend/cypress/e2e/01-auth.cy.ts` | Scénarios d'authentification |
| `frontend/cypress/e2e/02-admin.cy.ts` | CRUD projets admin |
| `frontend/cypress/e2e/03-portfolio.cy.ts` | Vue publique portfolio |
| `frontend/cypress/support/commands.ts` | Commandes customs : `loginByApi`, `archiveProjectByApi` |
| `frontend/cypress/support/e2e.ts` | Import des commandes + configuration globale |
| `frontend/cypress.config.ts` | Configuration Cypress (baseUrl, env, timeouts) |
| `frontend/package.json` | Scripts `e2e` et `e2e:open` |
