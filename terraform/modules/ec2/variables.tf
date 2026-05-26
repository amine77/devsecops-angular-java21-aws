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
  description = "EC2 instance type (t2.micro = Free Tier)"
  type        = string
  default     = "t2.micro"
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
