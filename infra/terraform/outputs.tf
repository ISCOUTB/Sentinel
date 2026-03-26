# ==========================================
# Outputs VM Sentinel
# ==========================================
output "vm_instance_id" {
  description = "ID de instancia EC2 del VM Sentinel"
  value       = module.vm-sentinel.instance_id
}

output "vm_elastic_ip" {
  description = "Elastic IP asociada a la instancia Sentinel"
  value       = module.vm-sentinel.elastic_ip
}

# ==========================================
# Outputs TSDB Sentinel (InfluxDB)
# ==========================================
output "influxdb_url" {
  description = "Endpoint de la instancia Timestream InfluxDB"
  value = module.tsdb-sentinel.influxdb_url
}

output "influxdb_username" {
  value = module.tsdb-sentinel.influxdb_username
}

output "influxdb_buckets" {
  value = module.tsdb-sentinel.all_bucket_names
}

output "influxdb_secret_arn" {
  description = "ARN del secreto de InfluxDB en Secrets Manager"
  value       = module.tsdb-sentinel.secret_arn
}

output "influxdb_password" {
  value     = module.tsdb-sentinel.influxdb_password
  sensitive = true
}

# ==========================================
# Outputs IoT Core
# ==========================================
output "iot_thing_name" {
  description = "Nombre del dispositivo IoT"
  value       = module.iot-core.thing_name
}

output "iot_certificate_pem" {
  description = "Certificado PEM del dispositivo IoT (sensible)"
  value       = module.iot-core.certificate_pem
  sensitive   = true
}

output "iot_private_key" {
  description = "Clave privada del dispositivo IoT (sensible)"
  value       = module.iot-core.private_key
  sensitive   = true
}

# ==========================================
# Outputs Gateway HTTP
# ==========================================
output "api_gateway_url" {
  description = "URL pública del API Gateway"
  value       = module.gateway-http.api_gateway_url
}

