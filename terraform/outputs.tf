output "rds_endpoint" {
  description = "RDS MySQL endpoint (reachable only from backend ECS task)"
  value       = aws_db_instance.mysql.address
}

output "ecs_cluster" {
  value = aws_ecs_cluster.pragati.name
}
