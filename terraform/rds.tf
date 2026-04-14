# RDS subnet group using subnet IDs passed as variable
resource "aws_db_subnet_group" "pragati" {
  name       = "pragati-db-subnet-group"
  subnet_ids = var.subnet_ids
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
  vpc_security_group_ids = [var.security_group_id]

  multi_az            = false
  publicly_accessible = false
  skip_final_snapshot = true

  auto_minor_version_upgrade = true
}
