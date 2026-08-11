#####################################################################
##Role attached to AWS IAM Service on AWS side (assum"ed" side)??
#####################################################################

resource "aws_iam_role" "ec2_cloudwatch" {
  name = "${var.name_prefix}-ec2-cloudwatch-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "ec2.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = var.common_tags
}

#####################################################################
##not need assume side role (due to service role)
#####################################################################


#####################################################################
##Role attached to cloud watch agent
#####################################################################

resource "aws_iam_role_policy_attachment" "cloudwatch_agent" {
  role       = aws_iam_role.ec2_cloudwatch.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

#####################################################################
##Role attached to ec2-instance-profile
#####################################################################
resource "aws_iam_instance_profile" "ec2_cloudwatch" {
  name = "${var.name_prefix}-ec2-cloudwatch-profile"
  role = aws_iam_role.ec2_cloudwatch.name
}