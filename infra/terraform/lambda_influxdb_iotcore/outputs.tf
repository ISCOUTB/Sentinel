output "lambda_arn" {
  description = "ARN of the creating Lambda function"
  value       = aws_lambda_function.iot_influx_lambda.arn
}

output "iot_rule_names" {
  description = "Map of IoT Rule names created"
  value       = { for k, v in aws_iot_topic_rule.rules : k => v.name }
}
