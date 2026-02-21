resource "aws_cognito_user_pool" "sentinel_pool" {
  name = "${var.project_name}-user-pool"

  username_attributes = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = var.password_minimum_length
    require_lowercase = var.password_require_lowercase
    require_uppercase = var.password_require_uppercase
    require_numbers   = var.password_require_numbers
    require_symbols   = var.password_require_symbols
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