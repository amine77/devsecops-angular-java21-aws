# PHASE 1 — Architecture Globale & Préparation

> **Date de création :** 2026-05-25
> **Dernière mise à jour :** 2026-07-24 — réécrit pour refléter l'architecture réellement déployée
> **Projet :** DevSecOps Portfolio — Angular + Spring Boot Java 21 + AWS
> **Objectif :** Architecture cloud native orientée production, compatible AWS Free Tier

---

> ⚠️ **Ce document décrit l'architecture réellement en production** : Docker Compose sur
> une seule EC2 (`deployment_mode = "docker"`, Terraform `terraform/main.tf`).
>
> Un **mode alternatif Kubernetes** (K3s + ArgoCD, toujours Free Tier) existe en parallèle
> dans le même code Terraform (`deployment_mode = "k3s"`) et est entièrement fonctionnel,
> mais **n'est pas ce qui sert le trafic réel** sur https://charrad-devsecops.duckdns.org.
> Il est documenté séparément : [PHASE18-ArgoCD-GitOps.md](PHASE18-ArgoCD-GitOps.md) et
> [PHASE20-FreeTier-K3s.md](PHASE20-FreeTier-K3s.md).

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

La production tourne sur **une seule EC2** avec **Docker Compose** (pas de Kubernetes managé,
pas de RDS managé) : c'est le compromis coût/simplicité retenu pour un portfolio personnel
(pas un site e-commerce), après une migration effectuée le 23-24/07/2026 qui a sorti
PostgreSQL de RDS pour le conteneuriser sur la même instance et réduire la facture AWS.
Le mode Kubernetes (K3s + ArgoCD) reste démontré dans le code Terraform pour la vitrine
technique, activable via une simple variable, mais n'est pas le mode live.

---

## 2. Diagramme d'architecture global

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                        DEVSECOPS PORTFOLIO — ARCHITECTURE (mode réel : Docker)   ║
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
│   │  ci-backend.yml / ci-frontend.yml : Lint → Tests unitaires →         │  │
│   │  Tests intégration (Testcontainers) → SonarCloud → Build Docker      │  │
│   │  gatling-load-test.yml, dast-zap.yml, security.yml : gates qualité   │  │
│   │  deploy-app.yml : push ECR puis SSH → EC2 → docker compose up        │  │
│   │  deploy-infra.yml : terraform plan/apply (VPC, EC2, IAM, Lambdas)    │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                          │              │                                    │
│                     Push images    Deploy via SSH (docker compose)           │
└────────────────────────── ─ ─ ─ ─ ─ ─ │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
                                          │
          ┌───────────────────────────────┼───────────────────────────────┐
          │                               │                               │
          ▼                               ▼                               ▼
┌─────────────────┐           ┌───────────────────────────────────────────────┐
│   AMAZON ECR    │           │                   AWS VPC                     │
│                 │           │                                               │
│ ┌─────────────┐ │           │  ┌─────────────────────────────────────────┐ │
│ │ backend:tag │ │           │  │          SUBNET PUBLIC                   │ │
│ └─────────────┘ │◄──────────┤  │                                          │ │
│ ┌─────────────┐ │  Pull     │  │  ┌──────────────────────────────────┐   │ │
│ │frontend:tag │ │  images   │  │  │  EC2 t3.small (2GB RAM)          │   │ │
│ └─────────────┘ │           │  │  │  Amazon Linux 2023               │   │ │
└─────────────────┘           │  │  │  Elastic IP : 13.39.132.25       │   │ │
                              │  │  │                                  │   │ │
                              │  │  │  ┌────────────────────────────┐  │   │ │
                              │  │  │  │  NGINX (host, natif)       │  │   │ │
                              │  │  │  │  Certbot / Let's Encrypt   │  │   │ │
                              │  │  │  │  :80 / :443 — TLS          │  │   │ │
                              │  │  │  └──┬──────┬──────┬──────────┘  │   │ │
                              │  │  │     │      │      │              │   │ │
                              │  │  │    /  /api/  /grafana/            │   │ │
                              │  │  │     ▼      ▼      ▼              │   │ │
                              │  │  │  ┌──────┐┌───────┐┌─────────┐   │   │ │
                              │  │  │  │front ││backend││ grafana │   │   │ │
                              │  │  │  │:8081 ││ :8080 ││  :3000  │   │   │ │
                              │  │  │  └──────┘└───┬───┘└────┬────┘   │   │ │
                              │  │  │              │         │         │   │ │
                              │  │  │              ▼         ▼         │   │ │
                              │  │  │        ┌──────────┐ ┌──────────┐ │   │ │
                              │  │  │        │ postgres │ │prometheus│ │   │ │
                              │  │  │        │  (local) │ │  + redis │ │   │ │
                              │  │  │        └────┬─────┘ └──────────┘ │   │ │
                              │  │  │             │  (Docker Compose,  │   │ │
                              │  │  │             │   /opt/portfolio)  │   │ │
                              │  │  │             ▼                    │   │ │
                              │  │  │   pg_dump quotidien (systemd      │   │ │
                              │  │  │   timer 03h UTC) ─────────────────┼───┼─┼──► S3
                              │  │  └────────────────────────────────────┘   │ │
                              │  └────────────────────────────────────────────  ┘ │
                              └───────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUX UTILISATEUR FINAL                            │
│                                                                              │
│  Browser → https://charrad-devsecops.duckdns.org                            │
│      → DuckDNS DNS → Elastic IP EC2                                         │
│      → NGINX (host, natif — pas de conteneur) reçoit :443                   │
│      → TLS terminaison (Certbot + Let's Encrypt, renouvelé par systemd)    │
│      → Route "/"        → container frontend (Angular statique)            │
│      → Route "/api/"    → container backend (Spring Boot) → PostgreSQL     │
│      → Route "/grafana/"→ container Grafana (dashboards Prometheus)        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Note historique :** entre le lancement du projet et le 23/07/2026, PostgreSQL était
hébergé sur **AWS RDS** (subnet privé, managé). Une migration a conteneurisé PostgreSQL
sur l'EC2 (23-24/07/2026) pour réduire les coûts (~40 $/mois bruts → ~22 $/mois), suivie
de la suppression définitive de RDS le 24/07/2026 (snapshot manuel conservé en filet de
sécurité). Conséquence assumée : l'app et la base partagent désormais le même EC2/EBS
(SPOF), mitigé par un backup quotidien hors-EC2 vers S3.

---

## 3. Flux réseau détaillé — Chaque paquet expliqué

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         FLUX RÉSEAU COMPLET (mode Docker Compose réel)       │
└──────────────────────────────────────────────────────────────────────────────┘

REQUÊTE UTILISATEUR → PAGE WEB
════════════════════════════════

  [Browser]                    [DNS]              [AWS EC2]
      │                          │                     │
      │ GET https://             │                     │
      │ charrad-devsecops.       │                     │
      │ duckdns.org/             │                     │
      │─────────────────────────►│                     │
      │                          │ DNS lookup:         │
      │                          │ → Elastic IP        │
      │◄─────────────────────────│                     │
      │                    IP: 13.39.132.25            │
      │                                                │
      │ TCP:443 ───────────────────────────────────────►
      │                                                │
      │               [Security Group AWS]             │
      │               Port 443 autorisé ✓              │
      │                                                │
      │          [NGINX — process natif sur l'EC2]      │
      │               ↓                               │
      │          TLS Handshake (certificat Certbot)    │
      │◄───────────────────────────────────────────────│
      │                                                │
      │ HTTPS établi ✓                                 │

ROUTAGE NGINX (reverse proxy vers les conteneurs Docker)
═════════════════════════════════════════════════════════

  Request: GET /api/projects
  ┌─────────────────────────────────────────────────┐
  │  NGINX (host, /etc/nginx/conf.d/)                │
  │                                                 │
  │  server_name charrad-devsecops.duckdns.org       │
  │  location /api/     → proxy_pass 127.0.0.1:8080 │
  │  location /grafana/ → proxy_pass 127.0.0.1:3000 │
  │  location /         → proxy_pass 127.0.0.1:8081 │
  │                                                 │
  └─────────────────────────────────────────────────┘
                                            │
                    ┌───────────────────────┴────────────────────┐
                    ▼                                            ▼
      ┌─────────────────────────┐                 ┌─────────────────────────┐
      │  portfolio-backend      │                 │  portfolio-frontend      │
      │  Spring Boot JVM :8080  │                 │  NGINX (container) :8081 │
      │  → JDBC → postgres:5432 │                 │  dist/angular/           │
      └─────────────────────────┘                 └─────────────────────────┘

COMMUNICATION ENTRE CONTENEURS (réseau Docker "portfolio-network")
════════════════════════════════════════════════════════════════

  backend → PostgreSQL :
  └─ Connection string :
     jdbc:postgresql://postgres:5432/portfolio_prod
     (conteneur "postgres" sur le même hôte, résolu par DNS Docker)

  backend → Redis (cache) :
  └─ spring.data.redis.host=redis (voir PHASE11-Redis-Cache.md)

  Prometheus → backend/postgres/redis :
  └─ scrape des endpoints /actuator/prometheus et exporters (voir PHASE7)
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
| Serveur | NGINX dans le conteneur (sert le build Angular) derrière un NGINX hôte (TLS + reverse proxy) | Séparation claire : le NGINX conteneur sert des fichiers statiques, le NGINX hôte gère TLS/Certbot et le routage entre conteneurs |

### ☕ Spring Boot Java 21 — Backend

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| Java 21 | Virtual Threads (Loom) | Scalabilité sur petite RAM, threads légers |
| Architecture | Layered (Controller/Service/Repo) | Séparation des responsabilités, testabilité |
| JPA/Hibernate | Spring Data JPA | ORM standard Java, pas de SQL boilerplate |
| Sécurité | Spring Security + JWT | Standard industrie, stateless (portable K8s ou Compose) |
| DTOs | MapStruct ou manuel | Évite d'exposer les entités DB = sécurité + flexibilité |
| Docs API | SpringDoc OpenAPI 3 | Interface interactive, documentation automatique |
| Health | Spring Actuator | Healthcheck Docker Compose + probes si mode K3s |
| JVM opts | `-Xmx300m -Xss256k` | Limite RAM pour EC2 t3.small (2GB total, partagé avec Postgres/Redis/Prometheus/Grafana) |

### 🐘 PostgreSQL — Base de données

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| Hébergement | **Conteneur Docker** (`postgres:15-alpine`) sur l'EC2, service `postgres` de `/opt/portfolio/docker-compose.yml` | Ex-RDS managé jusqu'au 23/07/2026 — migré pour réduire le coût (~18 $/mois de RDS en moins). Compromis assumé : plus de SPOF app+DB sur le même EC2/EBS |
| Volume | Volume Docker nommé `postgres_data` | Persistance des données indépendante du cycle de vie du conteneur |
| Connexion | Réseau Docker interne `portfolio-network` | Le backend résout `postgres` par DNS Docker, pas d'exposition réseau externe (`ports: []` en prod) |
| Pool | HikariCP (défaut Spring) | Pool de connexions performant |
| Backup | `pg_dump` quotidien (systemd timer, 03h00 UTC) → upload S3 (`db-backups/`), rétention locale 14 jours | Remplace les backups automatiques RDS, seul filet de sécurité hors-EC2 depuis la suppression de RDS le 24/07/2026 |

### 🐳 Docker — Conteneurisation

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| Build | Multi-stage builds | Image finale = code compilé seulement, pas les outils de build |
| Registry | Amazon ECR | Intégré AWS IAM, free 500MB/mois, latence faible vers EC2 |
| Base backend | `eclipse-temurin:21-jre-alpine` | JRE seul (pas JDK), Alpine = image petite (~150MB) |
| Base frontend | `node:20-alpine` (build) + `nginx:alpine` (run) | Build Angular → copie dist/ dans NGINX |
| Orchestration prod | **Docker Compose** sur une seule EC2 (`/opt/portfolio/docker-compose.yml`) | Simplicité et coût — pas de control plane à payer/maintenir pour un portfolio |

### ☸️ Kubernetes (K3s + ArgoCD) — Mode alternatif, non utilisé en production

| Aspect | État réel |
|--------|-----------|
| Statut | Code Terraform et manifests **complets et fonctionnels**, activables via `deployment_mode = "k3s"` |
| Production actuelle | **Non** — la variable réelle en prod est `deployment_mode = "docker"` (voir `terraform/terraform.tfvars`) |
| Documentation | [PHASE18-ArgoCD-GitOps.md](PHASE18-ArgoCD-GitOps.md) (GitOps/ArgoCD) et [PHASE20-FreeTier-K3s.md](PHASE20-FreeTier-K3s.md) (K3s Free Tier) |
| Pourquoi le garder | Démontre la compétence Kubernetes/GitOps pour un recruteur sans payer le coût de l'exploiter en continu |

### ⛵ Helm — Package Manager Kubernetes

Utilisé uniquement dans le mode alternatif K3s (`helm/` à la racine du repo) — voir
[PHASE19-Helm.md](PHASE19-Helm.md). Le mode Docker Compose réel n'utilise pas Helm.

### 🏗️ Terraform — Infrastructure as Code

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| Provider | AWS | Infrastructure AWS gérée par code |
| State | S3 remote backend | State partagé en équipe, pas de conflits |
| Modules réels | `vpc`, `ecr`, `ec2`, `security-groups`, `secrets-manager`, `cloudwatch`, `lambda-*` | Voir [PHASE5-Terraform.md](PHASE5-Terraform.md) — le module `rds` a été retiré du câblage (`main.tf`) le 24/07/2026 |
| Variables | `terraform.tfvars` (non commité) | Même code, `deployment_mode` bascule Docker Compose ⇄ K3s |

### 🔄 GitHub Actions — CI/CD

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| Workflows | `ci-backend.yml`, `ci-frontend.yml`, `sonarcloud.yml`, `security.yml`, `sbom-supply-chain.yml`, `dast-zap.yml`, `gatling-load-test.yml`, `deploy-app.yml`, `deploy-infra.yml`, `ci-gitops.yml` | Un workflow par responsabilité, fail fast si un gate échoue |
| Triggers | push main + PR | Build sur chaque commit |
| Secrets | GitHub Secrets | Credentials AWS jamais en clair |
| Deploy (réel) | `deploy-app.yml` : SSH → `docker compose pull` + `up -d --no-deps` | Pas de `helm upgrade` en production réelle (réservé au mode K3s) |

### 🌐 NGINX (hôte) — Reverse Proxy + TLS

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| NGINX | Installé nativement sur l'EC2 (pas conteneurisé) | Termine TLS et route vers les conteneurs par port (`8081` frontend, `8080` backend, `3000` Grafana) |
| Routing | Path-based (`/`, `/api/`, `/grafana/`) | Un seul domaine, pas de CORS |
| Mode K3s (alternatif) | NGINX Ingress Controller dans le cluster | Voir PHASE20 — non utilisé en prod réelle |

### 🔒 Certbot + Let's Encrypt — HTTPS

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| Certbot | Installé sur l'hôte EC2, renouvellement via timer systemd | HTTPS gratuit, reconnu par tous les navigateurs |
| Let's Encrypt | CA gratuite | Certificat lié au domaine DuckDNS |
| Mode K3s (alternatif) | cert-manager (opérateur K8s) | Voir PHASE20 — non utilisé en prod réelle |

### 🦆 DuckDNS — Domaine gratuit

| Aspect | Choix | Pourquoi |
|--------|-------|----------|
| DuckDNS | DNS dynamique gratuit | Domaine réel : `charrad-devsecops.duckdns.org`, pointe vers l'Elastic IP |
| Elastic IP | IP statique AWS (`13.39.132.25`) | IP fixe même après redémarrage EC2 |

### 📊 Redis, Prometheus, Grafana — Cache & Observabilité

Conteneurs supplémentaires de la stack Docker Compose réelle (`portfolio-redis`,
`portfolio-prometheus`, `portfolio-grafana`), non représentés dans les versions
précédentes de ce document. Détaillés dans
[PHASE11-Redis-Cache.md](PHASE11-Redis-Cache.md) et
[PHASE7-Observability.md](PHASE7-Observability.md).

---

## 5. Contraintes AWS Free Tier — Impact RAM critique

```
╔══════════════════════════════════════════════════════════════════════╗
║              BUDGET RAM EC2 t3.small (2048 MB total)                ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  OS Linux (Amazon Linux 2023)      ~150 MB                          ║
║  Docker daemon                     ~80 MB                           ║
║  NGINX hôte (natif, pas conteneur) ~20 MB                           ║
║  Spring Boot (JVM -Xmx300m, limite ~400M) ~400 MB ← le plus lourd   ║
║  PostgreSQL (limite conteneur)     ~256 MB                          ║
║  Angular/NGINX conteneur           ~64 MB                           ║
║  Redis                             ~64 MB                           ║
║  Prometheus                        ~200 MB                          ║
║  Grafana                           ~150 MB                          ║
║  ─────────────────────────────────────                              ║
║  TOTAL ESTIMÉ                      ~1384 MB / 2048 MB               ║
║                                                                      ║
║  ✅  t3.small (2GB) suffit sans SWAP pour ce mode Docker Compose     ║
║  ⚠️  Le mode K3s (alternatif) a besoin de plus de marge : le         ║
║      volume racine passe à 28GB et un SWAP de 4GB est prévu          ║
║      (voir terraform/modules/ec2/main.tf, condition sur              ║
║      deployment_mode == "k3s")                                       ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 6. Arborescence finale du projet

```
devsecops-angular-java21-aws/              ← Racine du monorepo
│
├── README.md                              ← Documentation principale portfolio
├── .gitignore                             ← Ignorer node_modules, .terraform, etc.
│
├── .github/
│   └── workflows/                         ← CI/CD réel (voir liste complète section 4)
│       ├── ci-backend.yml
│       ├── ci-frontend.yml
│       ├── sonarcloud.yml
│       ├── security.yml
│       ├── sbom-supply-chain.yml
│       ├── dast-zap.yml
│       ├── gatling-load-test.yml
│       ├── deploy-app.yml                 ← Déploiement réel (SSH + docker compose)
│       ├── deploy-infra.yml               ← terraform plan/apply
│       └── ci-gitops.yml                  ← Lint manifests K8s/Helm (mode alternatif)
│
├── backend/                               ← Application Spring Boot Java 21
│   ├── Dockerfile
│   ├── pom.xml
│   └── src/main/java/... (controller/service/repository/security/...)
│
├── frontend/                              ← Application Angular
│   ├── Dockerfile
│   ├── nginx.conf                         ← NGINX du conteneur (statique + proxy /api en dev)
│   └── src/app/...
│
├── docker/                                ← Docker Compose (dev + prod-like)
│   ├── docker-compose.yml                 ← Stack dev locale de base
│   ├── docker-compose.override.yml        ← Overrides dev (volumes, ports)
│   ├── docker-compose.prod.yml            ← Simulation locale des conditions prod
│   ├── docker-compose.dev-stack.yml
│   ├── docker-compose.kafka.yml           ← Phase 10 — Kafka
│   ├── docker-compose.observability.yml   ← Phase 7 — Prometheus/Grafana
│   ├── prometheus/
│   └── grafana/
│
├── terraform/                             ← Infrastructure as Code (racine, pas de sous-dossier "infrastructure/")
│   ├── main.tf                            ← Point d'entrée modules — plus de module "rds"
│   ├── variables.tf                       ← dont `deployment_mode` ("docker" | "k3s")
│   ├── outputs.tf
│   ├── terraform.tfvars                   ← Réel, non commité (gitignore)
│   └── modules/
│       ├── vpc/
│       ├── ecr/
│       ├── ec2/                           ← Instance t3.small + Elastic IP + IAM (dont backup S3)
│       ├── security-groups/
│       ├── secrets-manager/               ← Phase 21 — External Secrets
│       ├── cloudwatch/
│       ├── lambda-contact-form/
│       ├── lambda-image-resize/
│       ├── lambda-weekly-report/
│       └── rds/                           ← Code encore présent mais non référencé dans main.tf
│                                             (orphelin depuis la suppression du 24/07/2026)
│
├── k8s/ , helm/ , argocd/                  ← Manifests bruts, charts Helm, config ArgoCD
│                                             (mode alternatif K3s — PHASE18/19/20)
│
├── lambdas/                                ← Sources Node.js des 3 fonctions Lambda (Phase 15)
├── scripts/                                ← Scripts d'automatisation (déploiement, tests, etc.)
├── zap/                                    ← Config OWASP ZAP (Phase 12 — DAST)
│
└── docs/
    ├── PHASE1-Architecture.md             ← Ce document
    ├── PHASE2-Backend.md
    ├── PHASE3-Frontend.md
    ├── PHASE5-Terraform.md
    ├── PHASE18-ArgoCD-GitOps.md
    ├── PHASE19-Helm.md
    ├── PHASE20-FreeTier-K3s.md
    ├── PHASE21-ExternalSecrets.md
    ├── FINOPS-Cost-Analysis.md
    └── ... (voir liste complète des phases dans le repo)
```

---

## 7. Flux de données — Détail d'une requête login

```
┌──────────────────────────────────────────────────────────────────────────────┐
│             EXEMPLE : Utilisateur se connecte au portfolio                   │
└──────────────────────────────────────────────────────────────────────────────┘

① Browser → POST https://charrad-devsecops.duckdns.org/api/auth/login
   Body: { "email": "admin@portfolio.dev", "password": "..." }

② NGINX (hôte EC2, natif) reçoit la requête
   Règle : location /api/ → proxy_pass http://127.0.0.1:8080/

③ Spring Boot Controller (AuthController.java)
   @PostMapping("/auth/login")
   → Valide le body (Bean Validation)
   → Délègue à AuthService

④ AuthService.java
   → UserDetailsServiceImpl charge l'utilisateur depuis DB
   → BCrypt vérifie le password
   → JwtTokenProvider génère un JWT signé (HS256)
   → Retourne AuthResponse { token, expiresIn, userInfo }

⑤ PostgreSQL (conteneur Docker "postgres" sur la même EC2)
   SELECT * FROM users WHERE email = 'admin@portfolio.dev'
   → Connexion via le réseau Docker interne, pas d'exposition externe

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

| Aspect | Environnement DEV | Environnement PROD (réel) |
|--------|-------------------|--------------------------|
| Lancement | `docker compose up` | `docker compose pull && up -d --no-deps` via SSH (`deploy-app.yml`) |
| Angular | `:4200` (`ng serve`) | Conteneur NGINX `:8081` derrière le NGINX hôte |
| Spring Boot | `:8080` (`mvn spring-boot:run`) | Conteneur JVM `:8080` |
| PostgreSQL | Conteneur local `:5432` | Conteneur `postgres:15-alpine` sur la **même EC2** |
| TLS | ❌ Pas de HTTPS | ✅ Certbot + Let's Encrypt (renouvellement systemd) |
| Logs | Console colorés lisibles | Logs Docker (`awslogs` driver → CloudWatch) |
| Config | `application-dev.properties` | `application-prod.properties` |
| Rechargement | Hot reload Angular + Spring DevTools | Images Docker immutables, rolling restart via `deploy.sh` |
| Debug | Remote debugging JVM possible | Logs CloudWatch + `docker exec` / `docker logs` |

---

## 9. Checklist PHASE 1 — Avant de passer à la suite

- ✅ L'architecture réellement déployée est comprise (Docker Compose, une seule EC2)
- ✅ Les flux réseau sont clairs (Browser → DuckDNS → EC2 → NGINX hôte → conteneur)
- ✅ Les contraintes RAM EC2 t3.small sont identifiées (2GB, pas de swap nécessaire en mode Docker)
- ✅ La structure du projet est définie (monorepo backend/frontend/terraform/docker/k8s-helm-argocd)
- ✅ Les environnements dev/prod sont distincts (docker compose partout, config différente)
- ✅ La stratégie CI/CD est tracée (GitHub Actions → ECR → SSH → docker compose)
- ✅ Chaque composant a une justification technique claire
- ✅ Le mode Kubernetes/K3s alternatif est identifié comme non-production (voir PHASE18/20)

---

## 10. Résumé des compétences démontrées en PHASE 1 (recruteur)

> **Ce que le recruteur voit dans votre diagramme d'architecture :**

| Compétence | Signal visible |
|------------|---------------|
| 🧠 **Vision système** | Capacité à penser bout-en-bout, du browser à la DB |
| 🌐 **Networking** | DNS, TLS, Security Groups, VPC, reverse proxy path-based routing |
| ☸️ **Kubernetes** | Démontré via un mode alternatif complet K3s + ArgoCD (PHASE18/20), activable sans réécrire l'infra |
| 🏗️ **IaC** | Terraform pour infrastructure reproductible et versionnée, deux modes de déploiement pilotés par une variable |
| 🔒 **Security mindset** | Secrets via AWS Secrets Manager, JWT stateless, HTTPS forcé, non-root containers, IAM least privilege |
| 💰 **Cost awareness** | Migration RDS → conteneur pour diviser la facture par ~2, arbitrage documenté et assumé |
| 📐 **Clean architecture** | Séparation claire frontend / backend / infrastructure / CI-CD |
| 🔄 **CI/CD** | Pipeline complet avec quality gates (lint → test → SCA/DAST → build → deploy) |
| 🐳 **Docker** | Multi-stage builds, optimisation taille images, sécurité containers, orchestration Compose en prod |
| 📊 **Observabilité** | Prometheus + Grafana + Actuator, logs CloudWatch — mindset production |

---

*Document généré le 2026-05-25, réécrit le 2026-07-24 — Projet DevSecOps Portfolio*
*Prochaine étape : [PHASE 2 — Backend Spring Boot Java 21](PHASE2-Backend.md)*
