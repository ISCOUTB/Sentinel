output "elastic_ip" {
  description = "Elastic IP asociada a la instancia Sentinel"
  value       = aws_eip.sentinel_eip.public_ip
}
output "api_gateway_url" {
  description = "URL pública del API Gateway"
  value       = aws_apigatewayv2_api.sentinel_api.api_endpoint
}