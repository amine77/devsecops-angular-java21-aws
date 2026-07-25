# Phase 16 — Sécurité Avancée

> **Stack** : SonarCloud · SBOM CycloneDX · Cosign · OpenSSF Scorecard · Dependabot · Gitleaks Custom

## Objectif

La Phase 16 renforce la posture de sécurité du portfolio en ajoutant :

1. **SonarCloud** — Quality Gate + couverture de code + détection de hotspots sécurité
2. **SBOM CycloneDX** — Software Bill of Materials pour la supply chain security
3. **Cosign** — Signature des images Docker (SLSA Level 2)
4. **OpenSSF Scorecard** — Évaluation automatique des bonnes pratiques open-source
5. **Dependabot** — Mises à jour automatiques des dépendances avec alertes CVE
6. **Gitleaks custom** — Config `.gitleaks.toml` avec règles projet et allowlist test data

---

## Architecture de sécurité complète

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PIPELINE DEVSECOPS COMPLET                       │
├─────────────────┬───────────────────┬───────────────────────────────┤
│   CODE COMMIT   │   CI / BUILD      │   RUNTIME / DÉPLOIEMENT       │
├─────────────────┼───────────────────┼───────────────────────────────┤
│                 │                   │                               │
│ GitLeaks        │ CodeQL (SAST)     │ OWASP ZAP (DAST)             │
│ (secrets scan)  │ Semgrep (SAST)    │ Trivy images                  │
│                 │ Checkstyle        │ Docker Bench Security         │
│ Dependabot      │ ESLint            │                               │
│ (CVE alerts)    │                   │ Rate limiting ★NEW            │
│                 │                   │ NGINX + backend (2 niveaux)   │
│                 ├───────────────────┤                               │
│                 │ SonarCloud ★NEW   │                               │
│                 │ Quality Gate      │                               │
│                 │ Coverage ≥ 70%    │                               │
│                 │                   │                               │
│                 ├───────────────────┤                               │
│                 │ SBOM CycloneDX ★  │                               │
│                 │ Backend JSON+XML  │                               │
│                 │ Frontend JSON     │                               │
│                 │ Lambdas JSON      │                               │
│                 │                   │                               │
│                 ├───────────────────┤                               │
│                 │ Cosign ★NEW       │                               │
│                 │ Image signing     │                               │
│                 │ SLSA Level 2      │                               │
│                 │                   │                               │
│                 ├───────────────────┤                               │
│                 │ OpenSSF ★NEW      │                               │
│                 │ Scorecard         │                               │
│                 │ Best practices    │                               │
└─────────────────┴───────────────────┴───────────────────────────────┘
```

---

## 1. SonarCloud — Quality Gate

### Fichiers

- [.github/workflows/sonarcloud.yml](../.github/workflows/sonarcloud.yml)

### Configuration requise

**Secrets GitHub** (Settings → Secrets → Actions) :

| Secret | Description |
|--------|-------------|
| `SONAR_TOKEN` | Token d'accès SonarCloud pour le backend Maven |
| `SONAR_TOKEN_FRONTEND` | Token d'accès SonarCloud pour le frontend Angular |

**Variables GitHub** (Settings → Variables → Actions) :

| Variable | Exemple |
|----------|---------|
| `SONAR_ORGANIZATION` | `amine77` |

### Mise en place SonarCloud

1. Aller sur [sonarcloud.io](https://sonarcloud.io) → **My Account** → **Security** → **Generate Token**
2. Créer deux projets : `portfolio-backend` et `portfolio-frontend`
3. Ajouter les secrets et variables dans GitHub

### Quality Gate par défaut

| Métrique | Seuil |
|----------|-------|
| Coverage | ≥ 70% |
| Duplicated lines | < 3% |
| Maintainability rating | ≥ A |
| Reliability rating | ≥ A |
| Security rating | ≥ A |
| Security hotspots reviewed | 100% |

### Lancement local

```bash
# Backend
export SONAR_TOKEN=<token>
export SONAR_ORGANIZATION=amine77
make sonar-backend

# Frontend (nécessite sonar-scanner CLI)
export SONAR_TOKEN_FRONTEND=<token>
make sonar-frontend
```

---

## 2. SBOM CycloneDX — Software Bill of Materials

### Fichiers

- [.github/workflows/sbom-supply-chain.yml](../.github/workflows/sbom-supply-chain.yml)
- [backend/pom.xml](../backend/pom.xml) — Plugin `cyclonedx-maven-plugin`

### Qu'est-ce qu'un SBOM ?

Un **Software Bill of Materials** est l'inventaire exhaustif de toutes les dépendances d'un logiciel : nom, version, licence, hash, CVE connues. C'est l'équivalent d'une liste d'ingrédients pour le logiciel.

**Pourquoi c'est important :**
- **Réglementaire** : Executive Order 14028 (US) exige un SBOM pour les logiciels vendus au gouvernement fédéral américain
- **Supply chain** : Log4Shell aurait été détecté immédiatement avec un SBOM à jour
- **Compliance** : Identification rapide des licences GPL/AGPL incompatibles

### Format : CycloneDX v1.5

Standard OWASP, le plus largement supporté. Format **JSON + XML** généré.

### Artefacts générés

| Source | Fichier | Contenu |
|--------|---------|---------|
| Backend Maven | `backend/target/bom.json` | 80+ dépendances Spring Boot |
| Backend Maven | `backend/target/bom.xml` | Même contenu, format XML |
| Frontend npm | `frontend/sbom-cyclonedx.json` | 200+ dépendances Angular |
| Lambdas | `reports/sbom-lambdas.json` | Dépendances Node.js des 3 fonctions |

### Lancement local

```bash
# Tout d'un coup
make sbom

# Par composant
make sbom-backend    # → backend/target/bom.json
make sbom-frontend   # → frontend/sbom-cyclonedx.json
make sbom-lambdas    # → reports/sbom-lambdas.json
```

### Vérification du SBOM

```bash
# Installer CycloneDX CLI
npm install -g @cyclonedx/cyclonedx-cli

# Valider le format
cyclonedx validate --input-file backend/target/bom.json --input-format JSON
```

---

## 3. Cosign — Signature des images Docker (SLSA)

### Fichiers

- [.github/workflows/sbom-supply-chain.yml](../.github/workflows/sbom-supply-chain.yml) — Job `cosign-sign`

### SLSA Framework

**SLSA** (Supply-chain Levels for Software Artifacts) est un framework de l'industrie pour mesurer la sécurité de la chaîne d'approvisionnement.

| Niveau | Description |
|--------|-------------|
| SLSA 1 | Build documenté |
| **SLSA 2** | **Build hébergé + provenance signée ← Niveau atteint** |
| SLSA 3 | Build isolé + provenance vérifiable |
| SLSA 4 | Build hermétique + revue à deux personnes |

### Signature keyless via Sigstore

Le projet utilise la **signature keyless** Cosign : pas de clé privée à gérer. La preuve de signature est enregistrée dans le **transparency log Rekor** (publiquement vérifiable).

Le certificat de signature est délivré par **Fulcio** (CA OIDC de Sigstore) avec l'identité OIDC du workflow GitHub Actions.

```bash
# Vérifier qu'une image est signée
make cosign-verify IMAGE=portfolio-backend:latest
```

---

## 4. Dependabot — Mises à jour automatiques

### Fichiers

- [.github/dependabot.yml](../.github/dependabot.yml)

### Écosystèmes couverts

| Écosystème | Répertoire | Fréquence |
|------------|------------|-----------|
| Maven | `/backend` | Hebdomadaire (lundi) |
| npm | `/frontend` | Hebdomadaire (lundi) |
| npm | `/lambdas/*` | Mensuel |
| Docker | `/backend`, `/frontend` | Hebdomadaire |
| GitHub Actions | `/` | Hebdomadaire |
| Terraform | `/terraform` | Mensuel |

### Groupes de PRs

Les dépendances sont **regroupées** pour réduire le bruit :
- `spring-boot` — toutes les dépendances Spring en une PR
- `angular` — `@angular/*` + `@angular-devkit/*` + `@angular-eslint/*`
- `angular-material` — Material + CDK
- `security-actions` — Trivy, CodeQL, Semgrep, Gitleaks...

---

## 5. Gitleaks Custom — .gitleaks.toml

### Fichiers

- [.gitleaks.toml](../.gitleaks.toml)

### Règles ajoutées

| Règle | Pattern | Sévérité |
|-------|---------|----------|
| `aws-access-key-id-hardcoded` | `AKIA[0-9A-Z]{16}` | HIGH |
| `aws-secret-access-key-hardcoded` | Clé AWS 40 chars | CRITICAL |
| `jwt-secret-hardcoded` | `JWT_SECRET = "..."` | HIGH |
| `db-password-hardcoded` | `DB_PASSWORD = "..."` | MEDIUM |

### Allowlist documentée

Les faux positifs identifiés sont **exclus explicitement** avec justification :
- `Admin@2024!` — mot de passe de test dans les fixtures JUnit/Cypress
- `admin@portfolio.dev` — email admin de test
- Hash BCrypt — généré pour les tests, pas un secret

### Lancement local

```bash
# Avec la config custom
gitleaks detect --config .gitleaks.toml --verbose

# Sur un commit spécifique
gitleaks detect --config .gitleaks.toml --source . --log-opts="HEAD~1..HEAD"
```

---

## 6. OpenSSF Scorecard

### Fichiers

- [.github/workflows/sbom-supply-chain.yml](../.github/workflows/sbom-supply-chain.yml) — Job `openssf-scorecard`

### Checks évalués

| Check | Description |
|-------|-------------|
| Token-Permissions | Actions avec permissions minimales |
| Branch-Protection | Protection de la branche main |
| Vulnerabilities | CVEs connues dans les dépendances |
| Dependabot | Mises à jour automatiques actives |
| SAST | Outils d'analyse statique présents |
| Secret-Scanning | Détection de secrets activée |
| Binary-Artifacts | Pas de binaires dans le code source |
| Fuzzing | Tests de fuzzing présents |
| Packaging | Packages publiés depuis CI |
| Pinned-Dependencies | Actions épinglées par hash |

---

## 7. Rate limiting — protection anti-brute-force de `/auth/login`

BCrypt cost=12 rend chaque essai coûteux, mais ne limite pas *le nombre*
d'essais. Sans plafond, un attaquant dispose d'un oracle illimité sur le
formulaire de connexion. Deux limiteurs indépendants s'en chargent, à deux
niveaux de la pile — si l'un est mal configuré ou contourné, l'autre tient.

### Fichiers

- [backend/.../security/LoginRateLimiter.java](../backend/src/main/java/com/portfolio/backend/security/LoginRateLimiter.java) — compteurs Caffeine
- [backend/.../security/LoginRateLimitFilter.java](../backend/src/main/java/com/portfolio/backend/security/LoginRateLimitFilter.java) — filtre servlet devant Spring Security
- [backend/.../security/ClientIpResolver.java](../backend/src/main/java/com/portfolio/backend/security/ClientIpResolver.java) — résolution de l'IP réelle derrière le proxy
- [frontend/nginx.conf](../frontend/nginx.conf) — `limit_req_zone` / `limit_req`

### Les deux niveaux

| Niveau | Règle | Réponse |
|--------|-------|---------|
| **Backend** — verrouillage | 5 échecs / 15 min par IP | `429` + `Retry-After` (secondes restantes) |
| **Backend** — débit | 20 requêtes / 1 min par IP | `429` + `Retry-After` |
| **NGINX** — débit | `rate=10r/m`, `burst=5 nodelay` | `429` (`limit_req_status 429`) |

Tout est configurable par variables d'environnement
(`RATE_LIMIT_MAX_FAILURES`, `RATE_LIMIT_FAILURE_WINDOW`, `RATE_LIMIT_MAX_ATTEMPTS`,
`RATE_LIMIT_ATTEMPT_WINDOW`, `RATE_LIMIT_ENABLED`).

### Le piège de l'IP cliente

Derrière un reverse proxy, `request.getRemoteAddr()` renvoie l'IP de NGINX :
tout le trafic partagerait un seul compteur et le premier attaquant
verrouillerait le site entier. `ClientIpResolver` lit donc les en-têtes — mais
tous ne se valent pas :

- **`X-Real-IP`** : NGINX l'**écrase** à chaque requête (`proxy_set_header`),
  un client ne peut donc pas le falsifier. C'est celui qui fait foi.
- **`X-Forwarded-For`** : *concaténé* — un client qui envoie déjà cet en-tête
  voit sa valeur préservée en tête de liste. D'où `split(",")[0]` et un usage
  en repli seulement.

`app.rate-limit.behind-proxy=false` ignore les deux en-têtes : indispensable si
le backend est un jour exposé directement, sinon n'importe qui se forge une IP.

### Observabilité

`auth_login_rate_limited_total{reason="locked_out"|"throttled"}` distingue le
verrouillage après échecs répétés du simple dépassement de débit. Une hausse de
`locked_out` signale une attaque ; une hausse de `throttled` signale plutôt un
client mal codé.

### Vérification en conditions réelles

Testé sur la simulation de production, en passant par le port 80 (donc à
travers NGINX), le 25/07/2026 :

| Tentative | Réponse | Origine |
|-----------|---------|---------|
| 1 – 5 | `401` | authentification |
| 6 – 7 | `429` + `Retry-After: 895` | backend (verrouillage) |
| 8 – 9 | `429` sans `Retry-After` | NGINX (débit) |

La présence ou non de `Retry-After` identifie le limiteur qui a répondu — c'est
d'ailleurs ce que le frontend exploite pour afficher soit « Réessayez dans
N min », soit un message d'attente générique.

### Limite connue

Les compteurs Caffeine sont **en mémoire** : ils repartent à zéro au
redémarrage du backend et ne sont pas partagés entre instances. Acceptable sur
un déploiement mono-instance ; une montée en charge horizontale imposerait de
déporter les compteurs dans Redis.

---

## Résumé des fichiers créés

```
.
├── .gitleaks.toml                              ← Config Gitleaks custom (règles + allowlist)
├── SECURITY.md                                 ← Politique de divulgation responsable
├── .github/
│   ├── dependabot.yml                          ← Mises à jour auto (6 écosystèmes)
│   └── workflows/
│       ├── sonarcloud.yml                      ← SonarCloud Quality Gate (backend + frontend)
│       └── sbom-supply-chain.yml               ← SBOM + Cosign + OpenSSF Scorecard
└── backend/
    └── pom.xml                                 ← Plugin cyclonedx-maven-plugin ajouté
```

---

## Commandes Makefile Phase 16

```bash
make sbom                  # SBOM complet (backend + frontend + lambdas)
make sbom-backend          # SBOM Maven → backend/target/bom.json
make sbom-frontend         # SBOM npm → frontend/sbom-cyclonedx.json
make sbom-lambdas          # SBOM Trivy → reports/sbom-lambdas.json
make sonar-backend         # SonarCloud backend (SONAR_TOKEN requis)
make sonar-frontend        # SonarCloud frontend (SONAR_TOKEN_FRONTEND requis)
make cosign-verify         # Vérifier signature Cosign (IMAGE=... requis)
make security-phase16      # SBOM + Trivy en une commande
```

---

## Valeur pour le recruteur

| Compétence démontrée | Outil |
|----------------------|-------|
| Static Application Security Testing (SAST) avancé | SonarCloud + Quality Gate |
| Supply Chain Security | SBOM CycloneDX + Cosign SLSA |
| Vulnerability Management | Dependabot + OWASP DC |
| Secrets Management | Gitleaks custom config |
| Défense en profondeur runtime | Rate limiting NGINX + backend, métriques dédiées |
| OSS Best Practices | OpenSSF Scorecard |
| Compliance SBOM | Executive Order 14028 / NTIA |
