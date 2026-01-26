# 1. Crear el secreto (el contenedor)
resource "aws_secretsmanager_secret" "influx_token" {
  name        = "influxdb_admin_token_${uuid()}" # Nombre único
  description = "Token de acceso para InfluxDB"
}

# 2. Guardar el valor (la contraseña o token)
resource "aws_secretsmanager_secret_version" "influx_token_val" {
  secret_id     = aws_secretsmanager_secret.influx_token.id
  secret_string = var.db_password  # Aquí usas la variable que te pedía el CLI
}