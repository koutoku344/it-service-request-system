variable "system_name" {
  description = "System identifier used in resource names"
  type        = string
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
}

variable "ami_id" {
  description = "AMI ID used for the EC2 instance"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
}

variable "subnet_id" {
  description = "Subnet ID where the EC2 instance is deployed"
  type        = string
}

variable "security_group_id" {
  description = "Security Group ID attached to the EC2 instance"
  type        = string
}

variable "key_name" {
  description = "EC2 Key Pair name used for SSH access"
  type        = string
}

variable "root_volume_size" {
  description = "Size of the EC2 root EBS volume in GiB"
  type        = number
  default     = 20
}

variable "common_tags" {
  description = "Common tags applied to resources"
  type        = map(string)
}
