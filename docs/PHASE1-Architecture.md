# PHASE 1 — Architecture Globale & Préparation

> **Date de création :** 2026-05-25
> **Projet :** DevSecOps Portfolio — Angular + Spring Boot Java 21 + AWS
> **Objectif :** Architecture cloud native orientée production, compatible AWS Free Tier

---

## Table des matières

1. [Vue d'ensemble — Pourquoi cette stack ?](#1-vue-densemble--pourquoi-cette-stack-)
2. [Diagramme d'architecture global](#2-diagramme-darchitecture-global)
3. [Flux réseau détaillé](#3-flux-réseau-détaillé--chaque-paquet-expliqué)
4. [Rôle de chaque composant](#4-rôle-de-chaque-composant--pourquoi-chaque-choix-)
5. [Contraintes AWS Free Tier — Impact RAM](#5-contraintes-aws-free-tier--impact-ram-critique)
6. [Arborescence finale du projet](#6-arborescence-finale-du-projet)
7. [Flux de données — Exemple login](#7-flux-de-données--détail-dune-requête-login)
8. [Stratégie de déploiement Dev vs Prod](#8-stratégie-de-déploiement--dev-vs-prod)
9. [Checklist PHASE 1](#9-checklist-phase-1--avant-de-passer-à-la-suite)
10. [Compétences démontrées (recruteur)](#10-résumé-des-compétences-démontrées-en-phase-1-recruteur)

---

## 1. Vue d'ensemble — Pourquoi cette stack ?

Avant de coder une seule ligne, un architecte senior **dessine l'architecture**.
Chaque choix technique a un **coût**, une **raison**, et un **impact sur la maintenabilité**.

---

## 2. Diagramme d'architecture global

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                        DEVSECOPS PORTFOLIO — ARCHITECTURE                       ║
╚══════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│                            DEVELOPER WORKSTATION                             │
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────┐  │
│  │   Angular    │    │ Spring Boot  │    │     Docker Compose           │  │
│  │   :4200      │    │   :8080      │    │   (développement local)      │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────────────────────────┘  │
│         │                  │                                                │
│  git push ─────────────────┼────────────────────────────────────────────   │
└──────────────────────────── ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GITHUB + GITHUB ACTIONS                              │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                     CI/CD PIPELINE                                   │  │
│   │                                                                      │  │
│   │  ① Lint & Format Check   ② Unit Tests   ③ Integration Tests         │  │
│   │  ④ E2E Cypress Tests     ⑤ Build Docker ⑥ Push ECR                  │  │
│   │  ⑦ SSH → EC2             ⑧ helm upgrade                             │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                          │              │                                    │
│                     Push images    Deploy via SSH                            │
└────────────────────────── ─ ─ ─ ─ ─ ─ │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                                          │
          ┌───────────────────────────────┼───────────────────────────────┐
          │                               │                               │
          ▼                               ▼                               ▼
┌─────────────────┐           ┌───────────────────────────────────────────────┐
│   AMAZON ECR    │           │                   AWS VPC                     │
│                 │           │                                               │
│ ┌─────────────┐ │           │  ┌─────────────────────────────────────────┐ │
│ │ backend:tag │ │           │  │          PUBLIC SUBNET                   │ │
│ └─────────────┘ │◄──────────┤  │                                          │ │
│ ┌─────────────┐ │  Pull     │  │  ┌──────────────────────────────────┐   │ │
│ │frontend:tag │ │  images   │  │  │     EC2 t2.micro (Free Tier)     │   │ │
│ └─────────────┘ │           │  │  │         1 vCPU / 1GB RAM         │   │ │
└─────────────────┘           │  │  │         + 2GB SWAP               │   │ │
                              │  │  │         Elastic IP: X.X.X.X      │   │ │
                              │  │  │                                  │   │ │
                              │  │  │  ┌────────────────────────────┐  │   │ │
                              │  │  │  │     MINIKUBE (K8s)         │  │   │ │
                              │  │  │  │                            │  │   │ │
                              │  │  │  │  ┌──────────────────────┐  │  │   │ │
                              │  │  │  │  │  NGINX Ingress Ctrl   │  │  │   │ │
                              │  │  │  │  │  :80 / :443           │  │  │   │ │
                              │  │  │  │  └──────┬───────┬────────┘  │  │   │ │
                              │  │  │  │         │       │            │  │   │ │
                              │  │  │  │    /    │    /api│            │  │   │ │
                              │  │  │  │         ▼       ▼            │  │   │ │
                              │  │  │  │  ┌──────────┐ ┌──────────┐  │  │   │ │
                              │  │  │  │  │ Frontend │ │ Backend  │  │  │   │ │
                              │  │  │  │  │  Pod     │ │  Pod     │  │  │   │ │
                              │  │  │  │  │  NGINX   │ │  JVM     │  │  │   │ │
                              │  │  │  │  │  :80     │ │  :8080   │  │  │   │ │
                              │  │  │  │  │  128MB   │ │  400MB   │  │  │   │ │
                              │  │  │  │  └──────────┘ └────┬─────┘  │  │   │ │
                              │  │  │  │                     │        │  │   │ │
                              │  │  │  └─────────────────────┼────────┘  │   │ │
                              │  │  └───────────────────────── ─│─ ─ ─ ─ ┘   │ │
                              │  │                              │             │ │
                              │  │  ┌───────────────────────────┼───────────┐ │ │
                              │  │  │      PRIVATE SUBNET       │           │ │ │
                              │  │  │                           ▼           │ │ │
                              │  │  │  ┌────────────────────────────────┐   │ │ │
                              │  │  │  │  RDS PostgreSQL t3.micro       │   │ │ │
                              │  │  │  │  (Free Tier) :5432             │   │ │ │
                              │  │  │  │  Accessible depuis EC2 ONLY    │   │ │ │
                              │  │  │  └────────────────────────────────┘   │ │ │
                              │  │  └────────────────────────────────────────┘ │ │
                              │  └────────────────────────────────────────────  ┘ │
                              └───────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUX UTILISATEUR FINAL                            │
│                                                                              │
│  Browser → https://monapp.duckdns.org                                       │
│      → DuckDNS DNS → Elastic IP EC2                                         │
│      → iptables/nodePort → Minikube NGINX Ingress                           │
│      → TLS terminaison (cert-manager + Let's Encrypt)                       │
│      → Route "/" → Angular Pod → UI statique                                │
│      → Route "/api" → Spring Boot Pod → RDS PostgreSQL                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Flux réseau détaillé — Chaque paquet expliqué

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         FLUX RÉSEAU COMPLET                                  │
└──────────────────────────────────────────────────────────────────────────────┘

REQUÊTE UTILISATEUR → PAGE WEB
════════════════════════════════

  [Browser]                    [DNS]              [AWS EC2]
      │                          │                     │
      │ GET https://             │                     │
      │ monapp.duckdns.org/      │                     │
      │─────────────────────────►│                     │
      │                          │ DNS lookup:         │
      │                          │ → Elastic IP        │
      │◄─────────────────────────│                     │
      │                    IP: X.X.X.X                 │
      │                                                │
      │ TCP:443 ───────────────────────────────────────►
      │                                                │
      │               [Security Group AWS]             │
      │               Port 443 autorisé ✓              │
      │                                                │
      │          [Minikube NodePort 30443]              │
      │               ↓                               │
      │          [NGINX Ingress Controller]             │
      │               ↓                               │
      │          TLS Handshake (Let's Encrypt cert)    │
      │◄───────────────────────────────────────────────│
      │                                                │
      │ HTTPS établi ✓                                 │

ROUTAGE INGRESS
════════════════

  Request: GET /api/projects
  ┌─────────────────────────────────────────────────┐
  │  NGINX Ingress Controller                        │
  │                                                 │
  │  host: monapp.duckdns.org                       │
  │  path: /api/* ──────────────────────────────┐   │
  │  path: /*   ────────────────────────────┐   │   │
  │                                         │   │   │
  └─────────────────────────────────────────┼───┼───┘
                                            │   │
              ┌─────────────────────────────┘   │
              │                                 │
              ▼                                 ▼
  ┌─────────────────────────┐     ┌─────────────────────────┐
  │  frontend-service       │     │  backend-service        │
  │  ClusterIP :80          │     │  ClusterIP :8080        │
  └────────────┬────────────┘     └────────────┬────────────┘
               │                               │
               ▼                               ▼
  ┌─────────────────────────┐     ┌─────────────────────────┐
  │  frontend Pod           │     │  backend Pod            │
  │  NGINX serving          │     │  Spring Boot JVM        │
  │  dist/angular/          │     │  → JDBC → RDS           │
  └─────────────────────────┘     └─────────────────────────┘

COMMUNICATION INTERNE K8S (ClusterIP DNS)
══════════════════════════════════════════

  backend Pod → PostgreSQL :
  └─ Connection string :
     jdbc:postgresql://rds-endpoint.aws.com:5432/portfolio
     (RDS hors cluster, accès via Security Group)

  frontend Pod → backend Pod :
  └─ Via NGINX proxy_pass /api → backend-service:8080
     OU Angular appelle /api → réécrit par Ingress
```

---

## 4. Rôle de chaque composant — Pourquoi chaque choix ?

### 🅰️ Angular — Frontend

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| Framework | Angular | Framework enterprise, TypeScript natif, DI, structure imposée = maintenable |
| Routing | Angular Router + Lazy Loading | Charge uniquement le code du module actif → performance |
| HTTP | HttpClient + Interceptors | Gestion centralisée JWT, retry, error handling |
| State | Services RxJS | Pas de NgRx pour un portfolio (overkill), services simples suffisent |
| Build prod | `ng build --configuration production` | Tree-shaking, minification, AOT compilation → bundle petit |
| Serveur | NGINX dans Docker | Sert les fichiers statiques, gzip, proxy_pass vers API |

### ☕ Spring Boot Java 21 — Backend

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| Java 21 | Virtual Threads (Loom) | Scalabilité sur petite RAM, threads légers |
| Architecture | Layered (Controller/Service/Repo) | Séparation des responsabilités, testabilité |
| JPA/Hibernate | Spring Data JPA | ORM standard Java, pas de SQL boilerplate |
| Sécurité | Spring Security + JWT | Standard industrie, stateless (idéal Kubernetes) |
| DTOs | MapStruct ou manuel | Évite d'exposer les entités DB = sécurité + flexibilité |
| Docs API | SpringDoc OpenAPI 3 | Interface interactive, documentation automatique |
| Health | Spring Actuator | Kubernetes liveness/readiness probes |
| JVM opts | `-Xmx300m -Xss256k` | Limite RAM pour EC2 t2.micro (1GB total) |

### 🐘 PostgreSQL — Base de données

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| Hébergement | AWS RDS Free Tier | Managé, backups automatiques, pas de DBA work |
| Instance | db.t3.micro (1 vCPU, 1GB) | Free Tier 12 mois |
| Connexion | depuis EC2 via Security Group | RDS dans subnet privé → pas exposé publiquement |
| Pool | HikariCP (défaut Spring) | Pool de connexions performant |

### 🐳 Docker — Conteneurisation

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| Build | Multi-stage builds | Image finale = code compilé seulement, pas les outils de build |
| Registry | Amazon ECR | Intégré AWS IAM, free 500MB/mois, latence faible vers EC2 |
| Base backend | `eclipse-temurin:21-jre-alpine` | JRE seul (pas JDK), Alpine = image petite (~150MB) |
| Base frontend | `node:20-alpine` (build) + `nginx:alpine` (run) | Build Angular → copie dist/ dans NGINX |

### ☸️ Kubernetes / Minikube — Orchestration

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| Minikube | Cluster K8s local sur EC2 | Gratuit, démontre Kubernetes sans coût EKS ($72/mois) |
| Driver | `--driver=none` ou `docker` | Sur EC2, driver `none` = K8s directement sur host = moins RAM |
| Namespace | `portfolio` | Isolation, bonne pratique |
| Resources | Limits/Requests | Évite OOMKill sur 1GB RAM |
| Probes | Liveness + Readiness | K8s redémarre si mort, attend si pas prêt |
| Secrets | K8s Secrets | Pas de credentials en clair dans les YAMLs |
| ConfigMaps | Variables d'env non-sensibles | Configuration externalisée |

### ⛵ Helm — Package Manager Kubernetes

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| Charts | Un chart par app | Versioning indépendant, valeurs différentes par env |
| Values | `values.yaml` | Paramétrage sans modifier les templates |
| Upgrade | `helm upgrade --install` | Idempotent = safe en CI/CD |

### 🏗️ Terraform — Infrastructure as Code

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| Provider | AWS | Infrastructure AWS gérée par code |
| State | S3 remote backend | State partagé en équipe, pas de conflits |
| Modules | modules/ séparés | Réutilisabilité, séparation vpc/ec2/rds/ecr |
| Variables | tfvars par env | Même code, configurations différentes |

### 🔄 GitHub Actions — CI/CD

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| Triggers | push main + PR | Build sur chaque commit |
| Stages | test → build → push → deploy | Fail fast si tests KO |
| Secrets | GitHub Secrets | Credentials AWS jamais en clair |
| Deploy | SSH + helm upgrade | Simple, fonctionne sur n'importe quel serveur |

### 🌐 NGINX Ingress — Reverse Proxy

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| Ingress | NGINX Ingress Controller | Standard K8s, annotations riches, cert-manager intégration |
| Routing | Path-based | `/` → frontend, `/api` → backend sur même domaine (pas de CORS) |
| CORS | Évité grâce au path-based routing | Frontend et backend sur même domaine/port |

### 🔒 cert-manager + Let's Encrypt — HTTPS

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| cert-manager | Opérateur K8s | Renouvellement automatique des certificats |
| Let's Encrypt | CA gratuite | HTTPS gratuit, reconnu par tous les navigateurs |
| Challenge | HTTP-01 | Simple, fonctionne avec Ingress standard |

### 🦆 DuckDNS — Domaine gratuit

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| DuckDNS | DNS dynamique gratuit | Pointe vers Elastic IP, Let's Encrypt compatible |
| Elastic IP | IP statique AWS | IP fixe même après redémarrage EC2 |

---

## 5. Contraintes AWS Free Tier — Impact RAM critique

```
╔══════════════════════════════════════════════════════════════════════╗
║              BUDGET RAM EC2 t2.micro (1GB total)                   ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  OS Linux (Ubuntu 22.04)          ~150 MB                           ║
║  Docker daemon                    ~80 MB                            ║
║  Minikube + etcd + API server     ~350 MB                           ║
║  Spring Boot Pod (JVM -Xmx256m)   ~300 MB ← Critique               ║
║  Angular/NGINX Pod                ~50 MB                            ║
║  NGINX Ingress Controller         ~50 MB                            ║
║  cert-manager                     ~40 MB                            ║
║  ─────────────────────────────────────                              ║
║  TOTAL ESTIMÉ                    ~1020 MB ← DÉPASSE 1GB !          ║
║                                                                      ║
║  SOLUTION : Activer SWAP 2GB sur EC2                                ║
║  sudo fallocate -l 2G /swapfile                                     ║
║  sudo chmod 600 /swapfile                                           ║
║  sudo mkswap /swapfile                                              ║
║  sudo swapon /swapfile                                              ║
║                                                                      ║
║  ⚠️  Le swap ralentit mais évite l'OOM Killer                        ║
║  ⚠️  Pour un usage pro, migrer vers t3.small (2GB, ~17$/mois)       ║
║  ✅  Pour le portfolio/learning : t2.micro + swap suffisent          ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 6. Arborescence finale du projet

```
devsecops-angular-java21-aws/              ← Racine du monorepo
│
├── README.md                              ← Documentation principale portfolio
├── .gitignore                             ← Ignorer node_modules, .terraform, etc.
├── .editorconfig                          ← Cohérence IDE (indentation, charset)
│
├── .github/                               ← GitHub Actions CI/CD
│   └── workflows/
│       ├── backend-ci.yml                 ← Tests + build backend
│       ├── frontend-ci.yml                ← Tests + build frontend
│       └── deploy.yml                     ← Push ECR + déploiement Helm
│
├── backend/                               ← Application Spring Boot Java 21
│   ├── Dockerfile                         ← Multi-stage build optimisé RAM
│   ├── .dockerignore
│   ├── pom.xml                            ← Dépendances Maven
│   ├── checkstyle.xml                     ← Règles style Java
│   └── src/
│       ├── main/
│       │   ├── java/com/portfolio/backend/
│       │   │   ├── BackendApplication.java
│       │   │   ├── config/
│       │   │   │   ├── SecurityConfig.java
│       │   │   │   ├── OpenApiConfig.java
│       │   │   │   └── CorsConfig.java
│       │   │   ├── controller/
│       │   │   │   ├── AuthController.java
│       │   │   │   ├── ProjectController.java
│       │   │   │   └── SkillController.java
│       │   │   ├── dto/
│       │   │   │   ├── request/
│       │   │   │   │   ├── LoginRequest.java
│       │   │   │   │   ├── RegisterRequest.java
│       │   │   │   │   └── ProjectRequest.java
│       │   │   │   └── response/
│       │   │   │       ├── ApiResponse.java     ← Wrapper standard
│       │   │   │       ├── PageResponse.java    ← Pagination standard
│       │   │   │       ├── AuthResponse.java
│       │   │   │       ├── ProjectResponse.java
│       │   │   │       └── ErrorResponse.java
│       │   │   ├── entity/
│       │   │   │   ├── User.java
│       │   │   │   ├── Project.java
│       │   │   │   └── Skill.java
│       │   │   ├── exception/
│       │   │   │   ├── GlobalExceptionHandler.java
│       │   │   │   ├── ResourceNotFoundException.java
│       │   │   │   ├── UnauthorizedException.java
│       │   │   │   └── ValidationException.java
│       │   │   ├── mapper/
│       │   │   │   ├── ProjectMapper.java
│       │   │   │   └── SkillMapper.java
│       │   │   ├── repository/
│       │   │   │   ├── UserRepository.java
│       │   │   │   ├── ProjectRepository.java
│       │   │   │   └── SkillRepository.java
│       │   │   ├── security/
│       │   │   │   ├── JwtTokenProvider.java
│       │   │   │   ├── JwtAuthenticationFilter.java
│       │   │   │   └── UserDetailsServiceImpl.java
│       │   │   └── service/
│       │   │       ├── AuthService.java
│       │   │       ├── ProjectService.java
│       │   │       └── SkillService.java
│       │   └── resources/
│       │       ├── application.properties         ← Config commune
│       │       ├── application-dev.properties     ← Dev local
│       │       ├── application-prod.properties    ← Prod (RDS, logs JSON)
│       │       └── db/migration/                  ← Flyway migrations SQL
│       │           ├── V1__create_users.sql
│       │           ├── V2__create_projects.sql
│       │           └── V3__create_skills.sql
│       └── test/
│           └── java/com/portfolio/backend/
│               ├── controller/
│               │   ├── AuthControllerTest.java
│               │   └── ProjectControllerTest.java
│               ├── service/
│               │   ├── AuthServiceTest.java
│               │   └── ProjectServiceTest.java
│               ├── repository/
│               │   └── ProjectRepositoryTest.java
│               └── integration/
│                   └── ProjectIntegrationTest.java   ← Testcontainers
│
├── frontend/                              ← Application Angular
│   ├── Dockerfile                         ← Multi-stage : Node build + NGINX
│   ├── .dockerignore
│   ├── nginx.conf                         ← Config NGINX prod
│   ├── package.json
│   ├── package-lock.json
│   ├── angular.json
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.spec.json
│   ├── .eslintrc.json                     ← Règles ESLint strict
│   ├── .prettierrc                        ← Formatage auto
│   ├── jest.config.ts                     ← Jest (remplace Karma)
│   └── src/
│       ├── main.ts
│       ├── index.html
│       ├── styles.scss
│       ├── app/
│       │   ├── app.config.ts              ← Config standalone
│       │   ├── app.routes.ts              ← Routes lazy-loaded
│       │   ├── core/                      ← Singleton services
│       │   │   ├── interceptors/
│       │   │   │   ├── jwt.interceptor.ts
│       │   │   │   └── error.interceptor.ts
│       │   │   ├── guards/
│       │   │   │   └── auth.guard.ts
│       │   │   └── services/
│       │   │       ├── auth.service.ts
│       │   │       └── storage.service.ts
│       │   ├── shared/                    ← Composants réutilisables
│       │   │   ├── components/
│       │   │   │   ├── navbar/
│       │   │   │   ├── footer/
│       │   │   │   ├── loading-spinner/
│       │   │   │   └── error-message/
│       │   │   └── models/
│       │   │       ├── project.model.ts
│       │   │       ├── skill.model.ts
│       │   │       └── auth.model.ts
│       │   └── features/                  ← Modules métier (lazy-loaded)
│       │       ├── auth/
│       │       │   ├── auth.routes.ts
│       │       │   └── login/
│       │       │       ├── login.component.ts
│       │       │       ├── login.component.html
│       │       │       ├── login.component.scss
│       │       │       └── login.component.spec.ts
│       │       ├── portfolio/
│       │       │   ├── portfolio.routes.ts
│       │       │   ├── home/
│       │       │   ├── projects/
│       │       │   │   ├── project-list/
│       │       │   │   └── project-detail/
│       │       │   └── skills/
│       │       └── admin/                 ← CRUD admin (route protégée)
│       │           ├── admin.routes.ts
│       │           └── project-form/
│       └── environments/
│           ├── environment.ts             ← apiUrl: 'http://localhost:8080'
│           └── environment.prod.ts        ← apiUrl: '/api'
│
├── infrastructure/                        ← Infrastructure as Code
│   └── terraform/
│       ├── main.tf                        ← Point d'entrée modules
│       ├── variables.tf                   ← Variables globales
│       ├── outputs.tf                     ← IP EC2, endpoint RDS, ECR URLs
│       ├── provider.tf                    ← AWS provider + backend S3
│       ├── terraform.tfvars.example       ← Template (jamais committer le vrai)
│       └── modules/
│           ├── vpc/
│           │   ├── main.tf                ← VPC, subnets public/privé, IGW
│           │   ├── variables.tf
│           │   └── outputs.tf
│           ├── ecr/
│           │   ├── main.tf                ← Repos ECR backend + frontend
│           │   ├── variables.tf
│           │   └── outputs.tf
│           ├── ec2/
│           │   ├── main.tf                ← Instance t2.micro + Elastic IP
│           │   ├── variables.tf
│           │   ├── outputs.tf
│           │   └── user_data.sh           ← Script bootstrap EC2
│           └── rds/
│               ├── main.tf                ← RDS PostgreSQL t3.micro
│               ├── variables.tf
│               └── outputs.tf
│
├── kubernetes/                            ← Manifests K8s bruts (sans Helm)
│   ├── namespace.yaml
│   ├── backend/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── secret.yaml
│   ├── frontend/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   └── ingress/
│       ├── ingress.yaml
│       ├── cluster-issuer.yaml            ← Let's Encrypt ClusterIssuer
│       └── certificate.yaml
│
├── helm/                                  ← Helm charts (remplace les manifests bruts)
│   ├── backend/
│   │   ├── Chart.yaml
│   │   ├── values.yaml
│   │   ├── values-prod.yaml
│   │   └── templates/
│   │       ├── _helpers.tpl
│   │       ├── deployment.yaml
│   │       ├── service.yaml
│   │       ├── configmap.yaml
│   │       ├── secret.yaml
│   │       └── hpa.yaml
│   └── frontend/
│       ├── Chart.yaml
│       ├── values.yaml
│       ├── values-prod.yaml
│       └── templates/
│           ├── _helpers.tpl
│           ├── deployment.yaml
│           └── service.yaml
│
├── docker/
│   ├── docker-compose.yml                 ← Dev local complet
│   └── docker-compose.override.yml        ← Overrides dev (volumes, ports)
│
└── docs/
    ├── PHASE1-Architecture.md             ← Ce document
    ├── PHASE2-Backend.md                  ← (à venir)
    ├── PHASE3-Frontend.md                 ← (à venir)
    ├── PHASE4-Docker.md                   ← (à venir)
    ├── PHASE5-Terraform.md                ← (à venir)
    ├── PHASE6-EC2-Setup.md                ← (à venir)
    ├── PHASE7-Kubernetes.md               ← (à venir)
    ├── PHASE8-Helm.md                     ← (à venir)
    ├── PHASE9-Ingress.md                  ← (à venir)
    ├── PHASE10-HTTPS.md                   ← (à venir)
    ├── PHASE11-ECR.md                     ← (à venir)
    ├── PHASE12-CICD.md                    ← (à venir)
    ├── PHASE13-Monitoring.md              ← (à venir)
    ├── PHASE14-Securite.md                ← (à venir)
    └── PHASE15-Portfolio.md               ← (à venir)
```

---

## 7. Flux de données — Détail d'une requête login

```
┌──────────────────────────────────────────────────────────────────────────────┐
│             EXEMPLE : Utilisateur se connecte au portfolio                   │
└──────────────────────────────────────────────────────────────────────────────┘

① Browser → POST https://monapp.duckdns.org/api/auth/login
   Body: { "email": "admin@portfolio.com", "password": "secret" }

② NGINX Ingress Controller reçoit la requête
   Règle : path /api/* → backend-service:8080
   Rewrite : /api/auth/login → /auth/login

③ Spring Boot Controller (AuthController.java)
   @PostMapping("/auth/login")
   → Valide le body (Bean Validation)
   → Délègue à AuthService

④ AuthService.java
   → UserDetailsServiceImpl charge l'utilisateur depuis DB
   → BCrypt vérifie le password
   → JwtTokenProvider génère un JWT signé (HS256)
   → Retourne AuthResponse { token, expiresIn, userInfo }

⑤ PostgreSQL (RDS)
   SELECT * FROM users WHERE email = 'admin@portfolio.com'
   → Connexion sécurisée depuis EC2 (Security Group privé)

⑥ Réponse HTTP 200 avec JWT dans le body
   { "token": "eyJhbGci...", "expiresIn": 86400 }

⑦ Angular AuthService stocke le JWT (localStorage)
   Router navigue vers /admin/dashboard

⑧ Prochaines requêtes Angular → JwtInterceptor injecte automatiquement :
   Headers: Authorization: Bearer eyJhbGci...

⑨ Spring Boot JwtAuthenticationFilter valide le token à chaque requête protégée
   → Décode JWT → charge SecurityContext → autorise ou 401 Unauthorized
```

---

## 8. Stratégie de déploiement — Dev vs Prod

| Aspect | Environnement DEV | Environnement PROD (AWS) |
|--------|-------------------|--------------------------|
| Lancement | `docker-compose up` | `helm upgrade --install` |
| Angular | `:4200` (`ng serve`) | Pod NGINX `:80` |
| Spring Boot | `:8080` (`mvn spring-boot:run`) | Pod JVM `:8080` |
| PostgreSQL | Container local `:5432` | RDS PostgreSQL managé |
| TLS | ❌ Pas de HTTPS | ✅ Let's Encrypt automatique |
| Logs | Console colorés lisibles | JSON structurés (parsables) |
| Config | `application-dev.properties` | `application-prod.properties` |
| Base de données | H2 en mémoire (optionnel) | RDS PostgreSQL persistant |
| Rechargement | Hot reload Angular + Spring DevTools | Images Docker immutables |
| Debug | Remote debugging JVM possible | Logs + kubectl describe |

---

## 9. Checklist PHASE 1 — Avant de passer à la suite

- ✅ L'architecture est comprise dans son ensemble
- ✅ Les flux réseau sont clairs (Browser → DNS → EC2 → Ingress → Pod → RDS)
- ✅ Les contraintes RAM EC2 Free Tier sont identifiées (1GB + 2GB swap)
- ✅ La structure du projet est définie (monorepo avec backend/frontend/infra/helm/k8s)
- ✅ Les environnements dev/prod sont distincts (docker-compose vs Kubernetes)
- ✅ La stratégie CI/CD est tracée (GitHub Actions → ECR → helm upgrade)
- ✅ Chaque composant a une justification technique claire
- ✅ Les choix Free Tier sont validés (t2.micro + RDS t3.micro + ECR 500MB)

---

## 10. Résumé des compétences démontrées en PHASE 1 (recruteur)

> **Ce que le recruteur voit dans votre diagramme d'architecture :**

| Compétence | Signal visible |
|------------|---------------|
| 🧠 **Vision système** | Capacité à penser bout-en-bout, du browser à la DB |
| 🌐 **Networking** | DNS, TLS, Security Groups, VPC, Ingress, path-based routing |
| ☸️ **Kubernetes** | Orchestration, services, ingress, namespaces, probes, resource limits |
| 🏗️ **IaC** | Terraform pour infrastructure reproductible et versionnée |
| 🔒 **Security mindset** | RDS en subnet privé, JWT stateless, HTTPS forcé, non-root containers |
| 💰 **Cost awareness** | Free Tier choisi sciemment, RAM budget explicite, swap strategy |
| 📐 **Clean architecture** | Séparation claire frontend / backend / infrastructure / CI-CD |
| 🔄 **CI/CD** | Pipeline complet avec quality gates (lint → test → build → deploy) |
| 🐳 **Docker** | Multi-stage builds, optimisation taille images, sécurité containers |
| 📊 **Observabilité** | Probes K8s, Actuator, logs structurés — mindset production |

---

*Document généré le 2026-05-25 — Projet DevSecOps Portfolio*
*Prochaine étape : [PHASE 2 — Backend Spring Boot Java 21](PHASE2-Backend.md)*
