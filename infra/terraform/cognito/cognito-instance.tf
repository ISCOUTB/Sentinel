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

  callback_urls = var.callback_urls

  logout_urls = var.logout_urls
  
  access_token_validity = var.access_token_validity
  id_token_validity     = var.id_token_validity
  refresh_token_validity = var.refresh_token_validity

  token_validity_units {
    access_token  = var.access_token_validity_unit
    id_token      = var.id_token_validity_unit
    refresh_token = var.refresh_token_validity_unit
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

# Obtener el Account ID actual de AWS
data "aws_caller_identity" "current" {}

# 1. Crear el Identity Pool
resource "aws_cognito_identity_pool" "sentinel_identity_pool" {
  identity_pool_name               = "${var.project_name}-identity-pool"
  allow_unauthenticated_identities = false # Solo usuarios logueados

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.sentinel_client.id
    provider_name           = aws_cognito_user_pool.sentinel_pool.endpoint
    server_side_token_check = false
  }
}

# 2. Roles de IAM para los usuarios del Identity Pool
resource "aws_iam_role" "authenticated_role" {
  name = "${var.project_name}-cognito-auth-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = { Federated = "cognito-identity.amazonaws.com" }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          "StringEquals": { "cognito-identity.amazonaws.com:aud": aws_cognito_identity_pool.sentinel_identity_pool.id },
          "ForAnyValue:StringLike": { "cognito-identity.amazonaws.com:amr": "authenticated" }
        }
      }
    ]
  })
}

# 3. Política IAM que permite al rol autenticado de Cognito usar IoT Core
#
# BUG CORREGIDO: Los tópicos ahora usan var.thing_name (p. ej. "USV-001")
# para que coincidan exactamente con los tópicos que suscribe el frontend:
#   {thingName}/general_usv_status
#   {thingName}/mision
#   {thingName}/logs
#
# Antes usaban "${var.project_name}/hmi/*" que NO cubre esos tópicos.
resource "aws_iam_role_policy" "iot_policy" {
  name = "${var.project_name}-iot-policy"
  role = aws_iam_role.authenticated_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Conectar con client_id que comience por "{project_name}_hmi_"
        # Debe coincidir con el clientId generado en iot-config.ts
        Effect   = "Allow"
        Action   = "iot:Connect"
        Resource = "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:client/${var.project_name}_hmi_*"
      },
      {
        # Publicar en cualquier sub-tópico del USV (p. ej. USV-001/control)
        Effect   = "Allow"
        Action   = "iot:Publish"
        Resource = "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topic/${var.thing_name}/*"
      },
      {
        # Suscribirse y recibir de los tópicos del USV
        # Cubre: {thing_name}/general_usv_status, /mision, /logs
        Effect = "Allow"
        Action = [
          "iot:Subscribe",
          "iot:Receive"
        ]
        Resource = "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topicfilter/${var.thing_name}/*"
      },
      {
        # El frontend llama a AttachPolicy para adjuntar la política IoT
        # al principal de Cognito Identity (requerido para WebSocket + SigV4)
        Effect   = "Allow"
        Action   = "iot:AttachPolicy"
        Resource = "*"
      }
    ]
  })
}

# 4. Vincular los roles al Identity Pool
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.sentinel_identity_pool.id

  roles = {
    authenticated = aws_iam_role.authenticated_role.arn
  }
}