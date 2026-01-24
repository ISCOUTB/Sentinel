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
        Effect   = "Allow"
        Action   = ["iot:*"]
        Resource = ["*"]
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