variable "name_prefix" {
  description = "Prefix applied to all resource names"
  type        = string
}

variable "aws_region" {
  description = "AWS region where the Lambda and S3 bucket reside"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention in days"
  type        = number
  default     = 7
}
