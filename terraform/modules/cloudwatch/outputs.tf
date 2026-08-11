output "application_log_group_name" {
  value = aws_cloudwatch_log_group.application.name
}

output "nginx_log_group_name" {
  value = aws_cloudwatch_log_group.nginx.name
}

output "system_log_group_name" {
  value = aws_cloudwatch_log_group.system.name
}

output "cpu_alarm_name" {
  value = aws_cloudwatch_metric_alarm.ec2_cpu_high.alarm_name
}
