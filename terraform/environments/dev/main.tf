module "network" {
  source = "../../modules/network"

  system_name        = var.system_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  public_subnet_cidr = var.public_subnet_cidr
  availability_zone  = var.availability_zone
  allowed_ipv4_cidr  = var.allowed_ipv4_cidr
  common_tags        = local.common_tags
}