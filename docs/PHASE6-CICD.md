# Phase 6 — Pipeline CI/CD complet

## Vue d'ensemble

```
                     ┌─────── GitHub Repository ───────────────────────────────┐
                     │                                                          │
   git push main     │   ┌─────────────────────────────────────────────────┐   │
   ──────────────────┼──►│          PIPELINES CI (existants)               │   │
                     │   │                                                 │   │
                     │   │  ci-backend.yml    ci-frontend.yml              │   │
                     │   │  ├─ Checkstyle     ├─ ESLint + Prettier         │   │
                     │   │  ├─ Build Maven    ├─ Tests Jest                │   │
                     │   │  ├─ CodeQL SAST    ├─ Build Angular             │   │
                     │   │  ├─ OWASP DC       ├─ Semgrep SAST              │   │
                     │   │  └─ Trivy image    └─ Trivy image               │   │
                     │   └─────────────────────────────────────────────────┘   │
                     │                                                          │
   terraform/ change │   ┌─────────────────────────────────────────────────┐   │
   ──────────────────┼──►│       deploy-infra.yml (Phase 6)               │   │
                     │   │  ├─ terraform fmt + validate                    │   │
                     │   │  ├─ Trivy IaC scan                              │   │
                     │   │  ├─ terraform plan                              │   │
                     │   │  └─ Commentaire sur PR (plan complet)           │   │
                     │   └─────────────────────────────────────────────────┘   │
                     │                                                          │
   backend/ ou       │   ┌─────────────────────────────────────────────────┐   │
   frontend/ change  │   │       deploy-app.yml (Phase 6)                 │   │
   ──────────────────┼──►│                                                 │   │
                     │   │  ┌──────────────┐    ┌──────────────┐          │   │
                     │   │  │ build-push-  │    │ build-push-  │          │   │
                     │   │  │ backend      │    │ frontend     │          │   │
                     │   │  │              │    │              │          │   │
                     │   │  │ Trivy scan   │    │ Trivy scan   │          │   │
                     │   │  │ → ECR push   │    │ → ECR push   │          │   │
                     │   │  │ sha-XXXXXXX  │    │ sha-XXXXXXX  │          │   │
                     │   │  └──────┬───────┘    └──────┬───────┘          │   │
                     │   │         └──────────┬─────────┘                 │   │
                     │   │                    ▼                            │   │
                     │   │             ┌────────────┐                     │   │
                     │   │             │   deploy   │                     │   │
                     │   │             │            │                     │   │
                     │   │             │ Get EC2 IP │                     │   │
                     │   │             │ SSH + pull │                     │   │
                     │   │             │ Health chk │                     │   │
                     │   │             └─────┬──────┘                     │   │
                     │   └───────────────────┼─────────────────────────────┘   │
                     │                       │                                  │
                     └───────────────────────┼──────────────────────────────────┘
                                             ▼
                                    ┌─────────────────┐
                                    │   EC2 t2.micro  │
                                    │   eu-west-3     │
                                    │                 │
                                    │ docker compose  │
                                    │  pull + up -d   │
                                    │                 │
                                    │ Health check    │
                                    │ /health → 200   │
                                    └─────────────────┘
```

## Workflows créés

| Fichier | Déclencheur | Rôle |
|---------|-------------|------|
| `deploy-infra.yml` | Push/PR sur `terraform/**` | Terraform validate + plan + commentaire PR |
| `deploy-app.yml` | Push main sur `backend/**` ou `frontend/**` | Build → ECR → EC2 deploy |

## Stratégie de tags ECR

Chaque image est poussée avec **2 tags** :

```
portfolio-backend:sha-abc1234   ← immuable, pour le rollback
portfolio-backend:latest        ← pointe toujours sur la dernière version
```

**Pourquoi le SHA ?** Permet de revenir exactement à n'importe quelle version précédente sans chercher dans les logs.

## Configuration GitHub (à faire avant le premier déploiement)

### 1. Secrets (Settings → Secrets and variables → Actions → New secret)

| Nom du secret | Valeur | Pourquoi |
|---------------|--------|----------|
| `AWS_ACCESS_KEY_ID` | Clé AWS IAM | Authentification AWS CLI dans CI |
| `AWS_SECRET_ACCESS_KEY` | Secret AWS IAM | Authentification AWS CLI dans CI |
| `EC2_SSH_PRIVATE_KEY` | Contenu du fichier `.pem` | SSH vers EC2 pour le déploiement |

**Créer un utilisateur IAM dédié CI/CD** (jamais utiliser l'utilisateur root) :

```bash
# Créer un utilisateur avec les permissions minimales
aws iam create-user --user-name github-actions-deploy

# Attacher les permissions nécessaires
aws iam attach-user-policy \
  --user-name github-actions-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

aws iam attach-user-policy \
  --user-name github-actions-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess

# Créer les clés d'accès
aws iam create-access-key --user-name github-actions-deploy
# → Copier AccessKeyId et SecretAccessKey dans GitHub Secrets
```

**Récupérer la clé SSH pour EC2_SSH_PRIVATE_KEY** :

```bash
# Sur Windows (PowerShell) :
Get-Content "$env:USERPROFILE\.ssh\portfolio-key.pem"
# Copier tout le contenu (-----BEGIN RSA PRIVATE KEY----- ... -----END RSA PRIVATE KEY-----)
# et le coller dans le secret EC2_SSH_PRIVATE_KEY
```

### 2. Environnements GitHub (optionnel mais recommandé)

```
Settings → Environments → New environment
Créer : "dev" et "prod"

Pour "prod" : activer "Required reviewers" (approval avant déploiement)
```

### 3. Variables (optionnel)

```
Settings → Secrets and variables → Actions → Variables
AWS_REGION = eu-west-3  (si tu veux éviter de le hardcoder)
```

## Déclenchement manuel (rollback)

```
GitHub → Actions → 🚀 Deploy — Application → Run workflow
  ├── image_tag: sha-abc1234  (SHA du commit à redéployer)
  └── environment: dev
```

## Prérequis infrastructure

Avant que le pipeline de déploiement fonctionne :

```bash
# 1. Bootstrapper l'infrastructure Terraform
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Remplir terraform.tfvars avec les vraies valeurs
terraform init
terraform apply

# 2. Pousser manuellement les premières images (bootstrap)
# Les outputs Terraform donnent les URLs ECR
terraform output deploy_commands
# → Suivre les commandes affichées

# 3. Configurer les 3 secrets GitHub (voir ci-dessus)

# Les prochains déploiements se font automatiquement via git push main
```

## Sécurité du pipeline

| Pratique | Implémentation |
|----------|----------------|
| **Scan avant push** | Trivy CRITICAL scan sur l'image avant push ECR |
| **Credentials éphémères** | ECR token renouvelé à chaque déploiement |
| **Pas de secrets en dur** | Tout via GitHub Secrets, jamais dans les fichiers |
| **IP EC2 dynamique** | Récupérée via AWS CLI (pas de secret IP) |
| **Concurrency** | Un seul déploiement à la fois (pas de race condition) |
| **Rollback facile** | Tag SHA immuable → redéployer n'importe quel commit |
| **Audit trail** | Job Summary avec commit SHA + image URI + acteur |

## Coût CI/CD

GitHub Actions Free Tier : 2 000 minutes/mois pour les repos publics (illimité), 500 minutes pour les privés.

Estimation par déploiement :
- build-push-backend : ~3-4 min (avec cache Docker)
- build-push-frontend : ~2-3 min (avec cache Docker)
- deploy : ~2 min
- **Total : ~7-9 minutes par push**
