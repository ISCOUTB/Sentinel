resource "aws_iot_policy" "hmi_all_access" {
  name = "${var.project_name}-hmi-policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Permite conectar con el Client ID prefijado (Ej: sentinel_hmi_123)
        Action   = ["iot:Connect"]
        Effect   = "Allow"
        Resource = "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:client/${var.project_name}_hmi_*"
      },
      {
        # Permite publicar comandos en los tópicos del USV (Ej: USV-001/control)
        Action   = ["iot:Publish"]
        Effect   = "Allow"
        Resource = [
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topic/${var.thing_name}/*"
        ]
      },
      {
        # Permite suscribirse y recibir telemetría (Ej: USV-001/status, USV-001/mission)
        Action   = ["iot:Subscribe", "iot:Receive"]
        Effect   = "Allow"
        Resource = [
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topicfilter/${var.thing_name}/*",
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topic/${var.thing_name}/*"
        ]
      },
      {
        # Permite interactuar con el Device Shadow para obtener/actualizar estado persistente
        Action = [
          "iot:GetThingShadow",
          "iot:UpdateThingShadow"
        ]
        Effect   = "Allow"
        Resource = [
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:thing/${var.thing_name}"
        ]
      }
    ]
  })
}


output "iot_policy_name" {
  value = aws_iot_policy.hmi_all_access.name
  description = "Nombre de la política de IoT para el HMI"
}
