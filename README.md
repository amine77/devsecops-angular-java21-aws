# Portfolio DevSecOps — Angular 18 + Spring Boot Java 21 + AWS

Application full-stack démontrant une pipeline DevSecOps complète.

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Angular 18, TypeScript, Signals |
| Backend | Spring Boot 3.3, Java 21, Virtual Threads |
| Base de données | PostgreSQL 15 (Flyway migrations) |
| Sécurité | JWT (HS384), BCrypt, Spring Security |
| Observabilité | Prometheus, Grafana, Logback JSON, MDC |
| Infrastructure | AWS (EC2, RDS, ECR, VPC) via Terraform |
| CI/CD | GitHub Actions (build, test, SAST, deploy) |

---

## 🚀 Lancement en développement local

### Prérequis
- Java 21 + Maven 3.8+
- Node.js 20+ + npm
- Docker Desktop

### 1. Démarrer la stack de support (Postgres + Prometheus + Grafana)

```powershell
docker-compose -f docker/docker-compose.dev-stack.yml up -d
```

### 2. Démarrer le backend Spring Boot (natif Maven)

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
| Grafana | http://localhost:3000 | `admin` / `admin1` |
| Kafka UI | http://localhost:8090 | — |
| Redis | localhost:6379 | — |

### Comptes de démonstration

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Admin | `admin@portfolio.dev` | `Admin@2024!` |
| Utilisateur | `demo@portfolio.dev` | `Admin@2024!` |

### 4. Lancer les tests E2E Cypress (Phase 13)

Prérequis : backend + frontend + PostgreSQL démarrés (étapes 1–3).

```powershell
cd frontend

# Mode headless (CI)
npm run e2e

# Mode interactif (navigateur Cypress ouvert)
npm run e2e:open
```

Les specs testent le flux complet :
- `01-auth.cy.ts` — redirection non-auth, validation login, login réussi, déconnexion
- `02-admin.cy.ts` — dashboard admin, création projet, modification, archivage
- `03-portfolio.cy.ts` — accès public, navbar conditionnelle

### 5. Tests de charge k6 (Phase 14)

Prérequis : [k6 installé](https://k6.io/docs/get-started/installation/) + backend démarré.

```powershell
# Windows : winget install k6 --source winget
# Linux/Mac : brew install k6

# Scénario principal — 100 VUs, SLA p(95) < 200ms
make test-load

# Stress test login — 50 VUs (bcrypt = lent par design)
make test-load-auth

# Flux admin CRUD — 5 VUs (login + create + read + update + delete)
make test-load-admin

# Tous les scénarios séquentiellement
make test-load-all
```

Les rapports HTML sont générés dans `k6/reports/` après chaque run.

**Seuils (fail si non respectés) :**
| Scénario | Threshold |
|----------|-----------|
| GET /projects (100 VUs) | `p(95) < 200ms`, `error rate < 1%` |
| POST /auth/login (50 VUs) | `p(95) < 1500ms` (bcrypt intentionnel) |
| Admin CRUD (5 VUs) | `p(95) < 500ms` |

En CI : `Actions → "Load Tests — k6" → Run workflow` (déclenchement manuel, démarre le backend automatiquement dans le runner).

### 6. (Optionnel) Démarrer le broker Kafka + Kafka UI

```powershell
docker-compose -f docker/docker-compose.dev-stack.yml -f docker/docker-compose.kafka.yml up -d
```

Redis est inclus dans la stack de support (`docker-compose.dev-stack.yml`) et démarre automatiquement.
Le cache est activé dès que le backend démarre avec un Redis accessible.

Stratégie de cache :
- `GET /projects` (liste) — cachée 5 min, invalidée à chaque création/mise à jour/suppression
- `GET /projects/{id}` (détail) — caché 10 min par ID, invalidé sur modification
- `GET /projects/featured` — caché 5 min, invalidé sur toute modification

Le dashboard **Grafana → "Redis Cache — Hits, Misses & Évictions"** (http://localhost:3000) affiche le hit rate en temps réel.

Les événements métier Kafka sont publiés en temps réel :
- `auth-events` — `UserLoginEvent` à chaque tentative de login
- `project-events` — `ProjectCreatedEvent` à chaque création de projet

Kafka UI accessible sur http://localhost:8090 pour visualiser les topics et messages.

Le dashboard **Grafana → "Kafka — Événements & Métriques"** (http://localhost:3000) affiche :
- Compteur total d'événements publiés par topic
- Taux de publication (events/min)
- Métriques Spring Kafka producer/consumer (latence, erreurs, lag)

### Arrêt

```powershell
# Arrêter Docker (Postgres + Prometheus + Grafana)
docker-compose -f docker/docker-compose.dev-stack.yml down

# Avec Kafka
docker-compose -f docker/docker-compose.dev-stack.yml -f docker/docker-compose.kafka.yml down

# Arrêter le backend : Ctrl+C dans le terminal Maven
# Arrêter le frontend : Ctrl+C dans le terminal npm
```

### Reset complet (supprime les données)

```powershell
docker-compose -f docker/docker-compose.dev-stack.yml down -v
# Avec Kafka
docker-compose -f docker/docker-compose.dev-stack.yml -f docker/docker-compose.kafka.yml down -v
```

---

## 📁 Structure du projet

```
.
├── backend/                    # Spring Boot Java 21
│   ├── src/main/java/          # Code source
│   ├── src/main/resources/     # Config (application*.properties, logback-spring.xml)
│   └── Dockerfile              # Multi-stage build (Maven → JRE Alpine)
│
├── frontend/                   # Angular 18
│   ├── src/                    # Code source
│   ├── proxy.conf.json         # Proxy /api → localhost:8080
│   └── Dockerfile              # Build Nginx
│
├── docker/
│   ├── docker-compose.yml              # Stack complète (backend + frontend en Docker)
│   ├── docker-compose.dev-stack.yml    # Postgres + Prometheus + Grafana (dev natif)
│   ├── docker-compose.observability.yml # Prometheus + Grafana (avec backend Docker)
│   ├── docker-compose.prod.yml         # Production
│   ├── prometheus/
│   │   ├── prometheus.yml              # Scrape backend Docker
│   │   └── prometheus-native.yml       # Scrape backend natif (host.docker.internal)
│   ├── docker-compose.kafka.yml         # Kafka KRaft broker + Kafka UI (Phase 10)
│   ├── docker-compose.redis.yml         # (inclus dans dev-stack)
│   └── grafana/
│       ├── provisioning/               # Datasource + dashboard auto-provisionnés
│       └── dashboards/
│           ├── portfolio.json          # Dashboard API + métriques applicatives
│           ├── kafka.json              # Dashboard Kafka (Phase 10)
│           └── cache.json              # Dashboard Redis Cache (Phase 11)
│
├── frontend/
│   ├── cypress/
│   │   ├── e2e/
│   │   │   ├── 01-auth.cy.ts           # Tests auth E2E (Phase 13)
│   │   │   ├── 02-admin.cy.ts          # Tests CRUD admin E2E (Phase 13)
│   │   │   └── 03-portfolio.cy.ts      # Tests portfolio public E2E (Phase 13)
│   │   └── support/
│   │       ├── commands.ts             # cy.loginByApi(), cy.createProjectByApi()
│   │       └── e2e.ts                  # Imports globaux
│   └── cypress.config.ts               # Config baseUrl, env vars, timeouts
│
├── k6/                                 # Tests de charge (Phase 14)
│   ├── lib/helpers.js                  # BASE_URL, getAdminToken(), authHeaders()
│   ├── scenarios/
│   │   ├── 01-public-projects.js       # 100 VUs, GET /projects, SLA p(95)<200ms
│   │   ├── 02-auth-stress.js           # 50 VUs, POST /auth/login
│   │   └── 03-admin-flow.js            # 5 VUs, flux CRUD admin complet
│   └── reports/                        # Rapports HTML générés (gitignored)
│
├── terraform/                  # Infrastructure AWS
│   ├── modules/
│   │   ├── vpc/                # VPC + subnets + IGW
│   │   ├── ecr/                # Registres Docker privés
│   │   ├── security-groups/    # Règles firewall EC2/RDS
│   │   ├── rds/                # PostgreSQL RDS
│   │   ├── ec2/                # Serveur applicatif
│   │   └── cloudwatch/         # Logs + métriques + alertes
│   └── terraform.tfvars.example
│
├── .github/workflows/
│   ├── deploy-infra.yml        # Terraform validate/plan
│   └── deploy-app.yml          # Build Docker + push ECR + deploy SSH
│
└── docs/
    ├── PHASE7-Observability.md
    └── ...
```

---

## 🔒 Variables d'environnement (production)

Injectées via GitHub Actions Secrets ou AWS Secrets Manager :

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Clé HMAC ≥ 32 chars (`openssl rand -base64 64`) |
| `SPRING_DATASOURCE_URL` | JDBC URL RDS PostgreSQL |
| `SPRING_DATASOURCE_USERNAME` | Utilisateur DB |
| `SPRING_DATASOURCE_PASSWORD` | Mot de passe DB |
| `CORS_ALLOWED_ORIGINS` | Domaine frontend (ex: `https://monapp.duckdns.org`) |
