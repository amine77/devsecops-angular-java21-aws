variable "name_prefix" {
  description = "Prefix for repository names"
  type        = string
}

variable "repositories" {
  description = "List of ECR repository names to create"
  type        = list(string)
  default     = ["portfolio-backend", "portfolio-frontend"]
}

variable "image_count_to_keep" {
  description = "Number of tagged images to keep per repository (lifecycle policy)"
  type        = number
  default     = 5
}

variable "scan_on_push" {
  description = "Enable automated vulnerability scanning on image push"
  type        = bool
  default     = true
}
