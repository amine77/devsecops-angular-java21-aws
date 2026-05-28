output "bucket_name" {
  description = "S3 bucket name for project images"
  value       = aws_s3_bucket.images.bucket
}

output "bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.images.arn
}

output "resized_base_url" {
  description = "Public base URL for resized images (append <name>-card.webp etc.)"
  value       = "https://${aws_s3_bucket.images.bucket}.s3.${var.aws_region}.amazonaws.com/resized"
}

output "function_name" {
  description = "Name of the image-resize Lambda function"
  value       = aws_lambda_function.image_resize.function_name
}

output "log_group_name" {
  description = "CloudWatch Log Group name for Lambda logs"
  value       = aws_cloudwatch_log_group.image_resize.name
}
