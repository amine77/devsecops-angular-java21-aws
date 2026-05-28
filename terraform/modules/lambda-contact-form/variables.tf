variable "name_prefix" {
  description = "Prefix applied to all resource names"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "sender_email" {
  description = "SES-verified email used as From: header"
  type        = string
}

variable "recipient_email" {
  description = "Email address that receives contact form submissions"
  type        = string
}

variable "allowed_origins" {
  description = "Comma-separated list of allowed CORS origins (e.g. https://portfolio.example.com)"
  type        = string
  default     = "*"
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention in days"
  type        = number
  default     = 7
}
