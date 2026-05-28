# Phase 14 — Tests de charge k6

## Vue d'ensemble

| Scénario | Fichier | VUs max | SLA principal |
|----------|---------|---------|---------------|
| GET /projects (SLA public) | `01-public-projects.js` | 100 | p(95) < 200ms |
| POST /auth/login (stress bcrypt) | `02-auth-stress.js` | 50 | p(95) < 1500ms |
| Admin CRUD complet | `03-admin-flow.js` | 5 | p(95) < 500ms |

---

## 1. Outil k6

**k6** est un outil de test de charge en Go, scriptable en JavaScript. Il est différent de JMeter ou Gatling :
- Pas d'interface graphique — uniquement CLI + rapports HTML
- Scripts JavaScript légers — logique de test directement dans le code
- Métriques personnalisées (`Trend`, `Counter`, `Rate`) intégrées à Prometheus
- Seuils (`thresholds`) déclaratifs — le test **échoue** si un SLA n'est pas respecté

---

## 2. Scénario 1 — `01-public-projects.js`

**Objectif :** valider que `GET /projects` tient la charge à 100 utilisateurs simultanés avec le cache Redis activé.

### Profil de charge

```
VUs
100 ┤                   ████████████████████
    │               ████                    ████
 0  └───────────────────────────────────────────── temps
     0s    30s       30s+1m              +15s
          montée     charge soutenue    descente
```

### Seuils (SLA)

```javascript
thresholds: {
    http_req_duration:         ['p(95)<200', 'p(99)<500'],   // SLA global
    http_req_failed:           ['rate<0.01'],                 // < 1% erreurs
    checks:                    ['rate>0.99'],                 // 99% checks OK
    projects_list_latency:     ['p(95)<200'],                 // métrique dédiée
    projects_featured_latency: ['p(95)<150'],                 // featured = plus petit
}
```

### Requêtes exécutées par VU

1. `GET /projects` — liste paginée (principal)
2. `GET /projects/featured` — projets mis en avant
3. `GET /actuator/health/readiness` — health check sous charge

### Détection empirique du cache Redis

```javascript
if (listRes.timings.duration < 20) {
    cacheHits.add(1);   // < 20ms = Redis hit probable
}
```

Sans cache Redis, `GET /projects` prend 15-50ms (PostgreSQL). Avec cache = < 5ms (Redis). La métrique `cache_hit_estimated` dans le rapport HTML permet de vérifier que le cache est bien actif.

---

## 3. Scénario 2 — `02-auth-stress.js`

**Objectif :** valider que le serveur ne sature pas sous 50 connexions simultanées, malgré le bcrypt cost=12 (~300ms par hash).

### Profil de charge

```
VUs
50  ┤                       ████████████████████
    │               ████████
20  ┤   ████████████
    │
 0  └─────────────────────────────────────────── temps
     0s   20s  30s    +20s     +30s       +15s
```

### Seuil intentionnellement souple

```javascript
thresholds: {
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    // bcrypt est lent par design — seuil 1.5s au lieu de 200ms
}
```

BCrypt (cost=12) prend ~300ms. Avec 50 VUs et des Virtual Threads, la latence ne doit pas s'empiler — mais si le pool de connexions DB sature, la latence explose. Ce scénario détecte ce type de saturation.

### Simulation de trafic réaliste

```javascript
// Toutes les 5 itérations = 20% de tentatives invalides
if (__ITER % 5 === 0) {
    // Login avec mauvais password → doit retourner 401
}
```

---

## 4. Scénario 3 — `03-admin-flow.js`

**Objectif :** valider le flux CRUD complet depuis la perspective d'un admin.

### Actions par itération

1. `POST /auth/login` — obtenir le token JWT
2. `POST /projects` — créer un projet (avec token)
3. `GET /projects/{id}` — lire le projet créé
4. `PUT /projects/{id}` — modifier le titre
5. `DELETE /projects/{id}` — archiver (soft delete)

5 VUs uniquement (faible charge) — ce scénario teste la **cohérence du flux** sous concurrence légère, pas la montée en charge.

---

## 5. Métriques personnalisées

```javascript
const projectsLatency = new Trend('projects_list_latency', true);  // Histogramme
const cacheHits       = new Counter('cache_hit_estimated');        // Compteur
const loginSuccessRate = new Rate('login_success_rate');           // Taux 0-1
```

Ces métriques apparaissent dans :
- Le résumé terminal à la fin du run
- Le rapport HTML (`k6/reports/`)
- Les `thresholds` — k6 sort avec code d'erreur si non respectés

---

## 6. Rapports HTML

k6 génère un rapport HTML par scénario via [k6-reporter](https://github.com/benc-uk/k6-reporter) :

```javascript
export function handleSummary(data) {
    return {
        'k6/reports/01-public-projects.html': htmlReport(data),
        stdout: textSummary(data, { indent: '  ', enableColors: true }),
    };
}
```

| Rapport | Contenu |
|---------|---------|
| `k6/reports/01-public-projects.html` | Latence p50/p95/p99, VUs, RPS, métriques custom |
| `k6/reports/02-auth-stress.html` | Login success rate, latence bcrypt |
| `k6/reports/03-admin-flow.html` | Durée des 5 opérations CRUD |

---

## 7. Lancement local

```powershell
# Installation k6 (Windows)
winget install k6

# Prérequis : backend démarré
make test-load        # 100 VUs — GET /projects
make test-load-auth   # 50 VUs  — POST /auth/login
make test-load-admin  # 5 VUs   — CRUD admin
make test-load-all    # Les 3 séquentiellement

# Contre une autre URL (staging, prod)
k6 run -e BASE_URL=http://staging.example.com:8080 k6/scenarios/01-public-projects.js
```

---

## 8. En CI (GitHub Actions)

**Workflow :** `k6-load-test.yml` — déclenchement **manuel uniquement**.

```
GitHub → Actions → "Load Tests — k6" → Run workflow
  → Choisir : scenario (01/02/03/all) + base_url (optionnel)
```

Le workflow démarre PostgreSQL + Redis + Spring Boot dans le runner CI, installe k6, exécute le scénario et publie le rapport HTML en artifact.

---

## 9. Décisions techniques

### Pourquoi des Virtual Users et pas des threads ?

k6 utilise des goroutines Go légères pour simuler des VUs — des milliers de VUs consomment peu de RAM (~1.5KB/VU). Contrairement à JMeter (threads Java = ~1MB/thread), k6 peut simuler 1000 VUs sur un laptop standard.

### Pourquoi des seuils dans le code plutôt qu'une vérification manuelle ?

Les `thresholds` k6 font retourner un code d'erreur non-zéro si une SLA est violée. En CI, cela fait échouer le workflow automatiquement — pas besoin d'interpréter manuellement le rapport.

### Pourquoi un déclenchement manuel en CI ?

Les tests de charge durent 2-5 minutes chacun et génèrent des centaines de requêtes. Les déclencher à chaque push ralentirait le pipeline de 10-15min et pourrait impacter d'autres tests parallèles qui utilisent le même backend.

---

## 10. Fichiers créés

| Fichier | Description |
|---------|-------------|
| `k6/lib/helpers.js` | `BASE_URL`, `getAdminToken()`, `authHeaders()`, constantes |
| `k6/scenarios/01-public-projects.js` | 100 VUs — SLA GET /projects avec cache Redis |
| `k6/scenarios/02-auth-stress.js` | 50 VUs — stress bcrypt sur POST /auth/login |
| `k6/scenarios/03-admin-flow.js` | 5 VUs — flux CRUD complet admin |
| `.github/workflows/k6-load-test.yml` | Workflow CI — déclenchement manuel |
| `Makefile` | Cibles `test-load`, `test-load-auth`, `test-load-admin`, `test-load-all` |
