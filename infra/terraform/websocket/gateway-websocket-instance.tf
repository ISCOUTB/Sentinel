resource "aws_apigatewayv2_api" "ws_api" {
  name                       = "${var.project_name}-ws-api"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.ws_api.id
  name        = "prod"
  auto_deploy = true
}