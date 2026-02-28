# crea la api gateway HTTP
resource "aws_apigatewayv2_api" "sentinel_api" {
  name          = "sentinel-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["*"]
  }
}

# crea la integración que apunta a la estica IP de la instancia EC2
resource "aws_apigatewayv2_integration" "sentinel_integration" {
  api_id           = aws_apigatewayv2_api.sentinel_api.id
  integration_type = "HTTP_PROXY"
  integration_method = "ANY"
  integration_uri    = "http://${var.backend_ip}:8080"
}

# crea la ruta catch-all para la integración
resource "aws_apigatewayv2_route" "sentinel_route" {
  api_id    = aws_apigatewayv2_api.sentinel_api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.sentinel_integration.id}"
}

#crea el stage de despliegue automatico
resource "aws_apigatewayv2_stage" "sentinel_stage" {
  api_id      = aws_apigatewayv2_api.sentinel_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_authorizer" "cognito_jwt" {
  name            = "sentinel-jwt-authorizer"
  api_id          = aws_apigatewayv2_api.sentinel_api.id
  authorizer_type = "JWT"

  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    issuer   = "https://cognito-idp.us-east-1.amazonaws.com/${var.user_pool_id}"
    audience = [var.user_pool_client_id]
  }
}

resource "aws_apigatewayv2_route" "get_users" {
  api_id    = aws_apigatewayv2_api.sentinel_api.id
  route_key = "GET /users"

  target = "integrations/${aws_apigatewayv2_integration.sentinel_integration.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_route" "public_health" {
  api_id    = aws_apigatewayv2_api.sentinel_api.id
  route_key = "GET /health"

  target = "integrations/${aws_apigatewayv2_integration.sentinel_integration.id}"

  authorization_type = "NONE"
}