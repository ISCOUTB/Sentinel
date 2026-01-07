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
