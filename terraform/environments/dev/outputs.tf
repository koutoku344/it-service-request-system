output "vpc_id" {
  description = "ID of the dev VPC"
  value       = module.network.vpc_id
}

output "public_subnet_id" {
  description = "ID of the dev public subnet"
  value       = module.network.public_subnet_id
}

output "internet_gateway_id" {
  description = "ID of the dev Internet Gateway"
  value       = module.network.internet_gateway_id
}

output "public_route_table_id" {
  description = "ID of the dev public route table"
  value       = module.network.public_route_table_id
}

output "ec2_security_group_id" {
  description = "ID of the dev EC2 security group"
  value       = module.network.ec2_security_group_id
}