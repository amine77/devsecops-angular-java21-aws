# PHASE 3 — Frontend Angular 18

> **Date :** 2026-05-25
> **Prérequis :** [PHASE 2 — Backend](PHASE2-Backend.md)

---

## Table des matières

1. [Architecture Angular 18 moderne](#architecture-angular-18-moderne)
2. [Fichiers produits](#fichiers-produits)
3. [Concepts clés utilisés](#concepts-clés-utilisés)
4. [Commandes de développement](#commandes-de-développement)
5. [Commandes de test](#commandes-de-test)
6. [Commandes Docker](#commandes-docker)
7. [Erreurs fréquentes et solutions](#erreurs-fréquentes-et-solutions)
8. [Checklist PHASE 3](#checklist-phase-3)

---

## Architecture Angular 18 moderne

```
src/app/
├── app.config.ts          ← provideRouter, provideHttpClient, interceptors
├── app.routes.ts          ← lazy loading par feature
├── app.component.ts       ← shell (navbar + router-outlet + footer)
│
├── core/                  ← Services singleton, guards, interceptors
│   ├── services/
│   │   ├── auth.service.ts      ← Signals (currentUser, isAuthenticated, isAdmin)
│   │   ├── storage.service.ts   ← Abstraction localStorage (testable)
│   │   ├── project.service.ts   ← HTTP + map(r => r.data!)
│   │   └── skill.service.ts
│   ├── interceptors/
│   │   ├── jwt.interceptor.ts   ← Fonctionnel (HttpInterceptorFn)
│   │   └── error.interceptor.ts ← 401 → logout, 403 → redirect
│   └── guards/
│       ├── auth.guard.ts        ← Fonctionnel (CanActivateFn)
│       └── adminGuard           ← ROLE_ADMIN uniquement
│
├── shared/                ← Composants et modèles réutilisables
│   ├── components/
│   │   ├── navbar/             ← @if(isAuthenticated()), @if(isAdmin())
│   │   ├── footer/
│   │   ├── loading-spinner/    ← @Input() fullPage, message
│   │   └── project-card/       ← @Input({ required: true }) project
│   └── models/
│       ├── api-response.model.ts  ← ApiResponse<T>, PageResponse<T>
│       ├── project.model.ts
│       ├── skill.model.ts
│       └── auth.model.ts
│
└── features/              ← Modules métier lazy-loaded
    ├── auth/
    │   ├── auth.routes.ts
    │   └── login/              ← Reactive Forms, Signals, OnPush
    ├── portfolio/
    │   ├── portfolio.routes.ts
    │   ├── home/               ← Featured projects, stats, hero
    │   ├── projects/
    │   │   ├── project-list/   ← Pagination, @for avec trackBy
    │   │   └── project-detail/ ← @Input() id (withComponentInputBinding)
    │   └── skills/             ← computed() pour grouper par catégorie
    └── admin/
        ├── admin.routes.ts
        ├── dashboard/          ← Table CRUD, soft delete
        └── project-form/       ← Formulaire créer/éditer (même composant)
```

---

## Concepts clés utilisés

### Signals Angular 18

```typescript
// Signal mutable (état interne)
private readonly _currentUser = signal<UserInfo | null>(null);

// Signal lecture seule (exposé aux composants)
readonly currentUser = this._currentUser.asReadonly();

// Computed (dérivé automatique, recalculé si dépendances changent)
readonly isAuthenticated = computed(() => this._currentUser() !== null);

// Mise à jour du signal
this._currentUser.set(user);           // remplace
this.projects.update(list => [...list, newProject]); // transforme
```

### Nouveaux blocs de contrôle (Angular 17+)

```html
<!-- Remplace *ngIf -->
@if (isLoading()) {
  <app-loading-spinner />
} @else if (error()) {
  <p>{{ error() }}</p>
} @else {
  <div>...</div>
}

<!-- Remplace *ngFor (avec trackBy obligatoire recommandé) -->
@for (project of projects(); track project.id) {
  <app-project-card [project]="project" />
} @empty {
  <p>Aucun projet.</p>
}
```

### Intercepteurs fonctionnels

```typescript
// Plus de classe, une simple fonction
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(StorageService).getToken();
  if (!token) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

// Enregistrement dans app.config.ts
provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor]))
```

### withComponentInputBinding (Angular 16+)

```typescript
// Plus besoin d'ActivatedRoute pour les params de route
// Dans app.config.ts : withComponentInputBinding()
// Dans le composant :
@Input() id!: string; // reçoit automatiquement le param :id de la route
```

---

## Fichiers produits

| Fichier | Rôle |
|---------|------|
| `package.json` | Angular 18, Jest, ESLint, Prettier, Cypress |
| `tsconfig.json` | strict: true, paths aliases (@core, @shared, @features) |
| `angular.json` | Build prod optimisé, budget 1MB, OnPush par défaut |
| `.eslintrc.json` | @angular-eslint + @typescript-eslint strict |
| `.prettierrc` | 100 chars, single quotes, trailing commas |
| `jest.config.ts` | jest-preset-angular, coverage 70% |
| `proxy.conf.json` | /api → localhost:8080 en dev |
| `nginx.conf` | SPA routing, gzip, cache, security headers |
| `Dockerfile` | Multi-stage : Node:20-alpine → nginx:alpine (~25MB) |
| `docker-compose.yml` | postgres + backend + frontend en local |

---

## Commandes de développement

```bash
# Installer les dépendances
cd frontend
npm install

# Démarrer en mode développement (avec proxy /api → localhost:8080)
npm start
# → http://localhost:4200

# Build production
npm run build
# → dist/portfolio-frontend/browser/

# Vérifier le formatage
npm run format:check

# Corriger le formatage automatiquement
npm run format

# Lint
npm run lint
npm run lint:fix
```

---

## Commandes de test

```bash
# Tests unitaires
npm test

# Tests en mode watch (développement)
npm run test:watch

# Tests CI (avec rapport JUnit pour GitHub Actions)
npm run test:ci

# Voir le rapport de couverture
# Ouvrir : coverage/lcov-report/index.html

# Tests E2E Cypress (nécessite l'application qui tourne)
npm run e2e:open  # mode interactif
npm run e2e       # mode CI headless
```

---

## Commandes Docker

```bash
# Build de l'image frontend
docker build -t portfolio-frontend:1.0.0 .

# Vérifier la taille (doit être ~25MB)
docker images portfolio-frontend

# Lancer le container
docker run -d --name portfolio-frontend -p 4200:80 portfolio-frontend:1.0.0

# Docker Compose — tout l'environnement local
cd docker
docker-compose up -d         # démarrer
docker-compose logs -f       # voir les logs
docker-compose down          # arrêter
docker-compose down -v       # arrêter + supprimer les volumes
```

---

## Erreurs fréquentes et solutions

### ❌ `NullInjectorError: No provider for AuthService`
```
Cause : import oublié dans le TestBed ou service mal configuré
Solution : vérifier que le service a bien providedIn: 'root'
           et que HttpClientTestingModule est importé dans le test
```

### ❌ `ExpressionChangedAfterItHasBeenCheckedError`
```
Cause : modification d'un Signal dans ngAfterViewInit ou ngAfterContentInit
Solution : utiliser setTimeout(() => ...) ou ChangeDetectorRef.detectChanges()
           Préférer la mise à jour dans ngOnInit
```

### ❌ `Cannot read properties of null (reading 'id')`
```
Cause : accès à project.id avant que l'Observable ait émis
Solution : utiliser @if (project()) dans le template
           ou l'opérateur ?. (optional chaining)
```

### ❌ `CORS error` (en dev sans proxy)
```
Cause : Angular appelle directement localhost:8080 au lieu de passer par le proxy
Solution : vérifier que proxy.conf.json est configuré dans angular.json
           et que l'apiUrl = '/api' (pas 'http://localhost:8080')
```

### ❌ `Blank page en production (SPA routing)`
```
Cause : NGINX retourne 404 pour les routes Angular (/portfolio/projects)
Solution : vérifier la règle try_files $uri $uri/ /index.html dans nginx.conf
```

---

## Checklist PHASE 3

- ✅ Angular 18 standalone components (pas de NgModule)
- ✅ Signals pour l'état réactif (signal, computed, effect)
- ✅ Nouveau control flow (@if, @for, @empty)
- ✅ Intercepteurs fonctionnels (HttpInterceptorFn)
- ✅ Guards fonctionnels (CanActivateFn)
- ✅ withComponentInputBinding() pour les params de route
- ✅ withViewTransitions() pour les transitions de page
- ✅ Lazy loading par feature (réduction bundle initial)
- ✅ ChangeDetectionStrategy.OnPush sur tous les composants
- ✅ TypeScript strict mode
- ✅ Séparation core / shared / features
- ✅ Models TypeScript miroir des DTOs Java (readonly)
- ✅ Gestion centralisée des erreurs (errorInterceptor)
- ✅ JWT automatique (jwtInterceptor)
- ✅ Reactive Forms avec validation
- ✅ SCSS avec CSS Variables (dark theme)
- ✅ Responsive design (mobile-first)
- ✅ NGINX avec SPA routing, gzip, security headers
- ✅ Dockerfile multi-stage (image ~25MB)
- ✅ Docker Compose pour dev local (postgres + backend + frontend)
- ✅ ESLint + Prettier configurés
- ✅ Jest (remplace Karma) avec coverage 70%
- ✅ Tests unitaires LoginComponent + AuthService

---

*Prochaine étape : [PHASE 4 — Docker](PHASE4-Docker.md)*
