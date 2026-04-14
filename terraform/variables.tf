variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "backend_image" {
  type = string
}

variable "frontend_image" {
  type = string
}

# ── Networking — fetch these from AWS Console (see README below) ──
# These are passed as GitHub Secrets because ec2:DescribeSubnets
# is blocked by the organization's SCP policy.

variable "subnet_ids" {
  description = "Comma-separated list of subnet IDs from default VPC e.g. [\"subnet-abc\",\"subnet-xyz\"]"
  type        = list(string)
}

variable "security_group_id" {
  description = "Default security group ID of the default VPC"
  type        = string
}

# ── IAM — NOT needed
# execution_role_arn removed — public DockerHub image,
# no CloudWatch, no Secrets Manager = no IAM role required

# ── Database ──
variable "db_name" {
  type    = string
  default = "pragati_db"
}

variable "db_username" {
  type    = string
  default = "pragati_user"
}

variable "db_password" {
  type      = string
  sensitive = true
}

# ── App secrets ──
variable "secret_key" {
  type      = string
  sensitive = true
}

variable "groq_api_key" {
  type      = string
  sensitive = true
}

variable "nebius_api_key" {
  type      = string
  sensitive = true
}

variable "weather_api_key" {
  type      = string
  sensitive = true
}

variable "data_gov_key" {
  type      = string
  sensitive = true
}

variable "opencage_key" {
  type      = string
  sensitive = true
}

variable "backend_task_url" {
  type    = string
  default = "http://localhost:8000"
}
