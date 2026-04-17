# ==========================================
# Variables Generales AWS
# ==========================================
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

# ==========================================
# Variables VM Sentinel (EC2)
# ==========================================
variable "region_sentinel" {
  description = "La región de AWS donde se desplegarán los recursos"
  type        = string
  default     = "us-east-1"
}

variable "repo_branch" {
  description = "Rama del repositorio a clonar"
  type        = string
  default     = "develop"
}

variable "secret_key" {
  description = "Secret key para el backend"
  type        = string
  default     = "your-secret-key-here-change-this-in-production"
}

# Variables MySQL
variable "mysql_root_password" {
  description = "Contraseña root de MySQL"
  type        = string
  default     = "rootpassword"
}

variable "mysql_database" {
  description = "Nombre de la base de datos"
  type        = string
  default     = "usv_hmi"
}

variable "mysql_user" {
  description = "Usuario de MySQL"
  type        = string
  default     = "usv_user"
}

variable "mysql_password" {
  description = "Contraseña del usuario de MySQL"
  type        = string
  default     = "usv_password"
}

# ==========================================
# Variables TSDB Sentinel (InfluxDB)
# ==========================================
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

# ==========================================
# Variables IoT Core
# ==========================================
variable "thing_name" {
  description = "Nombre del dispositivo IoT (USV)"
  type        = string
}

variable "iot_policy_name" {
  description = "Nombre de la política IoT"
  type        = string
  default     = "usv-iot-policy"
}

# ==========================================
# Variables Cognito
# ==========================================
variable "user_pool_id" {
  type = string
}

variable "user_pool_client_id" {
  type = string
}
# Variables Lambda IoT -> InfluxDB
# ==========================================
variable "lambda_function_name" {
  description = "Nombre de la función Lambda para procesar datos IoT y enviarlos a InfluxDB"
  type        = string
  default     = "iot-to-influxdb"
}

variable "iot_rules" {
  description = "Map of rule names to configuration (sql, bucket)"
  type = map(object({
    sql    = string
    bucket = string
  }))
  default = {
    "usv_mission" = {
      sql    = "SELECT *, 'mission' as influx_bucket FROM 'usv/mission/data'"
      bucket = "mission"
    }
    "usv_logs" = {
      sql    = "SELECT *, 'logs' as influx_bucket FROM 'usv/logs/data'"
      bucket = "logs"
    }
    "usv_status" = {
      sql    = "SELECT *, 'general_status' as influx_bucket FROM 'usv/status/data'"
      bucket = "general_status"
    }
  }
}
