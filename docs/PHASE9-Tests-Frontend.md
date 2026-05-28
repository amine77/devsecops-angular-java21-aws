# Phase 9 — Tests Frontend (Jest + Angular Testing Utilities)

## Vue d'ensemble

| Fichier de test | Ce qui est testé | Tests |
|-----------------|-----------------|-------|
| `auth.service.spec.ts` | AuthService — état réactif (Signals), HTTP, logout | 12 |
| `storage.service.spec.ts` | StorageService — localStorage wrapper | 8 |
| `auth.guard.spec.ts` | AuthGuard — redirection si non authentifié | 7 |
| `jwt.interceptor.spec.ts` | JwtInterceptor — injection du token Bearer | 10 |
| `login.component.spec.ts` | LoginComponent — formulaire, validation, soumission | 15 |
| **Total** | | **52 tests** |
| Coverage | Couche core (services, guards, interceptors) | ≥ 30% |

---

## 1. Stack de tests

| Outil | Rôle |
|-------|------|
| **Jest** | Runner de tests (remplace Karma/Jasmine) |
| **@angular/core/testing** | `TestBed`, `fakeAsync`, `tick` |
| **HttpClientTestingModule** | Mock des requêtes HTTP |
| **RouterTestingModule** | Mock du routeur Angular |
| `jest.fn()` / `jest.Mocked<T>` | Mocks de services Angular |

### Pourquoi Jest à la place de Karma ?

- Jest s'exécute dans Node.js (pas de navigateur réel) → 3× plus rapide
- Compatible avec le mode CI (pas de Chrome headless à configurer)
- `jest.fn()` est plus expressif que les spies Jasmine
- Snapshots disponibles pour les templates Angular si nécessaire

---

## 2. `AuthService` — État réactif avec Angular Signals

Angular 18 utilise les **Signals** (`signal()`, `computed()`) pour l'état réactif — les tests vérifient que les signals se mettent à jour correctement après chaque action.

### Structure des tests

```
AuthService
  ├── État initial (aucun user en storage)
  │     ├── isAuthenticated() → false
  │     ├── isAdmin() → false
  │     ├── displayName() → null
  │     └── currentUser() → null
  ├── État initial (user présent en storage)
  │     └── isAuthenticated() → true (restauration depuis localStorage)
  ├── getToken()
  │     └── Délègue à StorageService
  ├── login()
  │     ├── Stocke le token après login réussi
  │     ├── Met à jour tous les signals (isAuthenticated, isAdmin, displayName)
  │     ├── Propage l'erreur HTTP sans modifier l'état
  │     └── Ne modifie pas l'état si response.success = false
  ├── logout()
  │     ├── Vide le storage
  │     ├── Réinitialise le signal currentUser à null
  │     └── Navigue vers /auth/login
  └── Signals — état réactif
        └── isAuthenticated() passe à true après login réussi
```

### Pattern : mock de StorageService

```typescript
const mockStorageService: jest.Mocked<Partial<StorageService>> = {
    getToken: jest.fn().mockReturnValue(null),
    setToken: jest.fn(),
    setItem: jest.fn(),
    getItem: jest.fn().mockReturnValue(null),
    clear: jest.fn(),
};
```

Les services Angular sont injectés via `{ provide: StorageService, useValue: mockStorageService }` dans `TestBed` — pas de vraie persistance en localStorage pendant les tests.

### Pattern : mock des requêtes HTTP

```typescript
afterEach(() => {
    httpMock.verify();   // Vérifie qu'aucune requête n'est en attente
});

it('devrait stocker le token après login réussi', () => {
    service.login({ email: '...', password: '...' }).subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/auth/login'));
    expect(req.request.method).toBe('POST');
    req.flush(loginResponse);   // Simuler la réponse du backend

    expect(storageService.setToken).toHaveBeenCalledWith('jwt-token-abc123');
    expect(service.isAuthenticated()).toBe(true);
});
```

---

## 3. `StorageService` — Abstraction du localStorage

`StorageService` encapsule `localStorage` pour faciliter les tests (pas d'accès direct au DOM dans les composants) et gérer la sérialisation JSON.

Tests couverts :

| Test | Comportement vérifié |
|------|---------------------|
| `setToken` / `getToken` | Stockage et récupération du JWT |
| `setItem` / `getItem` | Sérialisation/désérialisation JSON transparente |
| `clear()` | Supprime tous les items du storage |
| `getItem` retourne `null` si clé absente | Comportement défensif |

---

## 4. `AuthGuard` — Protection des routes admin

`AuthGuard` implémente `CanActivateFn` — il redirige vers `/auth/login` si l'utilisateur n'est pas authentifié.

| Test | Comportement vérifié |
|------|---------------------|
| Utilisateur non authentifié | `router.navigate(['/auth/login'])` appelé, retourne `false` |
| Utilisateur authentifié | Retourne `true`, pas de redirection |
| Utilisateur non-admin sur route admin | Redirection vers `/` |
| Token présent en storage | Route accessible sans login supplémentaire |

---

## 5. `JwtInterceptor` — Injection automatique du Bearer token

Cet intercepteur HTTP injecte `Authorization: Bearer <token>` dans chaque requête sortante si un token est présent.

| Test | Comportement vérifié |
|------|---------------------|
| Requête avec token présent | Header `Authorization: Bearer xxx` ajouté |
| Requête sans token | Aucun header Authorization ajouté |
| Requête vers endpoint externe | Header ajouté uniquement si même domaine |
| 401 reçu → logout automatique | `authService.logout()` appelé |

---

## 6. `LoginComponent` — Formulaire Reactive Forms

Le composant utilise `ReactiveFormsModule` — les tests vérifient la validation Angular et la soumission.

| Groupe | Tests |
|--------|-------|
| Rendu initial | Formulaire visible, bouton disabled si vide |
| Validation email | Erreur si email invalide |
| Validation password | Erreur si < 3 chars |
| Soumission réussie | Appel `authService.login()`, redirection /admin |
| Soumission échouée | Message d'erreur affiché, pas de redirection |
| Chargement | Bouton disabled pendant la requête HTTP |

---

## 7. Configuration Jest

### `jest.config.js` / `package.json`

```json
{
  "jest": {
    "preset": "jest-preset-angular",
    "setupFilesAfterFramework": ["<rootDir>/setup-jest.ts"],
    "testPathPattern": "src/.*\\.spec\\.ts$",
    "coverageDirectory": "coverage",
    "coverageThreshold": {
      "global": {
        "lines": 30
      }
    }
  }
}
```

### Mode CI

```powershell
# Mode CI — sans watch, avec rapport JUnit XML
cd frontend && npm run test:ci

# Génère :
#   frontend/coverage/lcov-report/index.html   (HTML)
#   frontend/test-results/junit.xml            (CI/CD)
```

---

## 8. Exécution

```powershell
# Mode watch (développement)
cd frontend && npm test

# Mode CI (une seule passe, rapport XML + coverage)
cd frontend && npm run test:ci

# Rapports :
#   frontend/coverage/lcov-report/index.html   (coverage HTML)
#   frontend/coverage/lcov.info                (LCOV pour GitHub Actions)
```

---

## 9. Décisions techniques

### Pourquoi tester uniquement la couche `core/` (coverage 30%) ?

Le seuil de 30% couvre délibérément uniquement la couche `core/` (services, guards, interceptors) qui contient la logique métier réutilisable. Les composants de présentation (`features/`) sont couverts par les tests Cypress E2E (Phase 13) qui testent le comportement réel dans un navigateur.

Cette séparation évite les tests fragiles de templates HTML (qui cassent à chaque refactoring visuel) tout en testant solidement la logique.

### Pourquoi mocker `StorageService` et non `localStorage` directement ?

Mocker `StorageService` isole le test de l'implémentation du storage. Si on change de `localStorage` à `sessionStorage` ou à un autre mécanisme, les tests de `AuthService` ne changent pas — seuls les tests de `StorageService` sont impactés.

---

## 10. Fichiers créés / modifiés

| Fichier | Description |
|---------|-------------|
| `frontend/src/app/core/services/auth.service.spec.ts` | 12 tests — AuthService avec Signals |
| `frontend/src/app/core/services/storage.service.spec.ts` | 8 tests — StorageService |
| `frontend/src/app/core/guards/auth.guard.spec.ts` | 7 tests — AuthGuard CanActivateFn |
| `frontend/src/app/core/interceptors/jwt.interceptor.spec.ts` | 10 tests — JwtInterceptor |
| `frontend/src/app/features/auth/login/login.component.spec.ts` | 15 tests — LoginComponent |
| `frontend/jest.config.js` | Configuration Jest + jest-preset-angular |
| `frontend/setup-jest.ts` | Setup global (TextEncoder, etc.) |
| `frontend/package.json` | Scripts `test` / `test:ci`, seuil coverage |
