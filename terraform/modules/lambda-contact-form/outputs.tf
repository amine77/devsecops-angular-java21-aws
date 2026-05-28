output "api_endpoint" {
  description = "HTTPS endpoint for the contact form (POST /contact)"
  value       = "${aws_apigatewayv2_stage.default.invoke_url}/contact"
}

output "api_id" {
  description = "API Gateway HTTP API ID"
  value       = aws_apigatewayv2_api.contact.id
}

output "function_name" {
  description = "Name of the contact form Lambda function"
  value       = aws_lambda_function.contact_form.function_name
}

output "log_group_name" {
  description = "CloudWatch Log Group for Lambda logs"
  value       = aws_cloudwatch_log_group.contact_form.name
}
