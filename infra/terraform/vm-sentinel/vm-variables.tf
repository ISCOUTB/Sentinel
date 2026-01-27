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
