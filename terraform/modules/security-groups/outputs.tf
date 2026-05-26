output "ec2_sg_id" {
  description = "Security group ID for EC2 instances"
  value       = aws_security_group.ec2.id
}

output "rds_sg_id" {
  description = "Security group ID for RDS PostgreSQL"
  value       = aws_security_group.rds.id
}
