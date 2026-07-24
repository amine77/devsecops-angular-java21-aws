# =============================================================================
# OUTPUTS.TF — Valeurs importantes après terraform apply
# =============================================================================
# Ces valeurs sont affichées après un apply réussi.
# Elles peuvent aussi être lues par d'autres modules ou par CI/CD :
#   terraform output -raw ec2_public_ip
#   terraform output -json > infra.json
# =============================================================================

# =============================================================================
# RÉSEAU
# =============================================================================
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of private subnets (RDS)"
  value       = module.vpc.private_subnet_ids
}

# =============================================================================
# EC2
# =============================================================================
output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = module.ec2.instance_id
}

output "ec2_public_ip" {
  description = "Elastic IP (static) — use this for DNS configuration"
  value       = module.ec2.public_ip
}

output "ec2_ami_id" {
  description = "AMI used for the EC2 instance"
  value       = module.ec2.ami_id
}

output "ssh_command" {
  description = "Copy-paste SSH command to connect to the server"
  value       = module.ec2.ssh_command
}

# =============================================================================
# APPLICATION
# =============================================================================
output "application_url" {
  description = "URL to access the portfolio application"
  value       = module.ec2.application_url
}

output "swagger_url" {
  description = "URL to access the Swagger API documentation"
  value       = "http://${module.ec2.public_ip}/api/swagger-ui.html"
}

# RDS supprimé le 24/07/2026 — PostgreSQL containerisé sur l'EC2 (voir module ec2)

# =============================================================================
# ECR
# =============================================================================
output "ecr_backend_url" {
  description = "ECR URL for backend image (use with docker push)"
  value       = module.ecr.backend_repository_url
}

output "ecr_frontend_url" {
  description = "ECR URL for frontend image (use with docker push)"
  value       = module.ecr.frontend_repository_url
}

# =============================================================================
# CLOUDWATCH — Observabilité
# =============================================================================
output "cloudwatch_log_group" {
  description = "CloudWatch Log Group name for backend logs"
  value       = module.cloudwatch.log_group_name
}

output "cloudwatch_dashboard_url" {
  description = "URL to view the CloudWatch dashboard"
  value       = module.cloudwatch.dashboard_url
}

output "cloudwatch_sns_topic_arn" {
  description = "SNS topic ARN for alert notifications"
  value       = module.cloudwatch.sns_topic_arn
}

# =============================================================================
# LAMBDA
# =============================================================================
output "lambda_weekly_report_function_name" {
  description = "Name of the weekly report Lambda function"
  value       = module.lambda_weekly_report.function_name
}

output "lambda_weekly_report_log_group" {
  description = "CloudWatch Log Group for the weekly report Lambda"
  value       = module.lambda_weekly_report.log_group_name
}

output "lambda_image_resize_function_name" {
  description = "Name of the image-resize Lambda function"
  value       = module.lambda_image_resize.function_name
}

output "images_bucket_name" {
  description = "S3 bucket name for project images"
  value       = module.lambda_image_resize.bucket_name
}

output "images_resized_base_url" {
  description = "Public base URL for resized WebP images"
  value       = module.lambda_image_resize.resized_base_url
}

output "contact_api_endpoint" {
  description = "HTTPS endpoint for the contact form — set in Angular environment"
  value       = module.lambda_contact_form.api_endpoint
}

output "lambda_contact_function_name" {
  description = "Name of the contact form Lambda function"
  value       = module.lambda_contact_form.function_name
}

# =============================================================================
# COMMANDES PRATIQUES
# =============================================================================
output "deploy_commands" {
  description = "Commands to build and deploy the application"
  value       = <<-EOT

  ╔══════════════════════════════════════════════════════════╗
  ║        DÉPLOIEMENT — Commandes post-apply               ║
  ╚══════════════════════════════════════════════════════════╝

  1. Login ECR :
     aws ecr get-login-password --region ${var.aws_region} \
       | docker login --username AWS --password-stdin ${module.ecr.backend_repository_url}

  2. Build + push backend :
     docker build -t ${module.ecr.backend_repository_url}:latest ./backend
     docker push ${module.ecr.backend_repository_url}:latest

  3. Build + push frontend :
     docker build -t ${module.ecr.frontend_repository_url}:latest ./frontend
     docker push ${module.ecr.frontend_repository_url}:latest

  4. Accéder à l'application :
     http://${module.ec2.public_ip}

  5. SSH vers le serveur :
     ${module.ec2.ssh_command}

  EOT
}
