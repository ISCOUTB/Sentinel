# Módulo VM Sentinel - Instancia EC2 principal
module "vm-sentinel" {
  source = "./vm-sentinel"

  # AWS Credentials
  my_access_key = var.my_access_key
  my_secret_key = var.my_secret_key

  # Configuración regional
  region_sentinel = var.region_sentinel

  # Configuración del repositorio
  repo_branch = var.repo_branch

  # Secret key para el backend
  secret_key = var.secret_key

  # Configuración MySQL
  mysql_root_password = var.mysql_root_password
  mysql_database      = var.mysql_database
  mysql_user          = var.mysql_user
  mysql_password      = var.mysql_password
}

# Módulo TSDB Sentinel - Base de datos InfluxDB
module "tsdb-sentinel" {
  source = "./tsdb-sentinel"

  # AWS Credentials
  my_access_key = var.my_access_key
  my_secret_key = var.my_secret_key

  # AWS Region
  aws_region = var.aws_region

  # InfluxDB Configuration
  db_instance_name    = var.db_instance_name
  db_username         = var.db_username
  db_password         = var.db_password
  organization_name   = var.organization_name
  bucket_name         = var.bucket_name
  allocated_storage   = var.allocated_storage
  db_instance_type    = var.db_instance_type
  publicly_accessible = var.publicly_accessible
}

# Módulo IoT Core - Dispositivo IoT
module "iot-core" {
  source = "./iot"

  # AWS Credentials
  my_access_key    = var.my_access_key
  my_secret_key    = var.my_secret_key
  region_sentinel  = var.region_sentinel

  thing_name      = var.thing_name
  iot_policy_name = var.iot_policy_name
}

# Módulo Gateway HTTP - API Gateway
module "gateway-http" {
  source = "./gateway-http"
   user_pool_id        = var.user_pool_id
  user_pool_client_id = var.user_pool_client_id

  # AWS Credentials
  my_access_key = var.my_access_key
  my_secret_key = var.my_secret_key
  aws_region    = var.aws_region

  backend_ip = module.vm-sentinel.elastic_ip
}
