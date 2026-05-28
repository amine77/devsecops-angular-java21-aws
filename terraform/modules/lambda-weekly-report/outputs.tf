output "function_name" {
  description = "Name of the weekly report Lambda function"
  value       = aws_lambda_function.weekly_report.function_name
}

output "function_arn" {
  description = "ARN of the weekly report Lambda function"
  value       = aws_lambda_function.weekly_report.arn
}

output "schedule_name" {
  description = "Name of the EventBridge Scheduler schedule"
  value       = aws_scheduler_schedule.weekly_report.name
}

output "log_group_name" {
  description = "CloudWatch Log Group name for Lambda logs"
  value       = aws_cloudwatch_log_group.weekly_report.name
}
