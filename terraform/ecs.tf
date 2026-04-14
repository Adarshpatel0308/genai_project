# ── Backend Task Definition ───────────────────
resource "aws_ecs_task_definition" "backend" {
  family                   = "pragati-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "1024"
  memory                   = "2048"
  # execution_role_arn not needed — public DockerHub image, no CloudWatch, no Secrets Manager

  container_definitions = jsonencode([{
    name      = "backend"
    image     = var.backend_image
    essential = true

    portMappings = [{ containerPort = 8000, protocol = "tcp" }]

    environment = [
      { name = "APP_ENV",             value = "production" },
      { name = "DB_HOST",             value = aws_db_instance.mysql.address },
      { name = "DB_PORT",             value = "3306" },
      { name = "DB_USER",             value = var.db_username },
      { name = "DB_PASSWORD",         value = var.db_password },
      { name = "DB_NAME",             value = var.db_name },
      { name = "SECRET_KEY",          value = var.secret_key },
      { name = "GROQ_API_KEY",        value = var.groq_api_key },
      { name = "GROQ_MODEL",          value = "llama-3.3-70b-versatile" },
      { name = "NEBIUS_API_KEY",      value = var.nebius_api_key },
      { name = "NEBIUS_VISION_MODEL", value = "Qwen/Qwen2.5-VL-72B-Instruct" },
      { name = "NEBIUS_TEXT_MODEL",   value = "meta-llama/Llama-3.3-70B-Instruct-fast" },
      { name = "WEATHER_API_KEY",     value = var.weather_api_key },
      { name = "DATA_GOV_KEY",        value = var.data_gov_key },
      { name = "OPENCAGE_KEY",        value = var.opencage_key },
      { name = "ALLOWED_ORIGINS",     value = "[\"*\"]" }
    ]

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
      interval    = 30
      timeout     = 10
      retries     = 3
      startPeriod = 60
    }
  }])
}

# ── Frontend Task Definition ──────────────────
resource "aws_ecs_task_definition" "frontend" {
  family                   = "pragati-frontend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  # execution_role_arn not needed — public DockerHub image, no CloudWatch, no Secrets Manager

  container_definitions = jsonencode([{
    name      = "frontend"
    image     = var.frontend_image
    essential = true

    portMappings = [{ containerPort = 80, protocol = "tcp" }]

    environment = [
      { name = "BACKEND_URL", value = var.backend_task_url }
    ]

    healthCheck = {
      command     = ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:80/ || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 10
    }
  }])
}

# ── Backend ECS Service ───────────────────────
resource "aws_ecs_service" "backend" {
  name            = "pragati-backend"
  cluster         = aws_ecs_cluster.pragati.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = true
  }

  depends_on = [aws_db_instance.mysql]
}

# ── Frontend ECS Service ──────────────────────
resource "aws_ecs_service" "frontend" {
  name            = "pragati-frontend"
  cluster         = aws_ecs_cluster.pragati.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = true
  }

  depends_on = [aws_ecs_service.backend]
}
