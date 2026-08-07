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
