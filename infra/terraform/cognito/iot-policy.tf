resource "aws_iot_policy" "hmi_all_access" {
  name = "sentinel-hmi-policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Restringir conexión por Client ID
        Action   = ["iot:Connect"]
        Effect   = "Allow"
        Resource = "arn:aws:iot:us-east-1:251622686387:client/sentinel_hmi_*"
      },
      {
        # Restringir suscripción y recepción a tópicos específicos
        Action   = ["iot:Subscribe", "iot:Receive"]
        Effect   = "Allow"
        Resource = [
          "arn:aws:iot:us-east-1:251622686387:topicfilter/USV-001/*",
          "arn:aws:iot:us-east-1:251622686387:topic/USV-001/*"
        ]
      },
      {
        # Restringir publicación a tópicos de control
        Action   = ["iot:Publish"]
        Effect   = "Allow"
        Resource = "arn:aws:iot:us-east-1:251622686387:topic/USV-001/*"
      }
    ]
  })
}


output "iot_policy_name" {
  value = aws_iot_policy.hmi_all_access.name
  description = "Nombre de la política de IoT para el HMI"
}
