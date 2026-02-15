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

# WebSocket Gateway Configuration
variable "project_name" {
  description = "Nombre del proyecto"
  type        = string
  default     = "sentinel"
}

