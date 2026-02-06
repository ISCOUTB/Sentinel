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

variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "us-east-1"
}

variable "lambda_name" {
  description = "Name of the Lambda function"
  type        = string
  default     = "iot_to_influxdb_v3"
}

variable "influxdb_url" {
  description = "URL of the InfluxDB v3 instance (e.g. https://<id>.<region>.timestream-influxdb.aws.com:8086)"
  type        = string
}

variable "influxdb_bucket" {
  description = "Default Bucket to write IoT data to (used as fallback if not specified in rule)"
  type        = string
}

variable "influxdb_org" {
  description = "Organization name in InfluxDB"
  type        = string
}

variable "influxdb_username" {
  description = "Username for InfluxDB authentication"
  type        = string
}

variable "influxdb_password" {
  description = "Password for InfluxDB authentication"
  type        = string
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
