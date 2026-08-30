output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_a_id" {
  description = "ID of public subnet in AZ-A"
  value       = aws_subnet.public_a.id
}

output "public_subnet_c_id" {
  description = "ID of public subnet in AZ-C"
  value       = aws_subnet.public_c.id
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value       = aws_internet_gateway.main.id
}

output "public_route_table_id" {
  description = "ID of the public route table"
  value       = aws_route_table.public.id
}

output "legacy_ec2_security_group_id" {
  description = "Legacy EC2 SG ID used during migration"
  value       = aws_security_group.ec2.id
}

output "alb_security_group_id" {
  description = "ALB SG ID"
  value       = aws_security_group.alb.id
}

output "web_security_group_id" {
  description = "Web EC2 SG ID"
  value       = aws_security_group.web.id
}

output "db_security_group_id" {
  description = "DB EC2 SG ID"
  value       = aws_security_group.db.id
}
