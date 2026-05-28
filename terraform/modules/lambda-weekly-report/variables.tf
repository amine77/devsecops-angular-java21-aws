variable "name_prefix" {
  description = "Prefix applied to all resource names"
  type        = string
}

variable "aws_region" {
  description = "AWS region where the Lambda runs"
  type        = string
}

variable "sender_email" {
  description = "SES-verified email address used as From: header"
  type        = string
}

variable "recipient_email" {
  description = "Email address that receives the weekly report"
  type        = string
}

variable "api_base_url" {
  description = "Base URL of the portfolio REST API (e.g. http://<EC2-IP>)"
  type        = string
}

variable "schedule_expression" {
  description = "EventBridge cron expression for the weekly report"
  type        = string
  default     = "cron(0 8 ? * MON *)"
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention in days (7 = Free Tier safe)"
  type        = number
  default     = 7
}
