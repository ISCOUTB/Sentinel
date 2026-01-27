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

# Gateway Configuration
variable "backend_ip" {
  description = "IP pública del backend EC2"
  type        = string
}
