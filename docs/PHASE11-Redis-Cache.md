# Phase 11 — Cache Redis (Spring Cache + @Cacheable)

## Vue d'ensemble

| Aspect | Détail |
|--------|--------|
| Backend cache | Spring Cache + `@Cacheable` / `@CacheEvict` |
| Store | Redis 7.2 (sérialisé JSON) |
| TTL liste projets | 5 min |
| TTL projet par ID | 10 min |
| TTL projets featured | 5 min |
| Dashboard Grafana | "Redis Cache — Hits, Misses & Évictions" |
| Port Redis | 6379 |

---

## 1. Stratégie de cache

### Quels endpoints sont cachés ?

```
GET /projects          → cache "projects"          TTL 5 min
GET /projects/{id}     → cache "project"           TTL 10 min
GET /projects/featured → cache "projects-featured" TTL 5 min
```

Les endpoints d'écriture (`POST`, `PUT`, `DELETE`) invalident les caches via `@CacheEvict` :

```java
// ProjectService.java
@CacheEvict(cacheNames = {CACHE_PROJECTS, CACHE_PROJECTS_FEATURED}, allEntries = true)
public ProjectResponse createProject(ProjectRequest request) { ... }

@CacheEvict(cacheNames = {CACHE_PROJECTS, CACHE_PROJECT, CACHE_PROJECTS_FEATURED}, allEntries = true)
public ProjectResponse updateProject(Long id, ProjectRequest request) { ... }

@CacheEvict(cacheNames = {CACHE_PROJECTS, CACHE_PROJECT, CACHE_PROJECTS_FEATURED}, allEntries = true)
public void deleteProject(Long id) { ... }
```

### Flux de lecture avec cache

```
GET /projects
    │
    ▼
@Cacheable("projects")    ← Spring AOP intercepte la méthode
    │
    ├── Cache HIT  → retourne la valeur Redis directement (< 1ms)
    │              → pas d'appel SQL, pas de PostgreSQL
    │
    └── Cache MISS → exécute la méthode Java
                   → requête PostgreSQL
                   → résultat stocké dans Redis (sérialisation JSON)
                   → retourné au client (~5-20ms)
```

---

## 2. Configuration Redis (`CacheConfig.java`)

### Sérialisation JSON

```java
ObjectMapper cacheMapper = new ObjectMapper()
    .registerModule(new JavaTimeModule())
    .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
    .activateDefaultTyping(            // @class dans le JSON pour désérialiser
        ...,
        ObjectMapper.DefaultTyping.NON_FINAL,
        JsonTypeInfo.As.PROPERTY
    );
```

La sérialisation JSON (au lieu de la sérialisation Java) est utilisée car :
- Les entrées Redis sont lisibles avec `redis-cli` ou RedisInsight
- Le cache survit aux redémarrages de l'application Java
- La mise à jour de la JVM (ex: JAR recompilé) ne corrompt pas le cache

### TTL par cache

```java
return RedisCacheManager.builder(connectionFactory)
    .cacheDefaults(defaultConfig)              // TTL 5 min (liste, featured)
    .withInitialCacheConfigurations(Map.of(
        CACHE_PROJECT, defaultConfig.entryTtl(Duration.ofMinutes(10))  // TTL 10 min (par ID)
    ))
    .build();
```

### Exclusion des null values

```java
.disableCachingNullValues()
```

Évite de cacher une réponse 404 — si `GET /projects/999` retourne null, la prochaine requête ira en base de données (pas de null poisoning).

### Dégradation gracieuse quand Redis est indisponible

Spring utilise par défaut `SimpleCacheErrorHandler`, qui **propage** les
exceptions du cache. Une simple indisponibilité de Redis transformait donc
`GET /projects` — la page publique la plus visitée — en **HTTP 500**, alors que
la donnée est parfaitement lisible en base.

`CacheConfig` implémente `CachingConfigurer` et fournit un `CacheErrorHandler`
qui journalise puis avale l'erreur :

```java
@Override
public CacheErrorHandler errorHandler() {
    return new CacheErrorHandler() { /* log WARN, pas de rethrow */ };
}
```

Le cache est une optimisation, pas une dépendance dure : Redis à terre, le site
sert la même donnée depuis PostgreSQL, plus lentement. Les quatre méthodes du
handler sont couvertes (`get`, `put`, `evict`, `clear`) — n'en traiter qu'une
laisserait le 500 revenir par une autre porte, typiquement l'éviction déclenchée
par une écriture admin.

---

## 3. Clés Redis

Format des clés dans Redis :

```
projects::SimpleKey []              → résultat de getAll()
projects-featured::SimpleKey []     → résultat de getFeatured()
project::1                          → résultat de getById(1L)
project::2                          → résultat de getById(2L)
```

Inspection en CLI :
```bash
redis-cli -p 6379
> KEYS *
> GET "project::1"
> TTL "projects::SimpleKey []"
```

---

## 4. Impact sur les performances

### Simulation Gatling (Phase 14) : 100 users sur GET /projects

| Métrique | Sans cache | Avec cache Redis |
|----------|-----------|-----------------|
| p(95) latence | ~150ms (PostgreSQL + requête JPA) | ~15ms (Redis hit) |
| Charge PostgreSQL | 100 req/s | ~0.03 req/s (1 req toutes les 5 min) |

Les réponses Redis < 20ms sont comptées comme "cache hits estimés" par `PublicProjectsSimulation`.

---

## 5. Dashboard Grafana

**Accès :** http://localhost:3000 → onglet "Redis Cache — Hits, Misses & Évictions"

| Panel | Métrique Prometheus |
|-------|---------------------|
| Hit rate (%) | `cache_gets_total{result="hit"}` / `cache_gets_total` |
| Puts (entrées ajoutées) | `cache_puts_total` |
| Évictions (TTL expiré ou `@CacheEvict`) | `cache_evictions_total` |
| Miss rate | `cache_gets_total{result="miss"}` |

Les métriques sont exposées par Spring Boot Actuator / Micrometer via `MeterBinder` Redis.

---

## 6. Démarrage local

Redis est inclus dans la stack de support :

```powershell
# Démarre Redis + Postgres + Prometheus + Grafana
docker compose -f docker/docker-compose.dev-stack.yml up -d

# Vérifier que Redis répond
redis-cli -p 6379 ping
# → PONG
```

---

## 7. Décisions techniques

### Pourquoi ne pas cacher les endpoints d'écriture ?

Les mutations (`POST /projects`, `PUT /projects/{id}`) modifient la base de données. Si elles étaient cachées, le cache retournerait une valeur stale. `@CacheEvict(allEntries = true)` sur les mutations garantit que la prochaine lecture relit PostgreSQL et remet à jour le cache.

### Pourquoi TTL 10 min pour les projets par ID (et 5 min pour la liste) ?

Un projet individuel (`GET /projects/{id}`) change moins souvent que la liste. 10 min réduit les accès PostgreSQL pour les pages de détail. La liste (`GET /projects`) est plus susceptible d'être invalide (nouveau projet ajouté) → TTL plus court.

### Pourquoi `NON_FINAL` dans `activateDefaultTyping` ?

`ProjectResponse` est un Java Record (non-final interdit par Kotlin mais autorisé en Java). Le type concret est inclus dans le JSON Redis via `@class` — cela permet à Jackson de désérialiser correctement même si `ProjectResponse` évolue entre deux déploiements.

---

## 8. Fichiers créés / modifiés

| Fichier | Description |
|---------|-------------|
| `backend/.../config/CacheConfig.java` | Configuration RedisCacheManager — TTL, sérialisation JSON |
| `backend/.../service/ProjectService.java` | Annotations `@Cacheable` et `@CacheEvict` |
| `docker/grafana/dashboards/cache.json` | Dashboard Grafana pré-construit |
| `backend/src/main/resources/application.properties` | Config Redis host/port/timeout |
| `backend/pom.xml` | Dépendance `spring-boot-starter-data-redis` |
