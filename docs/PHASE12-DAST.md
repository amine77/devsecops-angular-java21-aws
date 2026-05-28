# Phase 12 — DAST avec OWASP ZAP

## Contexte

Le DAST (Dynamic Application Security Testing) complète le SAST de la Phase 7.

| Technique | Moment d'exécution | Ce qu'elle voit |
|-----------|-------------------|-----------------|
| **SAST** (CodeQL, Semgrep) | Sur le code source, sans exécuter l'app | Vulnérabilités dans le code, dépendances |
| **DAST** (OWASP ZAP) | Sur l'application vivante, en envoyant de vraies requêtes HTTP | Comportement réel : injection, mauvais headers, auth bypass |

Le DAST trouve ce que le SAST ne peut pas voir : un endpoint qui semble sûr dans le code mais qui, en pratique, répond avec une mauvaise configuration de sécurité.

---

## Ce que ZAP teste

ZAP lit la spec OpenAPI 3 (`/v3/api-docs`) et génère automatiquement des cas de test pour chaque endpoint :

| Catégorie | Exemples de tests |
|-----------|-------------------|
| **Injection** | SQL injection, XSS, SSTI, Path traversal, LDAP injection |
| **En-têtes HTTP** | X-Content-Type-Options, Strict-Transport-Security, X-Frame-Options |
| **Authentification** | Endpoints protégés accessibles sans token ? Token invalide accepté ? |
| **Exposition d'info** | Stack traces dans les erreurs, numéros de version dans les headers |
| **CORS** | Origines autorisées trop larges |
| **Paramètres** | Valeurs limites, types inattendus, paramètres supprimés |

---

## Architecture du scan

```
GitHub Actions Runner
  ├── PostgreSQL 15          (service Docker)
  ├── Redis 7.2              (service Docker)
  ├── Spring Boot backend    (processus natif Maven)
  │     └── http://localhost:8080
  │           ├── /auth/login
  │           ├── /v3/api-docs   ← spec OpenAPI lue par ZAP
  │           └── /api/projects/**
  │
  └── OWASP ZAP              (container Docker : ghcr.io/zaproxy/zaproxy:stable)
        ├── Lit /v3/api-docs
        ├── Génère les requêtes de test
        ├── Injecte Authorization: Bearer <token>
        └── Produit : HTML + JSON + SARIF
```

---

## Utilisation en CI

### Déclenchement manuel

```
GitHub → Actions → "DAST — OWASP ZAP" → Run workflow
```

Deux types de scan disponibles :

| Type | Description | Durée |
|------|-------------|-------|
| `api` | Scan actif complet (OpenAPI) — injecte des payloads, tests d'injection | ~5 min |
| `baseline` | Scan passif — observe sans attaquer, plus rapide | ~2 min |

### Déclenchement automatique

Le scan `api` s'exécute chaque lundi à 4h UTC.

### Lire les résultats

**Rapport HTML** — Onglet Artifacts du run GitHub :
```
zap-dast-report-<run_id>/report_html.html
```

**GitHub Security tab** — Les résultats sont uploadés en SARIF :
```
GitHub → Security → Code scanning alerts → Filter by "zap-dast"
```

**GitHub Step Summary** — Tableau des alertes par niveau de risque visible directement dans le run.

---

## Utilisation en local

Prérequis : Docker installé + backend démarré.

```powershell
# Démarrer la stack de support (Postgres + Redis)
docker compose -f docker/docker-compose.dev-stack.yml up -d

# Démarrer le backend
$env:JWT_SECRET = "dev-secret-key-minimum-256-bits-for-hmac-sha256-algorithm"
mvn spring-boot:run -f backend/pom.xml -Dspring-boot.run.profiles=dev

# Scan actif complet (OpenAPI spec + injection tests)
make test-dast

# Scan passif uniquement (plus rapide)
make test-dast-baseline
```

Les rapports sont générés dans `zap/reports/`.

---

## Fichiers

| Fichier | Rôle |
|---------|------|
| `.github/workflows/dast-zap.yml` | Workflow CI — démarre le backend et lance ZAP |
| `zap/zap-rules.tsv` | Règles de suppression des faux positifs |
| `zap/reports/` | Rapports HTML/JSON générés localement (gitignored) |

---

## Règles de suppression (`zap-rules.tsv`)

Certaines alertes ZAP sont des faux positifs pour une API REST pure (JSON) :

| Rule ID | Alerte | Raison de l'IGNORE |
|---------|--------|-------------------|
| 10038 | CSP Header Not Set | CSP protège contre XSS dans les navigateurs — inapplicable à une API JSON |
| 10063 | Permissions-Policy Header | Contrôle les APIs navigateur (caméra, GPS) — inapplicable |
| 10020 | X-Frame-Options | Protège contre le clickjacking d'iframes HTML — inapplicable |
| 10027 | Suspicious Comments | Détecte des "commentaires" dans la spec OpenAPI — faux positif documenté |
| 10096 | Timestamp Disclosure | Les timestamps JSON sont intentionnels dans `ApiResponse` |

Les alertes **WARN** (10021, 10035) sont loguées sans bloquer le pipeline.

---

## Interprétation des résultats

### Niveaux de risque ZAP

| Niveau | Icône | Action recommandée |
|--------|-------|--------------------|
| High | 🔴 | Corriger immédiatement — vulnérabilité exploitable |
| Medium | 🟠 | Corriger dans le sprint en cours |
| Low | 🟡 | Backlog — amélioration sécurité |
| Informational | ℹ️ | Contexte — pas d'action requise |

### Ce qui est attendu pour ce projet

En environnement local/CI (HTTP, sans HSTS) et avec Spring Security activé, les alertes normales sont :
- **Low** : Absence de HSTS (normal en HTTP local) — à corriger en production
- **Informational** : Informations retournées dans les headers (version Spring, etc.)

Une alerte **High** sur cet API devrait être rare avec Spring Security + JWT correctement configurés. Si elle apparaît, investiguer immédiatement.
