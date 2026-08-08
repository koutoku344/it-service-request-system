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

variable "public_subnet_cidr" {
  description = "CIDR block of the public subnet"
  type        = string
}

variable "availability_zone" {
  description = "Availability Zone used by the public subnet"
  type        = string
}

variable "allowed_ipv4_cidr" {
  description = "IPv4 CIDR allowed to access HTTP, HTTPS and SSH"
  type        = string
}

variable "common_tags" {
  description = "Common tags applied to resources"
  type        = map(string)
}