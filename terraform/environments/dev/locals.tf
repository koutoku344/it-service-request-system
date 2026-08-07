locals {
  name_prefix = "${var.system_name}-${var.environment}"

  common_tags = {
    System      = var.system_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Project     = "IT Service Request System"
  }
}
