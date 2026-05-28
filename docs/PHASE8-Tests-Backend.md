# Phase 8 — Tests Backend (JUnit 5 + Mockito + Testcontainers)

## Vue d'ensemble

| Catégorie | Outil | Nombre de tests |
|-----------|-------|-----------------|
| Tests unitaires services | JUnit 5 + Mockito | 37 tests |
| Tests d'intégration repository | Testcontainers + PostgreSQL réel | 3 tests |
| Tests unitaires observabilité | JUnit 5 + SimpleMeterRegistry | 7 tests |
| **Total** | | **47 tests** |
| Coverage JaCoCo | | **≥ 70%** (lignes) |

---

## 1. Architecture des tests

### Pyramide de tests

```
          /──────────────────────\
         /   Tests d'intégration  \   3 tests — PostgreSQL Testcontainers
        /─────────────────────────\
       /    Tests unitaires        \  44 tests — Mockito, pas de Spring Context
      /───────────────────────────\
     /      Code de production     \
    \───────────────────────────────/
```

### Principe de base : pas de Spring Context dans les tests unitaires

```java
// ✅ Correct — Mockito uniquement, ultra-rapide (~50ms)
@ExtendWith(MockitoExtension.class)
class AuthServiceTest { ... }

// ❌ Évité pour les tests unitaires — charge tout le contexte Spring (~5s)
@SpringBootTest
class AuthServiceTest { ... }
```

---

## 2. Tests unitaires — Services

### `AuthServiceTest` — 7 tests

Classe sous test : `AuthService.login(LoginRequest)`

| Test | Ce qui est vérifié |
|------|-------------------|
| `shouldReturnAuthResponseOnSuccess` | Token, expiresIn et UserInfo corrects |
| `shouldIncrementLoginSuccessMetric` | `metrics.incrementLoginSuccess()` appelé |
| `shouldNotIncrementLoginFailureMetric` | `metrics.incrementLoginFailure()` jamais appelé |
| `shouldPopulateMdcWithUserId` | `MDC.get("userId")` = email après auth |
| `shouldDelegateToAuthenticationManager` | `AuthenticationManager.authenticate()` avec bons credentials |
| `shouldPropagateBadCredentialsException` | Exception propagée si mauvais password |
| `shouldNotPopulateMdcOnFailure` | MDC userId null si auth échoue |

**Pattern : BDD Given/When/Then**
```java
@Test
@DisplayName("Incrémente la métrique auth_login_success_total")
void shouldIncrementLoginSuccessMetric() {
    // GIVEN
    given(authenticationManager.authenticate(any())).willReturn(authentication);
    given(authentication.getPrincipal()).willReturn(testUser);
    given(jwtTokenProvider.generateToken(any())).willReturn("token");

    // WHEN
    authService.login(new LoginRequest("admin@portfolio.dev", "Admin@2024!"));

    // THEN
    verify(metrics).incrementLoginSuccess();
    verify(metrics, never()).incrementLoginFailure();
}
```

### `ProjectServiceTest` — 8 tests

Classe sous test : `ProjectService`

| Groupe (`@Nested`) | Tests |
|--------------------|-------|
| `getProjectById()` | Retourne le projet si ID existe · Lance `ResourceNotFoundException` si absent |
| `createProject()` | Crée et retourne le projet · Délègue à `projectRepository.save()` |
| `deleteProject()` — soft delete | Archive (status=ARCHIVED) · Ne supprime JAMAIS (`deleteById` non appelé) · Lance exception si absent |

**Comportement clé testé : soft delete**
```java
@Test
@DisplayName("Archive le projet (soft delete) au lieu de le supprimer")
void shouldArchiveProjectInsteadOfDeleting() {
    // ...
    projectService.deleteProject(1L);
    assertThat(testProject.getStatus()).isEqualTo(ProjectStatus.ARCHIVED);
    verify(projectRepository).save(testProject);
    verify(projectRepository, never()).deleteById(any());   // JAMAIS de suppression physique
}
```

### `AuthControllerTest` + `ProjectControllerTest` — 14 tests

Tests de la couche HTTP avec `@WebMvcTest` (charge uniquement les controllers, pas la DB) :

| Aspect testé | Exemples |
|-------------|---------|
| Codes de statut HTTP | 200, 201, 400, 401, 404 |
| Sérialisation JSON | `response.data.token`, `response.success` |
| Validation des inputs | Email invalide → 400, payload manquant → 400 |
| Spring Security | Endpoint protégé sans token → 401 |

### `GlobalExceptionHandlerTest` — 5 tests

Vérifie que les exceptions Java sont correctement converties en réponses HTTP :

| Exception | Réponse HTTP attendue |
|-----------|----------------------|
| `ResourceNotFoundException` | 404 avec message |
| `BadCredentialsException` | 401 |
| `MethodArgumentNotValidException` | 400 avec détail des champs invalides |
| `Exception` (fallback) | 500 |

### `AppMetricsTest` — 7 tests

Tests avec `SimpleMeterRegistry` (pas de Prometheus, pas de Spring) :
```java
AppMetrics metrics = new AppMetrics(new SimpleMeterRegistry());
metrics.incrementLoginSuccess();
Counter counter = metricsRegistry.find("auth.login.success").counter();
assertThat(counter.count()).isEqualTo(1.0);
```

---

## 3. Tests d'intégration — Repository

### `ProjectIntegrationTest` — 3 tests

**Testcontainers** démarre un vrai PostgreSQL 15 dans Docker pour chaque classe de test.

| Test | Ce qui est vérifié |
|------|-------------------|
| `shouldSaveAndFindProject` | Flyway migrations appliquées, CRUD basique fonctionne |
| `shouldFindOnlyActiveProjects` | Query `findAllActiveWithSkills` filtre correctement par status |
| `shouldFindOnlyFeaturedProjects` | Query `findByFeaturedTrueAndStatus` fonctionne |

**Pourquoi Testcontainers et pas H2 :**
- H2 ne supporte pas toutes les extensions PostgreSQL (ex : `ILIKE`, types spéciaux)
- Les migrations Flyway sont testées sur un vrai moteur → pas de surprise en prod
- Les requêtes JPQL sont exécutées sur PostgreSQL réel

**Configuration dynamique du port container :**
```java
@DynamicPropertySource
static void configureProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    // Le port est aléatoire → pas de conflit avec un Postgres local
}
```

---

## 4. Coverage JaCoCo

### Lancement

```powershell
# Génère le rapport coverage + vérifie le seuil
mvn verify -f backend/pom.xml

# Rapport HTML : backend/target/site/jacoco/index.html
```

### Seuils configurés dans `pom.xml`

```xml
<rule>
  <element>BUNDLE</element>
  <limits>
    <limit>
      <counter>LINE</counter>
      <value>COVEREDRATIO</value>
      <minimum>0.70</minimum>  <!-- 70% de lignes couvertes -->
    </limit>
  </limits>
</rule>
```

### Exclusions JaCoCo

Certains packages sont exclus du calcul de coverage car non testables unitairement :

| Package exclu | Raison |
|--------------|--------|
| `*.entity.*` | Entités JPA — getters/setters Lombok, pas de logique |
| `*.dto.*` | Records Java — pas de logique |
| `*.config.*` | Configuration Spring — testée par les tests d'intégration |
| `*Application.java` | Point d'entrée — non testable unitairement |

---

## 5. Décisions techniques

### Pourquoi `@Nested` pour regrouper les tests ?

```java
@Nested @DisplayName("login() — Succès") class LoginSuccessTests { ... }
@Nested @DisplayName("login() — Échec")  class LoginFailureTests  { ... }
```

Les classes `@Nested` groupent les tests par cas d'usage dans les outils (IntelliJ, Maven Surefire, GitHub Actions). L'arbre de résultats est lisible : `AuthServiceTest > login() — Succès > Retourne un AuthResponse`.

### Pourquoi `@AfterEach` pour nettoyer le MDC ?

```java
@AfterEach
void tearDown() {
    MDC.clear();  // Obligatoire avec Java 21 Virtual Threads
}
```

Avec les Virtual Threads (Java 21), un thread peut être réutilisé entre les tests. Sans `MDC.clear()`, les valeurs `userId`/`requestId` d'un test contaminent le test suivant.

### Pourquoi `ReflectionTestUtils` pour les `@Value` ?

```java
ReflectionTestUtils.setField(authService, "jwtExpirationMs", 86400000L);
```

Les champs `@Value` sont injectés par Spring, absent avec `MockitoExtension`. `ReflectionTestUtils` permet d'injecter directement sans démarrer Spring.

---

## 6. Exécution

```powershell
# Tous les tests + coverage JaCoCo
mvn verify -f backend/pom.xml

# Tests unitaires uniquement (rapide, ~3s)
mvn test -f backend/pom.xml

# Tests d'intégration uniquement (nécessite Docker)
mvn verify -f backend/pom.xml -DskipTests=false -Dtest=none -Dit.test="**/*IT"

# Rapport de test : backend/target/surefire-reports/
# Rapport coverage : backend/target/site/jacoco/index.html
```

---

## 7. Fichiers créés / modifiés

| Fichier | Description |
|---------|-------------|
| `backend/src/test/.../AuthServiceTest.java` | 7 tests unitaires AuthService |
| `backend/src/test/.../ProjectServiceTest.java` | 8 tests unitaires ProjectService |
| `backend/src/test/.../AuthControllerTest.java` | Tests couche HTTP auth |
| `backend/src/test/.../ProjectControllerTest.java` | Tests couche HTTP projets |
| `backend/src/test/.../GlobalExceptionHandlerTest.java` | Tests gestion erreurs |
| `backend/src/test/.../AppMetricsTest.java` | Tests métriques Micrometer |
| `backend/src/test/.../ProjectIntegrationTest.java` | Tests intégration Testcontainers |
| `backend/pom.xml` | Plugin JaCoCo + Testcontainers BOM + seuil 70% |
