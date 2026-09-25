variable "my_access_key" {
  description = "Llave de acceso aws"
  default     = ""
}

variable "my_secret_key" {
  description = "Clave de acceso aws"
  default     = ""
}

variable "region_sentinel" {
  description = "La región de AWS donde se desplegaran los recursos."
  default     = "us-east-1"
}

variable "repo_branch" {
  description = "Rama del repositorio a clonar"
  default     = "develop"
}

variable "user_pool_id" {
  description = "Cognito User Pool ID para el frontend"
  default     = ""
}

variable "user_pool_client_id" {
  description = "Cognito App Client ID para el frontend"
  default     = ""
}

variable "aws_iot_endpoint" {
  description = "Endpoint de AWS IoT Core para el bridge de inserción"
  default     = ""
}

variable "iot_certificate_pem" {
  description = "Certificado PEM del cliente IoT para el bridge"
  default     = ""
}

variable "iot_private_key" {
  description = "Clave privada del cliente IoT para el bridge"
  default     = ""
}

variable "influxdb_url" {
  description = "URL de InfluxDB para el bridge"
  default     = ""
}

variable "influxdb_org" {
  description = "Organización de InfluxDB"
  default     = ""
}

variable "influxdb_username" {
  description = "Usuario de InfluxDB"
  default     = ""
}

variable "influxdb_password" {
  description = "Contraseña de InfluxDB"
  default     = ""
}

variable "influxdb_bucket" {
  description = "Bucket de fallback para el bridge"
  default     = ""
}

variable "topic_bucket_map" {
  description = "Mapa JSON de topicos a buckets"
  default     = ""
}

variable "secret_key" {
  description = "Secret key para el backend"
  default     = "your-secret-key-here-change-this-in-production"
}

variable "mysql_root_password" {
  description = "Contraseña root de MySQL"
  default     = "rootpassword"
}

variable "mysql_database" {
  description = "Nombre de la base de datos"
  default     = "usv_hmi"
}

variable "mysql_user" {
  description = "Usuario de MySQL"
  default     = "usv_user"
}

variable "mysql_password" {
  description = "Contraseña del usuario de MySQL"
  default     = "usv_password"
}
