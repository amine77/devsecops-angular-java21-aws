# Phase 5 — Infrastructure AWS avec Terraform

## Architecture déployée

```
Internet
    │
┌───┴──────────────────────── VPC 10.0.0.0/16 (eu-west-3) ──────────────────┐
│                                                                             │
│   Subnet Public eu-west-3a (10.0.1.0/24)                                   │
│   ┌──────────────────────────────────────┐                                  │
│   │  EC2 t2.micro (Free Tier)            │ ← Elastic IP (IP fixe)          │
│   │  Amazon Linux 2023                   │                                  │
│   │  ┌────────────────────────────────┐  │                                  │
│   │  │ Docker                         │  │                                  │
│   │  │  • portfolio-frontend (NGINX)  │←─┤── Port 80 (HTTP)                │
│   │  │  • portfolio-backend (Spring)  │  │                                  │
│   │  └────────────────────────────────┘  │                                  │
│   └─────────────────┬────────────────────┘                                  │
│                     │ PostgreSQL :5432 (Security Group → Security Group)    │
│   Subnet Privé eu-west-3a (10.0.10.0/24)                                   │
│   ┌──────────────────────────────────────┐                                  │
│   │  RDS PostgreSQL 15 (db.t3.micro)     │ ← Pas d'accès internet          │
│   │  20 GB gp2, encrypted, backup 7j     │                                  │
│   └──────────────────────────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘

ECR (Elastic Container Registry) :
  • portfolio-backend  → image Spring Boot Java 21
  • portfolio-frontend → image Angular + NGINX
```

## Choix architecturaux et compromis

| Décision | Raison |
|----------|--------|
| EC2 en subnet **public** | Pas de NAT Gateway (~$32/mois). SG restrictif compense. |
| **t2.micro** EC2 | Free Tier 750h/mois. Suffisant pour un portfolio. |
| **db.t3.micro** RDS | Free Tier 750h/mois. 20 GB gratuit. |
| **Single-AZ** RDS | Multi-AZ = 2× le coût. Subnet group 2-AZ prêt si upgrade. |
| **EIP** fixe | L'IP EC2 change au redémarrage sans EIP. |
| **IAM Instance Profile** | Jamais de clés AWS sur le serveur. `aws ecr get-login-password` utilise le rôle. |
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

## Backend Terraform distant (optionnel — recommandé en équipe)

Pour partager le state entre développeurs et CI/CD :

```bash
# 1. Créer le bucket S3 et la table DynamoDB (une seule fois)
aws s3api create-bucket \
  --bucket portfolio-terraform-state \
  --region eu-west-3 \
  --create-bucket-configuration LocationConstraint=eu-west-3

aws s3api put-bucket-versioning \
  --bucket portfolio-terraform-state \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket portfolio-terraform-state \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws dynamodb create-table \
  --table-name portfolio-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-3

# 2. Décommenter le bloc backend dans versions.tf
# 3. Re-initialiser : terraform init -migrate-state
```

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
├── main.tf                     # Orchestre les 5 modules
├── variables.tf                # 20 variables documentées avec validations
├── outputs.tf                  # Outputs (IP, URLs, commandes)
├── terraform.tfvars.example    # Template (sans secrets, commitable)
└── modules/
    ├── vpc/          # VPC + 4 subnets + IGW + routes + VPC Flow Logs
    ├── ecr/          # 2 repos ECR + lifecycle policies + scan on push
    ├── security-groups/ # SG EC2 (80/443/22) + SG RDS (5432 from EC2 only)
    ├── rds/          # PostgreSQL 15 + parameter group + subnet group
    └── ec2/          # AMI AL2023 + IAM role + EIP + user-data + CloudWatch alarm
```

## Sécurité

- **Secrets** : jamais dans le state ou le code → variables sensibles + terraform.tfvars non committé
- **RDS** : uniquement accessible depuis le SG EC2, pas d'IP publique
- **EC2** : IMDSv2 obligatoire, chiffrement root volume, IAM moindre privilège
- **SG** : principe du moindre privilège, pas de règles overly permissive
- **VPC Flow Logs** : audit de tout le trafic réseau
- **ECR** : scan CVE automatique à chaque push

## Coût estimé

| Ressource | Coût Free Tier | Coût après 12 mois |
|-----------|----------------|---------------------|
| EC2 t2.micro | $0 (750h/mois) | ~$8.50/mois |
| RDS db.t3.micro | $0 (750h/mois) | ~$15/mois |
| ECR (< 500 MB) | $0 | $0 |
| EIP (attachée) | $0 | $0 |
| VPC Flow Logs | ~$0.50 | ~$0.50 |
| **Total** | **~$0.50/mois** | **~$24/mois** |
