# Bilan de Compétences — Portfolio DevSecOps
## Amine Charrad · amine.charrad@gmail.com

> Ce document recense les compétences démontrées et pratiquées à travers la construction
> d'un portfolio DevSecOps complet en 20 phases — du développement applicatif jusqu'au
> déploiement Kubernetes GitOps sur AWS Free Tier.
>
> Dépôt : https://github.com/amine77/devsecops-angular-java21-aws

---

## ☁️ Cloud & Infrastructure (AWS)

| Compétence | Niveau | Détail pratique |
|---|---|---|
| **Amazon EC2** | Avancé | t3.micro Free Tier, IAM Instance Profile, Elastic IP, IMDSv2, user_data bootstrap |
| **Amazon RDS** | Avancé | PostgreSQL 15, db.t3.micro, subnet privé, security groups SG→SG |
| **Amazon ECR** | Avancé | Registres privés, scan on push, lifecycle policies, authentification sans clé (IAM) |
| **Amazon VPC** | Intermédiaire | Subnets public/privé, Internet Gateway, route tables, NACLs |
| **AWS Lambda** | Intermédiaire | 3 fonctions Node.js 20 ESM : EventBridge Scheduler, S3 trigger, API Gateway HTTP |
| **Amazon S3** | Intermédiaire | Event notifications, stockage Lambda artifacts, cycle de vie |
| **API Gateway** | Intermédiaire | HTTP API, intégration Lambda, CORS, déploiements |
| **Amazon SES** | Intermédiaire | Envoi d'emails HTML, sandbox mode, identités vérifiées |
| **Amazon CloudWatch** | Intermédiaire | Métriques EC2, alarmes CPU/mémoire, log groups, dashboards |
| **AWS IAM** | Avancé | Rôles, policies moindre privilège, Instance Profiles, trust policies |
| **AWS Free Tier** | Avancé | Architecture ~$0/mois : EC2+RDS+ECR+Lambda dans les limites gratuites |

---

## ⎈ Kubernetes & Conteneurisation

| Compétence | Niveau | Détail pratique |
|---|---|---|
| **Kubernetes** | Avancé | Deployment, Service, Ingress, ConfigMap, Secret, HPA (autoscaling/v2), PDB |
| **K3s** | Intermédiaire | Single-node, Traefik intégré, SWAP 4GB, flags JVM contraints (-Xmx256m) |
| **Helm** | Avancé | Chart complet (9 templates), _helpers.tpl, valeurs hiérarchiques, HPA/PDB conditionnels |
| **Kustomize** | Intermédiaire | Base + overlays dev/prod, patches replicas/resources/ingress, image tags |
| **Docker** | Avancé | Multi-stage build (Maven→JRE Alpine), NGINX Alpine, images <30MB frontend |
| **Docker Compose** | Avancé | Stack locale dev (Postgres, Redis, Prometheus, Grafana, Kafka) |
| **NGINX** | Intermédiaire | Reverse proxy, path rewriting, static files Angular, non-root |
| **Security Context K8s** | Intermédiaire | runAsNonRoot, readOnlyRootFilesystem, capabilities drop ALL, anti-affinité |

---

## 🔄 GitOps & CI/CD

| Compétence | Niveau | Détail pratique |
|---|---|---|
| **ArgoCD** | Avancé | App of Apps pattern, sync auto dev / sync manuelle prod, prune + selfHeal |
| **GitOps (modèle pull)** | Avancé | CI push image ECR → yq update values → ArgoCD détecte → rolling update |
| **GitHub Actions** | Avancé | 9 workflows : CI backend/frontend, SBOM, SonarCloud, deploy, security, GitOps |
| **Helm + ArgoCD** | Avancé | valueFiles chainés (values.yaml + values-k3s.yaml + values-dev.yaml) |
| **yq** | Intermédiaire | Mise à jour YAML ciblée sans écraser commentaires (vs sed) |
| **Kustomize + ArgoCD** | Intermédiaire | Overlays gérés par ArgoCD avec sync automatique |
| **Dependabot** | Intermédiaire | 8 écosystèmes : Maven, npm×4, Docker×2, Actions, Terraform |
| **Rollback GitOps** | Intermédiaire | `git revert` = rollback ArgoCD, `helm rollback` natif |

---

## 🔒 DevSecOps & Sécurité

| Compétence | Niveau | Détail pratique |
|---|---|---|
| **SonarCloud** | Avancé | Quality Gate Java 21 + Angular 20, couverture JaCoCo + lcov, badges |
| **OWASP ZAP (DAST)** | Intermédiaire | Scan authentifié, workflow CI automatisé, suppressions commentées |
| **OWASP Dependency Check** | Intermédiaire | Scan Maven + npm, rapport SARIF, seuil CVSS configurable |
| **Trivy** | Avancé | Scan image Docker (CRITICAL/HIGH), scan filesystem (secrets + IaC), SARIF |
| **SBOM CycloneDX** | Intermédiaire | Génération Maven plugin 2.8.x, @cyclonedx/cyclonedx-npm, format JSON/XML |
| **Cosign / SLSA** | Intermédiaire | Signature keyless via Sigstore Fulcio + Rekor, SLSA Level 2 |
| **Gitleaks** | Intermédiaire | Règles custom .gitleaks.toml, historique Git complet, allowlist |
| **CodeQL** | Intermédiaire | SAST Java + TypeScript, intégration GitHub Security |
| **Semgrep** | Intermédiaire | SAST p/typescript, p/secrets, p/owasp-top-ten, SARIF upload |
| **OpenSSF Scorecard** | Intermédiaire | Évaluation bonnes pratiques open-source, publication résultats |
| **JWT / Spring Security** | Avancé | HS384, BCrypt cost=12, filtre JWT, IMDSv2, RBAC admin/user |
| **Supply Chain Security** | Intermédiaire | SBOM + Cosign + Dependabot + Gitleaks = pipeline sécurisé E2E |
| **Politique de sécurité** | Intermédiaire | SECURITY.md, divulgation responsable, CVE workflow |

---

## 📊 Observabilité & Monitoring

| Compétence | Niveau | Détail pratique |
|---|---|---|
| **Prometheus** | Intermédiaire | Scrape Spring Boot Actuator, règles d'alerte, prometheus.yml |
| **Grafana** | Intermédiaire | 3 dashboards : API metrics, Kafka topics, Redis cache hits/misses |
| **Micrometer** | Intermédiaire | Compteurs custom, timers, gauges sur les endpoints métier |
| **Logback JSON** | Intermédiaire | Structured logging, MDC (correlationId, userId), CloudWatch compatible |
| **CloudWatch Alarms** | Intermédiaire | CPU > 80%, intégration SNS email, 10 alarmes Free Tier |
| **Spring Boot Actuator** | Avancé | /health/liveness, /health/readiness, /prometheus, /info |

---

## 🧪 Tests

| Compétence | Niveau | Détail pratique |
|---|---|---|
| **JUnit 5 + Mockito** | Avancé | 47 tests unitaires + intégration, couverture ≥70%, mocks services |
| **Jest (Angular)** | Avancé | 53 tests composants + services + guards, couverture lcov |
| **Cypress E2E** | Intermédiaire | 3 scénarios : auth, admin CRUD, portfolio public |
| **k6 Load Tests** | Intermédiaire | 3 scénarios : 100 VUs public, 50 VUs stress auth, 5 VUs CRUD admin |
| **TestContainers** | Intermédiaire | Tests d'intégration PostgreSQL réel (isolés des tests unitaires CI) |
| **Coverage thresholds** | Intermédiaire | JaCoCo 70% backend, Jest branches 40% frontend |
| **DAST automatisé** | Intermédiaire | ZAP CI workflow avec authentification JWT |

---

## 🖥️ Backend — Java / Spring Boot

| Compétence | Niveau | Détail pratique |
|---|---|---|
| **Java 21** | Avancé | Virtual Threads (Project Loom), Records, Pattern Matching |
| **Spring Boot 3.3** | Avancé | REST API, Spring Data JPA, Spring Cache, Spring Security, Actuator |
| **PostgreSQL / Flyway** | Avancé | Migrations versionnées V1→V5, schema evolution, transactions |
| **Redis (@Cacheable)** | Intermédiaire | TTL 5/10 min, `@CacheEvict`, Spring Cache abstraction |
| **Apache Kafka KRaft** | Intermédiaire | Broker sans Zookeeper, 3 topics métier, consumer groups, JSON serde |
| **JWT HS384** | Avancé | Filtre Spring, claims custom, refresh token pattern |
| **BCrypt cost=12** | Avancé | Hashage sécurisé, attention au warm-up JIT (cf. -XX:TieredStopAtLevel=1) |
| **Checkstyle** | Intermédiaire | Règles Google Java Style, intégration Maven + CI |
| **Maven** | Avancé | Multi-module, plugins (Surefire, JaCoCo, CycloneDX, Checkstyle) |

---

## 🎨 Frontend — Angular

| Compétence | Niveau | Détail pratique |
|---|---|---|
| **Angular 20** | Avancé | Standalone components, Signals, `ChangeDetectionStrategy.OnPush` |
| **Angular Material 3** | Avancé | Dark theme azure/cyan, `provideAnimations()`, MDC components |
| **TypeScript 5.8** | Avancé | Types stricts, Guards fonctionnels, `withComponentInputBinding()` |
| **RxJS** | Intermédiaire | Interceptors JWT, error interceptor, Observables services |
| **Angular Signals** | Avancé | `signal()`, `computed()`, `effect()` — sans AsyncPipe ni subscribe |
| **CSS Animations** | Intermédiaire | `@keyframes` fadeInUp/orbFloat/pingPulse, stagger delays CSS custom props |
| **SCSS / BEM** | Avancé | Architecture CSS variables, dark theme, responsive, Prettier |
| **Lazy Loading** | Avancé | Feature modules (auth, portfolio, admin), `loadChildren` |

---

## ⚡ Serverless

| Compétence | Niveau | Détail pratique |
|---|---|---|
| **AWS Lambda Node.js 20** | Intermédiaire | ESM modules, 3 fonctions event-driven |
| **EventBridge Scheduler** | Intermédiaire | Cron `cron(0 8 ? * MON *)`, rapport hebdomadaire |
| **S3 Event Notifications** | Intermédiaire | PutObject trigger → image resize → 3 variantes WebP (Sharp) |
| **API Gateway HTTP** | Intermédiaire | POST /contact → validation → SES Reply-To visiteur |
| **AWS Free Tier Lambda** | Avancé | 1M req/mois gratuits, 400k GB-s compute — $0/mois |

---

## 🤖 IA & Outillage Moderne

| Compétence | Niveau | Détail pratique |
|---|---|---|
| **Claude Code CLI** | Avancé | Assistant IA dans le terminal, lecture/modification codebase entière |
| **Model Context Protocol (MCP)** | Intermédiaire | Architecture agent-tool, serveurs MCP npm, tools JSON-Schema |
| **21st Magic MCP** | Intermédiaire | Génération composants UI via MCP, adaptation React/Tailwind → Angular/SCSS |
| **AI-Assisted Development** | Avancé | Workflow : inspiration → adaptation → intégration, 8 composants redessinés |
| **Claude Code Skills** | Intermédiaire | Skills spécialisés (.md), angular-best-practices, ui-ux-designer |
| **Prompt Engineering** | Intermédiaire | Contexte codebase, contraintes techniques, itérations ciblées |

---

## 🛠️ Infrastructure as Code

| Compétence | Niveau | Détail pratique |
|---|---|---|
| **Terraform** | Avancé | Modules VPC/EC2/RDS/ECR/Lambda/CloudWatch, `templatefile()`, outputs |
| **Terraform modules** | Avancé | 8 modules réutilisables, variables typées + validations |
| **Terraform Free Tier** | Avancé | Architecture $0/mois sur les ressources AWS gratuites |
| **User Data Scripts** | Avancé | Bootstrap Docker Compose ET K3s + ArgoCD via `templatefile()` |
| **State Management** | Intermédiaire | Remote state, sensitive variables, `terraform.tfvars` |

---

## 🔧 Outils & Pratiques Transverses

| Outil / Pratique | Maîtrise |
|---|---|
| **Git / GitHub** | Branching, conventional commits, hooks, Dependabot PRs |
| **GitHub Advanced Security** | SARIF uploads, Code scanning, Secret scanning |
| **Makefile** | Targets `up/down/test/sbom/sonar/security-phase16` |
| **Linux / Shell (Bash)** | Scripts bootstrap 250 lignes, crons, systemd, sysctl |
| **Windows PowerShell** | Environnement de développement Windows + WSL |
| **npm / Node.js** | lock files, workspaces, audit, CVE management |
| **ESLint / Prettier** | Configuration TypeScript stricte, CI enforcement |
| **YAML / JSON** | K8s manifests, GitHub Actions, Helm values, ArgoCD |

---

## 📈 Chiffres Clés du Projet

| Métrique | Valeur |
|---|---|
| **Phases complètes** | 20 phases du dev local au K8s GitOps |
| **Lignes de code** | ~15 000 (backend Java + frontend Angular + infra) |
| **Tests automatisés** | 47 JUnit + 53 Jest + 3 Cypress + 3 k6 = **106 tests** |
| **Workflows CI/CD** | 9 GitHub Actions workflows actifs et verts |
| **Composants redessinés** | 8 composants Angular (design AI-assisted) |
| **Fichiers Terraform** | 28 fichiers .tf, 8 modules |
| **Templates Helm** | 9 templates, 3 values files (base, dev, prod, k3s) |
| **Coût infrastructure** | ~$0/mois (Free Tier 12 mois) |
| **Images Docker** | 2 images optimisées : backend ~200MB, frontend ~25MB |
| **SonarCloud** | Quality Gate ✅, 0 bugs critiques |

---

## 🎯 Résumé Profil pour CV

```
Ingénieur Fullstack DevSecOps — Angular 20 · Spring Boot Java 21 · AWS · Kubernetes

• CI/CD sécurisée : GitHub Actions, SAST (SonarCloud/Semgrep/CodeQL), DAST (OWASP ZAP),
  SBOM (CycloneDX), Cosign SLSA Level 2, Trivy, Gitleaks

• Kubernetes GitOps : K3s, ArgoCD (App of Apps), Helm (chart complet), Kustomize,
  déploiement ~$0/mois sur AWS Free Tier (SWAP 4GB sur EC2 t3.micro)

• Cloud AWS : EC2, RDS, ECR, Lambda, VPC, CloudWatch, IAM — architecture Free Tier

• Observabilité : Prometheus, Grafana (3 dashboards), Logback JSON, Micrometer, CloudWatch

• Backend : Spring Boot 3.3, Java 21 (Virtual Threads), PostgreSQL, Redis, Kafka KRaft

• Frontend : Angular 20 (Signals, OnPush), Angular Material 3, CSS animations

• IA & Outillage : Claude Code CLI, Model Context Protocol (MCP), 21st Magic MCP

• 106 tests automatisés · 9 workflows CI/CD verts · 20 phases DevSecOps
```

---

## 💡 Compétences Différenciantes

Ces compétences sont peu communes sur les profils juniors/mid-level :

1. **Supply Chain Security complète** — SBOM + Cosign + OpenSSF Scorecard + Gitleaks en pipeline CI
2. **GitOps modèle pull** — ArgoCD App of Apps avec Helm + yq + GITOPS_TOKEN pattern
3. **K3s Free Tier** — Kubernetes ~$0/mois grâce à SWAP + JVM contrainte (-Xmx256m)
4. **MCP / AI tooling** — Maîtrise du Model Context Protocol et de l'AI-assisted development
5. **Observabilité production** — Stack Prometheus + Grafana + structured logging + MDC
6. **Java 21 Virtual Threads** — Adoption des nouveautés JVM en production

---

*Généré automatiquement depuis le portfolio DevSecOps — github.com/amine77/devsecops-angular-java21-aws*
