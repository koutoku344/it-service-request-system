output "instance_profile_name" {
  description = "IAM instance profile name for EC2"
  value       = aws_iam_instance_profile.ec2_cloudwatch.name
}

output "role_name" {
  description = "IAM role name for EC2"
  value       = aws_iam_role.ec2_cloudwatch.name
}