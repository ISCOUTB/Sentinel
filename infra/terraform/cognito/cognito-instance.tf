resource "aws_cognito_user_pool" "sentinel_pool" {
  name = "${var.project_name}-user-pool"

  username_attributes = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

resource "aws_cognito_user_pool_domain" "sentinel_domain" {
  domain       = "${var.project_name}-auth"
  user_pool_id = aws_cognito_user_pool.sentinel_pool.id
}

resource "aws_cognito_user_pool_client" "sentinel_client" {
  name         = "${var.project_name}-app-client"
  user_pool_id = aws_cognito_user_pool.sentinel_pool.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  supported_identity_providers = ["COGNITO"]

  prevent_user_existence_errors = "ENABLED"

  allowed_oauth_flows_user_pool_client = true

  allowed_oauth_flows = ["code"]

  allowed_oauth_scopes = [
    "openid",
    "email",
    "profile"
  ]

  callback_urls = [
    "http://localhost:3000",
  ]

  logout_urls = [
    "http://localhost:3000",
  ]
  
  access_token_validity = 60
  id_token_validity     = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

# Roles por grupos (admin/user)
resource "aws_cognito_user_group" "admin_group" {
  name         = "admin"
  user_pool_id = aws_cognito_user_pool.sentinel_pool.id
  description  = "Administradores del sistema"
}

resource "aws_cognito_user_group" "user_group" {
  name         = "user"
  user_pool_id = aws_cognito_user_pool.sentinel_pool.id
  description  = "Usuarios normales del sistema"
}