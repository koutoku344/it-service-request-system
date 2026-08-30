module "network" {
  source = "../../modules/network"

  system_name          = var.system_name
  environment          = var.environment
  vpc_cidr             = var.vpc_cidr
  public_subnet_a_cidr = var.public_subnet_a_cidr
  public_subnet_c_cidr = var.public_subnet_c_cidr
  availability_zone_a  = var.availability_zone_a
  availability_zone_c  = var.availability_zone_c
  allowed_ipv4_cidr    = var.allowed_ipv4_cidr
  common_tags          = local.common_tags
}

module "ec2" {
  source = "../../modules/ec2"

  system_name          = var.system_name
  environment          = var.environment
  ami_id               = var.ami_id
  instance_type        = var.instance_type
  subnet_id            = module.network.public_subnet_a_id
  security_group_id    = module.network.legacy_ec2_security_group_id
  key_name             = var.key_name
  root_volume_size     = var.root_volume_size
  common_tags          = local.common_tags
  iam_instance_profile = module.iam.instance_profile_name
  instance_name        = "${local.name_prefix}-app-ec2"
  hostname             = "app-ec2"
}

module "web_c" {
  source = "../../modules/ec2"

  system_name          = var.system_name
  environment          = var.environment
  ami_id               = var.ami_id
  instance_type        = var.instance_type
  subnet_id            = module.network.public_subnet_c_id
  security_group_id    = module.network.web_security_group_id
  key_name             = var.key_name
  root_volume_size     = var.root_volume_size
  common_tags          = local.common_tags
  iam_instance_profile = module.iam.instance_profile_name
  instance_name        = "${local.name_prefix}-web-c"
  hostname             = "web-c"
}

module "db_c" {
  source = "../../modules/ec2"

  system_name          = var.system_name
  environment          = var.environment
  ami_id               = var.ami_id
  instance_type        = var.instance_type
  subnet_id            = module.network.public_subnet_c_id
  security_group_id    = module.network.db_security_group_id
  key_name             = var.key_name
  root_volume_size     = var.root_volume_size
  common_tags          = local.common_tags
  iam_instance_profile = module.iam.instance_profile_name
  instance_name        = "${local.name_prefix}-db-c"
  hostname             = "db-c"
}

module "cloudwatch" {
  source = "../../modules/cloudwatch"

  name_prefix        = local.name_prefix
  ec2_instance_id    = module.ec2.instance_id
  log_retention_days = 7
  cpu_threshold      = 80
  common_tags        = local.common_tags
}

module "iam" {
  source = "../../modules/iam"

  name_prefix       = local.name_prefix
  common_tags       = local.common_tags
  backup_bucket_arn = module.backup.bucket_arn
}

module "backup" {
  source = "../../modules/backup"

  bucket_name = "it-service-request-system-dev-backup-006635110954"

  common_tags = local.common_tags
}