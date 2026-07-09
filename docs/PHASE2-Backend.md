# PHASE 2 — Backend Spring Boot Java 21

> **Date :** 2026-05-25
> **Prérequis :** [PHASE 1 — Architecture](PHASE1-Architecture.md)

---

## Table des matières

1. [Architecture Layered — Théorie](#architecture-layered--théorie)
2. [Fichiers produits](#fichiers-produits)
3. [Commandes de développement](#commandes-de-développement)
4. [Commandes de test](#commandes-de-test)
5. [Commandes Docker](#commandes-docker)
6. [Erreurs fréquentes et solutions](#erreurs-fréquentes-et-solutions)
7. [Checklist PHASE 2](#checklist-phase-2)

---

## Architecture Layered — Théorie

```
HTTP Request
     ↓
Controller  → valide HTTP, délègue au Service
     ↓
Service     → logique métier, @Transactional
     ↓
Repository  → persistance JPA, accès DB
     ↓
PostgreSQL
```

**Règle d'or** : chaque couche ne connaît que la couche immédiatement en dessous.

---

## Fichiers produits

### Structure créée

```
backend/
├── Dockerfile                          ← Multi-stage, JRE Alpine, user non-root
├── .dockerignore
├── pom.xml                             ← Java 21, Spring Boot 3.5, Checkstyle, JaCoCo
├── checkstyle.xml                      ← Règles style Java (lignes max, nommage, etc.)
└── src/
    ├── main/
    │   ├── java/com/portfolio/backend/
    │   │   ├── BackendApplication.java
    │   │   ├── config/
    │   │   │   ├── SecurityConfig.java       ← JWT + CORS + BCrypt + STATELESS
    │   │   │   └── OpenApiConfig.java        ← Swagger UI + Bearer Auth
    │   │   ├── controller/
    │   │   │   ├── AuthController.java       ← POST /auth/login
    │   │   │   ├── ProjectController.java    ← CRUD /projects (public GET, admin POST/PUT/DELETE)
    │   │   │   └── SkillController.java      ← GET /skills
    │   │   ├── dto/
    │   │   │   ├── request/
    │   │   │   │   ├── LoginRequest.java     ← @NotBlank @Email @Size
    │   │   │   │   └── ProjectRequest.java   ← @NotBlank @Size @URL
    │   │   │   └── response/
    │   │   │       ├── ApiResponse.java      ← Wrapper standard { success, data, message }
    │   │   │       ├── PageResponse.java     ← Pagination standard
    │   │   │       ├── AuthResponse.java     ← Token JWT + UserInfo
    │   │   │       ├── ProjectResponse.java
    │   │   │       ├── SkillResponse.java
    │   │   │       └── ErrorResponse.java    ← { timestamp, status, error, message, validationErrors }
    │   │   ├── entity/
    │   │   │   ├── User.java                 ← implements UserDetails, BCrypt, roles
    │   │   │   ├── Role.java                 ← Enum USER/ADMIN
    │   │   │   ├── Project.java              ← ManyToOne User, ManyToMany Skills
    │   │   │   ├── ProjectStatus.java        ← Enum ACTIVE/ARCHIVED
    │   │   │   └── Skill.java
    │   │   ├── exception/
    │   │   │   ├── GlobalExceptionHandler.java  ← @RestControllerAdvice, catch-all
    │   │   │   ├── ResourceNotFoundException.java ← → 404
    │   │   │   └── UnauthorizedException.java    ← → 401
    │   │   ├── mapper/
    │   │   │   └── ProjectMapper.java        ← Entity → DTO, pas de logique métier
    │   │   ├── repository/
    │   │   │   ├── UserRepository.java       ← findByEmail, existsByEmail
    │   │   │   ├── ProjectRepository.java    ← Pagination, JOIN FETCH (anti N+1)
    │   │   │   └── SkillRepository.java
    │   │   ├── security/
    │   │   │   ├── JwtTokenProvider.java     ← génère + valide JWT (HMAC-SHA256)
    │   │   │   ├── JwtAuthenticationFilter.java ← intercepte chaque requête HTTP
    │   │   │   └── UserDetailsServiceImpl.java   ← loadUserByUsername
    │   │   └── service/
    │   │       ├── AuthService.java          ← login → JWT
    │   │       ├── ProjectService.java       ← CRUD + soft delete
    │   │       └── SkillService.java
    │   └── resources/
    │       ├── application.properties         ← Virtual Threads, HikariCP, Actuator
    │       ├── application-dev.properties     ← PostgreSQL local, logs DEBUG
    │       ├── application-prod.properties    ← RDS via env vars, logs INFO
    │       └── db/migration/
    │           ├── V1__create_users.sql
    │           ├── V2__create_projects.sql
    │           └── V3__create_skills.sql      ← avec seed data des 12 compétences
    └── test/
        └── java/com/portfolio/backend/
            ├── service/ProjectServiceTest.java        ← Mockito, BDD style
            ├── controller/ProjectControllerTest.java  ← MockMvc, @WithMockUser
            └── integration/ProjectIntegrationTest.java ← Testcontainers, vrai PostgreSQL
```

---

## Commandes de développement

```bash
# Démarrer PostgreSQL local avec Docker (nécessaire pour le profil dev)
docker run -d \
  --name portfolio-postgres \
  -e POSTGRES_DB=portfolio_dev \
  -e POSTGRES_USER=portfolio_user \
  -e POSTGRES_PASSWORD=portfolio_pass \
  -p 5432:5432 \
  postgres:15-alpine

# Démarrer l'application en mode développement
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# Accéder à Swagger UI
# http://localhost:8080/swagger-ui.html

# Accéder à l'API docs JSON
# http://localhost:8080/v3/api-docs

# Health check
curl http://localhost:8080/actuator/health
```

---

## Commandes de test

```bash
# Exécuter tous les tests
mvn test

# Tests + rapport JaCoCo
mvn verify

# Voir le rapport de couverture
# Ouvrir : target/site/jacoco/index.html

# Exécuter checkstyle uniquement
mvn checkstyle:check

# Tests d'intégration uniquement (nécessite Docker pour Testcontainers)
mvn test -Dtest=ProjectIntegrationTest

# Tests unitaires uniquement (rapides, sans Docker)
mvn test -Dtest="!*IntegrationTest"
```

---

## Commandes Docker

```bash
# Build de l'image Docker
docker build -t portfolio-backend:1.0.0 .

# Vérifier la taille de l'image (doit être ~170MB)
docker images portfolio-backend

# Lancer le container avec les variables d'env
docker run -d \
  --name portfolio-backend \
  -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/portfolio_dev \
  -e SPRING_DATASOURCE_USERNAME=portfolio_user \
  -e SPRING_DATASOURCE_PASSWORD=portfolio_pass \
  -e JWT_SECRET=my-super-secret-key-for-jwt-signing-minimum-256bits \
  portfolio-backend:1.0.0

# Voir les logs
docker logs -f portfolio-backend

# Stopper et supprimer
docker stop portfolio-backend && docker rm portfolio-backend
```

---

## Erreurs fréquentes et solutions

### ❌ `Flyway checksum mismatch`
```
Cause : vous avez modifié un script V1__, V2__ déjà exécuté
Solution : NE JAMAIS modifier un script Flyway déjà appliqué.
           Créer un nouveau script V4__ avec les modifications.
```

### ❌ `No bean named 'authenticationManager'`
```
Cause : AuthenticationManager non exposé en bean
Solution : ajouter @Bean sur authenticationManager() dans SecurityConfig
```

### ❌ `LazyInitializationException`
```
Cause : accès à une collection LAZY (project.getSkills()) hors transaction
Solution : utiliser @Transactional sur le service, ou JOIN FETCH dans la requête
```

### ❌ `JWT signature does not match`
```
Cause : clé JWT différente entre la génération et la validation
Solution : vérifier que JWT_SECRET est identique dans toutes les instances
```

### ❌ `Could not find class 'com.portfolio...'`
```
Cause : ordre des annotation processors (Lombok avant MapStruct)
Solution : vérifier l'ordre dans maven-compiler-plugin annotationProcessorPaths
```

---

## Checklist PHASE 2

- ✅ Architecture layered (Controller → Service → Repository)
- ✅ DTOs découplés des entités
- ✅ Bean Validation sur tous les DTOs request
- ✅ GlobalExceptionHandler couvre tous les cas (400, 401, 403, 404, 500)
- ✅ JWT stateless (compatible Kubernetes multi-répliques)
- ✅ BCrypt strength 12 (résistant brute-force)
- ✅ Flyway migrations versionnées
- ✅ Virtual Threads Java 21 activés
- ✅ Actuator health pour K8s probes
- ✅ Swagger UI documenté avec Bearer Auth
- ✅ JVM opts optimisés pour EC2 t2.micro (-Xmx300m)
- ✅ Dockerfile multi-stage (image ~170MB, user non-root)
- ✅ Tests unitaires avec Mockito (BDD style)
- ✅ Tests controller avec MockMvc + @WithMockUser
- ✅ Tests intégration avec Testcontainers (vrai PostgreSQL)
- ✅ JaCoCo coverage minimum 70%
- ✅ Checkstyle règles Java activées

---

*Prochaine étape : [PHASE 3 — Frontend Angular](PHASE3-Frontend.md)*
