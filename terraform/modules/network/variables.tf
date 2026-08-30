variable "system_name" {
  description = "System identifier used in resource names"
  type        = string
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block of the VPC"
  type        = string
}

variable "public_subnet_a_cidr" {
  description = "CIDR block of the public subnet in AZ-A"
  type        = string
}

variable "public_subnet_c_cidr" {
  description = "CIDR block of the public subnet in AZ-C"
  type        = string
}

variable "availability_zone_a" {
  description = "Availability Zone A"
  type        = string
}

variable "availability_zone_c" {
  description = "Availability Zone C"
  type        = string
}

variable "allowed_ipv4_cidr" {
  description = "Administrator/client IPv4 CIDR"
  type        = string
}

variable "common_tags" {
  description = "Common tags applied to resources"
  type        = map(string)
}
