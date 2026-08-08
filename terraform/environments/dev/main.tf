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

module "ec2" {
  source = "../../modules/ec2"

  system_name       = var.system_name
  environment       = var.environment
  ami_id            = var.ami_id
  instance_type     = var.instance_type
  subnet_id         = module.network.public_subnet_id
  security_group_id = module.network.ec2_security_group_id
  key_name          = var.key_name
  root_volume_size  = var.root_volume_size
  common_tags       = local.common_tags
}