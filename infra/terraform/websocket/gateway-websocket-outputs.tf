output "ws_url" {
  description = "URL WebSocket final"
  value       = aws_apigatewayv2_stage.prod.invoke_url
}
