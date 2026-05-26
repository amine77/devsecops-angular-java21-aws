output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.main.id
}

output "public_ip" {
  description = "Elastic IP (static public IP of the EC2 instance)"
  value       = aws_eip.main.public_ip
}

output "public_dns" {
  description = "Public DNS hostname of the EC2 instance"
  value       = aws_instance.main.public_dns
}

output "private_ip" {
  description = "Private IP of the EC2 instance (for internal communication)"
  value       = aws_instance.main.private_ip
}

output "ami_id" {
  description = "AMI ID used for the instance"
  value       = data.aws_ami.amazon_linux_2023.id
}

output "iam_role_arn" {
  description = "ARN of the IAM role attached to EC2"
  value       = aws_iam_role.ec2.arn
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i ~/.ssh/${var.key_name}.pem ec2-user@${aws_eip.main.public_ip}"
}

output "application_url" {
  description = "URL to access the application"
  value       = "http://${aws_eip.main.public_ip}"
}
