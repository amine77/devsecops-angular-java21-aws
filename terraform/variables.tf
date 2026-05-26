# =============================================================================
# VARIABLES.TF — Variables d'entrée du module racine
# =============================================================================
# Convention :
#   - Les variables sensibles ont sensitive = true (masquées dans les logs)
#   - Les validations empêchent les erreurs de configuration silencieuses
#   - Les descriptions sont en anglais (standard Terraform)
# =============================================================================

# =============================================================================
# GLOBAL
# =============================================================================

variable "aws_region" {
  description = "AWS region to deploy resources (eu-west-3 = Paris, closest to France)"
  type        = string
  default     = "eu-west-3"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]$", var.aws_region))
    error_message = "AWS region must be in the format 'us-east-1' or 'eu-west-3'."
  }
}

variable "environment" {
  description = "Deployment environment — controls resource sizing and security settings"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  description = "Project name used as prefix for all AWS resource names"
  type        = string
  default     = "portfolio"

  validation {
    condition     = can(regex("^[a-z0-9-]{3,20}$", var.project_name))
    error_message = "Project name must be 3-20 lowercase alphanumeric chars or hyphens."
  }
}

# =============================================================================
# NETWORKING — VPC
# =============================================================================

variable "vpc_cidr" {
  description = "CIDR block for the VPC. /16 gives 65,534 usable IPs"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of AZs to use (min 2 for RDS Multi-AZ readiness)"
  type        = list(string)
  default     = ["eu-west-3a", "eu-west-3b"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets (EC2, ALB). One per AZ"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (RDS). One per AZ. No direct internet access"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

# =============================================================================
# EC2 — Compute
# =============================================================================

variable "ec2_instance_type" {
  description = <<-EOT
    EC2 instance type.
    Free Tier eligible: t2.micro (1 vCPU, 1 GB RAM) — 750 h/month for 12 months.
    For production: t3.small (2 vCPU, 2 GB RAM) is recommended for Spring Boot.
  EOT
  type        = string
  default     = "t2.micro"
}

variable "ec2_key_name" {
  description = <<-EOT
    Name of an existing EC2 Key Pair for SSH access.
    Create one in AWS Console → EC2 → Key Pairs, then set this variable.
    Store the .pem file securely — it cannot be recovered from AWS.
  EOT
  type        = string
}

variable "allowed_ssh_cidr" {
  description = <<-EOT
    CIDR allowed to SSH to the EC2 instance.
    SECURITY WARNING: Default 0.0.0.0/0 is acceptable for dev but MUST be
    restricted to your IP in production (e.g. "203.0.113.42/32").
    Get your IP: curl https://checkip.amazonaws.com
  EOT
  type        = string
  default     = "0.0.0.0/0"
}

variable "image_tag" {
  description = "Docker image tag to deploy on EC2 (matches ECR tag). Use 'latest' or a git SHA"
  type        = string
  default     = "latest"
}

# =============================================================================
# RDS — PostgreSQL database
# =============================================================================

variable "db_instance_class" {
  description = <<-EOT
    RDS instance class.
    Free Tier eligible: db.t3.micro (2 vCPU, 1 GB RAM) — 750 h/month for 12 months.
    Storage: up to 20 GB free.
  EOT
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "Name of the PostgreSQL database to create"
  type        = string
  default     = "portfolio_prod"
}

variable "db_username" {
  description = "PostgreSQL master username (stored in AWS Secrets Manager)"
  type        = string
  default     = "portfolio_user"
  sensitive   = true
}

variable "db_password" {
  description = <<-EOT
    PostgreSQL master password (stored in AWS Secrets Manager, never in state).
    Requirements: 8-128 chars, avoid / @ " space (PostgreSQL connection string restrictions).
  EOT
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.db_password) >= 8 && length(var.db_password) <= 128
    error_message = "Database password must be between 8 and 128 characters."
  }
}

variable "db_allocated_storage" {
  description = "RDS storage in GB. Free Tier: up to 20 GB. Increases trigger billing"
  type        = number
  default     = 20
}

variable "db_backup_retention_days" {
  description = "Number of days to retain automated RDS backups. 0 disables backups"
  type        = number
  default     = 7
}

variable "db_skip_final_snapshot" {
  description = <<-EOT
    Skip final snapshot when destroying RDS. Set to false in production to
    preserve data before terraform destroy. True in dev for faster cleanup.
  EOT
  type        = bool
  default     = true
}

# =============================================================================
# SECRETS — JWT
# =============================================================================

variable "jwt_secret" {
  description = <<-EOT
    JWT signing secret for Spring Boot (stored in AWS Secrets Manager).
    Minimum 32 characters for HS256, 48 for HS384, 64 for HS512.
    Generate: openssl rand -base64 64
  EOT
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.jwt_secret) >= 32
    error_message = "JWT secret must be at least 32 characters (256 bits for HS256)."
  }
}
