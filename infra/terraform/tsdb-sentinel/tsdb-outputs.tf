output "influxdb_endpoint" {
  description = "Endpoint de la instancia Timestream InfluxDB"
  value       = aws_timestreaminfluxdb_db_instance.influxdb_instance.endpoint
}

output "influxdb_port" {
  description = "Puerto de la instancia Timestream InfluxDB"
  value       = aws_timestreaminfluxdb_db_instance.influxdb_instance.port
}


output "influxdb_bucket_name" {
  description = "Nombre del bucket inicial de la instancia Timestream InfluxDB"
  value       = var.bucket_name
}

# Sacar el ARN del secreto para saber dónde quedó
output "secret_arn" {
  value = aws_secretsmanager_secret.influx_token.arn
}

# Sacar el valor real (CUIDADO: esto se verá en el log de la consola)
output "influxdb_password_token" {
  value     = aws_secretsmanager_secret_version.influx_token_val.secret_string
  sensitive = true 
}