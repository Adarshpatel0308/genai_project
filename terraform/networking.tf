# Use the default VPC that exists in every AWS account
# This avoids needing VPC/subnet creation permissions
data "aws_vpc" "default" {
  default = true
}

# Fetch all public subnets from the default VPC
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Security group for the backend ECS task
# Allows: inbound 8000 from frontend SG, outbound all
resource "aws_security_group" "backend" {
  name   = "pragati-backend-sg"
  vpc_id = data.aws_vpc.default.id

  ingress {
    description     = "Allow frontend to reach backend"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.frontend.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Security group for the frontend ECS task
# Allows: inbound 80 from internet, outbound all
resource "aws_security_group" "frontend" {
  name   = "pragati-frontend-sg"
  vpc_id = data.aws_vpc.default.id

  ingress {
    description = "Allow HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Security group for RDS
# Allows: inbound 3306 only from backend ECS task
resource "aws_security_group" "rds" {
  name   = "pragati-rds-sg"
  vpc_id = data.aws_vpc.default.id

  ingress {
    description     = "MySQL from backend only"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
