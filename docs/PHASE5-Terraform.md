# Phase 5 — Infrastructure AWS avec Terraform

> ⚠️ **Mise à jour 2026-07-24** : le module `rds` a été retiré du câblage de `main.tf`.
> PostgreSQL est désormais un conteneur Docker sur l'EC2 (voir
> [PHASE1-Architecture.md](PHASE1-Architecture.md)) — RDS a été définitivement supprimé
> le 24/07/2026 après une période de migration. Le dossier `terraform/modules/rds/`
> existe encore sur disque mais n'est plus référencé nulle part (code orphelin).

## Architecture déployée

```
Internet
    │
┌───┴──────────────────────── VPC 10.0.0.0/16 (eu-west-3) ──────────────────┐
│                                                                             │
│   Subnet Public eu-west-3a (10.0.1.0/24)                                   │
│   ┌──────────────────────────────────────┐                                  │
│   │  EC2 t3.small (2GB RAM)              │ ← Elastic IP (IP fixe)          │
│   │  Amazon Linux 2023                   │                                  │
│   │  ┌────────────────────────────────┐  │                                  │
│   │  │ Docker Compose (/opt/portfolio)│  │                                  │
│   │  │  • portfolio-frontend (NGINX)  │←─┤── NGINX hôte : 80/443 (HTTPS)   │
│   │  │  • portfolio-backend (Spring)  │  │                                  │
│   │  │  • portfolio-postgres          │  │  ← plus de subnet privé RDS,    │
│   │  │  • portfolio-redis             │  │    Postgres tourne ici          │
│   │  │  • portfolio-prometheus/grafana│  │                                  │
│   │  └────────────────────────────────┘  │                                  │
│   └───────────────────────────────────────┘                                  │
│                                                                              │
│   (Le subnet privé existe toujours dans le module vpc/, mais plus aucune    │
│    ressource — RDS était la seule à l'occuper — n'y est déployée)           │
└─────────────────────────────────────────────────────────────────────────────┘

ECR (Elastic Container Registry) :
  • portfolio-backend  → image Spring Boot Java 21
  • portfolio-frontend → image Angular + NGINX
```

## Choix architecturaux et compromis

| Décision | Raison |
|----------|--------|
| EC2 en subnet **public** | Pas de NAT Gateway (~$32/mois). SG restrictif compense. |
| **t3.small** EC2 | Hors Free Tier (~$16.5/mois) mais nécessaire pour faire tourner Postgres + Redis + Prometheus/Grafana + l'app sur une seule instance depuis la suppression de RDS. |
| **PostgreSQL conteneurisé** (pas RDS) | Migré le 23-24/07/2026 pour couper ~$18/mois de coûts RDS (instance + storage) hors Free Tier. Compromis assumé : SPOF app+DB sur le même EC2/EBS, mitigé par backup `pg_dump` quotidien vers S3. |
| **EIP** fixe | L'IP EC2 change au redémarrage sans EIP. |
| **IAM Instance Profile** | Jamais de clés AWS sur le serveur. `aws ecr get-login-password` et l'upload S3 des backups utilisent le rôle. |
| **IMDSv2 obligatoire** | Protège contre les attaques SSRF qui volent le token IMDSv1. |
| **VPC Flow Logs** | Audit réseau. Rétention 7 jours (coût minimal). |
| Pas d'ALB | ALB coûte ~$16/mois fixe. Nginx sur EC2 suffit pour un portfolio. |

## Prérequis

### 1. Outils locaux

```bash
# Terraform >= 1.7.0
terraform --version

# AWS CLI v2
aws --version

# Vérifier l'auth AWS
aws sts get-caller-identity
```

### 2. Clé EC2

Créer une paire de clés dans AWS Console → EC2 → Key Pairs :
```bash
# Ou via AWS CLI
aws ec2 create-key-pair \
  --region eu-west-3 \
  --key-name portfolio-key \
  --key-format pem \
  --query KeyMaterial \
  --output text > ~/.ssh/portfolio-key.pem

chmod 400 ~/.ssh/portfolio-key.pem
```

## Déploiement

### Première fois (bootstrap)

```bash
cd terraform

# 1. Copier et remplir la configuration
cp terraform.tfvars.example terraform.tfvars
# Éditer terraform.tfvars avec tes vraies valeurs

# 2. Initialiser Terraform (télécharge les providers)
terraform init

# 3. Valider la configuration
terraform validate

# 4. Prévisualiser les changements
terraform plan

# 5. Déployer (confirmer avec 'yes')
terraform apply
```

### Résultat attendu

```
Apply complete! Resources: 28 added, 0 changed, 0 destroyed.

Outputs:
application_url = "http://X.X.X.X"
ssh_command     = "ssh -i ~/.ssh/portfolio-key.pem ec2-user@X.X.X.X"
ecr_backend_url = "XXXX.dkr.ecr.eu-west-3.amazonaws.com/portfolio-backend"
```

### Après le premier apply : pousser les images

```bash
# Variables depuis les outputs Terraform
ECR_BACKEND=$(terraform output -raw ecr_backend_url)
ECR_FRONTEND=$(terraform output -raw ecr_frontend_url)

# Login ECR
aws ecr get-login-password --region eu-west-3 \
  | docker login --username AWS --password-stdin \
    $(echo $ECR_BACKEND | cut -d/ -f1)

# Build + push
docker build -t $ECR_BACKEND:latest ./backend
docker push $ECR_BACKEND:latest

docker build -t $ECR_FRONTEND:latest ./frontend
docker push $ECR_FRONTEND:latest
```

Puis démarrer la stack sur EC2 :
```bash
EC2_IP=$(terraform output -raw ec2_public_ip)
ssh -i ~/.ssh/portfolio-key.pem ec2-user@$EC2_IP \
  "sudo systemctl start portfolio"
```

## Backend Terraform distant (ACTIVÉ — S3 avec locking natif)

Le state est hébergé dans S3 depuis 2026-07 : bucket
`portfolio-terraform-state-<account-id>` (versionné, SSE-S3, accès public
bloqué). Le locking est géré nativement par S3 via `use_lockfile = true`
(Terraform >= 1.10) — **plus besoin de table DynamoDB** (approche dépréciée).

```bash
# 1. Créer le bucket (idempotent, une seule fois par compte AWS)
./scripts/bootstrap-state.sh

# 2. Le bloc backend "s3" est déjà actif dans versions.tf :
#    bucket       = "portfolio-terraform-state-<account-id>"
#    key          = "portfolio/prod/terraform.tfstate"
#    region       = "eu-west-3"
#    encrypt      = true
#    use_lockfile = true

# 3. Initialiser / migrer un state local existant :
terraform init -migrate-state
```

Avantages : state partagé dev + CI/CD, rollback via le versioning S3,
chiffrement at-rest, verrou natif sans ressource supplémentaire.

## Makefile targets

```bash
make tf-init      # terraform init
make tf-plan      # terraform plan (aperçu)
make tf-apply     # terraform apply (déploie)
make tf-destroy   # terraform destroy (supprime tout)
make tf-output    # affiche les outputs
make tf-validate  # valide la syntaxe
```

## Structure des fichiers

```
terraform/
├── .gitignore                  # Ignore state, .tfvars, .terraform/
├── versions.tf                 # Versions Terraform + provider AWS
├── main.tf                     # Orchestre les 9 modules réellement câblés
├── variables.tf                # Variables documentées avec validations, dont deployment_mode
├── outputs.tf                  # Outputs (IP, URLs, commandes) — plus de rds_endpoint/rds_jdbc_url
├── terraform.tfvars.example    # Template (sans secrets, commitable)
└── modules/
    ├── vpc/                    # VPC + subnets public/privé + IGW + routes + VPC Flow Logs
    ├── ecr/                    # 2 repos ECR + lifecycle policies + scan on push
    ├── security-groups/        # SG EC2 (80/443/22) — plus de SG RDS dédié
    ├── ec2/                    # AMI AL2023 + IAM role (dont backup S3) + EIP + user-data + CloudWatch alarm
    ├── secrets-manager/        # Phase 21 — secrets applicatifs (JWT, etc.)
    ├── cloudwatch/             # Alarmes + log groups applicatifs
    ├── lambda-contact-form/    # Phase 15 — Lambda serverless
    ├── lambda-image-resize/    # Phase 15 — Lambda serverless
    └── lambda-weekly-report/   # Phase 15 — Lambda serverless
```

Le module `rds/` a été retiré de `main.tf` le 24/07/2026 puis supprimé du dépôt :
laisser du code orphelin dans `modules/` entretient l'illusion qu'il est encore
utilisé et le fait scanner par la CI sans qu'il soit jamais appliqué.

## Sécurité

- **Secrets** : jamais dans le state ou le code → variables sensibles + terraform.tfvars non committé
- **PostgreSQL** : conteneurisé sur l'EC2, aucune clé `ports:` déclarée sur le service en production — sans publication, la base n'est joignable que depuis le réseau Docker. Plus de RDS/subnet privé dédié depuis le 24/07/2026
  > ⚠️ Écrire `ports: []` dans un fichier d'override Compose **n'annule rien** : Compose *fusionne* les listes au lieu de les remplacer. Il faut `ports: !override []`. Piège vérifié le 25/07/2026 sur `docker-compose.prod.yml`, où le 8080 du backend était réellement publié malgré un `ports: []`.
- **EC2** : IMDSv2 obligatoire, chiffrement root volume, IAM moindre privilège (dont policy `s3:PutObject` scopée au préfixe `db-backups/*` pour les backups Postgres)
- **SG** : principe du moindre privilège, pas de règles overly permissive
- **VPC Flow Logs** : audit de tout le trafic réseau
- **ECR** : scan CVE automatique à chaque push

## Coût estimé

> Coûts réels post-migration (24/07/2026) — voir [FINOPS-Cost-Analysis.md](FINOPS-Cost-Analysis.md)
> pour le détail et l'historique complet (avant/après suppression de RDS).

| Ressource | Coût mensuel réel |
|-----------|---------------------|
| EC2 t3.small (compute) | ~$16.5/mois (hors Free Tier) |
| PostgreSQL (conteneur sur l'EC2) | $0 (inclus dans le coût EC2) |
| ECR (< 500 MB) | $0 |
| EIP (attachée) | $0 |
| VPC (NAT/data transfer) | ~$3/mois |
| Secrets Manager | ~$0.6/mois |
| **Total** | **~$21-22/mois** |
