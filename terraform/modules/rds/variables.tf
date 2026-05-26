variable "name_prefix" {
  description = "Prefix for RDS resource names"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where RDS will be deployed"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for the RDS subnet group (min 2 for multi-AZ readiness)"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID to attach to the RDS instance"
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance type (db.t3.micro = Free Tier)"
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "Name of the initial PostgreSQL database"
  type        = string
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "allocated_storage" {
  description = "Storage size in GB (20 GB max for Free Tier)"
  type        = number
  default     = 20
}

variable "backup_retention_days" {
  description = "Days to retain automated backups"
  type        = number
  default     = 7
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot on destroy (false = keep data)"
  type        = bool
  default     = true
}

variable "environment" {
  description = "Environment name (dev/staging/prod) — controls deletion protection"
  type        = string
  default     = "dev"
}
