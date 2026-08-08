locals {
  name_prefix = "${var.system_name}-${var.environment}"
}

resource "aws_instance" "application" {
  ami                         = var.ami_id
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [var.security_group_id]
  key_name                    = var.key_name
  associate_public_ip_address = true

  user_data = file("${path.module}/user_data.sh")

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size
    encrypted             = true
    delete_on_termination = true
  }

  tags = merge(var.common_tags, {
    Name = "${local.name_prefix}-app-ec2"
  })
}
