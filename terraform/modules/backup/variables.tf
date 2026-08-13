variable "bucket_name" {
  description = "PostgreSQL backup bucket name"
  type        = string
}

variable "common_tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
