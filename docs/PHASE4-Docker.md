# Phase 4 — Docker : Containerisation et Orchestration Locale

## Table des matières
1. [Objectifs de la phase](#objectifs)
2. [Concepts fondamentaux Docker](#concepts)
3. [Architecture Docker du projet](#architecture)
4. [Dockerfile Backend (Spring Boot)](#dockerfile-backend)
5. [Dockerfile Frontend (Angular + NGINX)](#dockerfile-frontend)
6. [Docker Compose — Développement](#compose-dev)
7. [Docker Compose — Production simulée](#compose-prod)
8. [Réseau Docker : Bridge, DNS, isolation](#réseau)
9. [Sécurité des conteneurs](#sécurité)
10. [Makefile — Commandes centralisées](#makefile)
11. [Scan de vulnérabilités avec Trivy](#trivy)
12. [Commandes de référence](#commandes)
13. [Erreurs courantes et solutions](#erreurs)
14. [Checklist de la phase](#checklist)

---

## 1. Objectifs de la phase {#objectifs}

| Objectif | Pourquoi |
|----------|----------|
| Multi-stage builds | Réduire la taille des images (JDK 400MB → JRE 170MB, Node 600MB → NGINX 25MB) |
| Images non-root | Principe de moindre privilège — les processus ne tournent pas en `root` |
| Read-only filesystem | Surface d'attaque réduite en production |
| Healthchecks | Docker et Kubernetes savent si le service est opérationnel |
| Docker Compose | Reproductibilité — même comportement sur toutes les machines de dev |
| `.editorconfig` | Cohérence de style entre tous les éditeurs (VSCode, IntelliJ) |
| `Makefile` | Interface unifiée — une seule commande pour chaque opération |

---

## 2. Concepts fondamentaux Docker {#concepts}

### 2.1 Qu'est-ce qu'une image Docker ?

Une image Docker est un **artefact immuable et en couches** (layers) qui contient :
- Le système de fichiers (OS de base, dépendances, application)
- Les métadonnées (CMD, EXPOSE, ENV, etc.)

```
Image portfolio-backend:latest
├── Layer 1 : eclipse-temurin:21-jre-alpine (OS + JRE)  ← partagé si utilisé par d'autres images
├── Layer 2 : groupe/utilisateur appuser                 ← rarément change
├── Layer 3 : dépendances Spring Boot (snapshot-deps)    ← change si pom.xml change
├── Layer 4 : dépendances Spring Boot (spring-boot-loader)
├── Layer 5 : JAR de l'application                       ← change à chaque commit
└── Métadonnées : CMD, EXPOSE, ENV
```

**Pourquoi les layers importent :**
- Docker cache chaque layer séparément
- Si Layer 5 change, Docker ne re-télécharge pas Layer 1-4
- → Build 10x plus rapide en CI/CD après le premier build

### 2.2 Multi-stage builds : pourquoi supprimer le builder ?

```
SANS multi-stage (mauvaise pratique) :
  Image finale = OS + JDK (400MB) + Maven + Sources + dépendances = ~700MB

AVEC multi-stage (notre approche) :
  Stage 1 (builder) = JDK + Maven + Sources → compile → JAR
  Stage 2 (final)   = JRE (170MB) + JAR uniquement = ~190MB
                      Le builder est JETÉ → il n'existe pas dans l'image finale
```

**Impact sécurité :**
- Le JDK contient des outils de compilation (`javac`, `javap`) qui ne devraient pas être en prod
- Maven n'est jamais accessible à un attaquant si le conteneur est compromis
- Les sources Java ne sont pas dans l'image finale

### 2.3 Le Layered JAR Spring Boot

Spring Boot 2.3+ supporte `jarmode=layertools` qui extrait le JAR en **4 couches séparées** :

```
SANS layered jar :
  COPY app.jar /app/app.jar         → Un seul layer, change à chaque commit
  → Toutes les dépendances re-transférées à chaque build

AVEC layered jar (notre approche) :
  COPY dependencies/     ← ~200MB, change uniquement si pom.xml change
  COPY spring-boot-loader/  ← ~2MB, change entre versions Spring Boot
  COPY snapshot-dependencies/  ← vos SNAPSHOT, change souvent
  COPY application/      ← votre code compilé, quelques KB

  → 95% du temps, seul le layer "application" change
  → Économise 200MB de transfert réseau à chaque push ECR
```

---

## 3. Architecture Docker du projet {#architecture}

```
┌─────────────────────────────────────────────────────────────────┐
│                     Hôte local (Windows)                        │
│                                                                 │
│  localhost:4200  localhost:8080  localhost:5432  localhost:5005  │
│       │               │               │               │         │
│  ┌────┴────────────────┴───────────────┴───────────────┴──────┐  │
│  │              Réseau Docker : portfolio-network             │  │
│  │                    (driver: bridge)                        │  │
│  │                                                            │  │
│  │  ┌──────────────────┐  ┌───────────────┐  ┌────────────┐  │  │
│  │  │ portfolio-frontend│  │portfolio-backend│ │portfolio-  │  │  │
│  │  │ nginx:1.27-alpine │  │eclipse-temurin │ │postgres    │  │  │
│  │  │ :21-jre-alpine    │  │:15-alpine      │  │  │
│  │  │                  │  │               │  │            │  │  │
│  │  │ /usr/share/nginx/ │  │ Port 8080     │  │ Port 5432  │  │  │
│  │  │ html/             │  │ Port 5005(dev)│  │            │  │  │
│  │  │ Port 80           │  │               │  │            │  │  │
│  │  └──────────────────┘  └───────────────┘  └────────────┘  │  │
│  │         │  DNS: "frontend"    DNS: "backend"  DNS: "postgres"  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Volume nommé: portfolio_postgres_data → /var/lib/postgresql    │
└─────────────────────────────────────────────────────────────────┘
```

**Communication inter-services :**
- `frontend` → NGINX → requêtes `/api/*` → proxypass vers `http://backend:8080`
  *(configuré dans nginx.conf)*
- `backend` → JDBC → `jdbc:postgresql://postgres:5432/portfolio_dev`
  *(le nom `postgres` est résolu par le DNS Docker interne)*
- De l'hôte → `localhost:4200` → frontend container

---

## 4. Dockerfile Backend (Spring Boot) {#dockerfile-backend}

```dockerfile
# ─────────────────────────────────────────────
# Stage 1 : BUILDER — JDK + Maven
# Cet stage est JETÉ après la compilation.
# Il ne sera jamais dans l'image finale.
# ─────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

# ÉTAPE CLEF : Copier UNIQUEMENT pom.xml d'abord
# Raison : si pom.xml ne change pas, Docker utilise
# le cache du layer "mvn dependency:go-offline"
# → Download des dépendances seulement quand pom.xml change
COPY pom.xml .
COPY checkstyle.xml .
RUN mvn dependency:go-offline -q

# Maintenant copier les sources (change à chaque commit)
# Ce layer sera invalidé à chaque commit → normal
COPY src/ src/

# Build sans tests (les tests tournent séparément en CI)
# -DskipTests=true : compile mais ne lance pas les tests
# -Pproduction : active le profil Maven production (layers)
RUN mvn package -DskipTests=true -q

# Extraire les layers du Layered JAR Spring Boot
# Crée 4 dossiers : dependencies/, spring-boot-loader/,
#                   snapshot-dependencies/, application/
RUN java -Djarmode=layertools -jar target/*.jar extract

# ─────────────────────────────────────────────
# Stage 2 : RUNTIME — JRE uniquement
# C'est l'image qui sera publiée et déployée.
# ─────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine

# Métadonnées OCI standard (bonnes pratiques)
LABEL maintainer="portfolio@example.com"
LABEL org.opencontainers.image.title="Portfolio Backend"
LABEL org.opencontainers.image.description="Spring Boot REST API"

WORKDIR /app

# Sécurité : créer un utilisateur non-root dédié
# -S = système (pas de home directory, pas de password)
# -G = groupe
# L'application ne tournera JAMAIS en root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copier les layers dans l'ordre : du moins fréquent au plus fréquent
# Docker invalide les layers suivants dès qu'un layer change
COPY --from=builder /app/dependencies/ ./
COPY --from=builder /app/spring-boot-loader/ ./
COPY --from=builder /app/snapshot-dependencies/ ./
COPY --from=builder /app/application/ ./

# Changer le propriétaire des fichiers
# L'utilisateur appuser doit pouvoir lire les fichiers
RUN chown -R appuser:appgroup /app

# Basculer sur l'utilisateur non-root AVANT l'ENTRYPOINT
USER appuser

# Port documenté (ne publie pas le port, c'est EXPOSE qui documente)
EXPOSE 8080

# Health check Docker natif
# Permet à docker compose de savoir si le service est healthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -q -O- http://localhost:8080/actuator/health || exit 1

# ENTRYPOINT (immuable) vs CMD (overridable)
# On utilise ENTRYPOINT pour les flags JVM obligatoires
# -Xmx300m : mémoire heap max (compatible EC2 t2.micro)
# -Xms128m : mémoire heap initiale (évite le resize au démarrage)
# -Xss256k : stack size par thread virtuel (réduit la RAM)
# -XX:+UseG1GC : Garbage Collector adapté aux petites heap
# -XX:MaxMetaspaceSize=128m : limite la Metaspace (classes chargées)
# -Djava.security.egd : accélère la génération de nombres aléatoires
ENTRYPOINT ["java", \
    "-Xmx300m", \
    "-Xms128m", \
    "-Xss256k", \
    "-XX:+UseG1GC", \
    "-XX:MaxMetaspaceSize=128m", \
    "-Djava.security.egd=file:/dev/./urandom", \
    "org.springframework.boot.loader.launch.JarLauncher"]
```

**Taille finale attendue : ~190MB** (contre ~700MB sans multi-stage)

---

## 5. Dockerfile Frontend (Angular + NGINX) {#dockerfile-frontend}

```dockerfile
# ─────────────────────────────────────────────
# Stage 1 : BUILDER — Node.js pour compiler Angular
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# npm ci vs npm install :
# - npm ci lit package-lock.json et installe EXACTEMENT ces versions
# - npm install peut mettre à jour package-lock.json
# - npm ci est idempotent → résultats reproductibles en CI/CD
# --prefer-offline : utilise le cache npm si disponible (builds plus rapides)
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

COPY . .

# ng build --configuration production :
# - Tree-shaking : supprime le code non utilisé
# - Minification : compresse JS/CSS
# - Source maps désactivées
# - AOT compilation (Ahead-of-Time) : templates compilés au build, pas au runtime
# - Hash dans les noms de fichiers (main.abc123.js) pour le cache-busting
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2 : RUNTIME — NGINX léger
# ─────────────────────────────────────────────
FROM nginx:1.27-alpine

LABEL maintainer="portfolio@example.com"

# Copier la config NGINX personnalisée
# Elle configure : gzip, security headers, SPA routing, /health endpoint
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier les fichiers compilés Angular
# Le build Angular génère dans dist/portfolio-frontend/browser/
# (le sous-dossier /browser est généré par Angular 17+ avec SSR désactivé)
COPY --from=builder /app/dist/portfolio-frontend/browser /usr/share/nginx/html

# Corriger les permissions : NGINX doit lire les fichiers
RUN chmod -R 755 /usr/share/nginx/html

# Port documenté
EXPOSE 80

# NGINX tourne en mode non-daemon pour Docker
# "daemon off;" fait que NGINX reste en foreground → Docker peut monitorer le processus
CMD ["nginx", "-g", "daemon off;"]
```

**Taille finale attendue : ~25MB** (contre ~600MB avec Node.js)

---

## 6. Docker Compose — Développement {#compose-dev}

### Structure des fichiers Compose

```
docker/
├── docker-compose.yml          ← Base commune (utilisée en dev ET prod)
├── docker-compose.override.yml ← Overrides dev (debug port, logs verbeux)
└── docker-compose.prod.yml     ← Overrides prod (read-only, no ports)
```

### Fusion automatique des fichiers

Docker Compose **fusionne automatiquement** `docker-compose.yml` et `docker-compose.override.yml` :

```bash
# Ces deux commandes sont ÉQUIVALENTES :
docker compose up
docker compose -f docker-compose.yml -f docker-compose.override.yml up

# Pour la prod, on spécifie explicitement :
docker compose -f docker-compose.yml -f docker-compose.prod.yml up
```

### Health checks et dépendances

```yaml
backend:
  depends_on:
    postgres:
      condition: service_healthy   # ← Attend que postgres soit HEALTHY
                                    #    (pas juste "started")
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
    start_period: 60s              # ← Spring Boot met ~45s à démarrer
                                    #    Sans ça, Docker tue le conteneur
                                    #    avant qu'il ait eu le temps de démarrer
```

**Pourquoi `start_period` est critique :**
- Spring Boot + Flyway + JPA initialization = ~45-60 secondes au premier lancement
- Sans `start_period`, Docker considère le healthcheck "failed" et redémarre le conteneur
- `start_period` crée une fenêtre de grâce : les failures pendant cette période sont ignorées

---

## 7. Docker Compose — Production simulée {#compose-prod}

### Différences clés dev vs prod

| Feature | Dev | Prod |
|---------|-----|------|
| Ports exposés | 4200, 8080, 5432, 5005 | 80 uniquement |
| Filesystem | Read-write | **Read-only** |
| Logs | DEBUG | INFO/WARN |
| Profil Spring | `dev` | `prod` |
| Secrets | Valeurs fixes | `${VAR:?erreur}` |
| `restart` | `unless-stopped` | `always` |
| Debug JDWP | Activé (port 5005) | Désactivé |
| SQL logging | Activé | Désactivé |

### Syntaxe `${VAR:?message}` — Fail-fast sur secrets manquants

```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD est obligatoire en prod}
```

- Si `POSTGRES_PASSWORD` n'est pas défini → Docker Compose **arrête avec une erreur**
- Évite de démarrer en prod sans secrets → comportement fail-fast
- Pattern recommandé pour tous les secrets critiques

### Read-only filesystem + tmpfs

```yaml
read_only: true           # Tous les écritures sont interdites par défaut
tmpfs:
  - /tmp:size=128m        # Exceptions : répertoires temp en mémoire
  - /app/tmp:size=64m
```

**Pourquoi c'est important en sécurité :**
1. Un attaquant qui exploite une RCE ne peut pas modifier les binaires
2. Pas de persistence d'artefacts malveillants entre les redémarrages
3. Réduit la surface d'attaque post-exploitation

---

## 8. Réseau Docker : Bridge, DNS, isolation {#réseau}

### Le réseau bridge de Docker

```
Hôte Linux/Windows
├── eth0 (réseau physique) : 192.168.1.x
└── docker0 (bridge virtuel) : 172.17.0.1
    ├── portfolio-frontend  : 172.20.0.2 (dans portfolio-network)
    ├── portfolio-backend   : 172.20.0.3
    └── portfolio-postgres  : 172.20.0.4
```

**Le réseau `portfolio-network` est isolé du réseau par défaut `docker0`.**
Les conteneurs dans des réseaux différents ne peuvent pas se parler — isolation par défaut.

### DNS interne Docker

Docker inclut un **serveur DNS interne** (127.0.0.11) dans chaque réseau custom :

```
Dans le conteneur backend, la résolution DNS fonctionne ainsi :
  "postgres" → 172.20.0.4 (IP interne du conteneur postgres)
  "frontend" → 172.20.0.2

C'est pourquoi dans application.properties on écrit :
  spring.datasource.url=jdbc:postgresql://postgres:5432/portfolio_dev
                                          ^^^^^^^^
                                          Nom du service Docker, pas une IP
```

**Avantage :** Si l'IP du conteneur change (redémarrage), le nom reste valide.

### Port mapping : de l'hôte au conteneur

```yaml
ports:
  - "8080:8080"    # hôte:conteneur
```

```
Hôte : localhost:8080
         │
         │ iptables NAT rule
         ▼
Docker bridge : 172.20.0.3:8080 (backend container)
```

**En production (Kubernetes) :**
- Les ports ne sont PAS exposés directement
- L'Ingress Controller gère le trafic entrant
- Les Services K8s font le load balancing entre les pods

---

## 9. Sécurité des conteneurs {#sécurité}

### Principe de moindre privilège

| Bonne pratique | Implémentation |
|----------------|----------------|
| Pas de root | `USER appuser` dans Dockerfile |
| Read-only filesystem | `read_only: true` en prod |
| No new privileges | `security_opt: - no-new-privileges:true` |
| Pas de secrets en image | Variables d'env injectées au runtime |
| Image minimale | Alpine (pas Ubuntu/Debian complet) |
| Pas d'outils de build en prod | Multi-stage build |
| Scan de vulnérabilités | Trivy en CI/CD |

### Pourquoi l'utilisateur non-root est crucial

```dockerfile
# MAUVAISE pratique (root par défaut) :
FROM eclipse-temurin:21-jre-alpine
COPY app.jar /app.jar
CMD ["java", "-jar", "/app.jar"]
# → Si l'app est compromise, l'attaquant est ROOT dans le conteneur

# BONNE pratique (notre approche) :
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
# → Si l'app est compromise, l'attaquant est "appuser" (UID 1000+)
# → Pas accès aux fichiers système, pas d'escalade de privilèges facile
```

### Pas de secrets dans les images

```dockerfile
# JAMAIS ça :
ENV JWT_SECRET=mon-secret-jwt    # ← Dans l'image, visible avec "docker history"
ENV DB_PASSWORD=password123      # ← Visible dans tous les layers

# TOUJOURS ça :
# Pas de valeur → injectée au "docker run" ou dans docker-compose.yml
# qui lui-même lit depuis .env (exclu de Git)
```

**Vérification :**
```bash
# Cette commande révèle les secrets si mal configurés :
docker history portfolio-backend:latest
docker inspect portfolio-backend:latest | grep -i secret
```

---

## 10. Makefile — Commandes centralisées {#makefile}

### Structure du Makefile

```makefile
.PHONY: help build up down logs test clean   # Déclare les targets non-fichiers

# Variables configurables via l'environnement :
IMAGE_TAG ?= latest    # "?=" → utilisé si non défini
                       # Override : make build IMAGE_TAG=v1.2.3
```

### Pourquoi un Makefile ?

Sans Makefile, chaque développeur doit mémoriser :
```bash
docker build --tag portfolio-backend:latest --file backend/Dockerfile ./backend
docker compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml up -d
```

Avec Makefile :
```bash
make build
make up
```

**Avantages :**
1. Interface unifiée quelque soit la complexité de la commande sous-jacente
2. Auto-documentation via `make help`
3. Cibles chainables : `make clean build up`
4. Variables d'environnement configurables : `make push-ecr IMAGE_TAG=v1.2.3`

### Installation de Make sur Windows

```powershell
# Via Chocolatey (recommandé)
choco install make

# Via Winget
winget install GnuWin32.Make

# Via Scoop
scoop install make
```

---

## 11. Scan de vulnérabilités avec Trivy {#trivy}

### Qu'est-ce que Trivy ?

Trivy (Aqua Security) est un scanner de vulnérabilités open-source qui analyse :
- Les packages OS (Alpine apk, Ubuntu apt)
- Les dépendances applicatives (pom.xml, package.json)
- Les configs Docker et Kubernetes

### Installation

```bash
# Windows (via Scoop)
scoop install trivy

# Windows (via Chocolatey)
choco install trivy

# Linux/Mac (via Homebrew)
brew install trivy
```

### Utilisation

```bash
# Scanner l'image backend
trivy image portfolio-backend:latest

# Scanner avec seuil : fail si HIGH ou CRITICAL
trivy image --exit-code 1 --severity HIGH,CRITICAL portfolio-backend:latest

# Générer un rapport HTML
trivy image --format template \
    --template "@/contrib/html.tpl" \
    -o trivy-report.html \
    portfolio-backend:latest
```

### Exemple de sortie Trivy

```
portfolio-backend:latest (alpine 3.19.1)
=========================================
Total: 2 (HIGH: 1, CRITICAL: 1)

┌─────────────┬───────────────┬──────────┬────────────────────┐
│   Library   │ Vulnerability │ Severity │ Fixed Version      │
├─────────────┼───────────────┼──────────┼────────────────────┤
│ openssl     │ CVE-2024-XXXX │ CRITICAL │ 3.1.5-r0           │
│ libcrypto3  │ CVE-2024-YYYY │ HIGH     │ 3.1.5-r0           │
└─────────────┴───────────────┴──────────┴────────────────────┘
```

**Solution typique :** Mettre à jour l'image de base vers une version plus récente.

### Intégration CI/CD (Phase 12)

```yaml
# .github/workflows/ci.yml (extrait)
- name: Scan image Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: portfolio-backend:${{ github.sha }}
    exit-code: '1'
    severity: 'HIGH,CRITICAL'
```

---

## 12. Commandes de référence {#commandes}

### Build

```powershell
# Build image backend
docker build -t portfolio-backend:latest -f backend/Dockerfile ./backend

# Build image frontend
docker build -t portfolio-frontend:latest -f frontend/Dockerfile ./frontend

# Build avec tag de version
docker build -t portfolio-backend:v1.0.0 -f backend/Dockerfile ./backend

# Via Makefile
make build
make build IMAGE_TAG=v1.0.0
```

### Lancer l'environnement

```powershell
# Dev (avec override automatique)
docker compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml up -d

# Voir les logs en temps réel
docker compose -f docker/docker-compose.yml logs -f

# Arrêter (garde les volumes)
docker compose -f docker/docker-compose.yml down

# Arrêter et supprimer les volumes (reset complet)
docker compose -f docker/docker-compose.yml down --volumes

# Production simulée
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d

# Via Makefile
make up
make up-prod
make down
make logs
```

### Inspection et debug

```powershell
# Voir les conteneurs en cours
docker ps

# Logs d'un service spécifique
docker compose -f docker/docker-compose.yml logs -f backend

# Entrer dans un conteneur
docker exec -it portfolio-backend sh
docker exec -it portfolio-frontend sh

# Inspecter les ressources
docker stats
docker stats --no-stream    # Snapshot une fois

# Voir les layers et tailles
docker history portfolio-backend:latest
docker images

# Inspecter le réseau
docker network inspect portfolio-network
docker network ls

# Via Makefile
make shell-backend
make image-sizes
make inspect-network
```

### Nettoyage

```powershell
# Supprimer les images du projet
docker rmi portfolio-backend:latest portfolio-frontend:latest

# Supprimer les containers arrêtés, images dangling, etc.
docker system prune -f

# Supprimer tout (images, conteneurs, volumes, réseau) — DANGEREUX
docker system prune -a --volumes

# Via Makefile
make clean
make clean-all
```

---

## 13. Erreurs courantes et solutions {#erreurs}

### `Cannot connect to the Docker daemon`

```
Error: Cannot connect to the Docker daemon at unix:///var/run/docker.sock
```
**Solution :** Docker Desktop n'est pas lancé. Démarrer Docker Desktop.

### `Port is already allocated`

```
Error: Bind for 0.0.0.0:8080 failed: port is already allocated
```
**Cause :** Un autre service utilise le port 8080.
```powershell
# Trouver le processus qui utilise le port
netstat -ano | findstr :8080
# Ou sur Linux :
lsof -i :8080

# Arrêter le service qui utilise le port
# Ou changer le port dans docker-compose.yml : "8081:8080"
```

### Backend health check échoue

```
portfolio-backend is unhealthy
```
**Cause possible 1 :** Spring Boot n'a pas fini de démarrer.
```yaml
# Augmenter start_period dans docker-compose.yml
healthcheck:
  start_period: 90s    # 60s → 90s
```

**Cause possible 2 :** PostgreSQL n'est pas accessible.
```powershell
# Vérifier les logs
docker compose logs backend | grep -i "connection refused"
docker compose logs postgres
```

### `Permission denied` dans le conteneur

```
java.io.IOException: Permission denied @ /app/tmp
```
**Cause :** `read_only: true` sans `tmpfs` pour les répertoires temporaires.
```yaml
# Ajouter tmpfs pour les répertoires que Spring Boot doit écrire
tmpfs:
  - /tmp:size=128m
  - /app/tmp:size=64m
```

### Image trop grande

```
WARN: Image size 680MB (expected ~190MB)
```
**Cause :** Le multi-stage n'est pas correctement configuré.
```powershell
# Inspecter les layers
docker history portfolio-backend:latest

# Chercher un layer avec "COPY . ." qui copie tout le projet
# Solution : vérifier le .dockerignore
```

### `npm ci` échoue : `package-lock.json` manquant

```
npm error The `npm ci` command can only install with an existing package-lock.json
```
**Solution :**
```powershell
cd frontend
npm install    # Génère package-lock.json
git add package-lock.json
```

### NGINX 404 sur les routes Angular

**Symptôme :** Accéder directement à `http://localhost:4200/portfolio/projects` retourne 404.

**Cause :** NGINX cherche un fichier `/portfolio/projects` qui n'existe pas.

**Solution :** La config nginx.conf avec `try_files $uri $uri/ /index.html` résout ce problème.
Si ça ne fonctionne pas, vérifier que la config est bien copiée dans l'image :
```powershell
docker exec portfolio-frontend cat /etc/nginx/conf.d/default.conf
```

---

## 14. Checklist de la phase {#checklist}

### Fichiers créés

- [x] `.editorconfig` — Cohérence de style entre éditeurs
- [x] `Makefile` — Interface de commandes centralisée
- [x] `backend/Dockerfile` — Multi-stage, non-root, JVM optimisée, layered JAR
- [x] `backend/.dockerignore` — Exclusion target/, .git/, etc.
- [x] `frontend/Dockerfile` — Multi-stage Node→NGINX, non-root
- [x] `frontend/.dockerignore` — Exclusion node_modules/, dist/, etc.
- [x] `frontend/nginx.conf` — SPA routing, gzip, security headers, /health
- [x] `docker/docker-compose.yml` — Base commune dev
- [x] `docker/docker-compose.override.yml` — Debug port 5005
- [x] `docker/docker-compose.prod.yml` — Read-only, no ports, secrets obligatoires
- [x] `docker/.env.prod.example` — Template secrets production

### Validations à effectuer

```powershell
# 1. Build des images
docker build -t portfolio-backend:latest -f backend/Dockerfile ./backend
docker build -t portfolio-frontend:latest -f frontend/Dockerfile ./frontend

# 2. Vérifier les tailles (objectif : backend < 200MB, frontend < 30MB)
docker images | grep portfolio

# 3. Lancer l'environnement
docker compose -f docker/docker-compose.yml up -d

# 4. Attendre le démarrage (~60s) et vérifier la santé
docker compose -f docker/docker-compose.yml ps
# → tous les services doivent être "healthy"

# 5. Tester les endpoints
curl http://localhost:8080/actuator/health
curl http://localhost:4200/health

# 6. Vérifier le login (si les migrations Flyway ont tourné)
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@portfolio.com","password":"admin123"}'

# 7. Scan de sécurité
trivy image --severity HIGH,CRITICAL portfolio-backend:latest
trivy image --severity HIGH,CRITICAL portfolio-frontend:latest
```

### Compétences démontrées aux recruteurs

| Compétence | Démonstration |
|------------|---------------|
| **Docker multi-stage** | Backend 190MB (vs 700MB naïf), frontend 25MB (vs 600MB naïf) |
| **Security mindset** | Non-root, read-only fs, no-new-privileges, pas de secrets dans images |
| **Cache optimization** | Ordre des COPY layers, `npm ci`, `mvn dependency:go-offline` |
| **Healthchecks** | Intégration Docker + Spring Actuator + Kubernetes-ready |
| **12-factor app** | Config via env vars, pas de hardcoding |
| **SPA deployment** | nginx.conf avec try_files pour Angular Router |
| **Prod simulation** | docker-compose.prod.yml avec contraintes réalistes |
| **Developer UX** | Makefile, .editorconfig, hot-reload en dev |
| **Container security** | Scan Trivy intégré dans le workflow |

---

*Phase 4 complétée — Prochaine étape : Phase 5 — Terraform & Infrastructure AWS*
