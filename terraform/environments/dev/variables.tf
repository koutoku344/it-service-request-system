variable "aws_region" {
  description = "AWS region used for the dev environment"
  type        = string
  default     = "ap-northeast-1"
}

variable "aws_profile" {
  description = "AWS CLI profile used by Terraform"
  type        = string
  default     = "terraform-dev"
}

variable "system_name" {
  description = "System identifier used in resource names and tags"
  type        = string
  default     = "it-service-request-system"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block of the dev VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block of the dev public subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "availability_zone" {
  description = "Availability Zone used by the dev environment"
  type        = string
  default     = "ap-northeast-1a"
}

variable "allowed_ipv4_cidr" {
  description = "IPv4 CIDR allowed to access the EC2 instance"
  type        = string
}
