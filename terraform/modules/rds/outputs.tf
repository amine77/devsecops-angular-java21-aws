output "endpoint" {
  description = "RDS connection endpoint (hostname:port)"
  value       = aws_db_instance.main.endpoint
}

output "host" {
  description = "RDS hostname only (without port)"
  value       = aws_db_instance.main.address
}

output "port" {
  description = "RDS port"
  value       = aws_db_instance.main.port
}

output "db_name" {
  description = "Name of the created database"
  value       = aws_db_instance.main.db_name
}

output "instance_id" {
  description = "RDS instance identifier"
  value       = aws_db_instance.main.id
}

output "jdbc_url" {
  description = "JDBC connection URL for Spring Boot datasource configuration"
  value       = "jdbc:postgresql://${aws_db_instance.main.address}:${aws_db_instance.main.port}/${aws_db_instance.main.db_name}"
  sensitive   = false # L'endpoint RDS est non-sensible (pas de credentials)
}
