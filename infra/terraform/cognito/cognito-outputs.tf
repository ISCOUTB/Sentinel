output "user_pool_id" {
  value = aws_cognito_user_pool.sentinel_pool.id
}

output "user_pool_client_id" {
  value = aws_cognito_user_pool_client.sentinel_client.id
}

output "region" {
  value = var.aws_region
}
