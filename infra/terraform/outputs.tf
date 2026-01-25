output "instance_id" {
  description = "ID de instancia EC2"
  value       = aws_instance.sentinel.id
}
output "instance_public_ip" {
  description = "IP publica de instancia EC2"
  value       = aws_instance.sentinel.public_ip
}
output "elastic_ip" {
  description = "Elastic IP asociada a la instancia Sentinel"
  value       = aws_eip.sentinel_eip.public_ip
}
output "api_gateway_url" {
  description = "URL pública del API Gateway"
  value       = aws_apigatewayv2_api.sentinel_api.api_endpoint
}