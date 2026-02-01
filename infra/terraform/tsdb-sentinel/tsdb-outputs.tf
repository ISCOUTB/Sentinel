output "influxdb_username" {
  value = var.db_username
}

output "influxdb_url" {
  description = "URL de la instancia Timestream InfluxDB"
  value       = "https://${aws_timestreaminfluxdb_db_instance.influxdb_instance.endpoint}:${aws_timestreaminfluxdb_db_instance.influxdb_instance.port}"
}

output "all_bucket_names" {
  description = "Lista de todos los buckets configurados (inicial + adicionales)"
  value       = concat([var.bucket_name], var.additional_buckets)
}

# Sacar el ARN del secreto para saber dónde quedó
output "secret_arn" {
  value = aws_secretsmanager_secret.influx_token.arn
}

# Sacar el valor real (CUIDADO: esto se verá en el log de la consola)
output "influxdb_password" {
  value     = aws_secretsmanager_secret_version.influx_token_val.secret_string
  sensitive = true
}
