data "aws_region" "current" {}

data "aws_caller_identity" "current" {}

resource "aws_iot_thing" "usv" {
  name = var.thing_name
}

resource "aws_iot_certificate" "usv_cert" {
  active = true
}

resource "aws_iot_policy" "usv_policy" {
  name = var.iot_policy_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["iot:Connect"]
        Resource = [
          "arn:aws:iot:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:client/${var.thing_name}",
          "arn:aws:iot:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:client/sentinel_hmi_*"
        ]
        
      },
      {
        Effect = "Allow"
        Action = ["iot:Publish", "iot:Receive"]
        Resource = [
          "arn:aws:iot:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:topic/${var.thing_name}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = ["iot:Subscribe"]
        Resource = [
          "arn:aws:iot:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:topicfilter/${var.thing_name}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = ["iot:GetThingShadow", "iot:UpdateThingShadow"]
        Resource = [
          "arn:aws:iot:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:thing/${var.thing_name}"
        ]
      }
    ]
  })
}

resource "aws_iot_policy_attachment" "policy_attach" {
  policy = aws_iot_policy.usv_policy.name
  target = aws_iot_certificate.usv_cert.arn
}

resource "aws_iot_thing_principal_attachment" "thing_attach" {
  thing     = aws_iot_thing.usv.name
  principal = aws_iot_certificate.usv_cert.arn
}