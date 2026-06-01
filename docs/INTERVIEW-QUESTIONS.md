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
