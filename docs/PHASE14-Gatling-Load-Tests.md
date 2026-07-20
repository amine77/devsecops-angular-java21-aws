# Phase 14 — Tests de charge Gatling

## Vue d'ensemble

| Simulation | Classe | Users concurrents max | SLA principal |
|------------|--------|------------------------|----------------|
| GET /projects (SLA public) | `PublicProjectsSimulation` | 100 | p(95) < 200ms |
| POST /auth/login (stress bcrypt) | `AuthStressSimulation` | 50 | p(95) < 1500ms |
| Admin CRUD complet | `AdminFlowSimulation` | 5 | p(95) < 500ms |

> Ces simulations remplacent les scénarios k6 initiaux de la Phase 14 (bascule vers Gatling — outil JVM-natif, intégré au build Maven du backend).

---

## 1. Outil Gatling

**Gatling** est un outil de test de charge JVM-natif, scriptable en Java (DSL fluide `io.gatling.javaapi`). Différences avec k6/JMeter :
- Intégré au build Maven du backend (`gatling-maven-plugin`) — pas de binaire externe à installer
- DSL Java typée, compilée avec le reste du projet (Checkstyle/Surefire ignorent ces classes, elles ne matchent pas les patterns `**/*Test.java`)
- Moteur asynchrone (Netty + acteurs) — simule des milliers d'utilisateurs concurrents avec peu de threads
- Assertions déclaratives (`setUp(...).assertions(...)`) — le build **échoue** (exit code ≠ 0) si un SLA n'est pas respecté
- Rapport HTML généré nativement dans `target/gatling/` (pas de librairie tierce à charger)

---

## 2. Simulation 1 — `PublicProjectsSimulation`

**Objectif :** valider que `GET /projects` tient la charge à 100 utilisateurs concurrents avec le cache Redis activé.

### Profil de charge (workload fermé)

```
Users
100 ┤                   ████████████████████
    │               ████                    ████
  0 └───────────────────────────────────────────── temps
     0s    30s       30s+1m              +15s
          montée     charge soutenue    descente
```

```java
scn.injectClosed(
    rampConcurrentUsers(0).to(100).during(Duration.ofSeconds(30)),
    constantConcurrentUsers(100).during(Duration.ofMinutes(1)),
    rampConcurrentUsers(100).to(0).during(Duration.ofSeconds(15))
)
```

`injectClosed` + `rampConcurrentUsers`/`constantConcurrentUsers` reproduisent fidèlement l'executor `ramping-vus` de k6 (nombre d'utilisateurs concurrents fixé, par opposition au workload ouvert où on injecte un débit de nouveaux utilisateurs/s).

### Assertions (SLA)

```java
.assertions(
    global().responseTime().percentile(95).lt(200),
    global().responseTime().percentile(99).lt(500),
    global().failedRequests().percent().lt(1.0),
    global().successfulRequests().percent().gt(99.0),
    details("GET /projects").responseTime().percentile(95).lt(200),
    details("GET /projects/featured").responseTime().percentile(95).lt(150)
)
```

### Requêtes exécutées par utilisateur virtuel

1. `GET /projects` — liste paginée (principal)
2. `GET /projects/featured` — projets mis en avant
3. `GET /actuator/health/readiness` — health check sous charge

### Détection empirique du cache Redis

```java
.check(responseTimeInMillis().saveAs("listDurationMs"))
// ...
if (session.getLong("listDurationMs") < 20) {
    CACHE_HITS.incrementAndGet();   // < 20ms = Redis hit probable
}
```

Sans cache Redis, `GET /projects` prend 15-50ms (PostgreSQL). Avec cache = < 5ms (Redis). Le compteur `CACHE_HITS` est affiché dans la console via le hook `after()` en fin de run.

---

## 3. Simulation 2 — `AuthStressSimulation`

**Objectif :** valider que le serveur ne sature pas sous 50 connexions concurrentes, malgré le bcrypt cost=12 (~300ms par hash).

### Profil de charge

```
Users
50  ┤                       ████████████████████
    │               ████████
20  ┤   ████████████
    │
 0  └─────────────────────────────────────────── temps
     0s   20s  30s    +20s     +30s       +15s
```

### Seuil intentionnellement souple

```java
.assertions(
    global().responseTime().percentile(95).lt(1500),
    global().responseTime().percentile(99).lt(3000),
    global().failedRequests().percent().lt(5.0)
)
```

BCrypt (cost=12) prend ~300ms. Avec 50 utilisateurs concurrents et des Virtual Threads, la latence ne doit pas s'empiler — mais si le pool de connexions DB sature, la latence explose. Cette simulation détecte ce type de saturation.

### Simulation de trafic réaliste

```java
.randomSwitch().on(
    percent(20.0).then(
        exec(http("POST /auth/login (invalide)")...)
    )
)
```

`randomSwitch` répartit ~20% des itérations vers une tentative de login invalide — équivalent probabiliste du modulo k6 (`__ITER % 5 === 0`). Le reste (80%, non couvert par une branche) poursuit simplement le scénario.

---

## 4. Simulation 3 — `AdminFlowSimulation`

**Objectif :** valider le flux CRUD complet depuis la perspective d'un admin.

### Actions par itération

1. `POST /projects` — créer un projet (avec token)
2. `GET /projects/{id}` — lire le projet créé
3. `PUT /projects/{id}` — modifier le titre
4. `DELETE /projects/{id}` — archiver (soft delete)

Le token JWT est obtenu **une seule fois** avant l'injection, via l'override `before()` (équivalent du `setup()` k6) qui appelle `/auth/login` avec `java.net.http.HttpClient` — en dehors du moteur Gatling, pour éviter de saturer bcrypt avec un login par itération.

5 utilisateurs concurrents uniquement (faible charge) — cette simulation teste la **cohérence du flux** sous concurrence légère, pas la montée en charge.

---

## 5. Rapports HTML

Gatling génère nativement un rapport HTML par run (pas de librairie tierce) :

```
backend/target/gatling/publicprojectssimulation-<timestamp>/index.html
backend/target/gatling/authstresssimulation-<timestamp>/index.html
backend/target/gatling/adminflowsimulation-<timestamp>/index.html
```

Le rapport contient latence p50/p95/p99, débit (req/s), taux d'erreur, et le détail par requête (`details("nom de la requête")`).

---

## 6. Lancement local

```powershell
# Prérequis : backend démarré (mvn spring-boot:run ou make up) + Maven installé
cd backend
mvn gatling:test -Dgatling.simulationClass=com.portfolio.backend.loadtest.PublicProjectsSimulation

# Ou via les cibles Makefile (depuis la racine du repo)
make test-load        # 100 users — GET /projects
make test-load-auth   # 50 users  — POST /auth/login
make test-load-admin  # 5 users   — CRUD admin
make test-load-all    # Les 3 séquentiellement

# Contre une autre URL (staging, prod)
mvn gatling:test -DbaseUrl=http://staging.example.com:8080 \
    -Dgatling.simulationClass=com.portfolio.backend.loadtest.PublicProjectsSimulation
```

---

## 7. En CI (GitHub Actions)

**Workflow :** `gatling-load-test.yml` — déclenchement **manuel uniquement**.

```
GitHub → Actions → "Load Tests — Gatling" → Run workflow
  → Choisir : scenario (public-projects/auth-stress/admin-flow/all) + base_url (optionnel)
```

Le workflow démarre PostgreSQL + Redis + Spring Boot dans le runner CI, exécute la simulation via `mvn gatling:test` (Maven télécharge Gatling automatiquement — pas de binaire à installer) et publie le rapport HTML en artifact.

---

## 8. Décisions techniques

### Pourquoi Gatling plutôt que k6 ?

Le choix technique initial (Phase 14) s'est porté sur k6, plus léger et scriptable en JavaScript. Gatling a été retenu ensuite pour son intégration JVM-native (Maven, même écosystème que le backend Spring Boot) et sa plus large adoption dans les équipes Java/DevOps — sans binaire externe à installer en CI.

### Pourquoi un workload fermé (`injectClosed`) plutôt qu'ouvert (`injectOpen`) ?

Un workload fermé fixe le nombre d'utilisateurs concurrents (chacun boucle sur le scénario), ce qui correspond au comportement réel attendu (N utilisateurs sur le site en simultané) et reproduit fidèlement les profils de charge définis en VUs k6.

### Pourquoi des assertions dans le code plutôt qu'une vérification manuelle ?

Les `assertions` Gatling font échouer le build (`mvn gatling:test` retourne un code non-zéro) si un SLA est violé. En CI, cela fait échouer le workflow automatiquement — pas besoin d'interpréter manuellement le rapport HTML.

### Pourquoi un déclenchement manuel en CI ?

Les simulations durent 1-5 minutes chacune et génèrent des centaines de requêtes. Les déclencher à chaque push ralentirait le pipeline et pourrait impacter d'autres jobs qui utilisent le même backend.

### Pourquoi les simulations vivent-elles dans `src/test/java` sans casser `mvn test` ?

Les classes de simulation (`*Simulation.java`) ne matchent pas les patterns par défaut de Surefire (`**/*Test.java`, `**/*Tests.java`...), donc `mvn test` les compile mais ne les exécute jamais. Le plugin `gatling-maven-plugin` n'a pas d'`<executions>` liée au cycle de vie par défaut — seul un appel explicite à `mvn gatling:test` les déclenche.

---

## 9. Fichiers créés

| Fichier | Description |
|---------|-------------|
| `backend/src/test/java/.../loadtest/LoadTestConfig.java` | `BASE_URL`, identifiants admin (surchargeables via `-DbaseUrl=...`) |
| `backend/src/test/java/.../loadtest/PublicProjectsSimulation.java` | 100 users — SLA GET /projects avec cache Redis |
| `backend/src/test/java/.../loadtest/AuthStressSimulation.java` | 50 users — stress bcrypt sur POST /auth/login |
| `backend/src/test/java/.../loadtest/AdminFlowSimulation.java` | 5 users — flux CRUD complet admin |
| `.github/workflows/gatling-load-test.yml` | Workflow CI — déclenchement manuel |
| `Makefile` | Cibles `test-load`, `test-load-auth`, `test-load-admin`, `test-load-all` |
