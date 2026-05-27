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

### Comptes de démonstration

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Admin | `admin@portfolio.dev` | `Admin@2024!` |
| Utilisateur | `demo@portfolio.dev` | `Admin@2024!` |

### Arrêt

```powershell
# Arrêter Docker (Postgres + Prometheus + Grafana)
docker-compose -f docker/docker-compose.dev-stack.yml down

# Arrêter le backend : Ctrl+C dans le terminal Maven
# Arrêter le frontend : Ctrl+C dans le terminal npm
```

### Reset complet (supprime les données)

```powershell
docker-compose -f docker/docker-compose.dev-stack.yml down -v
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
│   └── grafana/
│       ├── provisioning/               # Datasource + dashboard auto-provisionnés
│       └── dashboards/portfolio.json   # Dashboard pré-construit
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
