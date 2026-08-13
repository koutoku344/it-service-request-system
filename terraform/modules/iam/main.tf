#####################################################################
## EC2 IAM Role
#####################################################################

resource "aws_iam_role" "ec2" {
  name = "${var.name_prefix}-ec2-role"

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
## CloudWatch Agent Policy
#####################################################################

resource "aws_iam_role_policy_attachment" "cloudwatch_agent" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}


#####################################################################
## S3 Backup Policy
#####################################################################

resource "aws_iam_role_policy" "s3_backup" {
  name = "${var.name_prefix}-s3-backup"
  role = aws_iam_role.ec2.name

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "s3:ListBucket"
        ]

        Resource = [
          var.backup_bucket_arn
        ]
      },
      {
        Effect = "Allow"

        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]

        Resource = [
          "${var.backup_bucket_arn}/postgresql/*"
        ]
      }
    ]
  })
}


#####################################################################
## EC2 Instance Profile
#####################################################################

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.name_prefix}-ec2-profile"
  role = aws_iam_role.ec2.name
}