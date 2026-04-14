# RDS MySQL 8.0 — Single-AZ, cost optimised
# Uses default VPC subnets, locked to backend SG only
resource "aws_db_subnet_group" "pragati" {
  name       = "pragati-db-subnet-group"
  subnet_ids = data.aws_subnets.default.ids
}

resource "aws_db_instance" "mysql" {
  identifier        = "pragati-mysql"
  engine            = "mysql"
  engine_version    = "8.0"
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  storage_type      = "gp2"

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.pragati.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az            = false
  publicly_accessible = false  # Only reachable from backend ECS task
  skip_final_snapshot = true

  auto_minor_version_upgrade = true
}
