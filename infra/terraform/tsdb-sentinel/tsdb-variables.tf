#InfluxDB Variables
variable "aws_region" {
  description = "Región de AWS"
  type        = string
  default     = "us-east-1"
}

variable "db_instance_name" {
  description = "Nombre de la instancia InfluxDB"
  type        = string
  default     = "mi-influxdb-instance"
}

variable "db_username" {
  description = "Usuario administrador de InfluxDB"
  type        = string
  default     = "admin"
}

variable "db_password" {
  description = "Contraseña del usuario administrador"
  type        = string
  sensitive   = true
}

variable "organization_name" {
  description = "Nombre de la organización InfluxDB"
  type        = string
  default     = "mi-organizacion"
}

variable "bucket_name" {
  description = "Nombre del bucket inicial de InfluxDB"
  type        = string
  default     = "mi-bucket-inicial"
}

variable "additional_buckets" {
  description = "Lista de nombres de buckets adicionales a crear en InfluxDB"
  type        = list(string)
  default     = []
}

variable "allocated_storage" {
  description = "Almacenamiento asignado en GB para la instancia InfluxDB"
  type        = number
  default     = 20
}

variable "db_instance_type" {
  description = "Tipo de instancia para Timestream InfluxDB"
  type        = string
  default     = "db.influx.medium"
}

variable "publicly_accessible" {
  description = "Si la instancia es accesible públicamente"
  type        = bool
  default     = true
}


# AWS Credentials
variable "my_access_key" {
  description = "AWS Access Key"
  type        = string
}

variable "my_secret_key" {
  description = "AWS Secret Key"
  type        = string
  sensitive   = true
}
