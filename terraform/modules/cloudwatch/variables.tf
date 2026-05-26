variable "project_name" {
  description = "Nom du projet (utilisé comme préfixe sur toutes les ressources)"
  type        = string
}

variable "aws_region" {
  description = "Région AWS où déployer les ressources CloudWatch"
  type        = string
}

variable "ec2_instance_id" {
  description = "ID de l'instance EC2 à monitorer (ex: i-0123456789abcdef0)"
  type        = string
}

variable "alert_email" {
  description = "Adresse email pour les notifications SNS (alarmes CloudWatch)"
  type        = string
}

variable "tags" {
  description = "Tags communs à appliquer à toutes les ressources"
  type        = map(string)
  default     = {}
}
