# AWS Credentials
variable "my_access_key" {
  description = "Llave de acceso AWS"
  type        = string
  default     = ""
}

variable "my_secret_key" {
  description = "Clave de acceso AWS"
  type        = string
  sensitive   = true
  default     = ""
}

variable "aws_region" {
  description = "Región de AWS"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Nombre del proyecto"
  type        = string
  default     = "sentinel"
}

# Password Policy
variable "password_minimum_length" {
  description = "Longitud mínima de la contraseña"
  type        = number
  default     = 8
}

variable "password_require_lowercase" {
  description = "Requerir minúsculas en la contraseña"
  type        = bool
  default     = true
}

variable "password_require_uppercase" {
  description = "Requerir mayúsculas en la contraseña"
  type        = bool
  default     = true
}

variable "password_require_numbers" {
  description = "Requerir números en la contraseña"
  type        = bool
  default     = true
}

variable "password_require_symbols" {
  description = "Requerir símbolos en la contraseña"
  type        = bool
  default     = false
}

variable "callback_urls" {
  description = "URLs de callback para Cognito"
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "logout_urls" {
  description = "URLs de logout para Cognito"
  type        = list(string)
  default     = ["http://localhost:3000"]
}