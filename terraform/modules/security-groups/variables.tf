variable "name_prefix" {
  description = "Prefix for security group names"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where security groups will be created"
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed for SSH access to EC2"
  type        = string
  default     = "0.0.0.0/0"
}
