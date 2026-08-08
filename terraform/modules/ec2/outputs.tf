output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.application.id
}

output "private_ip" {
  description = "Private IPv4 address of the EC2 instance"
  value       = aws_instance.application.private_ip
}

output "public_ip" {
  description = "Public IPv4 address of the EC2 instance"
  value       = aws_instance.application.public_ip
}

output "public_dns" {
  description = "Public DNS name of the EC2 instance"
  value       = aws_instance.application.public_dns
}
