output "dev_secret_arn" {
  description = "ARN du secret Secrets Manager — dev"
  value       = aws_secretsmanager_secret.dev.arn
}

output "prod_secret_arn" {
  description = "ARN du secret Secrets Manager — prod"
  value       = aws_secretsmanager_secret.prod.arn
}

output "dev_secret_name" {
  description = "Nom du secret dans Secrets Manager — dev (utilisé dans ExternalSecret)"
  value       = aws_secretsmanager_secret.dev.name
}

output "prod_secret_name" {
  description = "Nom du secret dans Secrets Manager — prod"
  value       = aws_secretsmanager_secret.prod.name
}
