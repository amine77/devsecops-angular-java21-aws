output "log_group_name" {
  description = "Nom du Log Group CloudWatch pour les logs du backend"
  value       = aws_cloudwatch_log_group.backend.name
}

output "log_group_arn" {
  description = "ARN du Log Group (utilisé dans la IAM Policy EC2)"
  value       = aws_cloudwatch_log_group.backend.arn
}

output "sns_topic_arn" {
  description = "ARN du topic SNS pour les alertes"
  value       = aws_sns_topic.alerts.arn
}

output "dashboard_name" {
  description = "Nom du dashboard CloudWatch"
  value       = aws_cloudwatch_dashboard.portfolio.dashboard_name
}

output "dashboard_url" {
  description = "URL du dashboard CloudWatch"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.portfolio.dashboard_name}"
}
