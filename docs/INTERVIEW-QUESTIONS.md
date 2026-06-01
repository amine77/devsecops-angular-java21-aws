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

---

## Microservices & Architecture distribuée

### Q101 — Quelle est la différence entre une architecture monolithique et microservices ?

Un **monolithe** est une application unique déployée en un seul bloc. Tous les modules partagent la même DB, le même processus, le même déploiement. Simple à développer et déboguer, mais difficile à scaler partiellement.

Les **microservices** sont des services indépendants, chacun avec sa propre DB, son propre déploiement, sa propre échelle. Avantages : déploiement indépendant, stack technique différente par service, résilience (un service en panne n'arrête pas tout).

Ce portfolio est un **monolithe modulaire** : backend Spring Boot unique avec des modules bien séparés (auth, projects, skills). C'est le bon compromis pour un portfolio — les microservices auraient ajouté de la complexité opérationnelle sans bénéfice réel à cette échelle.

---

### Q102 — Qu'est-ce qu'un Circuit Breaker et comment fonctionne-t-il ?

Le Circuit Breaker est un pattern de résilience qui évite qu'un service défaillant cascade ses erreurs. Il a 3 états :

- **Fermé** : les requêtes passent normalement. Comptage des échecs.
- **Ouvert** : seuil d'échecs dépassé → les requêtes sont rejetées immédiatement (sans appeler le service distant) pendant un timeout.
- **Semi-ouvert** : après le timeout, quelques requêtes test passent. Si elles réussissent → retour à Fermé. Sinon → retour à Ouvert.

Implémentation : Resilience4j (Spring Boot), Hystrix (déprécié). Dans ce projet, les Lambda calls utilisent un retry simple — un vrai circuit breaker serait utile si on ajoutait des appels inter-services.

---

### Q103 — Qu'est-ce que le pattern Saga dans les microservices ?

La Saga gère les transactions distribuées sans verrou global (qui serait catastrophique pour les performances). Une saga est une séquence de transactions locales, chacune publiante un événement qui déclenche la suivante.

**Choreography Saga** : chaque service publie des événements et écoute ceux des autres (Kafka). Découplé mais difficile à suivre.

**Orchestration Saga** : un orchestrateur central coordonne la séquence. Plus facile à déboguer, couplage plus fort.

Exemple e-commerce : Order → Inventory → Payment. Si Payment échoue, un événement de compensation déclenche le rollback d'Inventory puis d'Order.

---

### Q104 — Qu'est-ce que le CQRS et l'Event Sourcing ?

**CQRS** (Command Query Responsibility Segregation) : séparer les opérations d'écriture (Commands) des lectures (Queries). Les Commands modifient l'état, les Queries lisent. Avantage : optimiser les deux chemins indépendamment (ex: index optimisés pour la lecture, write model simple).

**Event Sourcing** : au lieu de stocker l'état courant, stocker la séquence de tous les événements qui ont mené à cet état. L'état actuel = replay des événements. Avantage : historique complet, audit naturel, time-travel debugging.

Ce projet utilise Kafka pour les événements mais sans Event Sourcing pur — la DB PostgreSQL stocke l'état courant.

---

### Q105 — Qu'est-ce qu'une API Gateway et quel est son rôle ?

Une API Gateway est le point d'entrée unique pour toutes les requêtes client. Elle centralise :
- **Routing** : rediriger vers le bon microservice
- **Authentication** : valider le JWT une seule fois plutôt que dans chaque service
- **Rate limiting** : limiter les requêtes par client/IP
- **SSL termination** : décrypter HTTPS
- **Logging/Tracing** : corrélation des requêtes cross-services

Dans ce projet : AWS API Gateway pour les Lambda (formulaire contact, image resize). Le NGINX host joue le rôle de reverse proxy/API gateway pour le frontend et le backend.

---

### Q106 — Qu'est-ce que le pattern BFF (Backend For Frontend) ?

Le BFF crée un backend dédié pour chaque type de client (web, mobile, IoT). Chaque BFF agrège et transforme les données des microservices pour les besoins spécifiques de son client, évitant que le frontend fasse plusieurs appels ou reçoive des payloads surdimensionnés.

Dans ce projet, Spring Boot joue implicitement ce rôle : les endpoints `/api/projects` retournent exactement le format attendu par Angular (pas plus, pas moins), avec les DTOs `ProjectResponse` formatés pour l'affichage.

---

## Git & Workflows

### Q107 — Quelle est la différence entre Git Rebase et Git Merge ?

**Merge** : crée un commit de merge qui joint deux branches. L'historique garde les branches et leur point de fusion. Historique honnête mais potentiellement verbeux.

**Rebase** : rejoue les commits d'une branche sur une autre, linéarisant l'historique. L'historique est plus propre mais les SHA des commits changent — ne jamais rebaser des commits déjà poussés sur une branche partagée.

Dans ce projet, `git pull --rebase` est utilisé systématiquement pour éviter les commits de merge parasites dans l'historique main.

---

### Q108 — Qu'est-ce que le Trunk Based Development ?

Trunk Based Development (TBD) est une stratégie où tous les développeurs committing directement sur `main` (le trunk), plusieurs fois par jour. Pas de longues feature branches.

Avantages : intégration continue réelle, moins de conflits de merge, feedback CI rapide.

Mécanismes associés : feature flags pour déployer du code non terminé, pair programming, commits atomiques et petits.

Alternative : GitFlow (branches feature/develop/release/hotfix) — plus adapté aux cycles de release planifiés.

---

### Q109 — Comment écrivez-vous de bons messages de commit ?

Convention Conventional Commits (utilisée dans ce projet) :
```
type(scope): description courte (impératif, < 72 chars)

Corps optionnel : pourquoi, pas comment

Co-Authored-By: ...
```

Types : `feat` (nouvelle feature), `fix` (bug), `docs`, `test`, `refactor`, `ci`, `chore`.

Exemples dans ce projet :
- `fix(deploy): ne remplacer que les images ECR dans docker-compose.yml`
- `test(frontend): couvrir ProjectFormComponent + exclure main.ts de SonarCloud`

Un bon message répond à "Si appliqué, ce commit va : [description]".

---

### Q110 — Qu'est-ce qu'un Git hook et comment l'utiliseriez-vous ?

Les Git hooks sont des scripts exécutés automatiquement à certains moments du workflow Git. Exemples :

- `pre-commit` : lancer ESLint/Prettier avant chaque commit local — empêche de committer du code non formaté
- `commit-msg` : valider le format du message de commit (Conventional Commits)
- `pre-push` : lancer les tests unitaires avant de pusher

Outils : `husky` (npm) configure les hooks pour toute l'équipe via `package.json`. `lint-staged` exécute les linters uniquement sur les fichiers modifiés (plus rapide).

---

## Linux & Systèmes

### Q111 — Quelles commandes Linux utilisez-vous au quotidien en DevOps ?

Commandes essentielles utilisées dans ce projet :

```bash
# Processus et ressources
top / htop          # Monitoring CPU/mémoire en temps réel
free -h             # Utilisation de la mémoire/swap
df -h               # Espace disque
ps aux | grep java  # Trouver le process Java

# Réseau
netstat -tlnp       # Ports en écoute
curl -sv            # Test HTTP avec headers verbose
ss -tlnp            # Alternative moderne à netstat

# Fichiers/logs
tail -f /var/log/nginx/access.log  # Logs en temps réel
journalctl -u nginx -f             # Logs systemd
grep -r "ERROR" /var/log/ --include="*.log"

# Systemd
systemctl status nginx
systemctl restart portfolio
```

---

### Q112 — Qu'est-ce que `systemd` et comment avez-vous configuré un service ?

`systemd` est le système d'init Linux (remplace SysV init). Il gère les services, les cibles de boot, les logs (journald).

Dans ce projet, le service `portfolio.service` :
```ini
[Unit]
Description=Portfolio Application Stack
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/portfolio
ExecStartPre=... # login ECR
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

`systemctl enable portfolio` → démarre au boot. `systemctl start portfolio` → démarre immédiatement.

---

### Q113 — Qu'est-ce que le swap sous Linux et quand est-il utilisé ?

Le swap est un espace disque utilisé comme extension de la RAM quand la mémoire physique est saturée. Plus lent que la RAM (100-1000x), mais évite les OOM kills.

Dans ce projet, 4GB de swap ont été créés sur l'EC2 t3.micro (1GB RAM) pour permettre à K3s + Spring Boot de coexister. Sur le t3.small (2GB RAM), le swap n'est plus utilisé en usage normal.

Création :
```bash
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
```

---

### Q114 — Qu'est-ce que `cron` et `crontab` ?

`cron` est le planificateur de tâches Unix. `crontab` édite les planifications.

Format : `minute heure jour_mois mois jour_semaine commande`

Exemples dans ce projet :
```cron
# Rafraîchir le token ECR toutes les 6h (token valide 12h)
0 */6 * * * root /usr/local/bin/refresh-ecr-token.sh

# Certbot renouvellement automatique (géré par systemd timer sur AL2023)
0 0,12 * * * root /usr/bin/certbot renew --quiet
```

`0 */6 * * *` = à la minute 0, toutes les 6 heures, tous les jours.

---

### Q115 — Qu'est-ce qu'un fichier `/etc/cron.d/` vs `crontab -e` ?

- `crontab -e` : édite la crontab de l'utilisateur courant. Les tâches s'exécutent avec ses permissions.
- `/etc/cron.d/` : répertoire pour les crontabs système. Chaque fichier peut spécifier un utilisateur différent par ligne. Géré par root, versionnables dans `/etc`.

Dans ce projet, `/etc/cron.d/ecr-token-refresh` contient le cron root pour le renouvellement ECR — plus propre qu'une crontab utilisateur.

---

## Réseau & Protocoles

### Q116 — Expliquez le handshake TLS/HTTPS.

TLS (Transport Layer Security) sécurise les communications HTTP. Le handshake :

1. **Client Hello** : client envoie les cipher suites supportées + random
2. **Server Hello** : serveur choisit une cipher suite, envoie son certificat
3. **Vérification** : client vérifie le certificat via la chaîne de certification (Let's Encrypt → ISRG Root X1)
4. **Key Exchange** : échange de clé via ECDHE (Perfect Forward Secrecy)
5. **Session établie** : communications chiffrées avec la clé dérivée

Let's Encrypt utilise le protocole ACME pour l'émission automatique. Certbot résout le challenge HTTP-01 (fichier dans `/.well-known/acme-challenge/`) pour prouver le contrôle du domaine.

---

### Q117 — Qu'est-ce que le DNS et comment DuckDNS fonctionne-t-il ?

Le DNS (Domain Name System) traduit les noms de domaine en adresses IP. Hiérarchie : Root → TLD (`.org`) → Domaine (`duckdns.org`) → Sous-domaine (`charrad-devsecops`).

DuckDNS fournit des sous-domaines gratuits avec une API simple. Pour mettre à jour l'IP :
```bash
curl "https://www.duckdns.org/update?domains=charrad-devsecops&token=TOKEN&ip=13.39.132.25"
```

Si l'IP de l'EC2 change (après un stop/start), il faut mettre à jour DuckDNS. Un cron ou un script dans le user-data automatiserait cette mise à jour.

---

### Q118 — Qu'est-ce que le HTTP/2 et quels sont ses avantages ?

HTTP/2 améliore HTTP/1.1 sur plusieurs points :

- **Multiplexing** : plusieurs requêtes sur une seule connexion TCP (vs une par connexion en HTTP/1.1)
- **Header compression** : HPACK compresse les headers répétitifs
- **Server Push** : le serveur peut envoyer des ressources avant que le client les demande
- **Binaire** : protocole binaire vs texte — plus efficace à parser

NGINX avec Let's Encrypt active HTTP/2 automatiquement sur HTTPS. Angular bénéficie particulièrement du multiplexing : le lazy loading charge plusieurs chunks en parallèle.

---

### Q119 — Qu'est-ce qu'un reverse proxy et en quoi NGINX en est un ?

Un **reverse proxy** se place devant les serveurs applicatifs et intercepte les requêtes clientes. Avantages :

- **SSL termination** : décrypte HTTPS avant de transmettre en HTTP interne
- **Load balancing** : distribue les requêtes entre plusieurs instances
- **Cache** : met en cache les réponses statiques
- **Sécurité** : cache l'architecture interne, rate limiting, filtrage

Dans ce projet, NGINX host écoute sur les ports 80/443 et proxie vers les containers Docker (frontend:8081, backend:8080, grafana:3000). Les containers ne sont pas directement exposés à internet.

---

### Q120 — Qu'est-ce que le CAP theorem ?

Le théorème CAP dit qu'un système distribué ne peut garantir que 2 des 3 propriétés simultanément :

- **Consistency** : tous les nœuds voient les mêmes données au même moment
- **Availability** : chaque requête reçoit une réponse (pas forcément la plus récente)
- **Partition tolerance** : le système continue à fonctionner malgré des partitions réseau

PostgreSQL est CA (Consistency + Availability) en Single-AZ — acceptable car il n'y a pas de partition réseau dans un datacenter.

Redis peut être configuré AP (Availability + Partition tolerance) avec Redis Cluster — quelques millisecondes de données perdues acceptables pour un cache.

---

## Advanced AWS

### Q121 — Qu'est-ce qu'un Elastic Load Balancer (ELB) et ses types ?

AWS propose 3 types de load balancers :

- **ALB** (Application LB) : couche 7 (HTTP/HTTPS). Route basé sur les headers, paths, host. Idéal pour les microservices et les WebSockets.
- **NLB** (Network LB) : couche 4 (TCP/UDP). Très haute performance, faible latence. Pour les flux non-HTTP.
- **GLB** (Gateway LB) : pour les appliances réseau tierces (firewalls, IDS).

Pour ce projet en production enterprise, un ALB remplacerait NGINX : routage `/api/*` → backend, `/*` → frontend, avec health checks natifs et intégration ACM pour les certificats.

---

### Q122 — Qu'est-ce qu'AWS CloudTrail ?

CloudTrail enregistre toutes les API calls AWS (qui a fait quoi, quand, depuis quelle IP). C'est l'audit trail complet de votre compte AWS.

Cas d'usage :
- Forensics après un incident de sécurité
- Compliance (PCI-DSS, SOC 2 exigent un audit trail)
- Détecter des API calls inhabituels (ex: `DeleteBucket` à 3h du matin)

Différence avec CloudWatch : CloudWatch monitore les **métriques** (CPU, latence), CloudTrail enregistre les **actions** (API calls).

---

### Q123 — Qu'est-ce qu'AWS Config ?

AWS Config enregistre en continu l'état de configuration de toutes les ressources AWS et évalue la conformité par rapport à des règles.

Exemple : règle "Les Security Groups ne doivent pas autoriser SSH depuis 0.0.0.0/0" → alerte immédiate si quelqu'un modifie un SG. Historique de configuration : retrouver comment un SG était configuré il y a 3 mois.

Complément à CloudTrail : Config dit **l'état** des ressources, CloudTrail dit **qui les a modifiées**.

---

### Q124 — Qu'est-ce qu'AWS WAF et quand l'utiliser ?

WAF (Web Application Firewall) filtre les requêtes HTTP malveillantes avant qu'elles atteignent l'application. Il inspecte : headers, body, query strings, IP source.

Règles managées AWS :
- Core Rule Set (OWASP Top 10)
- SQL injection protection
- Rate limiting par IP
- Blocage de pays entiers

Intégré à CloudFront, ALB ou API Gateway. Dans ce projet, OWASP ZAP simule les attaques que WAF bloquerait en production.

---

### Q125 — Qu'est-ce qu'AWS Systems Manager Session Manager ?

Session Manager permet de se connecter en SSH aux EC2 sans ouvrir le port 22, sans clé SSH. La connexion passe par l'agent SSM installé sur l'instance, tunnelé via HTTPS vers AWS.

Avantages sécurité :
- Port 22 fermé dans le SG (réduction de surface d'attaque)
- Toutes les sessions loggées dans CloudTrail
- Authentification via IAM, pas de clé partagée

Dans ce projet, on a ouvert le port 22 pour le CI/CD (compromis pragmatique). En production, Session Manager + IAM serait la solution cible.

---

### Q126 — Qu'est-ce qu'AWS Aurora et en quoi diffère-t-il de RDS PostgreSQL ?

Aurora est un moteur de DB propriétaire AWS, compatible PostgreSQL/MySQL mais reconstruit pour le cloud. Différences :

- **Storage** : Aurora utilise un storage distribué sur 6 copies dans 3 AZs — RDS utilise EBS classique
- **Performance** : 3-5x plus rapide que RDS PostgreSQL pour les workloads read-heavy
- **Serverless** : Aurora Serverless v2 scale automatiquement les ACUs (Aurora Capacity Units)
- **Coût** : plus cher que RDS classique (~20-30%)
- **Global Database** : réplication multi-région sub-seconde

Pour ce portfolio, RDS PostgreSQL standard est suffisant. Aurora serait justifié pour des millions de requêtes/jour.

---

### Q127 — Qu'est-ce qu'ElastiCache et quand l'utiliser plutôt qu'un Redis sur EC2 ?

ElastiCache est le service Redis/Memcached managé AWS. Avantages vs Redis auto-hébergé :

- **Multi-AZ avec failover automatique** : pas de downtime si un nœud tombe
- **Cluster mode** : sharding horizontal automatique
- **Backup** : snapshots automatiques vers S3
- **Monitoring** : métriques CloudWatch natives
- **Patches** : gérés par AWS

Dans ce portfolio, Redis tourne dans Docker Compose sur l'EC2 (plus simple, coût nul). Pour la production avec SLA, ElastiCache en mode cluster serait indispensable.

---

### Q128 — Qu'est-ce qu'AWS KMS et comment protège-t-il les secrets ?

KMS (Key Management Service) gère les clés de chiffrement de façon centralisée et auditée. Chaque utilisation d'une clé est loggée dans CloudTrail.

Dans ce projet, Secrets Manager chiffre les secrets avec une clé KMS (par défaut, la clé managée AWS `aws/secretsmanager`). Pour plus de contrôle, on créerait une Customer Managed Key (CMK) avec une rotation automatique et des policies IAM granulaires.

Avantage : même si quelqu'un vole le fichier de secrets chiffré, sans accès KMS il ne peut pas le déchiffrer.

---

### Q129 — Qu'est-ce qu'AWS STS et les rôles assumés ?

STS (Security Token Service) émet des credentials temporaires. Quand une Lambda ou un EC2 assume un rôle IAM, STS génère :
- `AccessKeyId` (temporaire, expire dans 1h-12h)
- `SecretAccessKey`
- `SessionToken`

C'est ce qui permet au pipeline deploy-app.yml de récupérer l'IP EC2 (`aws ec2 describe-instances`) sans credentials permanents dans GitHub Secrets — les credentials AWS_ACCESS_KEY_ID/SECRET configurés dans les secrets GitHub correspondent à un IAM User dédié CI/CD avec les permissions minimales nécessaires.

---

### Q130 — Qu'est-ce que le "Shared Responsibility Model" AWS ?

AWS et le client partagent la responsabilité de la sécurité :

**AWS est responsable de** : sécurité physique des datacenters, hyperviseur, réseau backbone, hardware.

**Vous êtes responsable de** : OS (patches), applications, données, IAM, chiffrement, configuration des Security Groups, secrets.

Exemple concret : AWS garantit que personne n'entre physiquement dans le datacenter. Vous garantissez que votre SG n'expose pas le port 5432 à internet.

---

## Performance & Scalabilité

### Q131 — Qu'est-ce que le connection pooling et pourquoi est-il critique ?

Créer une connexion PostgreSQL prend ~10-50ms (handshake TCP + authentification + allocation de processus serveur). Sans pooling, chaque requête HTTP ouvrirait et fermerait une connexion — catastrophique sous charge.

HikariCP (Spring Boot default) maintient un pool de connexions ouvertes. Config dans ce projet :
- `maximum-pool-size: 10` (t3.small → 10 connexions max)
- `minimum-idle: 2`
- `connection-timeout: 30000ms`
- `idle-timeout: 600000ms` (10min)

Métrique Micrometer : `hikaricp.connections.active` → si toujours à 10 sous charge, le pool est le bottleneck.

---

### Q132 — Qu'est-ce que l'index de base de données et quand en créer un ?

Un index est une structure de données (B-tree par défaut PostgreSQL) qui accélère les recherches. Sans index, chaque requête `WHERE` scanne toute la table (Sequential Scan).

Dans ce projet, index créés dans les migrations Flyway :
- `users.email` : unique + index (recherche par email à chaque login)
- `projects.status` : `findByStatus()` fréquent
- `projects.featured` : filtrage page d'accueil

**Ne pas indexer** : colonnes à faible cardinalité (booléens), colonnes rarement filtrées, tables très petites. Chaque index ralentit les INSERT/UPDATE.

---

### Q133 — Qu'est-ce que le Content Delivery Network (CDN) et comment optimise-t-il les performances ?

Un CDN distribue les assets statiques sur des serveurs géographiquement proches des utilisateurs. Au lieu de charger `bundle.js` depuis eu-west-3 (Paris) pour un utilisateur à Tokyo, il le charge depuis un PoP (Point of Presence) japonais.

Dans une architecture Angular :
- Les fichiers JS/CSS/images (immuables avec hash dans le nom) sont mis en cache indéfiniment
- Headers `Cache-Control: public, max-age=31536000, immutable`
- Seul `index.html` n'est pas mis en cache (il référence les autres fichiers)

CloudFront + S3 est la solution AWS typique pour les SPA Angular en production.

---

### Q134 — Qu'est-ce que la pagination et comment l'avez-vous implémentée ?

La pagination évite de charger toutes les données en une requête. Dans ce projet :

**Backend** : `Pageable` Spring Data → `SELECT * FROM projects LIMIT ? OFFSET ?` + COUNT total.
```java
Page<Project> findAll(Pageable pageable);
// appel : PageRequest.of(page, size, Sort.by("sortOrder"))
```

**Frontend** : `PageResponse<T>` DTO contenant `content`, `totalElements`, `totalPages`, `size`, `number`. L'Angular affiche les boutons de pagination basés sur ces métadonnées.

Optimisation : pour les grandes tables, `OFFSET` devient lent (PostgreSQL scanne quand même les lignes). Alternative : keyset pagination (`WHERE id > lastId`) pour les listes infinies.

---

### Q135 — Qu'est-ce que `@Async` dans Spring Boot et quand l'utiliser ?

`@Async` exécute la méthode dans un thread pool séparé (TaskExecutor), libérant le thread HTTP immédiatement. Le résultat est un `CompletableFuture<T>`.

Cas d'usage : envoi d'email, génération de rapport, notification webhook — opérations longues dont le résultat n'est pas immédiatement nécessaire.

**Piège** : `@Async` ne fonctionne pas si appelé depuis la même classe (proxy AOP). Nécessite `@EnableAsync` sur une `@Configuration`.

Dans ce projet, les Lambda gèrent l'async de façon plus robuste (EventBridge + Lambda = garantie de livraison).

---

## Patterns & Architecture

### Q136 — Qu'est-ce que le pattern Repository et pourquoi l'utilise-t-on ?

Le Repository abstrait la couche d'accès aux données derrière une interface. Le service ne sait pas si les données viennent de PostgreSQL, MongoDB ou d'un cache.

Avantages :
- Testabilité : `@Mock ProjectRepository` → pas de DB dans les tests unitaires
- Séparation des responsabilités : le service contient la logique métier, pas les requêtes SQL
- Évolutivité : changer de DB = implémenter une nouvelle classe de repository

Spring Data JPA génère l'implémentation à partir du nom des méthodes (`findByStatusOrderBySortOrderAsc`) — zéro SQL boilerplate pour 80% des cas.

---

### Q137 — Qu'est-ce que le pattern DTO et pourquoi ne pas exposer les entités directement ?

Un **DTO** (Data Transfer Object) est un objet spécialisé pour le transport de données entre couches. Exposer les entités JPA directement pose des problèmes :

- **Sécurité** : l'entité `User` contient le champ `password` hashé — ne doit jamais apparaître dans une API response
- **Couplage** : changer la DB (renommer une colonne) casse l'API
- **Lazy loading** : Jackson peut déclencher des requêtes SQL lors de la sérialisation des associations JPA
- **Flexibilité** : le DTO peut avoir un format différent de l'entité (dates formatées, champs calculés)

Dans ce projet : `ProjectResponse` (API out), `ProjectRequest` (API in), `Project` (entité DB) — trois objets distincts avec `ProjectMapper` pour les conversions.

---

### Q138 — Qu'est-ce que le pattern Singleton et comment Spring le gère-t-il ?

Le Singleton garantit qu'une seule instance d'une classe existe dans l'application. Spring implémente ce pattern nativement : par défaut, tous les beans Spring (`@Service`, `@Repository`, `@Controller`) sont des singletons gérés par le contexte.

Conséquence importante : les beans Spring doivent être **thread-safe** car plusieurs threads peuvent les utiliser simultanément. Éviter les champs d'instance mutable dans les services. Les données de requête doivent être dans des variables locales ou dans `ThreadLocal`.

---

### Q139 — Qu'est-ce que l'injection de dépendances (DI) et pourquoi l'utiliser ?

La DI est un pattern où les dépendances d'un objet lui sont fournies de l'extérieur plutôt qu'il les crée lui-même. Spring est un conteneur IoC (Inversion of Control) qui gère l'injection.

Avantages :
- **Testabilité** : injecter un mock à la place d'une vraie dépendance
- **Couplage faible** : `ProjectService` ne connaît que l'interface `ProjectRepository`, pas l'implémentation
- **Configurabilité** : changer l'implémentation sans toucher au code

Dans ce projet, injection par constructeur (recommandée) : `private final ProjectRepository projectRepository` injecté via le constructeur annoté `@Autowired` (implicite depuis Spring 4.3 avec un seul constructeur).

---

### Q140 — Qu'est-ce que l'AOP (Aspect Oriented Programming) dans Spring ?

L'AOP permet d'ajouter des comportements transversaux (logging, transaction, sécurité) sans les mélanger au code métier. Spring utilise des proxies dynamiques.

Exemples dans ce projet :
- `@Transactional` : Spring crée un proxy qui ouvre/ferme la transaction autour de la méthode
- `@Cacheable` : proxy qui vérifie Redis avant d'appeler la méthode
- `@PreAuthorize` : proxy qui vérifie les permissions avant l'exécution

Les aspects `@Around`, `@Before`, `@After` permettent de créer ses propres comportements transversaux (ex: logging automatique des temps de réponse).

---

## Platform Engineering

### Q141 — Qu'est-ce qu'une Internal Developer Platform (IDP) ?

Une IDP est une plateforme construite en interne qui abstrait la complexité de l'infrastructure pour les développeurs. Elle leur permet de déployer, monitorer et gérer leurs applications sans connaître Kubernetes, Terraform ou AWS.

Composants typiques :
- **Service Catalog** : templates de microservices, pipelines CI/CD prêts à l'emploi
- **Self-service** : un développeur crée un nouvel environnement de dev en 2 clics
- **Golden paths** : chemins recommandés pour déployer en respectant les standards de l'entreprise
- **Observabilité** : dashboards Grafana pré-configurés par type d'application

Outils : Backstage (Spotify), Port, Cortex. Ce portfolio est la fondation d'une telle plateforme.

---

### Q142 — Qu'est-ce que le concept de "You Build It, You Run It" ?

Popularisé par Amazon, ce principe dit que l'équipe qui développe un service est aussi responsable de son fonctionnement en production (pas une équipe Ops séparée).

Avantages : les développeurs font attention à la qualité, l'observabilité, les alertes car ce sont eux qui seront réveillés à 3h du matin si ça plante.

Conséquences pratiques : chaque équipe a son propre Runbook, ses propres SLOs, son accès direct à la prod, ses dashboards Grafana. Le rôle des équipes Platform/DevOps devient alors d'outiller ces équipes produit, pas de gérer la prod à leur place.

---

### Q143 — Qu'est-ce que le "shift-left security" ?

Shift-left = déplacer les activités de sécurité vers la gauche du cycle de développement (vers le début, pas à la fin).

Traditionnel : audit de sécurité en fin de projet → découverte tardive, corrections coûteuses.

Shift-left : sécurité dès le design (threat modeling), IDE plugins (Snyk, SonarLint), pre-commit hooks, SAST dans le CI, DAST sur chaque PR.

Dans ce projet : CodeQL + Checkstyle à chaque push (shift-left SAST), OWASP ZAP en CI (shift-left DAST), Dependabot (shift-left dépendances).

---

### Q144 — Qu'est-ce que le Feature Flagging et dans quel contexte l'utiliseriez-vous ?

Les feature flags permettent d'activer/désactiver des fonctionnalités en production sans redéploiement. Cas d'usage :

- **Dark launch** : déployer du code en production mais l'activer pour 1% des utilisateurs d'abord
- **A/B testing** : montrer deux versions d'une UI à des groupes différents
- **Kill switch** : désactiver une feature en cas de problème sans rollback complet
- **Progressive rollout** : activer graduellement (1% → 10% → 50% → 100%)

Outils : LaunchDarkly, Unleash, GrowthBook, ou un simple flag en DB. Spring Boot + `@ConditionalOnProperty` pour les flags simples.

---

### Q145 — Qu'est-ce que le Blue/Green Deployment ?

Deux environnements identiques (Blue = actuel, Green = nouveau). On déploie la nouvelle version sur Green, on la teste, puis on bascule le load balancer de Blue vers Green.

Avantages : rollback instantané (rebasculer vers Blue), zéro downtime, test en prod réelle.

Avec AWS : ALB + Target Groups (Blue Target Group et Green Target Group), modification des weights de routing.

Dans ce projet, le déploiement est plus simple : restart rolling du container Docker. Blue/Green serait implémenté avec ECS ou EKS + deux target groups ALB.

---

## OpenTelemetry & Observabilité avancée

### Q146 — Qu'est-ce qu'OpenTelemetry ?

OpenTelemetry (OTel) est un standard open-source pour l'observabilité. Il unifie les APIs de collecte de métriques, logs et traces en un seul framework, indépendant du backend (Jaeger, Zipkin, Datadog, etc.).

Dans Spring Boot 3, l'intégration OTel via Micrometer Tracing permet de :
- Propager automatiquement les `traceId` à travers les appels HTTP (W3C Trace Context)
- Corréler logs et traces : retrouver tous les logs d'une requête via son `traceId`
- Mesurer le temps passé dans chaque span (DB, HTTP, cache)

Ce projet utilise Micrometer (métriques) mais pas encore le tracing distribué — prochaine évolution naturelle.

---

### Q147 — Qu'est-ce qu'un span dans le distributed tracing ?

Un **trace** représente une requête de bout en bout (ex: GET /api/projects depuis Angular jusqu'à PostgreSQL).

Un **span** est une opération unitaire dans cette trace : `HTTP GET /api/projects` → span1 (controller), span2 (service), span3 (repository + SQL), span4 (Redis check).

Chaque span a : `traceId` (commun à toute la trace), `spanId`, `parentSpanId`, timestamp de début/fin, attributs.

Visualisé dans Jaeger/Zipkin : une cascade de spans montre exactement où le temps est passé. Si le span SQL prend 2s, c'est la DB qui est lente — pas le code applicatif.

---

### Q148 — Comment corréleriez-vous les logs avec les traces ?

En ajoutant le `traceId` dans chaque ligne de log. Avec Spring Boot + Micrometer Tracing :

```java
// Automatique avec spring.sleuth / micrometer-tracing
// Chaque log JSON inclut : {"traceId": "abc123", "spanId": "def456", ...}
```

Workflow d'investigation :
1. Alerte CloudWatch : erreur 5xx sur `/api/projects`
2. CloudWatch Logs : filtrer par `level=ERROR` → trouver le `traceId: abc123`
3. Jaeger : rechercher la trace `abc123` → voir le span SQL qui a pris 5s et échoué
4. PostgreSQL logs : croiser avec le `traceId` pour retrouver la requête exacte

---

### Q149 — Qu'est-ce que le profiling applicatif et quand l'utiliser ?

Le profiling mesure en détail où le temps CPU est passé dans l'application (méthode par méthode, microseconde par microseconde). Outils :

- **async-profiler** : profiler léger pour JVM, peut s'attacher à un process en production
- **JFR (Java Flight Recorder)** : intégré à la JVM, overhead minimal
- **VisualVM / JProfiler** : pour l'environnement de dev

Utilisation : quand les métriques montrent une latence élevée mais sans identifier la cause. Le profiler monte que `projectMapper.toResponse()` est appelé 10 000x et consomme 80% du CPU.

---

### Q150 — Qu'est-ce que Prometheus `PromQL` et donnez des exemples utiles.

PromQL est le langage de requête de Prometheus. Exemples pratiques :

```promql
# Taux de requêtes/sec sur les 5 dernières minutes
rate(http_server_requests_seconds_count[5m])

# p95 de latence (95% des requêtes sont plus rapides)
histogram_quantile(0.95, rate(http_server_requests_seconds_bucket[5m]))

# Taux d'erreur (5xx)
sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m]))
  / sum(rate(http_server_requests_seconds_count[5m]))

# CPU JVM utilisé
process_cpu_usage * 100

# Connexions Hikari actives
hikaricp_connections_active{pool="HikariPool-1"}

# Auth failures/minute
rate(auth_login_failure_total[1m]) * 60
```

---

## DevSecOps Culture & Processus

### Q151 — Qu'est-ce que le "Three Ways" de DevOps (Gene Kim) ?

Le livre "The Phoenix Project" définit 3 principes fondamentaux DevOps :

1. **Flow** : optimiser le flux de travail de gauche à droite (dev → ops → client). Réduire les transferts, les silos, les files d'attente. CI/CD en est l'implémentation technique.

2. **Feedback** : créer des boucles de feedback de droite à gauche. Les problèmes de prod remontent vers le dev. Monitoring, alertes, post-mortems.

3. **Continuous Learning** : expérimentation, prise de risque calculée, apprentissage des échecs. Les post-mortems sans blâme (blameless post-mortems), les chaos experiments.

---

### Q152 — Qu'est-ce qu'un blameless post-mortem ?

Après un incident, un post-mortem analyse ce qui s'est passé, pourquoi, et comment éviter la récurrence. "Blameless" signifie que personne n'est blâmé — on analyse le système, pas les individus.

Structure d'un post-mortem :
1. Résumé de l'incident (durée, impact)
2. Timeline factuelle (heure par heure)
3. Analyse des causes racines (5 Whys)
4. Actions correctives (qui fait quoi, avant quelle date)
5. Ce qui a bien fonctionné

Philosophie : si quelqu'un a fait une erreur, c'est que le système lui a permis de la faire. Améliorer le système, pas punir la personne.

---

### Q153 — Comment priorisez-vous les vulnérabilités de sécurité ?

Système CVSS (Common Vulnerability Scoring System) : score 0-10.

- **Critique (9-10)** : patch immédiat, rollback si nécessaire
- **Élevé (7-8.9)** : patch dans les 48-72h
- **Moyen (4-6.9)** : patch dans le prochain sprint
- **Faible (0-3.9)** : backlog, à traiter selon disponibilité

Facteurs supplémentaires : exploitabilité réelle (PoC public disponible ?), exposition (interne vs internet-facing), données sensibles concernées.

Dans ce projet, OWASP Dependency Check bloque le pipeline si une CVE critique est détectée sur les dépendances.

---

### Q154 — Qu'est-ce qu'un Red Team / Blue Team en cybersécurité ?

- **Red Team** : attaquants. Simulent des attaques réelles (phishing, exploitation de vulnérabilités, intrusion physique). Objectif : trouver des failles avant les vrais attaquants.
- **Blue Team** : défenseurs. Détectent et répondent aux attaques. Monitoring, SOC, incident response.
- **Purple Team** : collaboration entre Red et Blue pour améliorer les deux.

Dans ce portfolio, OWASP ZAP joue le rôle d'un outil Red Team automatisé. Un vrai Red Team testerait aussi l'ingénierie sociale et les vecteurs non-techniques.

---

### Q155 — Qu'est-ce que le principe de Defense in Depth ?

Defense in Depth (défense en profondeur) : plusieurs couches de sécurité indépendantes. Si une couche est contournée, les autres restent.

Dans ce projet :
1. **Réseau** : SG restrictif, RDS en subnet privé
2. **Transport** : HTTPS (Let's Encrypt), SSL PostgreSQL
3. **Application** : JWT, RBAC, validation des inputs
4. **Données** : chiffrement at-rest RDS/Secrets Manager, BCrypt passwords
5. **CI/CD** : SAST, DAST, SCA, images signées
6. **Monitoring** : alertes sur comportements anormaux

Si une vulnérabilité contourne l'application (SQL injection), les données sont encore chiffrées (couche 4).

---

## Spring Boot Avancé

### Q156 — Qu'est-ce que Spring WebFlux et en quoi diffère-t-il de Spring MVC ?

Spring WebFlux est le framework réactif (non-bloquant) de Spring. Spring MVC est bloquant (thread-per-request).

- **Spring MVC** : chaque requête HTTP occupe un thread pendant toute sa durée (I/O inclus). Pool de 200 threads = 200 requêtes simultanées max.
- **WebFlux** : basé sur Project Reactor. Un thread gère des milliers de requêtes avec de l'I/O non-bloquant. Idéal pour les applications avec beaucoup d'I/O (appels réseau, DB).

Ce projet utilise Spring MVC + Virtual Threads (Java 21), qui donnent les performances de WebFlux avec la simplicité du code synchrone.

---

### Q157 — Qu'est-ce que Spring Boot Actuator ?

Actuator expose des endpoints de management et de monitoring pour une application Spring Boot :

- `/actuator/health` : état global de l'app (DB, Redis, disk)
- `/actuator/health/readiness` : prête à recevoir du trafic (utilisé par K8s/Docker healthcheck)
- `/actuator/health/liveness` : vivante (utilisé par K8s pour les restarts)
- `/actuator/metrics` : toutes les métriques Micrometer
- `/actuator/prometheus` : métriques au format Prometheus (scrapé toutes les 15s)
- `/actuator/info` : informations sur l'application (version, git commit)

Dans ce projet, les endpoints health sont en `permitAll()`, prometheus est protégé par SG AWS (pas accessible depuis internet).

---

### Q158 — Comment configurez-vous les profils Spring Boot ?

Les profils permettent d'avoir des configurations différentes par environnement. Fichiers de config :
- `application.properties` : config commune
- `application-prod.properties` : surcharge pour la prod
- `application-test.properties` : surcharge pour les tests

Activation : variable d'env `SPRING_PROFILES_ACTIVE=prod` dans le docker-compose.

Dans ce projet : `application-prod.properties` désactive les endpoints Actuator sensibles, configure le niveau de log `WARN` (vs `DEBUG` en dev), active la compression HTTP.

---

### Q159 — Qu'est-ce que Bean Validation et comment l'utilisez-vous ?

Bean Validation (JSR-380) permet d'annoter les champs d'un objet avec des contraintes. Spring Boot l'intègre automatiquement.

```java
public record ProjectRequest(
    @NotBlank @Size(min=2, max=200) String title,
    @NotBlank @Size(min=10) String description,
    @URL String githubUrl  // optionnel mais validé si présent
) {}
```

Avec `@Valid` sur le paramètre du controller, Spring valide automatiquement et renvoie un 400 structuré via `@ExceptionHandler(MethodArgumentNotValidException.class)`.

Avantage : validation déclarative, réutilisable, testable unitairement.

---

### Q160 — Qu'est-ce que Spring Data Specifications et quand l'utiliser ?

Les Specifications permettent de construire des requêtes dynamiques de façon type-safe. Utile pour les filtres combinables (ex: API de recherche avec 10 critères optionnels).

```java
Specification<Project> hasStatus(ProjectStatus status) {
    return (root, query, cb) -> cb.equal(root.get("status"), status);
}
Specification<Project> isFeatured() {
    return (root, query, cb) -> cb.isTrue(root.get("featured"));
}
// Combinaison : hasStatus(ACTIVE).and(isFeatured())
```

Alternative plus simple : méthodes de repository Spring Data avec nommage (`findByStatusAndFeatured`). Specifications pour les cas complexes.

---

## Tests Avancés

### Q161 — Qu'est-ce que le contract testing et Pact ?

Le contract testing vérifie que le contrat entre un consumer (Angular) et un provider (Spring Boot) est respecté, sans déployer les deux ensemble.

**Pact** :
1. Angular écrit un test qui définit ce qu'il attend de l'API (le "contrat")
2. Pact génère un fichier JSON de contrat
3. Spring Boot vérifie que son implémentation respecte ce contrat
4. Si l'API change de façon incompatible → le test Pact échoue côté provider

Avantage : détecter les breaking changes API sans integration test complet. Scalable pour les microservices avec des dizaines de consumers.

---

### Q162 — Qu'est-ce que le test de mutation (mutation testing) ?

Le mutation testing évalue la qualité des tests en introduisant des bugs (mutations) dans le code et vérifiant que les tests les détectent.

Exemple : changer `>` en `>=` dans une condition → si aucun test ne plante, les tests ne couvrent pas vraiment ce cas.

Outil Java : **PIT (Pitest)**. Score de mutation typique visé : >70%.

Différence avec la couverture de code : 100% de coverage avec `assertTrue(true)` ne détecte rien. Un bon score de mutation prouve que les tests testent réellement le comportement.

---

### Q163 — Qu'est-ce que le Chaos Engineering et comment l'implémenter ?

Le Chaos Engineering (popularisé par Netflix avec Chaos Monkey) consiste à introduire délibérément des pannes en production pour tester la résilience.

Exemples d'expériences :
- Tuer aléatoirement des instances EC2
- Injecter de la latence réseau entre services
- Remplir le disque
- Saturer la mémoire d'un container

Outils : AWS FIS (Fault Injection Simulator), Gremlin, Chaos Toolkit.

Prérequis : avoir un monitoring solide et des mécanismes de fallback avant de commencer le chaos.

---

### Q164 — Qu'est-ce que le Property-Based Testing ?

Contrairement aux tests basés sur des exemples (`assertEquals(2, add(1,1))`), le property-based testing génère des centaines d'inputs aléatoires et vérifie des propriétés invariantes.

Exemple pour une fonction de tri :
- Propriété : la liste résultante a la même longueur
- Propriété : chaque élément est ≤ au suivant
- Propriété : tous les éléments originaux sont présents

Outil Java : **jqwik**. Outil TypeScript : **fast-check**.

Intérêt : découvrir des edge cases que les exemples manuels ne couvrent pas (strings vides, nombres négatifs, Unicode).

---

### Q165 — Comment testez-vous les Kafka consumers dans ce projet ?

Pour tester les Kafka consumers sans Kafka réel, plusieurs approches :

1. **EmbeddedKafka** (Spring Test) : démarre un Kafka in-memory dans le test
```java
@EmbeddedKafka(topics = "portfolio.projects.created")
@SpringBootTest
class AuditEventConsumerTest { ... }
```

2. **Testcontainers** : démarre un vrai Kafka container Docker pendant le test. Plus lent mais identique à la prod.

3. **Test unitaire** : mocker le `KafkaTemplate`, tester la logique du consumer directement sans infrastructure Kafka.

Dans ce projet, les consumers sont simples (log + audit) → tests unitaires Mockito suffisent.

---

## Kubernetes Avancé

### Q166 — Qu'est-ce que le RBAC Kubernetes ?

RBAC (Role-Based Access Control) contrôle qui peut faire quoi dans le cluster.

Objets :
- **Role** : permissions dans un namespace (`get pods`, `list deployments`)
- **ClusterRole** : permissions cluster-wide
- **RoleBinding** : associe un Role à un User/ServiceAccount dans un namespace
- **ClusterRoleBinding** : associe un ClusterRole globalement

Dans ce projet, ArgoCD utilise un ServiceAccount avec les permissions minimales pour déployer dans les namespaces `portfolio-dev` et `portfolio-prod`. ESO a un ServiceAccount avec accès en lecture à Secrets Manager via IAM IRSA.

---

### Q167 — Qu'est-ce qu'une Network Policy Kubernetes ?

Les Network Policies définissent les règles de communication entre pods. Sans policy, tous les pods peuvent communiquer entre eux (zero trust absent).

Exemple : autoriser seulement le backend à parler à PostgreSQL :
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-backend-to-postgres
spec:
  podSelector:
    matchLabels: {app: postgres}
  ingress:
  - from:
    - podSelector:
        matchLabels: {app: portfolio-backend}
    ports: [{port: 5432}]
```

Nécessite un CNI supportant les Network Policies (Calico, Cilium). K3s utilise Flannel par défaut qui ne les supporte pas — il faudrait configurer Calico.

---

### Q168 — Qu'est-ce que Istio et le service mesh ?

Un service mesh est une couche d'infrastructure qui gère la communication entre microservices : mTLS automatique, observabilité, traffic management, circuit breaking.

**Istio** injecte un sidecar proxy (Envoy) dans chaque pod. Ce proxy intercepte tout le trafic entrant/sortant sans modifier le code applicatif.

Fonctionnalités : chiffrement mTLS service-à-service, retries automatiques, canary deployments (10% du trafic vers v2), distributed tracing.

Complexité élevée — justifié pour des dizaines de microservices. Pour ce portfolio, NGINX est suffisant.

---

### Q169 — Qu'est-ce que les Kubernetes Probes ?

Les probes permettent à Kubernetes de savoir si un pod est sain :

- **Liveness probe** : est-ce que l'application est vivante ? Si elle échoue, Kubernetes redémarre le container. Dans ce projet : `GET /actuator/health/liveness`.
- **Readiness probe** : est-ce que l'application est prête à recevoir du trafic ? Si elle échoue, le pod est retiré du Service Endpoints (plus de trafic). Dans ce projet : `GET /actuator/health/readiness`.
- **Startup probe** : est-ce que l'application a démarré ? Pendant le démarrage, ni liveness ni readiness ne sont vérifiées. Spring Boot avec Flyway peut prendre 60s — startup probe évite les kills prématurés.

---

### Q170 — Qu'est-ce qu'un Operator Kubernetes ?

Un Operator étend l'API Kubernetes avec des CRDs (Custom Resource Definitions) et implémente des controllers qui automatisent la gestion d'applications complexes.

Exemple : l'Operator PostgreSQL surveille les ressources `PostgresCluster`. Quand vous créez une instance, l'Operator crée automatiquement les Deployments, Services, PVCs, configure la réplication, gère les backups.

Dans ce projet, External Secrets Operator est un exemple : le CRD `ExternalSecret` est surveillé par le controller ESO qui synchronise avec Secrets Manager automatiquement.

---

## Angular Avancé

### Q171 — Qu'est-ce que le Server Side Rendering (SSR) Angular et quand l'utiliser ?

Angular Universal permet le rendu côté serveur. Avantages :

- **SEO** : les crawlers voient le HTML complet, pas un `<app-root>` vide
- **Performance perçue** : First Contentful Paint plus rapide (le HTML statique arrive immédiatement)
- **Réseaux lents** : le contenu visible avant que JS soit parsé

Désavantages : complexité d'infrastructure (Node.js server), hydration (risque de mismatch server/client).

Pour ce portfolio, le SEO n'est pas prioritaire (authentification requise pour la plupart des fonctionnalités). Une future évolution serait d'activer SSR pour la page `/portfolio` publique.

---

### Q172 — Qu'est-ce que le State Management dans Angular et quand utiliser NgRx ?

L'état applicatif est l'ensemble des données qui déterminent ce qu'affiche l'UI. Sans gestion centralisée, chaque composant gère son propre état → désynchronisation.

Solutions par complexité croissante :
1. **Signals** (Angular 16+) : état local d'un composant ou partagé via un service. Simple, performant.
2. **Services + Observables** : état partagé entre composants via `BehaviorSubject`. Ce projet utilise cette approche.
3. **NgRx** (Redux pattern) : Store centralisé, Actions, Reducers, Effects. Justifié pour des apps avec état global complexe (panier e-commerce, état de collaboration temps réel).

NgRx ajoute beaucoup de boilerplate — à éviter pour un portfolio CRUD relativement simple.

---

### Q173 — Comment optimisez-vous les performances Angular ?

Techniques appliquées dans ce projet :

- **`OnPush` Change Detection** : re-rendu uniquement sur changement de Signal/Input
- **Lazy loading** : feature modules chargés à la demande
- **`trackBy` dans les boucles** : `@for (p of projects; track p.id)` → Angular ne recrée pas les DOM nodes quand la liste change
- **Signals** : pas de `zone.js` pour les changements d'état locaux
- **Image optimization** : le bucket S3 + Lambda resize crée des miniatures WebP

Outils de mesure : Lighthouse, Angular DevTools, Chrome Performance profiler.

---

### Q174 — Qu'est-ce qu'un Angular Guard et ses différents types ?

Les guards contrôlent l'accès aux routes. Types disponibles :

- **`CanActivate`** (`CanActivateFn`) : peut-on activer cette route ? (authentification, permissions)
- **`CanDeactivate`** : peut-on quitter cette route ? (formulaire non sauvegardé → confirmation)
- **`CanLoad`** : peut-on charger le module lazy ? (vérifié avant le téléchargement)
- **`CanMatch`** : Angular 14+, version moderne de CanLoad
- **`Resolve`** : pré-charger les données avant d'afficher la route

Dans ce projet : `authGuard` (CanActivateFn) pour les routes authentifiées, `adminGuard` pour les routes admin.

---

### Q175 — Qu'est-ce que PWA (Progressive Web App) ?

Une PWA est une app web qui se comporte comme une app native :
- **Offline** : Service Worker met en cache les assets → fonctionne sans réseau
- **Installable** : peut être ajoutée à l'écran d'accueil du mobile
- **Push notifications** : même mécanisme qu'une app native
- **Background sync** : synchronise les données quand la connexion revient

Angular CLI génère une PWA avec `ng add @angular/pwa`. Ce projet n'est pas une PWA (pas de mode offline pertinent pour un portfolio admin).

---

## FinOps & Coûts Cloud

### Q176 — Qu'est-ce que le FinOps et en quoi concerne-t-il les DevOps ?

FinOps = Financial + DevOps. C'est la pratique de responsabiliser les équipes techniques sur les coûts cloud. Chaque équipe voit les coûts générés par ses services et les optimise.

Dans les grandes orgs cloud : les développeurs provisionnent des ressources sans visibility sur les coûts → factures AWS surprises. FinOps amène :
- Tagging systématique des ressources (tag `team`, `environment`, `project`)
- Dashboards de coûts par équipe/service
- Budgets et alertes
- Rightsizing régulier (supprimer les ressources sous-utilisées)

---

### Q177 — Qu'est-ce que les Reserved Instances et les Savings Plans AWS ?

Pour les charges stables et prévisibles, AWS propose des réductions en échange d'un engagement :

- **Reserved Instances** : engagement 1 ou 3 ans sur un type d'instance → jusqu'à 72% de réduction vs On-Demand
- **Savings Plans** : engagement de dépense ($/heure) → jusqu'à 66% de réduction, flexible sur le type d'instance

Pour ce portfolio : On-Demand est suffisant (trafic imprévisible, durée < 12 mois). Pour une startup avec un EC2 qui tourne 24/7, un Reserved Instance 1 an économiserait ~40%.

---

### Q178 — Comment identifiez-vous et supprimez-vous les ressources AWS inutilisées ?

Approche systématique :

1. **AWS Cost Explorer** : identifier les services avec des coûts inhabituels
2. **Trusted Advisor** : recommandations de rightsizing (EC2 sous-utilisé, EBS non attaché)
3. **CloudWatch métriques** : instances avec CPU < 5% pendant 14 jours → candidates à la suppression
4. **EBS orphelins** : volumes non attachés génèrent des coûts
5. **Elastic IPs non associées** : facturées si non attachées à une instance running
6. **ECR lifecycle policies** : sans policy, les anciennes images s'accumulent

Dans ce projet : ECR lifecycle (5 images max), EIP attachée à l'EC2, pas de ressources orphelines.

---

## Questions situationnelles avancées

### Q179 — L'application est lente en production. Comment déboguez-vous ?

Approche méthodique :

1. **Caractériser** : quelle page/endpoint ? Depuis quand ? Tous les utilisateurs ou certains ?
2. **Métriques** : Grafana → p95 latence, CPU, mémoire, connexions DB. Quel service est le goulot ?
3. **Logs** : CloudWatch Logs → erreurs corrélées ? Timeouts DB/Redis ?
4. **APM/Tracing** : si OpenTelemetry configuré → quel span est lent ?
5. **DB** : `EXPLAIN ANALYZE` sur les requêtes lentes. Index manquant ?
6. **Profiler** : si le problème est CPU → async-profiler pour identifier la méthode couteuse

Ne jamais optimiser sans mesurer d'abord (premature optimization).

---

### Q180 — Comment gérez-vous un incident P1 (production down) ?

Processus ITSM appliqué :

1. **Triage** (0-5 min) : confirmer l'impact, notifier les parties prenantes
2. **Communication** : status page, message Slack #incidents, informer le management
3. **Mitigation** (5-15 min) : rollback si dégradation récente, failover si possible
4. **Diagnostic** : logs, métriques, derniers changements (git log depuis 24h)
5. **Résolution** : fix ou contournement
6. **Post-mortem** (J+2) : timeline, RCA, actions préventives

Règle : **communiquer souvent**, même pour dire "pas encore de solution". Le silence est le pire.

---

### Q181 — Vous découvrez une CVE critique dans une dépendance en production. Que faites-vous ?

Processus de réponse :

1. **Évaluer** : est-ce que cette CVE est exploitable dans notre contexte ? (score CVSS, vecteur d'attaque, configuration)
2. **Patch disponible** ? Si oui : mettre à jour la dépendance, tests, déployer en urgence
3. **Pas de patch** : existe-t-il un workaround ? (désactiver une feature, WAF rule pour bloquer le vecteur)
4. **Communiquer** : informer l'équipe sécurité, le management
5. **Documenter** : qui a fait quoi, quand, pourquoi — utile pour la compliance

Prévention : Dependabot + alertes CVE en continu évitent les surprises.

---

### Q182 — Un développeur a committé une clé AWS dans Git. Que faites-vous ?

Actions immédiates (dans la minute) :

1. **Révoquer** la clé dans AWS IAM Console → Actions → Make inactive / Delete
2. **Vérifier** dans CloudTrail les API calls faits avec cette clé dans les 24h
3. **Nettoyer Git** : `git filter-branch` ou BFG Repo Cleaner pour supprimer la clé de l'historique
4. **Force-push** sur la branche (et avertir l'équipe)
5. **Générer** une nouvelle clé et la stocker correctement dans GitHub Secrets

Prévention : `git-secrets` ou `truffleHog` dans les pre-commit hooks + Trivy scan des repos. AWS a un système de détection automatique qui révoque les clés trouvées sur GitHub public.

---

### Q183 — Comment géreriez-vous la migration de base de données sans downtime ?

Technique : migration en plusieurs étapes avec compatibilité backward.

Étape 1 : ajouter la nouvelle colonne nullable (migration sans breaking change)
Étape 2 : déployer le code qui écrit dans les deux colonnes
Étape 3 : backfiller les données existantes
Étape 4 : ajouter la contrainte NOT NULL
Étape 5 : déployer le code qui lit la nouvelle colonne
Étape 6 : supprimer l'ancienne colonne

Flyway gère les étapes : chaque migration est un fichier numéroté. Les migrations sont idempotentes et irréversibles par conception.

---

### Q184 — Quelle est votre approche pour la sécurisation d'une API REST publique ?

Checklist appliquée :

1. **HTTPS uniquement** : HSTS header (`Strict-Transport-Security`)
2. **Authentification** : JWT, rotation des secrets
3. **Authorization** : RBAC granulaire, principe du moindre privilège
4. **Validation** : tout input validé avant traitement
5. **Rate limiting** : par IP ou par token
6. **CORS** : origins strictement définies
7. **Headers de sécurité** : `X-Content-Type-Options`, `X-Frame-Options`, `CSP`
8. **Logging** : tous les accès loggés avec requestId
9. **Dépendances** : scan CVE automatique
10. **Pentest** : OWASP ZAP ou équivalent en CI

---

### Q185 — Comment assurez-vous la continuité de service lors d'une mise à jour du schéma DB ?

Strategy "expand and contract" :

**Expand** (phase 1) : migration additive seulement.
- Ajouter une colonne nullable
- Ajouter une table
- Jamais renommer/supprimer directement

Déployer le code compatible avec l'ancien ET le nouveau schéma.

**Contract** (phase 2, sprint suivant) : nettoyer.
- Supprimer l'ancienne colonne maintenant inutilisée
- Rendre la colonne NOT NULL après backfill complet

Avantage : rollback possible à tout moment (l'ancien code fonctionne toujours avec le nouveau schéma).

---

## Tendances & Innovations

### Q186 — Qu'est-ce que le GitOps 2.0 et Flux vs ArgoCD ?

**Flux v2** et **ArgoCD** sont les deux leaders GitOps CNCF. Comparaison :

| | ArgoCD | Flux v2 |
|--|--------|---------|
| UI | Web UI complète | Dashboards Weave |
| Multi-tenant | Projets isolés | Kustomizations |
| Multi-cluster | Oui natif | Oui via providers |
| Notifications | Intégrées | Via Notification Controller |
| Apprentissage | Plus facile | Plus "Kubernetes-native" |

Ce projet utilise ArgoCD pour l'App of Apps pattern, l'UI de visualisation, et la compatibilité Helm + Kustomize.

---

### Q187 — Qu'est-ce que l'eBPF et son impact sur l'observabilité ?

eBPF (Extended Berkeley Packet Filter) permet d'exécuter des programmes sandboxés dans le kernel Linux sans modifier le code source des applications.

Impact sur l'observabilité :
- **Cilium** : networking K8s + observabilité réseau basée eBPF (remplace iptables)
- **Pixie** : monitoring applicatif automatique sans instrumentation de code (trace les syscalls)
- **Falco** : détection d'anomalies de sécurité en temps réel (ex: container qui exécute `bash`)

Avantage clé : observer des applications sans les modifier (auto-instrumentation), overhead minimal.

---

### Q188 — Qu'est-ce que le concept de "Platform as a Product" ?

L'équipe Platform (infra, DevOps) se comporte comme une équipe produit dont les clients sont les équipes développement.

Implications :
- **Roadmap** : priorisation basée sur les besoins des équipes (pas sur la techno pour la techno)
- **UX** : l'Internal Developer Platform doit être facile à utiliser (Developer Experience)
- **SLA** : l'équipe Platform a des engagements de disponibilité envers ses clients internes
- **Feedback** : NPS interne, interviews des développeurs
- **Self-service** : moins de tickets "ouvrir-moi-un-port", plus de portails en libre-service

---

### Q189 — Qu'est-ce que Wasm (WebAssembly) dans le contexte cloud/backend ?

WebAssembly est un bytecode portable s'exécutant dans les navigateurs. Dans le cloud, WASI (WebAssembly System Interface) permet d'exécuter du Wasm côté serveur.

Applications DevOps/cloud :
- **Plugins Envoy** : filtres HTTP personnalisés en Wasm (vs C++ complexe)
- **Serverless edge** : CloudFlare Workers exécute du Wasm à la périphérie réseau
- **Sécurité** : sandboxing plus fort que les containers pour l'exécution de code untrusted

Encore émergent pour les backends traditionnels, mais à surveiller pour les edge functions.

---

### Q190 — Qu'est-ce que la Software Supply Chain Security ?

La supply chain d'un logiciel inclut tous les composants tiers : bibliothèques, images base, outils CI/CD, pipelines. Une compromission de la supply chain peut injecter du code malveillant dans des milliers d'applications (ex: SolarWinds, Log4Shell).

Mesures appliquées dans ce projet :
- **SBOM** (CycloneDX) : inventaire complet des composants
- **Cosign** : signature cryptographique des images Docker
- **Dependabot** : mise à jour automatique des dépendances vulnérables
- **SLSA (Supply chain Levels for Software Artifacts)** : framework de bonnes pratiques
- **Pinning des versions** : images Docker avec SHA digest fixe plutôt que `:latest`

---

## Questions finales

### Q191 — Expliquez OWASP Top 10 et lesquels avez-vous adressés ?

Le Top 10 OWASP liste les vulnérabilités web les plus critiques :

| Vuln | Mitigation dans ce projet |
|------|--------------------------|
| A01 Broken Access Control | RBAC Spring Security, `@PreAuthorize` |
| A02 Cryptographic Failures | HTTPS, BCrypt, chiffrement at-rest RDS |
| A03 Injection | JPA paramétré, Bean Validation |
| A04 Insecure Design | Threat modeling, defense in depth |
| A05 Security Misconfiguration | Security headers, SG restrictif |
| A06 Vulnerable Components | Dependabot, OWASP Dependency Check |
| A07 Auth Failures | JWT, BCrypt cost 12, brute-force alerting |
| A08 Integrity Failures | Cosign image signing, SBOM |
| A09 Logging Failures | Logs JSON structurés, CloudTrail |
| A10 SSRF | Validation des URLs, pas de proxy interne |

---

### Q192 — Qu'est-ce que le Zero Trust Security Model ?

Zero Trust = "Ne jamais faire confiance, toujours vérifier". Opposé au modèle "castle and moat" (périmètre sécurisé + confiance interne).

Principes :
1. Vérifier explicitement l'identité à chaque accès (pas de "déjà dans le réseau = de confiance")
2. Principe du moindre privilège (accès minimal nécessaire)
3. Assumer la compromission (surveiller le trafic interne)

Dans ce projet : même les services internes (backend → RDS) utilisent SSL + credentials. L'IAM Role EC2 a des permissions minimales. Les Network Policies K8s limiteraient le trafic pod-à-pod.

---

### Q193 — Qu'est-ce que l'Infrastructure Immutable ?

L'infra immutable = une fois déployée, une instance n'est jamais modifiée. Pour changer la configuration : on construit une nouvelle image et on remplace l'ancienne.

Avantages :
- Pas de "snowflake servers" (serveurs uniques avec configurations manuelles accumulées)
- Déploiements reproductibles
- Facilite le rollback (garder l'ancienne image)

Dans ce projet : les images Docker sont immutables (tag SHA). L'EC2 user-data est exécuté une seule fois. En revanche, la configuration docker-compose.yml est modifiable (pas totalement immutable) — une amélioration serait de rebuilder l'AMI EC2 à chaque changement de config.

---

### Q194 — Qu'est-ce qu'un Runbook et comment en écrivez-vous un ?

Un Runbook est un document qui décrit les procédures opérationnelles : comment démarrer/arrêter un service, investiguer une alarme, effectuer une maintenance.

Structure d'un bon Runbook :
1. **Nom de l'alerte** : "CPU EC2 > 80% pendant 5 min"
2. **Symptômes** : latence augmentée, timeouts
3. **Impact** : utilisateurs affectés
4. **Actions immédiates** : vérifier les containers, les logs
5. **Investigation** : `docker stats`, top, CloudWatch
6. **Remédiation** : restart backend, scale up, identifier la requête lourde
7. **Escalade** : contacter X si non résolu en 30 min

---

### Q195 — Comment auditez-vous les accès AWS ?

Trois outils complémentaires :

1. **CloudTrail** : toutes les API calls avec qui/quand/où. Requêtable via Athena.
2. **AWS Config** : état de configuration des ressources dans le temps. Règles de conformité.
3. **Access Analyzer** : identifie les ressources accessibles depuis l'extérieur (S3 publics, rôles IAM trop permissifs)

Pour la compliance (SOC 2, ISO 27001) : exporter CloudTrail vers S3 + Glacier avec un verrou d'objet (Write Once Read Many) pour l'immuabilité des logs d'audit.

---

### Q196 — Qu'est-ce que le principe de "Configuration as Code" ?

Toute configuration d'infrastructure, de pipeline, de monitoring est définie dans des fichiers versionés dans Git — pas de configuration manuelle via une UI.

Dans ce projet :
- Infrastructure → Terraform (`.tf`)
- Pipelines CI/CD → GitHub Actions (`.yml`)
- Dashboards Grafana → JSON provisionnés automatiquement
- Alertes → CloudWatch (Terraform)
- K8s manifests → Helm + Kustomize
- Certificats → Certbot config

Avantage : une démo "from scratch" = `git clone` + `terraform apply` + quelques commandes.

---

### Q197 — Quelles certifications AWS recommanderiez-vous pour un DevSecOps ?

Parcours recommandé :

1. **AWS Cloud Practitioner** (niveau fondations) : compréhension globale des services AWS
2. **AWS Solutions Architect Associate** : concevoir des architectures AWS robustes
3. **AWS DevOps Engineer Professional** : CI/CD, IaC, monitoring
4. **AWS Security Specialty** : IAM, KMS, Macie, GuardDuty, WAF

Complémentaires :
- **CKA** (Certified Kubernetes Administrator) : indispensable pour K8s en prod
- **CKS** (Certified Kubernetes Security Specialist) : sécurité K8s
- **HashiCorp Terraform Associate** : Terraform best practices

---

### Q198 — Comment présenteriez-vous ce projet en 2 minutes à un non-technique ?

"J'ai construit une application web complète déployée sur le cloud d'Amazon, accessible à l'adresse charrad-devsecops.duckdns.org. Ce n'est pas juste une app — c'est tout le cycle de vie d'un logiciel professionnel :

- L'app elle-même : une interface Angular moderne reliée à une API Java, avec une base de données PostgreSQL
- La sécurité : tests automatiques qui détectent les failles, les données sont chiffrées, les accès sont contrôlés
- Le déploiement automatique : quand je modifie le code, en 8 minutes c'est en production — sans intervention manuelle
- Le monitoring : tableaux de bord Grafana qui montrent en temps réel si l'app est saine

Le tout en Free Tier AWS : ~$0/mois pendant 12 mois."

---

### Q199 — Quelle est selon vous la compétence la plus importante d'un DevSecOps engineer ?

La **capacité à voir le système dans son ensemble** — comprendre comment le code, l'infrastructure, la sécurité et les opérations s'interconnectent, et comment un changement dans une couche impacte les autres.

Techniquement, les outils changent vite (le Kubernetes d'aujourd'hui n'est pas celui de demain). Mais comprendre pourquoi on fait des tests, pourquoi on automatise, pourquoi on monitore — ces principes sont permanents.

Humainement : la communication. Un incident à 3h du matin se résout mieux avec une équipe qui communique clairement qu'avec la meilleure stack technique du monde.

---

### Q200 — Pourquoi vous plutôt qu'un autre candidat ?

Ce portfolio répond directement à cette question :

1. **Je construis, je ne théorise pas** : 21 phases implémentées, toutes commitées et déployées. Chaque technologie citée dans le CV est visible dans le code et en production.

2. **Je comprends les compromis** : K3s vs Docker Compose, t3.micro vs t3.small, Free Tier vs performance. Les décisions sont documentées avec les raisons, pas juste la solution retenue.

3. **Je pense sécurité dès le début** : SAST, DAST, SBOM, IAM least privilege — pas un audit de sécurité à la fin.

4. **Je suis autonome** : ce projet a été construit de zéro, de l'architecture à la production, en autonomie complète.

5. **Je documente** : les questions d'entretien que vous me posez ont leurs réponses dans `docs/INTERVIEW-QUESTIONS.md` — parce que je pense toujours à la transmission et à la maintenabilité.
