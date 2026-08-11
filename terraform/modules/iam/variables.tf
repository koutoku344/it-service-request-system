variable "name_prefix" {
  description = "Name prefix for IAM resources"
  type        = string
}

variable "common_tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}