output "user_pool_id" {
  value = aws_cognito_user_pool.sentinel_pool.id
}

output "identity_pool_id" {
  value = aws_cognito_identity_pool.sentinel_identity_pool.id
}

output "user_pool_client_id" {
  value = aws_cognito_user_pool_client.sentinel_client.id
}

output "issuer_url" {
  value = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.sentinel_pool.id}"
}

output "region" {
  value = var.aws_region
}
