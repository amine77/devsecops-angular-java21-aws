output "repository_urls" {
  description = "Map of repository name → URL (used for docker push/pull)"
  value       = { for name, repo in aws_ecr_repository.repos : name => repo.repository_url }
}

output "repository_arns" {
  description = "Map of repository name → ARN (used in IAM policies)"
  value       = { for name, repo in aws_ecr_repository.repos : name => repo.arn }
}

output "registry_id" {
  description = "ECR registry ID (= AWS account ID)"
  value       = values(aws_ecr_repository.repos)[0].registry_id
}

output "backend_repository_url" {
  description = "URL of the backend ECR repository"
  value       = aws_ecr_repository.repos["portfolio-backend"].repository_url
}

output "frontend_repository_url" {
  description = "URL of the frontend ECR repository"
  value       = aws_ecr_repository.repos["portfolio-frontend"].repository_url
}
