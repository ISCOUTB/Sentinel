output "user_pool_id" {
  value = aws_cognito_user_pool.sentinel_pool.id
}

output "user_pool_client_id" {
  value = aws_cognito_user_pool_client.sentinel_client.id
}

output "issuer_url" {
  value = "https://cognito-idp.us-east-1.amazonaws.com/${aws_cognito_user_pool.sentinel_pool.id}"
}

output "region" {
  value = var.aws_region
}