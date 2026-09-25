# IoT Rules (Dynamic)
resource "aws_iot_topic_rule" "rules" {
  for_each = var.iot_rules

  name        = "${var.lambda_name}_rule_${each.key}"
  description = "Route ${each.key} to InfluxDB Lambda (Target Bucket: ${each.value.bucket})"
  enabled     = true
  sql         = each.value.sql
  sql_version = "2016-03-23"

  lambda {
    function_arn = aws_lambda_function.iot_influx_lambda.arn
  }
}

# Permissions for IoT to invoke Lambda (one per rule)
resource "aws_lambda_permission" "allow_iot" {
  for_each = var.iot_rules

  statement_id  = "AllowExecutionFromIoT_${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.iot_influx_lambda.function_name
  principal     = "iot.amazonaws.com"
  source_arn    = aws_iot_topic_rule.rules[each.key].arn
}
