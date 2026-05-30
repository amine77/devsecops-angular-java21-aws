variable "name_prefix" {
  description = "Prefix for EC2 resource names"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnet_id" {
  description = "Public subnet ID where EC2 will be launched"
  type        = string
}

variable "security_group_id" {
  description = "Security group ID for EC2"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type (t3.micro = Free Tier, meilleur réseau que t2.micro)"
  type        = string
  default     = "t3.micro"
}

variable "deployment_mode" {
  description = "Mode de déploiement : 'docker' (Compose, Phase 6) ou 'k3s' (Kubernetes, Phase 20)"
  type        = string
  default     = "k3s"

  validation {
    condition     = contains(["docker", "k3s"], var.deployment_mode)
    error_message = "deployment_mode doit être 'docker' ou 'k3s'."
  }
}

variable "github_repo" {
  description = "URL GitHub du repo pour ArgoCD (mode k3s uniquement)"
  type        = string
  default     = "https://github.com/amine77/devsecops-angular-java21-aws.git"
}

variable "argocd_admin_password" {
  description = "Mot de passe admin ArgoCD (mode k3s uniquement)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "key_name" {
  description = "Name of the EC2 Key Pair for SSH access"
  type        = string
}

variable "aws_region" {
  description = "AWS region (used in user-data for ECR login)"
  type        = string
}

variable "ecr_backend_url" {
  description = "ECR URL for the backend image"
  type        = string
}

variable "ecr_frontend_url" {
  description = "ECR URL for the frontend image"
  type        = string
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "rds_host" {
  description = "RDS PostgreSQL hostname"
  type        = string
}

variable "rds_port" {
  description = "RDS PostgreSQL port"
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
}

variable "db_username" {
  description = "PostgreSQL username"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "ecr_repository_arns" {
  description = "List of ECR repository ARNs for IAM policy"
  type        = list(string)
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}
