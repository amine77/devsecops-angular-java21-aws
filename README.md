# Portfolio DevSecOps — Angular 20 + Spring Boot Java 21 + AWS

Application full-stack démontrant une pipeline DevSecOps complète : du développement local
jusqu'au déploiement AWS, avec observabilité, messaging, cache, tests à tous les niveaux,
et développement assisté par IA (Claude Code + MCP).

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Angular 20, TypeScript, Angular Material 3 (dark theme), Signals |
| Backend | Spring Boot 3.3, Java 21, Virtual Threads (Project Loom) |
| Base de données | PostgreSQL 15, Flyway migrations |
| Cache | Redis 7.2 — Spring Cache `@Cacheable`, TTL 5/10 min |
| Messaging | Apache Kafka KRaft (sans Zookeeper) — événements métier asynchrones |
| Serverless | AWS Lambda (Node.js 20) — 3 fonctions : rapport hebdomadaire, resize images, formulaire contact |
| Sécurité | JWT (HS384), BCrypt cost=12, Spring Security, OWASP Dependency Check, OWASP ZAP DAST |
| Observabilité | Prometheus, Grafana (3 dashboards), Logback JSON + MDC, Micrometer |
| Tests | JUnit 5 + Mockito (47 tests), Jest (53 tests), Cypress E2E (20 specs), k6 load tests (3 scénarios) |
| Infrastructure | AWS — EC2, RDS, ECR, VPC, CloudWatch, Lambda, S3, API Gateway, SES via Terraform |
| CI/CD | GitHub Actions — build, test, SAST (CodeQL), Trivy, OWASP DC, deploy |
| **GitOps** | **ArgoCD — App of Apps · Helm Chart · Kustomize overlays · modèle pull** |
| **IA & Outillage** | **Claude Code CLI · 21st Magic MCP · Model Context Protocol** |

---

## 🚀 Lancement en développement local

### Prérequis
- Java 21 + Maven 3.8+
- Node.js 20+ + npm
- Docker Desktop

### 1. Démarrer la stack de support

Démarre PostgreSQL, Redis, Prometheus et Grafana en une seule commande :

```powershell
docker-compose -f docker/docker-compose.dev-stack.yml up -d
```

### 2. Démarrer le backend Spring Boot

```powershell
# Windows PowerShell
$env:SPRING_DATASOURCE_URL      = "jdbc:postgresql://localhost:5433/portfolio_dev"
$env:SPRING_DATASOURCE_USERNAME = "portfolio_user"
$env:SPRING_DATASOURCE_PASSWORD = "portfolio_pass"
$env:JWT_SECRET                 = "dev-secret-key-minimum-256-bits-for-hmac-sha256-algorithm"
$env:SPRING_PROFILES_ACTIVE     = "dev"

mvn spring-boot:run -f backend/pom.xml -Dspring-boot.run.profiles=dev
```

> **Note :** `<optimizedLaunch>false</optimizedLaunch>` est configuré dans `pom.xml` pour
> désactiver le flag `-XX:TieredStopAtLevel=1` injecté par défaut par Spring Boot Maven Plugin.
> Sans ça, BCrypt strength=12 passe de ~300ms à ~20s → timeout login.

### 3. Démarrer le frontend Angular

```powershell
cd frontend
npm start
```

### Accès aux services

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:4200 | — |
| Backend API | http://localhost:8080 | — |
| Swagger UI | http://localhost:8080/swagger-ui.html | — |
| Actuator / Prometheus | http://localhost:8080/actuator/prometheus | — |
| Prometheus | http://localhost:9090 | — |
| Grafana | http://localhost:3000 | `admin` / `admin` |
| Redis | localhost:6379 | — |

### Comptes de démonstration

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Admin | `admin@portfolio.dev` | `Admin@2024!` |
| Utilisateur | `demo@portfolio.dev` | `Admin@2024!` |

---

## 🧪 Tests

### Tests unitaires et d'intégration (backend)

```powershell
cd backend
mvn test          # 47 tests unitaires (JUnit 5 + Mockito)
mvn verify        # + coverage JaCoCo ≥ 70%
```

### Tests unitaires (frontend)

```powershell
cd frontend
npm test          # Jest — composants, services, guards
npm run test:ci   # Mode CI avec rapport JUnit XML
```

### Tests E2E Cypress (Phase 13)

Prérequis : backend + frontend + PostgreSQL démarrés (étapes 1–3).

```powershell
cd frontend
npm run e2e        # Mode headless (CI)
npm run e2e:open   # Mode interactif (navigateur Cypress)
```

Scénarios couverts :
- `01-auth.cy.ts` — redirection non-auth, validation formulaire, login réussi, déconnexion
- `02-admin.cy.ts` — dashboard admin, création/modification/archivage de projets
- `03-portfolio.cy.ts` — accès public, navbar conditionnelle

### Tests de charge k6 (Phase 14)

Prérequis : [k6 installé](https://k6.io/docs/get-started/installation/) + backend démarré.

```powershell
# Windows : winget install k6
# Linux/Mac : brew install k6

make test-load        # 100 VUs — GET /projects, SLA p(95) < 200ms
make test-load-auth   # 50 VUs  — POST /auth/login (stress bcrypt)
make test-load-admin  # 5 VUs   — flux CRUD admin complet
make test-load-all    # Les 3 scénarios séquentiellement
```

Rapports HTML générés dans `k6/reports/` après chaque run.

| Scénario | Seuils |
|----------|--------|
| GET /projects — 100 VUs | `p(95) < 200ms`, `p(99) < 500ms`, `error rate < 1%` |
| POST /auth/login — 50 VUs | `p(95) < 1500ms` (bcrypt intentionnel) |
| Admin CRUD — 5 VUs | `p(95) < 500ms` |

En CI : `Actions → "Load Tests — k6" → Run workflow` (déclenchement manuel).

---

## 📨 Apache Kafka (Phase 10)

Démarrage optionnel du broker Kafka (overlay sur la stack de support) :

```powershell
docker-compose -f docker/docker-compose.dev-stack.yml -f docker/docker-compose.kafka.yml up -d
```

Événements publiés en temps réel :
- Topic `auth-events` — `UserLoginEvent` à chaque tentative de login
- Topic `project-events` — `ProjectCreatedEvent` à chaque création de projet

| Service | URL |
|---------|-----|
| Kafka UI | http://localhost:8090 |
| Dashboard Grafana Kafka | http://localhost:3000 (onglet "Kafka — Événements & Métriques") |

---

## ⚡ Cache Redis (Phase 11)

Redis démarre automatiquement avec la stack de support (port 6379).

Stratégie de cache (Spring Cache + `@Cacheable`) :
- `GET /projects` — TTL 5 min, invalidé à chaque create/update/delete
- `GET /projects/{id}` — TTL 10 min par ID
- `GET /projects/featured` — TTL 5 min

Dashboard Grafana : `"Redis Cache — Hits, Misses & Évictions"` → hit rate, puts, évictions.

---

## 🔍 DAST OWASP ZAP (Phase 12)

Dynamic Application Security Testing : ZAP démarre le backend réel et envoie de vraies requêtes HTTP pour trouver des vulnérabilités que le SAST ne peut pas détecter.

### Ce que ZAP teste

- Injections (SQL, XSS, Path traversal, SSTI)
- En-têtes de sécurité HTTP manquants
- Problèmes d'authentification et d'autorisation
- Exposition d'informations sensibles dans les réponses

### Lancement local

Prérequis : Docker + backend démarré.

```powershell
make test-dast          # Scan actif complet (OpenAPI spec + payloads d'injection)
make test-dast-baseline # Scan passif uniquement (plus rapide)
```

Rapports générés dans `zap/reports/`.

### En CI

```
GitHub → Actions → "DAST — OWASP ZAP" → Run workflow
```

Deux modes : `api` (scan actif, ~5 min) ou `baseline` (passif, ~2 min).
Résultats SARIF → **GitHub → Security → Code scanning alerts**.
Rapport HTML → onglet **Artifacts** du run.

Scan automatique chaque lundi 4h UTC.

| Fichier | Rôle |
|---------|------|
| `.github/workflows/dast-zap.yml` | Workflow CI — démarre le backend + ZAP |
| `zap/zap-rules.tsv` | Suppression des faux positifs (API REST) |

---

## ⚡ AWS Lambda — Architecture Serverless (Phase 15)

Trois fonctions Lambda Node.js 20 couvrent des cas d'usage **event-driven** que Spring Boot ne doit pas gérer :

| Fonction | Déclencheur | Rôle |
|---|---|---|
| `weekly-report` | EventBridge Scheduler (lun. 8h UTC) | Rapport HTML hebdomadaire → SES |
| `image-resize` | S3 PutObject (`originals/`) | 3 variantes WebP via Sharp (640×360, 320×180, 1200×630) |
| `contact-form` | API Gateway HTTP POST `/contact` | Formulaire de contact → SES |

**Coût total : $0/mois** (Free Tier AWS à vie pour ces volumes).

### Déploiement

```bash
# Vérifier les emails dans SES sandbox (une seule fois)
make ses-verify SENDER_EMAIL=noreply@domaine.com RECIPIENT_EMAIL=admin@gmail.com

# Builder les 3 Lambdas (npm ci)
make lambda-build

# Déployer via Terraform
make tf-plan && make tf-apply

# Tester
make lambda-invoke-weekly-report   # Envoie un rapport immédiatement
make lambda-test-contact           # Teste le formulaire de contact
```

> **Note Sharp :** la Lambda `image-resize` utilise `sharp` (binaires Linux natifs). Le build npm passe `--platform=linux --arch=x64` pour être compatible avec l'environnement d'exécution Lambda depuis Windows ou macOS.

Voir [`docs/PHASE15-Lambda-Serverless.md`](docs/PHASE15-Lambda-Serverless.md) pour l'architecture complète, les diagrammes et les points clés entretien.

---

## Arrêt et reset

```powershell
# Arrêter la stack de support
docker-compose -f docker/docker-compose.dev-stack.yml down

# Avec Kafka
docker-compose -f docker/docker-compose.dev-stack.yml -f docker/docker-compose.kafka.yml down

# Reset complet (supprime les données)
docker-compose -f docker/docker-compose.dev-stack.yml down -v
```

---

## 📁 Structure du projet

```
.
├── backend/                              # Spring Boot Java 21
│   ├── src/main/java/com/portfolio/
│   │   ├── config/                       # SecurityConfig, CacheConfig (Redis)
│   │   ├── controller/                   # AuthController, ProjectController
│   │   ├── kafka/                        # EventPublisher, AuditEventConsumer, events/
│   │   ├── observability/                # AppMetrics (Micrometer counters)
│   │   ├── security/                     # JWT filter, provider, handlers
│   │   └── service/                      # AuthService, ProjectService (@Cacheable)
│   ├── src/main/resources/
│   │   ├── application.properties        # Config commune (Redis, Kafka, JWT, JPA)
│   │   ├── application-dev.properties    # Surcharges dev
│   │   ├── db/migration/                 # Scripts Flyway (V1__..., V2__...)
│   │   └── logback-spring.xml            # JSON en prod, couleurs en dev
│   └── Dockerfile                        # Multi-stage build (Maven → JRE Alpine)
│
├── frontend/                             # Angular 20 + Angular Material 3
│   ├── src/app/
│   │   ├── core/                         # Services, guards, interceptors
│   │   ├── features/                     # auth/, admin/, portfolio/
│   │   └── shared/                       # Composants, modèles, pipes
│   ├── cypress/                          # Tests E2E (Phase 13)
│   │   ├── e2e/
│   │   │   ├── 01-auth.cy.ts
│   │   │   ├── 02-admin.cy.ts
│   │   │   └── 03-portfolio.cy.ts
│   │   └── support/
│   │       ├── commands.ts               # cy.loginByApi(), cy.createProjectByApi()
│   │       └── e2e.ts
│   ├── cypress.config.ts
│   └── Dockerfile                        # Build Nginx
│
├── k6/                                   # Tests de charge (Phase 14)
│   ├── lib/helpers.js                    # BASE_URL, getAdminToken(), authHeaders()
│   └── scenarios/
│       ├── 01-public-projects.js         # 100 VUs, SLA p(95)<200ms
│       ├── 02-auth-stress.js             # 50 VUs, stress login
│       └── 03-admin-flow.js              # 5 VUs, CRUD complet
│
├── docker/
│   ├── docker-compose.yml                # Stack complète (backend + frontend en Docker)
│   ├── docker-compose.dev-stack.yml      # Postgres + Redis + Prometheus + Grafana (dev natif)
│   ├── docker-compose.kafka.yml          # Kafka KRaft broker + Kafka UI (overlay optionnel)
│   ├── docker-compose.observability.yml  # Prometheus + Grafana (avec backend Docker)
│   ├── docker-compose.prod.yml           # Simulation production
│   ├── prometheus/
│   │   ├── prometheus.yml                # Scrape backend Docker
│   │   └── prometheus-native.yml         # Scrape backend natif (host.docker.internal)
│   └── grafana/
│       ├── provisioning/                 # Datasource Prometheus + provider dashboards
│       └── dashboards/
│           ├── portfolio.json            # API, JVM, HikariCP, HTTP metrics
│           ├── kafka.json                # Événements Kafka par topic (Phase 10)
│           └── cache.json                # Redis hits/misses/évictions (Phase 11)
│
├── lambdas/                              # Fonctions AWS Lambda (Node.js 20 ESM)
│   ├── weekly-report/                    # EventBridge → rapport HTML → SES
│   ├── image-resize/                     # S3 trigger → Sharp → 3 WebP variants
│   └── contact-form/                     # API Gateway → validation → SES
│
├── terraform/                            # Infrastructure AWS
│   ├── modules/
│   │   ├── vpc/                          # VPC + subnets + IGW
│   │   ├── ecr/                          # Registres Docker privés
│   │   ├── security-groups/              # Règles firewall EC2/RDS
│   │   ├── rds/                          # PostgreSQL RDS Free Tier
│   │   ├── ec2/                          # Serveur applicatif t2.micro
│   │   ├── cloudwatch/                   # Logs + métriques + alertes
│   │   ├── lambda-weekly-report/         # IAM + Lambda + EventBridge Scheduler
│   │   ├── lambda-image-resize/          # IAM + Lambda + S3 bucket + notification
│   │   └── lambda-contact-form/          # IAM + Lambda + API Gateway HTTP
│   └── terraform.tfvars.example
│
├── .github/workflows/
│   ├── ci-backend.yml                    # Checkstyle → Tests → CodeQL → OWASP DC → Trivy
│   ├── ci-frontend.yml                   # ESLint → Jest → Prettier → Trivy image
│   ├── security.yml                      # Scans de sécurité hebdomadaires
│   ├── k6-load-test.yml                  # Tests de charge (déclenchement manuel)
│   ├── deploy-infra.yml                  # Terraform validate/plan
│   └── deploy-app.yml                    # Build Docker + push ECR + deploy SSH
│
├── docs/
│   ├── PHASE1-Architecture.md
│   ├── PHASE2-Backend.md
│   ├── PHASE3-Frontend.md
│   ├── PHASE4-Docker.md
│   ├── PHASE5-Terraform.md
│   ├── PHASE6-CICD.md
│   ├── PHASE7-Observability.md
│   ├── PHASE8-Tests-Backend.md
│   ├── PHASE9-Tests-Frontend.md
│   ├── PHASE10-Kafka.md
│   ├── PHASE11-Redis-Cache.md
│   ├── PHASE12-DAST.md
│   ├── PHASE13-Cypress-E2E.md
│   ├── PHASE14-k6-Load-Tests.md
│   ├── PHASE15-Lambda-Serverless.md
│   ├── PHASE16-Security-Avancee.md
│   ├── PHASE17-Design-UX-AI.md
│   ├── PHASE18-ArgoCD-GitOps.md
│   ├── PHASE19-Helm.md
│   ├── PHASE20-FreeTier-K3s.md
│   └── FINOPS-Cost-Analysis.md
│
├── k8s/                                  # Manifests Kubernetes — GitOps (Phase 18)
│   ├── base/                             # Ressources communes (Deployment, Service, Ingress)
│   │   ├── backend/
│   │   ├── frontend/
│   │   └── kustomization.yaml
│   └── overlays/
│       ├── dev/                          # 1 replica, tag SHA auto-mis à jour par CI
│       └── prod/                         # 3 replicas, TLS, sync manuelle ArgoCD
│
├── helm/                                 # Helm Chart (Phase 19)
│   └── portfolio/
│       ├── Chart.yaml                    # Métadonnées SemVer
│       ├── values.yaml                   # Valeurs par défaut
│       ├── values-dev.yaml               # Overrides dev (tag SHA auto)
│       ├── values-prod.yaml              # Overrides prod (HPA, PDB, TLS)
│       └── templates/                    # 9 templates (backend, frontend, ingress, hpa, pdb)
│
├── argocd/                               # Applications ArgoCD — GitOps
│   ├── apps/
│   │   ├── app-of-apps.yaml             # Bootstrap : gère toutes les Applications
│   │   ├── portfolio-dev.yaml           # App dev (sync auto)
│   │   └── portfolio-prod.yaml          # App prod (sync manuelle)
│   └── install/README.md               # Guide d'installation ArgoCD
│
└── Makefile                              # Raccourcis : make up/down/test/test-load/...
```

---

## ☁️ Phase 20 — Free Tier Kubernetes : EC2 t3.micro + SWAP + K3s

Déploiement Kubernetes **~$0/mois** sur AWS Free Tier (12 premiers mois) grâce à un SWAP
de 4GB qui compense la RAM limitée du t3.micro (1GB).

```
EC2 t3.micro (1GB RAM + 4GB SWAP EBS)
  K3s single-node + Traefik + ArgoCD (~200MB) + Spring Boot (-Xmx256m)
  → Application publique sur http://<Elastic-IP>
  → ArgoCD UI sur http://<Elastic-IP>:30080

Coût : ~$0/mois (Free Tier 12 mois) → ~$23/mois ensuite
```

```bash
# Déploiement complet en 3 commandes
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# (éditer les secrets)
terraform -chdir=terraform apply
# Attendre ~10 min → accéder à http://<IP>
```

→ Voir [docs/PHASE20-FreeTier-K3s.md](docs/PHASE20-FreeTier-K3s.md) pour le guide complet.

---

## 🎯 Phase 19 — Helm Charts

Packaging Kubernetes de l'application sous forme de **Helm Chart** avec templating
complet, gestion des releases, HPA/PDB conditionnels, et intégration ArgoCD native.

```bash
helm upgrade --install portfolio helm/portfolio/ \
  -f helm/portfolio/values.yaml \
  -f helm/portfolio/values-dev.yaml \
  --namespace portfolio-dev --create-namespace --atomic
```

| Fichier | Rôle |
|---|---|
| `helm/portfolio/Chart.yaml` | Métadonnées — nom, version SemVer |
| `helm/portfolio/values.yaml` | Valeurs par défaut — 2 replicas, probes, resources |
| `helm/portfolio/values-dev.yaml` | Dev : 1 replica, tag SHA auto-mis à jour par CI |
| `helm/portfolio/values-prod.yaml` | Prod : 3+2 replicas, TLS, HPA, PDB |
| `helm/portfolio/templates/` | 9 templates — backend, frontend, ingress, hpa, pdb |

→ Voir [docs/PHASE19-Helm.md](docs/PHASE19-Helm.md) pour les commandes et la promotion dev→prod.

---

## ⎈ Phase 18 — GitOps avec ArgoCD

Déploiement Kubernetes en **modèle pull** : ArgoCD surveille ce dépôt Git et réconcilie
automatiquement l'état du cluster avec les manifests Kustomize.

### Pattern App of Apps

```
kubectl apply -f argocd/apps/app-of-apps.yaml
    └── ArgoCD lit argocd/apps/
        ├── portfolio-dev.yaml  → k8s/overlays/dev/  (sync automatique)
        └── portfolio-prod.yaml → k8s/overlays/prod/ (sync manuelle)
```

### Workflow GitOps (ci-gitops.yml)

```
push main → Build + Push ECR → kustomize edit set image sha-XXXX → git commit
                                                                         ↓
                                                         ArgoCD détecte le diff (~3min)
                                                                         ↓
                                                            Rolling update 0-downtime
```

| Fichier | Rôle |
|---|---|
| `k8s/base/` | Manifests Deployment, Service, ConfigMap, Ingress |
| `k8s/overlays/dev/` | 1 replica, tag SHA auto-mis à jour par CI |
| `k8s/overlays/prod/` | 3 replicas backend, 2 frontend, TLS, sync manuelle |
| `argocd/apps/` | App of Apps + Applications dev et prod |
| `.github/workflows/ci-gitops.yml` | Build → ECR → update manifest → commit |

→ Voir [docs/PHASE18-ArgoCD-GitOps.md](docs/PHASE18-ArgoCD-GitOps.md) pour l'installation complète.

---

## 🤖 Phase 17 — Design UX & Développement Assisté par IA

Refonte visuelle complète des 8 composants Angular avec **Claude Code** (CLI IA d'Anthropic)
et **21st Magic MCP** (serveur Model Context Protocol pour la génération de composants UI).

### Outils IA utilisés

| Outil | Rôle | Protocole |
|-------|------|-----------|
| **Claude Code** | Assistant IA dans le terminal — lit, comprend et modifie la codebase | Propriétaire Anthropic |
| **21st Magic MCP** | Bibliothèque de composants UI interrogeable par un agent IA | Model Context Protocol |
| **Claude Code Skills** | Instructions spécialisées (angular, ui-ux-designer, magic-ui-generator) | Fichiers `.md` locaux |

### Model Context Protocol (MCP)

MCP est un protocole open-source créé par Anthropic permettant à un LLM d'appeler
des outils externes via une interface standardisée. Un serveur MCP expose des **tools**
qu'un agent IA peut invoquer — exactement comme une API REST mais depuis une conversation IA.

```bash
# Ajouter le serveur 21st Magic à Claude Code
claude mcp add @21st-dev/magic --api-key <API_KEY>

# Les tools disponibles :
# mcp__magic__21st_magic_component_inspiration  → cherche des composants UI
# mcp__magic__21st_magic_component_builder      → génère un composant personnalisé
# mcp__magic__logo_search                       → logos SVG (TSX/JSX/SVG)
```

### Composants redessinés

`Home` · `Navbar` · `Footer` · `ProjectCard` · `ProjectList` · `Skills` · `ProjectDetail` · `Login`

→ Voir [docs/PHASE17-Design-UX-AI.md](docs/PHASE17-Design-UX-AI.md) pour le détail complet.

---

## 🔒 Variables d'environnement (production)

Injectées via GitHub Actions Secrets :

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Clé HMAC ≥ 32 chars (`openssl rand -base64 64`) |
| `SPRING_DATASOURCE_URL` | JDBC URL RDS PostgreSQL |
| `SPRING_DATASOURCE_USERNAME` | Utilisateur DB |
| `SPRING_DATASOURCE_PASSWORD` | Mot de passe DB |
| `REDIS_HOST` | Host Redis (ElastiCache ou service Docker) |
| `REDIS_PASSWORD` | Mot de passe Redis (vide en dev) |
| `KAFKA_BOOTSTRAP_SERVERS` | `kafka:9092` en Docker, MSK endpoint en prod |
| `CORS_ALLOWED_ORIGINS` | Domaine frontend (ex: `https://monapp.duckdns.org`) |
| `TF_VAR_lambda_sender_email` | Email SES vérifié (expéditeur Lambdas) |
| `TF_VAR_lambda_recipient_email` | Email de réception des rapports et contacts |
| `SERVER_PORT` | Port HTTP (défaut : 8080) |
