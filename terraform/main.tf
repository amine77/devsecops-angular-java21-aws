# =============================================================================
# MAIN.TF — Module racine : orchestre tous les modules
# =============================================================================
#
# Infrastructure AWS déployée :
#
#   Internet
#       │
#   ┌───┴──────────────────────── VPC 10.0.0.0/16 ──────────────────────────┐
#   │                                                                        │
#   │   Subnet Public eu-west-3a          Subnet Public eu-west-3b          │
#   │   ┌─────────────────────┐           ┌──────────────────────┐          │
#   │   │  EC2 t2.micro       │           │  (réservé ALB futur) │          │
#   │   │  + Elastic IP       │           │                      │          │
#   │   │  + Docker           │           │                      │          │
#   │   │  portfolio-backend  │           │                      │          │
#   │   │  portfolio-frontend │           │                      │          │
#   │   └────────┬────────────┘           └──────────────────────┘          │
#   │            │ 5432 (SG → SG)                                           │
#   │   Subnet Privé eu-west-3a           Subnet Privé eu-west-3b           │
#   │   ┌─────────────────────┐           ┌──────────────────────┐          │
#   │   │  RDS PostgreSQL     │           │  (standby Multi-AZ)  │          │
#   │   │  db.t3.micro        │           │                      │          │
#   │   └─────────────────────┘           └──────────────────────┘          │
#   └────────────────────────────────────────────────────────────────────────┘
#
#   ECR    : portfolio-backend + portfolio-frontend (repos Docker privés)
#   Lambda : weekly-report (EventBridge) | image-resize (S3)
#
# Coût estimé Free Tier (premiers 12 mois) :
#   EC2 t2.micro   : GRATUIT (750h/mois)
#   RDS db.t3.micro: GRATUIT (750h/mois, 20GB)
#   ECR            : GRATUIT (500MB/mois)
#   Lambda         : GRATUIT (1M req/mois, 400k GB-s)
#   VPC/IGW        : GRATUIT
#   EIP (attachée) : GRATUIT
#   Total          : ~$0/mois pendant 12 mois
#
# =============================================================================

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# =============================================================================
# MODULE 1 — VPC
# =============================================================================
module "vpc" {
  source = "./modules/vpc"

  name_prefix          = local.name_prefix
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

# =============================================================================
# MODULE 2 — ECR
# =============================================================================
module "ecr" {
  source = "./modules/ecr"

  name_prefix         = local.name_prefix
  repositories        = ["portfolio-backend", "portfolio-frontend"]
  image_count_to_keep = 5
  scan_on_push        = true
}

# =============================================================================
# MODULE 3 — SECURITY GROUPS
# =============================================================================
module "security_groups" {
  source = "./modules/security-groups"

  name_prefix      = local.name_prefix
  vpc_id           = module.vpc.vpc_id
  allowed_ssh_cidr = var.allowed_ssh_cidr
}

# =============================================================================
# MODULE 4 — RDS PostgreSQL : SUPPRIMÉ le 24/07/2026
# =============================================================================
# PostgreSQL tourne désormais en container sur l'EC2 (docker-compose, service
# "postgres") pour réduire le coût AWS (~13-16$/mois économisés). Migration
# documentée dans deployment_plan.md (mémoire projet). RDS host = "postgres"
# (résolution DNS interne au network docker-compose), port 5432 inchangé.
#
# CONTREPARTIE ASSUMÉE : plus de snapshots automatiques ni de PITR gérés par
# AWS. La durabilité repose entièrement sur le bucket de backup ci-dessous,
# alimenté par le timer systemd installé par le user-data de l'EC2.

# =============================================================================
# MODULE 4 bis — BUCKET DE SAUVEGARDE POSTGRESQL
# =============================================================================
# Bucket dédié, distinct du bucket de state Terraform.
# Raison : rayons d'action séparés — quiconque peut lire le state ne doit pas
# obtenir au passage un dump complet de la base applicative.
data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "db_backups" {
  bucket = "${local.name_prefix}-db-backups-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name    = "${local.name_prefix}-db-backups"
    Purpose = "PostgreSQL daily dumps"
  }
}

# Versioning : protège contre un dump corrompu qui écraserait le précédent
resource "aws_s3_bucket_versioning" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Chiffrement at-rest (SSE-S3, sans coût KMS)
resource "aws_s3_bucket_server_side_encryption_configuration" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Un dump de base ne doit JAMAIS être accessible publiquement
resource "aws_s3_bucket_public_access_block" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# TLS obligatoire : refuse toute requête en HTTP clair, même authentifiée.
# Le chiffrement at-rest ci-dessus ne protège pas le transit ; sans cette
# policy, un dump complet pourrait transiter en clair.
resource "aws_s3_bucket_policy" "db_backups_tls_only" {
  bucket = aws_s3_bucket.db_backups.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource = [
        aws_s3_bucket.db_backups.arn,
        "${aws_s3_bucket.db_backups.arn}/*"
      ]
      Condition = {
        Bool = { "aws:SecureTransport" = "false" }
      }
    }]
  })

  # La policy doit être appliquée après le blocage d'accès public, sinon
  # S3 peut rejeter la requête (PutBucketPolicy évalué comme "public")
  depends_on = [aws_s3_bucket_public_access_block.db_backups]
}

# NOTE — access logging (SonarLint S6258 / Trivy AVD-AWS-0089) volontairement
# non activé : il exigerait un second bucket, et les accès à ce bucket sont
# déjà tracés par CloudTrail (events de management) pour un usage strictement
# machine-to-machine. À revoir si des accès humains deviennent possibles.

# Cycle de vie : le script purge déjà à 14 jours, mais le versioning conserve
# les versions non-courantes. Cette règle borne le coût de stockage.
resource "aws_s3_bucket_lifecycle_configuration" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id

  rule {
    id     = "expire-old-dumps"
    status = "Enabled"

    filter {
      prefix = "postgres/"
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# =============================================================================
# MODULE 5 — EC2
# =============================================================================
module "ec2" {
  source = "./modules/ec2"

  name_prefix       = local.name_prefix
  vpc_id            = module.vpc.vpc_id
  public_subnet_id  = module.vpc.public_subnet_ids[0] # eu-west-3a
  security_group_id = module.security_groups.ec2_sg_id
  instance_type     = var.ec2_instance_type
  key_name          = var.ec2_key_name
  aws_region        = var.aws_region
  environment       = var.environment

  # ECR
  ecr_backend_url     = module.ecr.backend_repository_url
  ecr_frontend_url    = module.ecr.frontend_repository_url
  ecr_repository_arns = values(module.ecr.repository_arns)
  image_tag           = var.image_tag

  # PostgreSQL — containerisé sur l'EC2 depuis le 24/07/2026 (ex-RDS)
  rds_host    = "postgres"
  rds_port    = 5432
  db_name     = var.db_name
  db_username = var.db_username
  db_password = var.db_password
  jwt_secret  = var.jwt_secret

  # Sauvegarde quotidienne (remplace les snapshots automatiques RDS)
  db_backup_bucket = aws_s3_bucket.db_backups.bucket

  # Phase 20 — K3s GitOps (Free Tier Kubernetes)
  # deployment_mode = "k3s"   → K3s + ArgoCD + SWAP 4GB
  # deployment_mode = "docker" → Docker Compose (comportement Phase 6)
  deployment_mode       = var.deployment_mode
  github_repo           = var.github_repo
  argocd_admin_password = var.argocd_admin_password
}

# =============================================================================
# MODULE 6 bis — SECRETS MANAGER (Phase 21 — External Secrets Operator)
# =============================================================================
# Stocke les secrets applicatifs dans AWS Secrets Manager.
# External Secrets Operator (ESO) les synchronise dans des K8s Secrets.
# Résultat : zéro secret en clair dans Git ou terraform.tfvars en prod.
module "secrets_manager" {
  source = "./modules/secrets-manager"

  name_prefix = local.name_prefix
  environment = var.environment
  rds_host    = "postgres"
  rds_port    = 5432
  db_name     = var.db_name
  db_username = var.db_username
  db_password = var.db_password
  jwt_secret  = var.jwt_secret
}

# =============================================================================
# MODULE 6 — CLOUDWATCH (Observabilité + Alertes)
# =============================================================================
module "cloudwatch" {
  source = "./modules/cloudwatch"

  project_name    = var.project_name
  aws_region      = var.aws_region
  ec2_instance_id = module.ec2.instance_id
  alert_email     = var.alert_email

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  depends_on = [module.ec2]
}

# =============================================================================
# MODULE 7 — LAMBDA : Rapport hebdomadaire (EventBridge → Lambda → SES)
# =============================================================================
module "lambda_weekly_report" {
  source = "./modules/lambda-weekly-report"

  name_prefix     = local.name_prefix
  aws_region      = var.aws_region
  sender_email    = var.lambda_sender_email
  recipient_email = var.lambda_recipient_email
  api_base_url    = "http://${module.ec2.public_ip}"

  depends_on = [module.ec2]
}

# =============================================================================
# MODULE 8 — LAMBDA : Image resize (S3 PUT → Lambda Sharp → WebP thumbnails)
# =============================================================================
module "lambda_image_resize" {
  source = "./modules/lambda-image-resize"

  name_prefix = local.name_prefix
  aws_region  = var.aws_region
}
