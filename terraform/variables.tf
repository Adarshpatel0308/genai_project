variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

variable "backend_image" {
  description = "DockerHub image URI for backend e.g. youruser/pragati-backend:abc123"
  type        = string
}

variable "frontend_image" {
  description = "DockerHub image URI for frontend e.g. youruser/pragati-frontend:abc123"
  type        = string
}

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

# After first deploy: get backend task public IP from ECS console
# and set BACKEND_TASK_IP in GitHub Secrets, then re-run workflow.
variable "backend_task_url" {
  description = "http://<backend-task-public-ip>:8000 — set after first backend deploy"
  type        = string
  default     = "http://localhost:8000"
}
