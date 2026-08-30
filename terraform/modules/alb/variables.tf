variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}

variable "target_instance_ids" {
  description = "EC2 instance IDs registered to ALB target group"
  type        = set(string)
  default     = []
}

variable "common_tags" {
  type = map(string)
}
