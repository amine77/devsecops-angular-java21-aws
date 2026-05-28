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
#   Lambda : weekly-report (EventBridge) | image-resize (S3) | contact (APIGW)
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
# MODULE 4 — RDS PostgreSQL
# =============================================================================
module "rds" {
  source = "./modules/rds"

  name_prefix           = local.name_prefix
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  security_group_id     = module.security_groups.rds_sg_id
  db_instance_class     = var.db_instance_class
  db_name               = var.db_name
  db_username           = var.db_username
  db_password           = var.db_password
  allocated_storage     = var.db_allocated_storage
  backup_retention_days = var.db_backup_retention_days
  skip_final_snapshot   = var.db_skip_final_snapshot
  environment           = var.environment
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

  # RDS
  rds_host    = module.rds.host
  rds_port    = module.rds.port
  db_name     = module.rds.db_name
  db_username = var.db_username
  db_password = var.db_password
  jwt_secret  = var.jwt_secret

  depends_on = [module.rds]
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

# =============================================================================
# MODULE 9 — LAMBDA : Formulaire de contact (API Gateway → Lambda → SES)
# =============================================================================
module "lambda_contact_form" {
  source = "./modules/lambda-contact-form"

  name_prefix     = local.name_prefix
  aws_region      = var.aws_region
  sender_email    = var.lambda_sender_email
  recipient_email = var.lambda_recipient_email
  allowed_origins = var.lambda_contact_allowed_origins
}
