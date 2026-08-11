variable "name_prefix" {
  type = string
}

variable "ec2_instance_id" {
  type = string
}

variable "log_retention_days" {
  type    = number
  default = 7
}

variable "cpu_threshold" {
  type    = number
  default = 80
}

variable "common_tags" {
  type    = map(string)
  default = {}
}
