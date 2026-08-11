resource "aws_cloudwatch_log_group" "application" {
  name              = "/${var.name_prefix}/application"
  retention_in_days = var.log_retention_days
  tags              = var.common_tags
}

resource "aws_cloudwatch_log_group" "nginx" {
  name              = "/${var.name_prefix}/nginx"
  retention_in_days = var.log_retention_days
  tags              = var.common_tags
}

resource "aws_cloudwatch_log_group" "system" {
  name              = "/${var.name_prefix}/system"
  retention_in_days = var.log_retention_days
  tags              = var.common_tags
}

resource "aws_cloudwatch_metric_alarm" "ec2_cpu_high" {
  alarm_name          = "${var.name_prefix}-ec2-cpu-high"
  alarm_description   = "EC2 CPU utilization is high"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = var.cpu_threshold
  treat_missing_data  = "notBreaching"

  dimensions = {
    InstanceId = var.ec2_instance_id
  }

  tags = var.common_tags
}
