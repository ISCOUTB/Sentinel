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

variable "region_sentinel" {
  description = "La región de AWS donde se desplegarán los recursos"
  type        = string
  default     = "us-east-1"
}

# IoT Configuration
variable "thing_name" {
  description = "Nombre del dispositivo IoT (USV)"
  type        = string
}

variable "iot_policy_name" {
  description = "Nombre de la política IoT"
  type        = string
  default     = "usv-iot-policy"
}
