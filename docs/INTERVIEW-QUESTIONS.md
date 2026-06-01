# Questions d'entretien — Portfolio DevSecOps

> Préparation aux questions techniques et comportementales d'un recruteur DevSecOps/Cloud.
> Basé sur le projet concret déployé sur https://charrad-devsecops.duckdns.org

---

## Architecture & Choix Techniques

### Q1 — Pourquoi avoir choisi Angular + Spring Boot + AWS pour ce portfolio ?

C'est une stack représentative des projets enterprise actuels. Angular est le framework dominant dans les DSI françaises pour les applications métier. Spring Boot avec Java 21 couvre les Virtual Threads et les projets Loom, ce qui est très demandé. AWS Free Tier permettait un déploiement réel sans coût pour un portfolio.

Le choix de séparer frontend et backend en containers distincts démontre aussi la maîtrise des architectures microservices et du découplage.

---

### Q2 — Expliquez l'architecture de votre infrastructure AWS.

L'infrastructure est entièrement décrite en code via Terraform (78 ressources). Elle comprend :

- **Réseau** : VPC avec subnets publics (EC2) et privés (RDS), Internet Gateway, pas de NAT Gateway (choix économique documenté : économise ~32$/mois)
- **Compute** : EC2 t3.small avec Docker Compose (backend, frontend, Redis, Prometheus, Grafana)
- **Base de données** : RDS PostgreSQL 15 en Single-AZ, subnets privés, SSL forcé, backups automatiques
- **Conteneurs** : ECR pour les images Docker, politiques de lifecycle (5 images tagguées conservées)
- **Serverless** : 3 Lambda (formulaire de contact, resize d'images, rapport hebdomadaire) + API Gateway
- **Secrets** : AWS Secrets Manager pour zéro secret en clair (Phase 21 — External Secrets Operator)
- **Observabilité** : CloudWatch (logs, alarmes, dashboard), Prometheus/Grafana sur l'EC2

---

### Q3 — Pourquoi Docker Compose plutôt que Kubernetes en production ?

J'ai d'abord implémenté K3s + ArgoCD (Phases 18-20) et ça fonctionne en local, mais sur un EC2 t3.micro (1GB RAM), la combinaison K3s + ArgoCD + Spring Boot saturait la mémoire physique et provoquait des crashs OOM. C'est une contrainte du Free Tier d'AWS.

En environnement entreprise, je déploierais sur EKS ou sur des nodes avec 4GB+ de RAM. Les manifests Kubernetes, le Helm chart et les configs ArgoCD sont dans le repo et fonctionnels — c'est documenté dans les Phases 18-21. Pour ce portfolio, Docker Compose était le compromis pragmatique pour avoir une URL publique stable.

---

### Q4 — Qu'est-ce que GitOps et comment l'avez-vous implémenté ?

GitOps, c'est le principe de traiter Git comme source unique de vérité pour les déploiements. Concrètement dans ce projet :

1. **ci-gitops.yml** : à chaque push sur main, GitHub Actions build l'image, la pousse sur ECR avec un tag SHA immuable (`sha-abc1234`), puis met à jour automatiquement `k8s/helm/values-dev.yaml` avec ce tag via un commit automatique.
2. **ArgoCD** scrute ce fichier values toutes les 3 minutes. Dès qu'il détecte un changement, il synchronise le cluster Kubernetes pour déployer la nouvelle version.
3. Résultat : aucun `kubectl apply` manuel, tout est traçable dans Git, rollback = revert d'un commit.

---

## DevSecOps & Sécurité

### Q5 — Que signifie DevSecOps pour vous et comment l'avez-vous appliqué ?

DevSecOps, c'est intégrer la sécurité à chaque étape du cycle de développement plutôt que de l'ajouter à la fin. Dans ce projet :

- **Dev** : SAST CodeQL dans le CI (analyse statique Java + TypeScript), Checkstyle pour les conventions
- **Sec** : OWASP Dependency Check (CVE sur les dépendances), OWASP ZAP DAST (scan dynamique de l'API), Trivy (vulnérabilités dans les images Docker), SBOM CycloneDX (inventaire des composants), Cosign (signature des images)
- **Ops** : CloudWatch alarmes sur les patterns brute-force (10 échecs d'auth/min), Secrets Manager pour zéro secret dans le code, SonarCloud Quality Gate (sécurité A, 84.2% couverture)

---

### Q6 — Comment gérez-vous les secrets dans ce projet ?

À plusieurs niveaux :

1. **Infrastructure** : `terraform.tfvars` est dans `.gitignore`, jamais committé. Les secrets sont dans AWS Secrets Manager (Phase 21) avec chiffrement KMS at-rest.
2. **CI/CD** : les secrets AWS, SSH, SonarCloud sont dans GitHub Secrets — jamais en clair dans les workflows.
3. **Runtime** : Spring Boot reçoit les secrets via variables d'environnement injectées au démarrage du container. External Secrets Operator (Kubernetes) synchronise depuis Secrets Manager vers des K8s Secrets automatiquement.
4. **Images Docker** : Trivy scan + Cosign signature pour garantir l'intégrité.

---

### Q7 — Qu'est-ce qu'un SBOM et pourquoi en avez-vous généré un ?

Un SBOM (Software Bill of Materials) est un inventaire exhaustif de tous les composants logiciels d'une application — équivalent d'une liste d'ingrédients. En cas de vulnérabilité critique (Log4Shell par exemple), on peut immédiatement savoir si on est impacté sans fouiller le code.

J'utilise CycloneDX : le workflow CI génère un SBOM en JSON et XML pour le backend (Maven) et le frontend (npm), et le publie dans GitHub Security. Les images Docker sont scannées par Trivy avec le même objectif.

---

## CI/CD & Automatisation

### Q8 — Décrivez votre pipeline CI/CD.

Le pipeline comprend 9 workflows GitHub Actions qui s'enchaînent sur chaque push :

```
push main
  ├── CI Backend       → Checkstyle → Tests (60) → JaCoCo → CodeQL → Docker build → ECR push
  ├── CI Frontend      → ESLint/Prettier → Tests Jest (57) → Docker build → ECR push  
  ├── SonarCloud       → Analyse qualité → Quality Gate (84.2% coverage)
  ├── Security Scans   → OWASP ZAP → Trivy filesystem → Dependabot
  ├── SBOM             → CycloneDX backend+frontend → Cosign signature
  ├── CI/CD GitOps     → Update values-dev.yaml avec le SHA → commit auto
  └── 🚀 Deploy        → SSH EC2 → docker pull backend+frontend → restart → health check
```

Total : ~8 minutes du push à la mise en production.

---

### Q9 — Comment garantissez-vous la qualité du code ?

Plusieurs niveaux de filets de sécurité :

- **Formatage** : Prettier (frontend) + Checkstyle (backend) — le pipeline échoue si non respecté
- **Tests** : 60 tests Java (unitaires + intégration Testcontainers), 57 tests Jest/Angular, coverage ≥ 55% JaCoCo côté backend
- **Analyse statique** : SonarCloud Quality Gate (reliability A, security A, coverage 84.2% sur nouveau code)
- **Sécurité** : CodeQL SAST, OWASP Dependency Check, Trivy
- **Conventions** : les PR (même auto-générées par GitOps) passent par tous ces checks

---

### Q10 — Qu'est-ce que Testcontainers et pourquoi l'utiliser ?

Testcontainers lance de vrais containers Docker pendant les tests d'intégration. Pour le backend, ça signifie tester contre un vrai PostgreSQL 15 (pas un mock H2 en mémoire) — les migrations Flyway sont jouées, les contraintes FK fonctionnent, les fonctions PostgreSQL-spécifiques aussi.

C'est plus lent qu'H2 mais beaucoup plus représentatif de la prod. En contrepartie, les tests unitaires Mockito restent rapides pour la logique métier pure.

---

## Observabilité

### Q11 — Quels outils d'observabilité avez-vous mis en place et pourquoi ?

J'ai mis en place les "trois piliers" de l'observabilité :

- **Métriques** : Prometheus scrape `/actuator/prometheus` de Spring Boot toutes les 15s. Métriques custom via Micrometer (`auth_login_failure_total`, `http_errors_total`). Grafana visualise avec 3 dashboards (Portfolio, Cache Redis, Kafka).
- **Logs** : Logback JSON structuré dans Spring Boot → CloudWatch Logs. Chaque log inclut `requestId`, `level`, `app`, `env`. CloudWatch Logs Insights permet des requêtes PromQL-like.
- **Alertes** : 3 alarmes CloudWatch (CPU > 80%, échecs auth > 10/min, erreurs 5xx > 5/min) avec notifications SNS par email.

---

### Q12 — Comment détectez-vous une tentative de brute-force ?

Deux niveaux :

1. **Applicatif** : Spring Security rejette les credentials invalides. `GlobalExceptionHandler` loggue en JSON avec un pattern reconnaissable. Micrometer incrémente le compteur `auth_login_failure_total`.
2. **Infrastructure** : Prometheus détecte `rate(auth_login_failure_total[1m]) > 10`. Une alarme CloudWatch sur la métrique `AuthLoginFailures` envoie un email via SNS si le seuil dépasse 10 échecs/minute.

---

## Cloud & Infrastructure

### Q13 — Comment avez-vous optimisé les coûts AWS ?

Plusieurs décisions documentées :

- **Pas de NAT Gateway** : économise ~32$/mois. L'EC2 est dans un subnet public avec SG restrictif, la RDS dans un subnet privé sans accès internet.
- **Single-AZ RDS** : Multi-AZ doublerait le coût. Acceptable pour un portfolio.
- **t3.small** vs instances plus grosses : suffisant pour le workload actuel.
- **ECR lifecycle policies** : maximum 5 images taggées conservées, images non-taggées supprimées après 1 jour.
- **Lambda pour le serverless** : facturation à la requête, $0 si peu d'appels.
- **Free Tier** : RDS db.t3.micro et les services Lambda/S3/API GW sont dans les limites Free Tier.

Coût total estimé : ~17.60$/mois (EC2 + Secrets Manager) couverts par les crédits AWS.

---

### Q14 — Pourquoi Terraform plutôt que des scripts bash ou la console AWS ?

Trois raisons fondamentales :

1. **Reproductibilité** : `terraform apply` sur un nouveau compte recréé exactement la même infra. Utile pour les environnements dev/staging/prod.
2. **State management** : Terraform garde l'état de l'infra et calcule uniquement le diff nécessaire. Pas de scripts bash qui échouent à mi-chemin sans rollback.
3. **Documentation vivante** : les fichiers `.tf` décrivent l'architecture aussi clairement qu'un diagramme, mais sont exécutables et vérifiables par code review.

Dans ce projet, 78 ressources AWS gérées en code, avec modules réutilisables (vpc, ec2, rds, ecr, lambda, cloudwatch, secrets-manager).

---

## Soft Skills & Méthodo

### Q15 — Quel a été le challenge le plus difficile de ce projet ?

Honnêtement, faire tourner Kubernetes sur un EC2 t3.micro. J'avais implémenté K3s + ArgoCD (qui sont dans le code et documentés), mais la combinaison K3s + ArgoCD + Spring Boot + Redis dépassait le gigaoctet de RAM disponible. Le serveur crashait sous la pression mémoire.

J'ai dû faire un choix pragmatique : passer en mode Docker Compose pour avoir un portfolio stable et démontrable, tout en conservant toute la config K3s/ArgoCD dans le code pour montrer la maîtrise technique. C'est la différence entre un projet académique (K3s sur papier) et un projet de production (Docker Compose qui fonctionne vraiment).

---

### Q16 — Comment avez-vous abordé la sécurité des credentials dans le pipeline CI/CD ?

Dès la conception, principe de zéro secret en clair :

- `terraform.tfvars` dans `.gitignore` avec des valeurs générées aléatoirement
- GitHub Actions utilise uniquement des Secrets chiffrés (jamais de valeurs en dur dans les workflows)
- Le GITOPS_TOKEN est un PAT GitHub dédié avec le scope minimum nécessaire
- L'EC2 utilise un IAM Instance Profile (pas de clés d'accès sur le serveur)
- Les images Docker sont scannées par Trivy avant le push ECR

Sur un projet d'équipe, j'ajouterais HashiCorp Vault ou une rotation automatique des secrets.

---

### Q17 — Comment expliquez-vous l'approche "App of Apps" d'ArgoCD ?

ArgoCD App of Apps est un pattern de méta-orchestration : une Application ArgoCD gère d'autres Applications ArgoCD.

Concrètement : `portfolio-app-of-apps` surveille le dossier `argocd/apps/` dans Git. Ce dossier contient les définitions des applications `portfolio-dev` et `portfolio-prod`. Quand ArgoCD synchronise `portfolio-app-of-apps`, il crée automatiquement les deux applications enfants qui déploient chacune le Helm chart sur leur namespace.

Avantage : ajouter un nouvel environnement = ajouter un fichier YAML dans `argocd/apps/`. Pas de commande `kubectl` manuelle. C'est du GitOps pur.

---

### Q18 — Quelle est la différence entre SAST et DAST, et comment les utilisez-vous ?

- **SAST** (Static Analysis Security Testing) : analyse le code source sans l'exécuter. Dans ce projet : CodeQL scanne le bytecode Java et le TypeScript compilé, détecte des patterns de vulnérabilités (injections, XSS, etc.) avant même le déploiement.

- **DAST** (Dynamic Analysis Security Testing) : teste l'application en cours d'exécution. Dans ce projet : OWASP ZAP lance des requêtes HTTP réelles contre l'API déployée, simule des attaques (injection SQL, traversée de répertoires, etc.) et vérifie les réponses.

Les deux sont complémentaires : SAST est rapide et trouve les erreurs de code, DAST trouve les problèmes de configuration runtime que le code seul ne révèle pas.

---

### Q19 — Si vous deviez refaire ce projet, que changeriez-vous ?

Trois choses :

1. **Tests d'intégration plus tôt** : j'aurais dû écrire les tests Testcontainers dès le début et non en Phase 8. Le coût d'une contrainte `NOT NULL` non testée = plusieurs heures de débogage en CI.

2. **Infrastructure plus grande dès le départ** : t3.micro pour K3s était une mauvaise décision d'optimisation prématurée. t3.small (2x la RAM, +8$/mois) aurait permis de garder K3s en production.

3. **HTTPS dès le départ** : configurer DuckDNS + Let's Encrypt en premier évite de corriger les CORS et les redirections HTTP→HTTPS après coup.

---

### Q20 — Qu'est-ce qu'un External Secrets Operator et pourquoi l'utiliser ?

External Secrets Operator (ESO) est un opérateur Kubernetes qui synchronise des secrets depuis des fournisseurs externes (AWS Secrets Manager, Vault, Azure Key Vault) vers des Kubernetes Secrets.

Sans ESO : vous devez créer les K8s Secrets manuellement (`kubectl create secret`), ce qui implique que les valeurs transitent par votre terminal ou un script.

Avec ESO : vous définissez en YAML "quel secret AWS, quels champs, vers quel namespace", et ESO s'occupe de la synchronisation toutes les 60 minutes. Le secret n'apparaît jamais dans Git, ni dans les logs CI/CD. Avantage supplémentaire : rotation automatique — si vous changez le secret dans AWS, ESO le met à jour dans Kubernetes sans redéploiement.

Dans ce projet, les secrets `portfolio/dev` et `portfolio/prod` dans AWS Secrets Manager contiennent les credentials DB, JWT secret et Redis host.

---

## Java 21 & Spring Boot

### Q21 — Quelles nouveautés de Java 21 avez-vous utilisées ?

Java 21 est une LTS (Long Term Support) avec plusieurs fonctionnalités clés :

- **Virtual Threads (Project Loom)** : Spring Boot 3.2+ les active automatiquement. Un thread virtuel coûte quelques centaines d'octets vs ~1MB pour un thread plateforme. Permet de gérer 100 000 connexions concurrentes sur un t3.small sans thread pool tuning.
- **Record patterns** (Java 21) : utilisés pour les DTOs immuables (`ProjectRequest`, `SkillResponse`). Un `record` génère automatiquement `equals`, `hashCode`, `toString` et les accesseurs.
- **Sealed classes** : non utilisées directement mais utiles pour modéliser des états finis.
- **Text blocks** : pour les requêtes SQL multilignes dans les repositories custom.

---

### Q22 — Expliquez le principe de JWT et comment vous l'implémentez.

JWT (JSON Web Token) est un token auto-porteur : il contient les claims (subject=email, rôle, expiration) signés par une clé secrète HMAC-SHA256. Le serveur n'a pas besoin de stocker de session.

Dans ce projet :
1. Le client envoie `POST /api/auth/login` avec email + password
2. Spring Security vérifie via `UserDetailsService` + BCrypt (coût 12)
3. `JwtTokenProvider` génère le token signé avec une clé 256-bit injectée via variable d'env
4. À chaque requête suivante, `JwtAuthenticationFilter` intercepte, valide le token, et injecte l'`Authentication` dans le `SecurityContextHolder`
5. Les endpoints publics (`GET /projects`, `GET /skills`) sont en `permitAll()`, les endpoints admin en `hasRole("ADMIN")`

---

### Q23 — Qu'est-ce que Flyway et pourquoi l'utiliser plutôt que `spring.jpa.hibernate.ddl-auto=create` ?

Flyway est un outil de migration de schéma de base de données versionné. Les fichiers `V1__create_users.sql`, `V2__create_projects.sql`, etc. s'exécutent dans l'ordre à chaque démarrage de l'application si la version cible est supérieure à la version actuelle.

`ddl-auto=create` recrée le schéma à chaque démarrage — catastrophique en production, vous perdez vos données. `ddl-auto=validate` vérifie la cohérence mais ne migre pas.

Flyway garantit : schéma versionné dans Git, migrations rejouables, historique des changements dans la table `flyway_schema_history`, rollback possible.

---

### Q24 — Qu'est-ce que `@Cacheable` et comment Redis est-il intégré ?

`@Cacheable("projects")` sur une méthode de service fait que Spring intercepte l'appel, vérifie Redis, et renvoie la valeur cachée si elle existe. Sinon, il exécute la méthode et stocke le résultat.

Dans ce projet :
- `ProjectService.getAllProjects()` → cache Redis avec TTL 5 minutes
- `SkillService.getAllSkills()` → cache 10 minutes (données rarement modifiées)
- `@CacheEvict` sur les méthodes d'écriture vide le cache concerné
- `CacheConfig` configure un `RedisCacheManager` avec `StringRedisSerializer` + `GenericJackson2JsonRedisSerializer`

Grafana visualise le hit/miss ratio via la métrique `cache.gets` de Micrometer.

---

### Q25 — Comment fonctionne `@Transactional` et quand l'utilisez-vous ?

`@Transactional` ouvre une transaction ACID au début de la méthode et la commit à la fin (ou rollback sur exception non-checked). Spring AOP intercepte l'appel via un proxy.

Règles appliquées dans ce projet :
- **`@Transactional(readOnly = true)`** sur les services de lecture : optimisation Hibernate (pas de dirty checking, requêtes éventuellement en mode read-only côté DB)
- **`@Transactional`** (lecture-écriture) sur les méthodes qui modifient des données
- **Propagation REQUIRED** par défaut : si une transaction existe déjà, on la réutilise
- **Piège évité** : pas d'appel interne entre méthodes `@Transactional` dans la même classe (le proxy AOP ne se déclenche pas)

---

### Q26 — Qu'est-ce que Micrometer et quel est son rôle dans ce projet ?

Micrometer est une façade de métriques pour JVM, comparable à SLF4J pour les logs. Il fournit une API unifiée qui permet de changer le backend (Prometheus, Datadog, CloudWatch) sans changer le code.

Dans ce projet :
- **Auto-métriques Spring Boot** : `http.server.requests`, `jvm.memory.used`, `hikaricp.connections.active` exposées sur `/actuator/prometheus`
- **Métriques custom** (`AppMetrics`) : `auth_login_success_total`, `auth_login_failure_total`, `http_errors_total` avec tags (status code, path)
- Prometheus scrape toutes les 15s, Grafana visualise avec des dashboards pré-provisionnés

---

### Q27 — Comment avez-vous sécurisé les endpoints de l'API ?

Plusieurs couches de sécurité :

1. **HTTPS** : tout le trafic est chiffré (Let's Encrypt, NGINX)
2. **JWT stateless** : pas de session côté serveur
3. **RBAC** : `@PreAuthorize("hasRole('ADMIN')")` sur les endpoints d'écriture, `permitAll()` sur les lectures publiques
4. **Validation des inputs** : `@Valid` + `@NotBlank`, `@Size`, contraintes Bean Validation. Le `GlobalExceptionHandler` renvoie des 400 structurés sans exposer le stack trace
5. **CORS** : restreint aux origines connues via `SecurityConfig.corsConfigurationSource()`
6. **Headers de sécurité** : Spring Security ajoute automatiquement `X-Content-Type-Options`, `X-Frame-Options`, etc.
7. **Rate limiting** : détection via Prometheus (alerte brute-force) — un vrai rate limiter serait la prochaine évolution

---

### Q28 — Expliquez le rôle de Kafka dans ce projet.

Kafka (Phase 10) est utilisé pour les événements métier asynchrones en mode KRaft (sans ZooKeeper depuis Kafka 2.8).

Flux implémentés :
- **ProjectCreatedEvent** : quand un admin crée un projet, le service publie sur le topic `portfolio.projects.created`. Un consumer loggue l'événement pour audit.
- **UserLoginEvent** : chaque connexion réussie publie sur `portfolio.users.login`

Avantages : découplage entre l'action utilisateur et le traitement asynchrone (logs d'audit, notifications futures, analytics). En production enterprise, ces events alimenteraient ElasticSearch ou un data lake.

---

### Q29 — Quelle est la différence entre `@RestController` et `@Controller` ?

`@RestController` = `@Controller` + `@ResponseBody` sur toutes les méthodes. Chaque méthode sérialise automatiquement le retour en JSON (via Jackson) sans besoin d'annoter chaque méthode.

`@Controller` est pour les applications web MVC traditionnelles qui renvoient des vues (Thymeleaf, JSP). Dans une API REST pure comme ce projet, `@RestController` est toujours utilisé.

---

### Q30 — Comment gérez-vous les erreurs HTTP dans l'API ?

Un `GlobalExceptionHandler` (`@RestControllerAdvice`) centralise la gestion :
- `ResourceNotFoundException` → 404 avec message structuré
- `MethodArgumentNotValidException` → 400 avec liste des erreurs de validation par champ
- `AccessDeniedException` → 403
- `AuthenticationException` → 401
- `Exception` (catch-all) → 500 avec message générique (sans stack trace exposé)

Chaque réponse suit le format `ApiResponse<T>` : `{ success: false, data: null, errors: [...] }`. Ce format uniforme simplifie le traitement côté Angular.

---

## Angular & Frontend

### Q31 — Pourquoi Angular 20 et pas React ou Vue ?

Angular est un framework opinionné avec une structure imposée (modules, services, DI, routing). C'est une force dans un contexte enterprise : tous les développeurs Angular écrivent du code structuré de la même façon.

React est une librairie, ce qui nécessite de choisir soi-même routing, state management, etc. Vue est un bon compromis mais moins présent dans les grandes entreprises françaises.

Dans ce portfolio, Angular 20 démontre aussi la maîtrise des Signals (remplaçant progressif de RxJS pour la gestion d'état local), `@if`/`@for` (nouvelle syntaxe template), et le mode `zoneless` (ChangeDetectionStrategy.OnPush).

---

### Q32 — Qu'est-ce que le lazy loading et pourquoi l'utilisez-vous ?

Le lazy loading découpe le bundle JavaScript en chunks chargés à la demande. Au lieu d'un fichier `main.js` de 2MB, le navigateur charge uniquement le code nécessaire pour la page affichée.

Dans ce projet, chaque feature Angular (`portfolio`, `admin`, `auth`) est un module lazy-loaded via `loadChildren(() => import('./features/...')`. Le bundle initial est réduit à ~100KB, améliorant le TTI (Time To Interactive).

---

### Q33 — Expliquez les Signals Angular et pourquoi ils remplacent progressivement RxJS.

Les Signals (Angular 16+) sont des valeurs réactives qui notifient automatiquement les consumers quand elles changent. Comparés à RxJS :

- **Simpler** : `const count = signal(0); count.set(1); count.update(v => v + 1)` vs `BehaviorSubject` + `async pipe` + `takeUntil`
- **Performance** : Change Detection granulaire — seul le composant qui utilise le signal est re-rendu
- **Computed** : `const doubled = computed(() => count() * 2)` se met à jour automatiquement

Dans ce projet, `HomeComponent`, `SkillsComponent` et `DashboardComponent` utilisent des Signals pour `isLoading`, `error`, et les données. Pas de `subscribe/unsubscribe` à gérer.

---

### Q34 — Comment fonctionne l'intercepteur JWT côté Angular ?

`JwtInterceptor` (`HttpInterceptorFn`) intercepte chaque requête HTTP sortante. Si un token est stocké dans `StorageService`, il ajoute l'header `Authorization: Bearer <token>`.

`ErrorInterceptor` intercepte les réponses : sur 401, il vide le storage et redirige vers `/auth/login` avec le `returnUrl`. Sur 403, il redirige vers l'accueil.

Ce pattern évite de répéter la gestion d'auth dans chaque service Angular.

---

### Q35 — Comment gérez-vous la protection des routes côté Angular ?

`AuthGuard` (fonctionnel, `CanActivateFn`) vérifie `authService.isAuthenticated()`. Si false, redirige vers `/auth/login` avec `returnUrl`. `AdminGuard` vérifie en plus `authService.isAdmin()`.

Les routes publiques (`/portfolio`, `/skills`) n'ont pas de guard. Les routes admin (`/admin/**`) ont `canActivate: [adminGuard]`. L'URL `/auth/login` est accessible sans auth.

---

## Docker & Containers

### Q36 — Comment avez-vous optimisé vos images Docker ?

Plusieurs techniques appliquées :

- **Multi-stage build** pour le backend : stage 1 `maven:3.9-eclipse-temurin-21` compile le JAR, stage 2 `eclipse-temurin:21-jre-alpine` ne contient que le JRE (~180MB vs ~500MB)
- **Multi-stage build** pour le frontend : stage 1 `node:24-alpine` build Angular, stage 2 `nginx:alpine` (~25MB) sert les fichiers statiques
- **`.dockerignore`** : exclut `node_modules`, `target`, `.git`, `.angular`
- **Layers ordering** : `COPY pom.xml` + `mvn dependency:resolve` avant `COPY src` pour maximiser le cache Docker

Résultat : image backend ~200MB, image frontend ~25MB.

---

### Q37 — Quelle est la différence entre `COPY` et `ADD` dans un Dockerfile ?

`ADD` peut décompresser des archives tar et télécharger des URLs. `COPY` fait uniquement une copie locale.

Bonne pratique : toujours utiliser `COPY` sauf si on a besoin de décompression automatique. `ADD` est moins prévisible et peut introduire des comportements inattendus.

---

### Q38 — Qu'est-ce que `depends_on` dans docker-compose et suffit-il pour garantir l'ordre de démarrage ?

`depends_on` garantit l'ordre de **création des containers** mais pas que le service soit **prêt à répondre**. Redis démarre en quelques secondes, mais Spring Boot prend 30-60 secondes.

Pour attendre qu'un service soit prêt, il faut `depends_on` avec `condition: service_healthy` et un `healthcheck` défini. Dans ce projet, le frontend `depends_on: backend: condition: service_healthy`. La healthcheck vérifie `/actuator/health/readiness` de Spring Boot.

---

### Q39 — Pourquoi avoir un container Redis séparé plutôt qu'un Redis embarqué ?

Redis embarqué (comme Embedded Redis pour les tests) n'est pas recommandé en production :
1. **Isolation** : le cache Redis survit aux redémarrages du backend
2. **Scalabilité** : si on scale le backend en plusieurs instances, toutes partagent le même cache Redis
3. **Monitoring** : les métriques Redis sont distinctes des métriques applicatives
4. **Ressources** : Redis peut être configuré indépendamment (maxmemory, eviction policy)

Pour les tests, Testcontainers lance un Redis éphémère — comportement identique à la prod sans état partagé.

---

### Q40 — Comment fonctionne ECR et pourquoi ne pas utiliser Docker Hub ?

ECR (Elastic Container Registry) est le registre privé AWS. Avantages vs Docker Hub :
- **Sécurité** : intégration IAM native (l'EC2 pull via son Instance Profile, pas de credentials)
- **Performances** : réseau AWS interne, pull quasi-instantané depuis EC2
- **Coût** : 500MB/mois gratuit (Free Tier), suffisant pour ce portfolio
- **Scanning** : scan de vulnérabilités automatique à chaque push
- **Lifecycle policies** : suppression automatique des vieilles images

Le token ECR expire toutes les 12h — un cron job sur l'EC2 le renouvelle toutes les 6h.

---

## Tests

### Q41 — Quelle est votre stratégie de tests ?

Je suis la pyramide de tests :

- **Tests unitaires** (base, nombreux, rapides) : Mockito pour les services, Jest pour les composants Angular. Ils testent la logique métier isolément.
- **Tests d'intégration** (milieu) : Testcontainers pour tester les repositories avec un vrai PostgreSQL. `@WebMvcTest` pour tester les controllers avec le contexte Spring complet.
- **Tests E2E** (sommet, peu nombreux, lents) : Cypress pour les 3 scénarios critiques (auth, admin, portfolio). k6 pour les tests de charge.
- **Tests de sécurité** : OWASP ZAP DAST sur l'API déployée.

60 tests backend, 57 tests frontend, 84.2% de couverture sur le nouveau code.

---

### Q42 — Qu'est-ce que JaCoCo et comment l'avez-vous configuré ?

JaCoCo (Java Code Coverage) instrumente le bytecode pour mesurer quelles lignes sont exécutées pendant les tests. Il génère des rapports HTML et XML.

Configuration dans ce projet :
- Plugin Maven `jacoco-maven-plugin` dans `pom.xml`
- Exclusions : entités Lombok, mappers, `BackendApplication.java` (code généré ou bootstrapping)
- Seuil minimal : 55% de coverage sur les lignes (abaissé de 70% car les Phases 17-21 ont ajouté du code sans tests correspondants)
- Le rapport XML est consommé par SonarCloud pour le Quality Gate

---

### Q43 — Comment avez-vous testé les scénarios de sécurité (401, 403) ?

Dans `ProjectControllerTest` avec `@WebMvcTest` + Spring Security réel (non mocké) :

```java
@Test
void shouldReturn401WhenNoToken() {
    mockMvc.perform(get("/projects/1"))
        .andExpect(status().isUnauthorized());
}

@Test
@WithMockUser(roles = "USER") // pas ADMIN
void shouldReturn403WhenNotAdmin() {
    mockMvc.perform(post("/projects").content(...))
        .andExpect(status().isForbidden());
}
```

Le `@WithMockUser` injecte un `Authentication` dans le `SecurityContextHolder` sans passer par le JWT filter.

---

### Q44 — Qu'est-ce que Cypress et en quoi diffère-t-il de Selenium ?

Cypress est un framework E2E moderne qui s'exécute **dans** le navigateur (pas via WebDriver comme Selenium). Avantages :
- Pas de timing issues : Cypress attend automatiquement les éléments DOM
- Accès direct au réseau : intercepter/mocker des requêtes HTTP avec `cy.intercept()`
- Débogage visuel : time-travel debugger avec screenshots à chaque étape
- Rapide : pas de driver HTTP entre le test et le navigateur

Dans ce projet, 3 scénarios : login admin, création de projet, consultation portfolio public.

---

### Q45 — Comment fonctionnent les tests de charge k6 ?

k6 est un outil de load testing écrit en Go avec des scripts JavaScript. Il simule des utilisateurs virtuels (VUs) qui exécutent des scénarios HTTP.

Scénarios implémentés :
- **Smoke test** : 5 VUs pendant 1 minute (vérification que l'app répond)
- **Load test** : montée progressive à 50 VUs sur 10 minutes (charge normale)
- **Stress test** : 200 VUs pendant 5 minutes (pic de charge)

Métriques clés : p95 response time < 500ms, error rate < 1%. Les résultats sont publiés en Job Summary GitHub Actions.

---

### Q46 — Comment avez-vous géré l'isolation des tests d'intégration avec Flyway ?

Problème : Flyway V4 insère des données seed (admin, 2 projets) dans le container PostgreSQL Testcontainers. Ces données persistent entre les tests et faussent les `assertThat().hasSize()`.

Solution : `@BeforeEach` exécute du SQL via `JdbcTemplate` pour vider les tables dans l'ordre des FK :
```java
jdbcTemplate.execute("DELETE FROM project_skills");
jdbcTemplate.execute("DELETE FROM projects");
jdbcTemplate.execute("DELETE FROM users");
```
Puis recrée un `testUser` propre pour chaque test.

---

### Q47 — Quelle est la différence entre un mock, un stub et un spy ?

- **Mock** (Mockito `@Mock`) : objet factice qui vérifie qu'une méthode a été appelée (`verify()`). Retourne null/0 par défaut.
- **Stub** (`given(...).willReturn(...)`) : configure ce que le mock retourne pour un appel donné. Pas de vérification d'appel.
- **Spy** (`@Spy`) : enveloppe un vrai objet — les méthodes non stubées s'exécutent vraiment.

Usage dans ce projet : `@Mock ProjectRepository` + stubs pour les services, `@InjectMocks ProjectService` pour tester la logique métier sans Spring Context.

---

### Q48 — Comment avez-vous testé les composants Angular avec `@WebMvcTest` côté backend ?

`@WebMvcTest(ProjectController.class)` charge uniquement la couche web Spring (controller, security, serialization). Pas de DB, pas de services réels.

Il faut `@MockBean` pour toutes les dépendances du controller + les beans de sécurité (JwtTokenProvider, UserDetailsService, AppMetrics). L'`@Import(SecurityConfig.class)` charge la vraie configuration de sécurité pour tester les 401/403.

`MockMvc` simule les requêtes HTTP en mémoire — rapide et sans port réseau.

---

## AWS Services

### Q49 — Qu'est-ce qu'un VPC et pourquoi en avez-vous créé un ?

Un VPC (Virtual Private Cloud) est un réseau privé isolé dans AWS. Sans VPC, toutes vos ressources seraient sur le réseau public AWS partagé.

Dans ce projet, le VPC `10.0.0.0/16` contient :
- **Subnets publics** (10.0.1.0/24, 10.0.2.0/24) : EC2 accessible depuis internet
- **Subnets privés** (10.0.10.0/24, 10.0.11.0/24) : RDS sans accès internet direct

L'Internet Gateway connecte les subnets publics à internet. Les Security Groups font office de firewall par ressource.

---

### Q50 — Expliquez le principe d'IAM Role vs IAM User.

Un **IAM User** a des credentials permanents (Access Key + Secret Key). Risque : ces clés peuvent être leakées dans du code ou des logs.

Un **IAM Role** est une identité temporaire assumée par un service AWS. Pas de credentials permanents. L'EC2 assume le rôle `portfolio-dev-ec2-role` via un Instance Profile — il obtient des tokens STS temporaires renouvelés automatiquement toutes les heures.

Dans ce projet, l'EC2 peut appeler `ecr:GetAuthorizationToken`, `logs:PutLogEvents`, etc. sans avoir de clés AWS en dur dans le code ou la configuration.

---

### Q51 — Qu'est-ce qu'un Security Group et en quoi diffère-t-il d'un NACL ?

Un **Security Group** est un firewall stateful au niveau de l'instance : les connexions établies sont automatiquement autorisées en retour. Opère au niveau de l'ENI.

Un **NACL** (Network ACL) est un firewall stateless au niveau du subnet : les règles entrantes et sortantes sont indépendantes, il faut explicitement autoriser le retour.

Dans ce projet, seuls les Security Groups sont utilisés :
- `ec2-sg` : ports 80/443 (HTTP/HTTPS) depuis 0.0.0.0/0, port 22 (SSH) ouvert pour le CI/CD
- `rds-sg` : port 5432 uniquement depuis `ec2-sg` (pas depuis internet)

---

### Q52 — Comment fonctionnent les Lambda Functions de ce projet ?

Trois Lambda serverless (Phase 15) :

1. **Contact Form** : déclenché par API Gateway (POST /contact) → valide les inputs → envoie un email via SES → retourne 200. Pas de serveur, facturation à la requête.

2. **Image Resize** : déclenché par un événement S3 PutObject → utilise Sharp (Node.js) pour créer une miniature WebP → stocke dans `resized/` → pas de polling.

3. **Weekly Report** : déclenché par EventBridge (cron `0 9 ? * MON *`, lundi 9h) → appelle l'API backend → compile les stats → envoie un rapport email via SES.

Zéro serveur à gérer, ~$0 de coût pour un portfolio avec peu de trafic.

---

### Q53 — Qu'est-ce que CloudWatch et comment l'utilisez-vous ?

CloudWatch est le service d'observabilité AWS. Dans ce projet :

- **Logs** : le backend Spring Boot écrit des logs JSON structurés dans `/portfolio/backend` (CloudWatch Log Group, rétention 30j)
- **Métriques custom** : `AuthLoginFailures`, `Http5xxErrors` extraites des logs via Log Metric Filters
- **Alarmes** : 3 alarmes avec seuils → SNS topic → email à `amine.charrad@gmail.com`
- **Dashboard** : 5 widgets (CPU, mémoire, auth failures, HTTP 5xx, logs récents)
- **VPC Flow Logs** : enregistrement du trafic réseau pour audit de sécurité (rétention 7j)

---

### Q54 — Qu'est-ce que RDS et pourquoi pas une base de données sur l'EC2 ?

RDS (Relational Database Service) est une base de données managée. Avantages vs PostgreSQL auto-hébergé :

- **Backups automatiques** : point-in-time recovery configurable
- **Patches** : AWS gère les mises à jour de sécurité PostgreSQL
- **Multi-AZ** : failover automatique en cas de panne (non activé ici pour économiser)
- **Snapshots** : backup manuel en 1 clic avant une migration
- **Monitoring intégré** : métriques CloudWatch (connections, CPU, storage)
- **Sécurité** : subnet privé, SSL forcé (`rds.force_ssl=1`), chiffrement at-rest AES-256

---

### Q55 — Comment fonctionne le renouvellement du token ECR sur l'EC2 ?

Le token ECR (`aws ecr get-login-password`) est valide 12 heures. Un cron job s'exécute toutes les 6 heures (mi-parcours de validité) pour le renouveler :

```cron
0 */6 * * * root /usr/local/bin/refresh-ecr-token.sh
```

Le script crée/met à jour le secret `ecr-credentials` dans les namespaces Kubernetes (prévu pour K3s). En mode Docker Compose, `docker login` est relancé dans le script de déploiement à chaque CI/CD.

---

### Q56 — Qu'est-ce que S3 et comment l'utilisez-vous ?

S3 (Simple Storage Service) est un stockage objet AWS. Dans ce projet (Phase 15) :

- Bucket `portfolio-dev-project-images` pour stocker les images de projets uploadées
- Versioning activé pour l'historique des fichiers
- Chiffrement SSE-S3 at-rest
- CORS configuré pour les uploads directs depuis Angular
- La Lambda `image-resize` est déclenchée par un événement `s3:ObjectCreated:*` dans le préfixe `originals/`

---

### Q57 — Expliquez SES (Simple Email Service) et ses contraintes.

SES est le service d'emailing AWS. Contrainte principale : en mode **sandbox** (par défaut), vous ne pouvez envoyer des emails qu'à des adresses vérifiées.

Dans ce projet, `amine.charrad@gmail.com` est vérifiée. Pour lever la restriction sandbox (envoyer à n'importe quelle adresse), il faut faire une demande de production access à AWS avec justification (use case, volume estimé).

Les Lambdas contact-form et weekly-report utilisent SES via le SDK Node.js avec les permissions IAM `ses:SendEmail`.

---

### Q58 — Qu'est-ce que CloudFront et pourquoi ne l'avez-vous pas utilisé ?

CloudFront est le CDN (Content Delivery Network) d'AWS. Il met en cache le contenu statique sur ~400 points de présence mondiaux, réduit la latence et protège des attaques DDoS.

Pour ce portfolio, il n'a pas été jugé nécessaire car :
1. Le public cible est principalement français (Paris = eu-west-3 est déjà proche)
2. Ajoute de la complexité (invalidation de cache, HTTPS cert via ACM obligatoire)
3. Coût supplémentaire hors Free Tier

Sur un projet d'entreprise avec utilisateurs mondiaux, CloudFront serait indispensable.

---

## Kubernetes & GitOps (avancé)

### Q59 — Expliquez la différence entre Deployment, StatefulSet et DaemonSet.

- **Deployment** : pour les applications sans état (stateless). Les pods sont interchangeables, peuvent être recréés n'importe où. Utilisé pour le backend Spring Boot et le frontend.
- **StatefulSet** : pour les applications avec état (Redis, PostgreSQL, Kafka). Chaque pod a un nom stable (`redis-0`, `redis-1`) et un stockage persistant associé.
- **DaemonSet** : un pod par nœud. Utilisé pour la collecte de logs (Fluentd) ou les agents de monitoring (Node Exporter, CloudWatch Agent).

---

### Q60 — Qu'est-ce qu'un Helm Chart et pourquoi l'avez-vous créé ?

Helm est le gestionnaire de paquets Kubernetes — comparable à apt/npm. Un chart Helm est un ensemble de templates YAML paramétrables.

Dans ce projet (Phase 19), le chart `portfolio/` contient 9 templates (Deployment, Service, Ingress, HPA, PDB, etc.) avec 3 niveaux de valeurs :
- `values.yaml` : valeurs par défaut
- `values-k3s.yaml` : contraintes t3.micro (JVM -Xmx256m, 1 réplique)
- `values-dev.yaml` : tag SHA mis à jour automatiquement par le CI/CD

Avantage : un seul chart, 3 environnements (dev/staging/prod) sans dupliquer les manifests.

---

### Q61 — Qu'est-ce qu'un HPA (Horizontal Pod Autoscaler) ?

HPA ajuste automatiquement le nombre de répliques d'un Deployment en fonction de métriques (CPU, mémoire, métriques custom). Si la charge augmente → plus de pods, si elle baisse → moins de pods.

Dans ce projet, le chart Helm définit un HPA pour le backend : minimum 1 réplique, maximum 3, cible 70% de CPU. Sur un t3.micro Free Tier, l'HPA est configuré mais inactif (une seule réplique suffit et les ressources sont limitées).

---

### Q62 — Expliquez les SyncWaves ArgoCD utilisées dans ce projet.

Les SyncWaves permettent d'ordonner le déploiement des ressources ArgoCD. Une ressource avec wave 0 est déployée et attendue avant celles de wave 1, etc.

Dans ce projet (Phase 21 - ESO) :
- **Wave 0** : External Secrets Operator (l'opérateur doit être installé en premier)
- **Wave 1** : ClusterSecretStore (configure la connexion AWS Secrets Manager)
- **Wave 2** : ExternalSecret (crée le K8s Secret depuis AWS SM)

Sans SyncWaves, ESO pourrait tenter de créer le Secret avant que le CRD ExternalSecret soit disponible, causant une erreur.

---

### Q63 — Qu'est-ce que Kustomize et comment l'avez-vous utilisé ?

Kustomize est un outil de personnalisation de manifests Kubernetes sans templating. Il utilise des overlays qui "patchent" des manifests de base.

Dans ce projet (Phase 18) :
- `base/` : manifests communs (Deployment, Service)
- `overlays/dev/` : `kustomization.yaml` avec patches spécifiques dev (1 réplique, images dev)
- `overlays/prod/` : patches prod (3 répliques, resources limits élevées)

ArgoCD applique directement un overlay Kustomize — pas besoin de générer les manifests localement.

---

### Q64 — Qu'est-ce qu'un PodDisruptionBudget (PDB) ?

Un PDB garantit qu'un minimum de pods restent disponibles lors d'opérations de maintenance (drain de nœud, rolling update). Exemple : `minAvailable: 1` sur un Deployment avec 2 répliques — Kubernetes ne supprimera jamais les 2 en même temps.

Dans le chart Helm de ce projet, un PDB `minAvailable: 1` est défini pour le backend. En production avec 3 répliques, cela permet des rolling updates sans downtime.

---

### Q65 — Qu'est-ce que Traefik et comment s'intègre-t-il à K3s ?

Traefik est un reverse proxy et load balancer cloud-native. K3s l'inclut par défaut comme Ingress Controller — pas besoin d'installer NGINX Ingress séparément.

Dans ce projet, le chart Helm définit un `Ingress` Kubernetes qui référence `ingressClassName: traefik`. Traefik intercepte le trafic entrant sur le port 80/443 et le route vers les services backend/frontend selon les règles de l'Ingress (host, path).

---

## Sécurité (avancé)

### Q66 — Qu'est-ce que OWASP ZAP et comment l'utilisez-vous ?

ZAP (Zed Attack Proxy) est un scanner de sécurité web open-source de l'OWASP. Il simule des attaques réelles contre une application en cours d'exécution (DAST).

Dans ce projet (Phase 12) :
1. Un workflow GitHub Actions démarre l'application avec Docker Compose
2. ZAP lance un scan authentifié (avec token JWT admin) pour tester les endpoints protégés
3. Il teste : injection SQL, XSS, CSRF, traversée de répertoires, headers de sécurité manquants
4. Le rapport est publié en artifact GitHub Actions
5. Les findings critiques/élevés font échouer le pipeline

---

### Q67 — Qu'est-ce que Cosign et comment signez-vous les images Docker ?

Cosign (Sigstore project) permet de signer et vérifier cryptographiquement des images de containers. La signature prouve que l'image a été buildée par un pipeline CI/CD spécifique, pas par un attaquant qui aurait pushé une image modifiée.

Dans ce projet (Phase 16), le workflow SBOM utilise Cosign pour signer les images ECR après le build. La signature est stockée dans ECR à côté de l'image. Avant un déploiement, on peut vérifier la signature.

---

### Q68 — Qu'est-ce que Dependabot et comment l'avez-vous configuré ?

Dependabot est un bot GitHub qui surveille les dépendances et crée automatiquement des Pull Requests quand une nouvelle version est disponible ou qu'une CVE est détectée.

Dans ce projet (Phase 16), `.github/dependabot.yml` configure :
- Scan hebdomadaire des dépendances Maven (`backend/pom.xml`)
- Scan hebdomadaire des dépendances npm (`frontend/package.json`)
- Scan des actions GitHub (`.github/workflows/`)

Les PR Dependabot passent par tous les checks CI/CD avant merge — zéro dépendance vulnérable sans review.

---

### Q69 — Qu'est-ce que CodeQL et en quoi est-il différent d'un linter ?

Un linter (Checkstyle, ESLint) vérifie le style et les conventions de code. CodeQL est une analyse sémantique qui comprend le flux de données.

Exemple : un linter ne voit pas qu'une variable provient d'une requête HTTP et finit dans une requête SQL. CodeQL suit le flux complet et détecte l'injection SQL potentielle. Il peut analyser comment les données traversent des couches d'abstraction.

Dans ce projet, CodeQL analyse Java et TypeScript sur chaque PR et push main. Les findings sont intégrés dans GitHub Security (onglet Code Scanning).

---

### Q70 — Comment protégez-vous contre les injections SQL ?

À plusieurs niveaux :

1. **JPA/Hibernate** : les repositories Spring Data utilisent des requêtes paramétrées automatiquement. `findById(id)` génère `WHERE id = ?`, pas de concaténation.
2. **JPQL paramétré** : pour les queries custom, `@Query("SELECT p FROM Project p WHERE p.status = :status")` avec `@Param("status")`.
3. **Validation d'entrée** : Bean Validation rejette les inputs malformés avant qu'ils atteignent la DB.
4. **CodeQL SAST** : détecte les patterns d'injection potentiels statiquement.
5. **OWASP ZAP DAST** : teste des payloads SQL injection en runtime.

---

### Q71 — Qu'est-ce que le BCrypt et pourquoi cost=12 ?

BCrypt est un algorithme de hachage adaptatif pour les mots de passe. Son paramètre `cost` (ou `strength`) détermine le nombre de rounds (2^cost itérations).

- Cost 10 : ~100ms/hash (standard 2020)
- Cost 12 : ~300ms/hash (recommandé 2024)
- Cost 14 : ~1.2s/hash (trop lent pour UX)

À 300ms, un attaquant avec 1 GPU peut tenter ~3 hashes/seconde, rendant une attaque par dictionnaire impraticable. Le salt intégré rend les rainbow tables inutiles. Spring Security gère automatiquement la migration de cost si on augmente le paramètre.

---

### Q72 — Comment gérez-vous le CORS dans ce projet ?

CORS (Cross-Origin Resource Sharing) est configuré dans `SecurityConfig.corsConfigurationSource()` :

- **Origins autorisées** : défini via variable d'env `CORS_ALLOWED_ORIGINS` (valeur : `https://charrad-devsecops.duckdns.org`). En dev, `http://localhost:4200`.
- **Méthodes** : GET, POST, PUT, PATCH, DELETE, OPTIONS
- **Headers** : Authorization, Content-Type, Accept, Origin
- **Credentials** : `allowCredentials(true)` pour les cookies/tokens
- **Preflight cache** : 3600 secondes (évite une requête OPTIONS à chaque appel)

Les requêtes provenant du domaine DuckDNS sont considérées comme same-origin via le proxy NGINX.

---

### Q73 — Qu'est-ce qu'un Security Hotspot dans SonarCloud ?

Un Security Hotspot est un code qui mérite une review manuelle de sécurité mais qui n'est pas forcément une vulnérabilité. Contrairement aux bugs ou code smells, il demande un jugement humain.

Exemple : un `@SuppressWarnings("unchecked")` peut être sûr ou non selon le contexte. SonarCloud le signale pour qu'un développeur confirme que c'est intentionnel.

Dans ce projet, tous les Security Hotspots sont reviewés et marqués "Safe" — c'est une condition du Quality Gate (`security_hotspots_reviewed: 100%`).

---

## Infrastructure & SRE

### Q74 — Qu'est-ce qu'un "golden signal" en SRE et les mesurez-vous ?

Les 4 golden signals (Google SRE Book) sont les métriques fondamentales à monitorer :

1. **Latency** : temps de réponse des requêtes. Mesuré via `http_server_requests_seconds` dans Prometheus.
2. **Traffic** : nombre de requêtes par seconde. Mesuré via `rate(http_server_requests_seconds_count[1m])`.
3. **Errors** : taux d'erreurs (5xx). Alarme CloudWatch + métrique custom `Http5xxErrors`.
4. **Saturation** : utilisation des ressources (CPU, mémoire). Alarme CloudWatch CPU > 80%.

---

### Q75 — Qu'est-ce qu'un SLO et un SLA ?

- **SLO** (Service Level Objective) : objectif interne de fiabilité. Exemple : "99.5% des requêtes répondent en moins de 200ms".
- **SLA** (Service Level Agreement) : contrat externe avec les clients. Généralement moins ambitieux que le SLO (marge de sécurité).
- **Error Budget** : si le SLO est 99.5%, le budget d'erreur mensuel est 0.5% × 43200min = 216 minutes de downtime acceptable.

Pour un portfolio, ces métriques ne sont pas formellement définies, mais les dashboards Grafana permettraient de les calculer.

---

### Q76 — Comment feriez-vous un rollback en cas de régression en production ?

Plusieurs niveaux de rollback :

1. **Rollback rapide** (< 2 min) : `gh workflow run deploy-app.yml --ref main -f image_tag=sha-abc1234` — déploie le tag précédent
2. **Rollback GitOps** : `git revert <commit>` + push — ArgoCD re-synchronise vers l'ancien état
3. **Rollback Helm** : `helm rollback portfolio 2` — revient à la revision 2 du chart
4. **Base de données** : les migrations Flyway sont append-only. Rollback DB = script SQL de compensation (pas une annulation Flyway)

Le tag SHA immuable sur chaque image ECR rend le rollback précis et fiable.

---

### Q77 — Qu'est-ce que l'Infrastructure as Code (IaC) et quels en sont les risques ?

IaC = décrire l'infrastructure dans du code versionné plutôt que de la configurer manuellement via une console.

**Avantages** : reproductibilité, code review, historique Git, documentation vivante.

**Risques** :
- **Terraform state drift** : si quelqu'un modifie l'infra manuellement (console AWS), le state Terraform diverge. Solution : `terraform import` ou `terraform refresh`.
- **`terraform apply` destructif** : un changement anodin peut déclencher une recréation de ressource. Toujours faire `terraform plan` et relire les actions `destroy/create`.
- **Secrets dans le state** : le `terraform.tfstate` peut contenir des mots de passe en clair. Solution : backend distant chiffré (S3 + DynamoDB locking).

---

### Q78 — Comment scaleriez-vous ce projet si le trafic multipliait par 10 ?

Actions graduées :

1. **DB** : activer le Multi-AZ RDS + Read Replica pour le trafic de lecture
2. **Cache** : augmenter le TTL Redis, ajouter un Redis Cluster
3. **Compute** : passer à K3s/EKS avec plusieurs nodes, HPA sur le backend
4. **CDN** : CloudFront devant l'application pour les assets statiques
5. **LB** : ALB (Application Load Balancer) AWS pour distribuer entre plusieurs EC2
6. **Async** : déporter les traitements lourds vers Lambda ou des workers Kafka
7. **Monitoring** : définir des SLOs formels, alertes sur error budget

---

## Base de données

### Q79 — Qu'est-ce que PostgreSQL JSONB et quand l'utiliseriez-vous ?

JSONB est un type de colonne PostgreSQL qui stocke du JSON sous forme binaire indexable. Contrairement à JSON (texte brut), JSONB supporte les index GIN et les opérateurs d'interrogation.

Cas d'usage : attributs variables par entité (ex: métadonnées de projet différentes selon le type), données semi-structurées, ou éviter une table de pivot pour des propriétés rares.

Dans ce projet, la structure est relationnelle classique. JSONB serait utile si on ajoutait des attributs dynamiques par projet (ex: stack technique sous forme de JSON).

---

### Q80 — Qu'est-ce que le N+1 query problem et comment l'éviter avec JPA ?

Le problème N+1 : pour une liste de 10 projets, JPA charge les projets (1 requête) puis pour chaque projet charge ses skills (10 requêtes) = 11 requêtes au lieu de 2.

Solutions dans ce projet :
- **`@ManyToMany(fetch = FetchType.LAZY)`** : chargement à la demande (évite le chargement systématique)
- **JPQL avec JOIN FETCH** : `SELECT DISTINCT p FROM Project p LEFT JOIN FETCH p.skills` → une seule requête SQL avec JOIN
- **`@EntityGraph`** : alternative aux JOIN FETCH pour les repositories Spring Data

Micrometer expose `hikaricp.connections.active` et `jvm.db.query.duration` pour détecter les N+1 en production.

---

### Q81 — Pourquoi `db_skip_final_snapshot = true` en dev ?

Lors d'un `terraform destroy`, RDS crée par défaut un snapshot final avant de supprimer la base de données. C'est une protection contre la perte accidentelle de données en production.

En dev/portfolio, ce snapshot est inutile (données de démo) et coûterait 20GB × $0.095/GB/mois = ~$2/mois de stockage EBS. `skip_final_snapshot = true` évite ce snapshot.

En production : **toujours** `skip_final_snapshot = false` et `deletion_protection = true`.

---

### Q82 — Qu'est-ce que le point-in-time recovery (PITR) RDS ?

PITR permet de restaurer une base de données à n'importe quel instant dans la fenêtre de rétention (jusqu'à 35 jours). AWS réalise des sauvegardes automatiques quotidiennes + journaux de transactions en continu.

Si à 14h un développeur supprime accidentellement une table, on peut restaurer la DB à 13h59 sur une nouvelle instance RDS et re-syncer les données perdues.

Dans ce projet, `backup_retention_days = 0` (désactivé pour Free Tier). En production, minimum 7 jours recommandés.

---

## Performance & Optimisation

### Q83 — Qu'est-ce que le lazy loading JPA et ses pièges ?

`LAZY` signifie que les associations (`@OneToMany`, `@ManyToMany`) ne sont pas chargées jusqu'à ce qu'on y accède. `EAGER` charge tout immédiatement.

**Piège : LazyInitializationException** — si on accède à une collection LAZY en dehors d'une transaction, Hibernate ne peut plus faire la requête SQL. Solution : `@Transactional` sur la méthode du service, ou `@EntityGraph` pour forcer le chargement nécessaire.

Dans ce projet, `Project.skills` est en `LAZY`. Le service charge explicitement les skills via JPQL quand nécessaire.

---

### Q84 — Comment mesurez-vous les performances de l'API ?

Plusieurs outils combinés :

- **k6** (Phase 14) : mesure les p50/p95/p99 de latence sous charge réelle. Seuils définis dans les scripts.
- **Actuator `/actuator/metrics/http.server.requests`** : percentiles de réponse en production.
- **Prometheus + Grafana** : évolution temporelle des latences, identification de dégradations.
- **Hikari metrics** : `hikaricp.connections.acquire` pour détecter les bottlenecks DB.

---

### Q85 — Pourquoi `-Xmx600m` dans la commande Java du docker-compose ?

`-Xmx600m` limite le heap Java à 600MB. Sans limite, la JVM peut consommer tout le RAM disponible (par défaut 25% du RAM système = ~500MB sur t3.small, mais peut monter plus).

En conteneur, si la JVM dépasse la limite mémoire du container Docker (`memory: 768M`), le process est tué par le kernel (OOM Kill). `-Xmx600m` laisse de la marge pour le Metaspace, les threads, le native memory, tout en restant sous les 768MB.

---

## Comportemental & Soft Skills

### Q86 — Décrivez une décision technique difficile que vous avez dû prendre.

La décision de passer de K3s à Docker Compose. J'avais passé plusieurs heures à implémenter et déboguer K3s + ArgoCD (Phases 18-21, commits vérifiés), mais la réalité du t3.micro (1GB RAM, 0MB SWAP disponible au bon moment) rendait la combinaison instable.

J'aurais pu insister, passer des heures à tuner les JVM args et les memory limits Kubernetes. Mais j'ai choisi la pragmatisme : Docker Compose stable ET la documentation K3s complète dans le repo. Un recruteur qui lit le code voit les deux.

---

### Q87 — Comment vous tenez-vous à jour sur les évolutions DevSecOps ?

Plusieurs sources :

- **Newsletters** : DevOps Weekly, SRE Weekly, TLDR DevOps
- **GitHub Trending** : suivre les nouveaux outils (récemment : OpenTofu fork de Terraform, Bun alternative à Node)
- **CNCF** : suivi du paysage cloud native (cloudnativelandscape.io)
- **CVE databases** : NVD, GitHub Security Advisories pour les alertes critiques
- **Hands-on** : ce portfolio est un lab permanent — chaque nouvelle phase teste une technologie réelle

---

### Q88 — Expliquez votre approche de la documentation technique.

Dans ce projet, chaque phase a un fichier `docs/PHASE*.md` qui explique les choix architecturaux, pas seulement le code. La règle : documenter le **pourquoi**, pas le **quoi** (le code dit déjà le quoi).

Exemples : pourquoi pas de NAT Gateway (économie documentée), pourquoi BCrypt cost 12 (sécurité argumentée), pourquoi Docker Compose plutôt que K3s (contraintes expliquées).

La documentation la plus utile est celle qui explique les décisions prises et celles écartées.

---

### Q89 — Comment collaboreriez-vous avec l'équipe sécurité sur ce type de projet ?

Plusieurs points de contact :

1. **Shift-left** : intégrer les revues de sécurité dans les PR (code review + SAST résultats) plutôt qu'en fin de projet
2. **Threat modeling** : travailler avec l'équipe sécu pour identifier les assets critiques et les vecteurs d'attaque dès la conception
3. **Security as Code** : les policies de sécurité (règles RBAC, network policies K8s, IAM policies) sont dans le repo et peuvent être reviewées
4. **Runbooks communs** : les procédures d'incident de sécurité (rotation de secrets, revocation de tokens) sont documentées et testées

---

### Q90 — Qu'auriez-vous fait différemment si ce projet était en production enterprise ?

Plusieurs différences :

1. **State Terraform distant** : S3 + DynamoDB locking au lieu du state local (évite les conflits en équipe)
2. **Environments séparés** : dev, staging, prod avec comptes AWS dédiés (AWS Organizations)
3. **Secrets rotation** : Lambda pour rotation automatique des credentials RDS dans Secrets Manager
4. **WAF** : AWS WAF devant CloudFront pour bloquer les attaques applicatives
5. **VPC endpoints** : pour ECR et Secrets Manager (évite que le trafic passe par internet)
6. **Alerting on-call** : PagerDuty intégré à CloudWatch (pas juste un email)
7. **Chaos Engineering** : Gremlin ou AWS FIS pour tester la résilience

---

## Questions pièges & Avancées

### Q91 — Terraform `terraform.tfstate` — pourquoi ne jamais le committer dans Git ?

Le `terraform.tfstate` contient l'état complet de l'infrastructure, y compris des valeurs sensibles en clair : mots de passe RDS, clés privées, secrets. Les committer dans Git les expose à quiconque peut lire le repo (même si le repo est privé — un futur collaborateur, une fuite de token).

Solution : **backend distant**. Dans ce projet, le state est local (acceptable pour un portfolio solo). En équipe : S3 bucket chiffré + DynamoDB pour le locking concurrent.

---

### Q92 — Quelle est la différence entre `docker exec` et `docker attach` ?

- `docker exec` : lance un **nouveau processus** dans un container en cours d'exécution. `docker exec -it portfolio-backend bash` ouvre un shell sans interrompre le processus principal.
- `docker attach` : se connecte au **processus principal** (PID 1) du container. Ctrl+C dans un `attach` tue le container. À éviter en production.

---

### Q93 — Que fait `docker compose up -d --no-deps backend` ?

- `up -d` : démarre en arrière-plan (detached)
- `--no-deps` : ne démarre **pas** les dépendances (`redis`, `prometheus`)
- `backend` : uniquement le service backend

C'est la commande utilisée dans le script de déploiement pour un rolling restart zero-downtime : on redémarre le backend seul, sans toucher le frontend qui continue de servir du trafic pendant le redémarrage.

---

### Q94 — Qu'est-ce que `@SpringBootTest` vs `@WebMvcTest` vs `@DataJpaTest` ?

- **`@SpringBootTest`** : charge le contexte Spring complet (tous les beans). Lent mais teste l'intégration réelle. Utilisé pour les tests E2E ou d'intégration complète.
- **`@WebMvcTest`** : charge uniquement la couche web (controllers, security, serialization). Rapide. Les services doivent être mockés avec `@MockBean`.
- **`@DataJpaTest`** : charge uniquement JPA + repositories. Configure une DB de test (H2 par défaut, ou Testcontainers avec `@AutoConfigureTestDatabase(replace=NONE)`). Rapide, isolé.

---

### Q95 — Pourquoi `ChangeDetectionStrategy.OnPush` dans Angular ?

Par défaut (`Default`), Angular vérifie **tous** les composants à chaque event (click, timer, HTTP). Avec `OnPush`, Angular ne re-vérifie un composant que si :
- Un `@Input()` change (nouvelle référence, pas mutation)
- Un Signal qu'il observe change
- Un `async` pipe déclenche une nouvelle valeur
- `markForCheck()` est appelé manuellement

Résultat : performances significativement meilleures sur les listes longues. Tous les composants de ce projet utilisent `OnPush`.

---

### Q96 — Qu'est-ce qu'une race condition dans le contexte DevSecOps ?

Une race condition entre processus concurrents qui accèdent à une ressource partagée sans synchronisation. En DevSecOps :

- **TOCTOU** (Time-Of-Check Time-Of-Use) : vérifier qu'un fichier est sûr, puis l'utiliser — entre les deux, un attaquant peut le modifier. Mitigation : utiliser des file descriptors atomiques.
- **CI/CD** : deux pipelines qui tournent en parallèle et deployent simultanément. Mitigation : queuing des déploiements, verrous (GitHub Environments avec `concurrency`).
- **DB** : deux transactions qui lisent puis écrivent la même ligne. Mitigation : transactions avec niveau d'isolation `SERIALIZABLE` ou `SELECT FOR UPDATE`.

---

### Q97 — Expliquez le principe du moindre privilège (PoLP) dans ce projet.

Le principe du moindre privilège : chaque entité ne doit avoir que les permissions strictement nécessaires.

Applications concrètes :
- **IAM EC2** : permissions ECR (pull seulement), CloudWatch Logs (write seulement), Secrets Manager (read seulement sur `portfolio/*`). Pas de `*:*`.
- **RDS** : accès uniquement depuis le SG EC2, jamais depuis internet
- **GitHub Secrets** : `EC2_SSH_PRIVATE_KEY` n'est accessible qu'au workflow `deploy-app.yml`
- **Kubernetes** : RBAC avec `ServiceAccount` dédié par namespace
- **Spring Security** : `permitAll()` uniquement sur les routes explicitement publiques, `authenticated()` pour tout le reste

---

### Q98 — Qu'est-ce que l'observabilité vs le monitoring ?

**Monitoring** = vérifier que les métriques connues sont dans les clés (alertes sur des seuils prédéfinis).

**Observabilité** = capacité à comprendre l'état interne d'un système à partir de ses outputs (logs, métriques, traces). On peut répondre à des questions imprévues sans modifier le code.

Concrètement : le monitoring dit "CPU est à 90%". L'observabilité dit "pourquoi le CPU est à 90% — quelle requête, quel utilisateur, quelle trace SQL".

Dans ce projet : monitoring (CloudWatch alarmes) + observabilité partielle (logs JSON corrélés par requestId, métriques Prometheus détaillées). La pièce manquante est le **distributed tracing** (Jaeger/Zipkin) qui corrèle une requête HTTP à travers le backend, Redis et PostgreSQL.

---

### Q99 — Comment débogueriez-vous une fuite mémoire dans un container Docker en production ?

Démarche :

1. **Identifier** : `docker stats portfolio-backend` — watch la mémoire augmenter sans se stabiliser
2. **Heap dump** : `docker exec portfolio-backend jcmd 1 VM.native_memory summary` ou `jmap -heap 1`
3. **Analyser** : transférer le heap dump, analyser avec Eclipse MAT ou VisualVM. Identifier les objets qui s'accumulent.
4. **Comparer** : prendre deux heap dumps à intervalles, comparer les deltas (`jmap -histo:live`)
5. **Causes fréquentes** : caches non bornés (`@Cacheable` sans TTL), listeners non déregistrés, ThreadLocal non nettoyés, streams non fermés

En production : activer `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/` pour capturer automatiquement le dump au crash.

---

### Q100 — Où voyez-vous votre évolution dans les 2 ans ?

Ce portfolio couvre volontairement tout le spectre DevSecOps — de l'Angular au Terraform en passant par Kubernetes. Il démontre la capacité à comprendre chaque couche.

À court terme (6-12 mois), l'objectif est de me spécialiser sur **Platform Engineering** : construire les outils et les plateformes qui permettent aux équipes développement de déployer en autonomie et en sécurité. C'est l'évolution naturelle du DevSecOps : de l'automatisation projet par projet vers une plateforme interne réutilisable (Internal Developer Platform).

À moyen terme, viser une certification AWS Solutions Architect Professional et approfondir Kubernetes (CKA/CKS) pour les environnements multi-cluster en production.
