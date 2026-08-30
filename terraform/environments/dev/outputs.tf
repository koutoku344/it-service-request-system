output "vpc_id" {
  description = "ID of the dev VPC"
  value       = module.network.vpc_id
}

output "public_subnet_a_id" {
  value = module.network.public_subnet_a_id
}

output "public_subnet_c_id" {
  value = module.network.public_subnet_c_id
}

output "internet_gateway_id" {
  description = "ID of the dev Internet Gateway"
  value       = module.network.internet_gateway_id
}

output "public_route_table_id" {
  description = "ID of the dev public route table"
  value       = module.network.public_route_table_id
}

output "legacy_ec2_security_group_id" {
  description = "ID of the legacy dev EC2 security group"
  value       = module.network.legacy_ec2_security_group_id
}

output "alb_security_group_id" {
  value = module.network.alb_security_group_id
}

output "web_security_group_id" {
  value = module.network.web_security_group_id
}

output "db_security_group_id" {
  value = module.network.db_security_group_id
}

output "web_c_instance_id" {
  value = module.web_c.instance_id
}

output "web_c_private_ip" {
  value = module.web_c.private_ip
}

output "web_c_public_ip" {
  value = module.web_c.public_ip
}

output "db_c_instance_id" {
  value = module.db_c.instance_id
}

output "db_c_private_ip" {
  value = module.db_c.private_ip
}

output "db_c_public_ip" {
  value = module.db_c.public_ip
}

output "ec2_instance_id" {
  description = "Application EC2 instance ID"
  value       = module.ec2.instance_id
}

output "ec2_private_ip" {
  description = "Application EC2 private IPv4 address"
  value       = module.ec2.private_ip
}

output "ec2_public_ip" {
  description = "Application EC2 public IPv4 address"
  value       = module.ec2.public_ip
}

output "ec2_public_dns" {
  description = "Application EC2 public DNS name"
  value       = module.ec2.public_dns
}

output "backup_bucket_name" {
  value = module.backup.bucket_name
}