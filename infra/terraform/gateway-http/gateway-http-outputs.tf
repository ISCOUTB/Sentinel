output "backend_ip" {
  value = var.backend_ip
}
output "api_gateway_url" {
  description = "URL pública del API Gateway"
  value       = aws_apigatewayv2_api.sentinel_api.api_endpoint
}