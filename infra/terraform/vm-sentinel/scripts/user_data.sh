#!/bin/bash
set -e

# Actualizar sistema
apt-get update -y
apt-get upgrade -y

# Dependencias
apt-get install -y ca-certificates curl gnupg git

# Instalar Docker (método estable)
curl -fsSL https://get.docker.com | sh

# Habilitar Docker
systemctl enable docker
systemctl start docker

# Instalar docker-compose v1 (NO v2)
curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" \
-o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Permisos usuario ubuntu
usermod -aG docker ubuntu

# Clonar repo
cd /home/ubuntu
git clone -b ${branch} https://github.com/ISCOUTB/Sentinel.git
chown -R ubuntu:ubuntu Sentinel

# Instalar herramientas adicionales
# Fresh Editor
curl -sL $(curl -s https://api.github.com/repos/sinelaw/fresh/releases/latest | grep "browser_download_url.*_$(dpkg --print-architecture)\.deb" | cut -d '"' -f 4) -o /tmp/fresh-editor.deb && sudo dpkg -i /tmp/fresh-editor.deb && rm /tmp/fresh-editor.deb

# htop
sudo apt install -y htop

# Crear archivo .env con las variables inyectadas
cat > /home/ubuntu/Sentinel/infra/.env << EOF
# Backend
SECRET_KEY="${secret_key}"
PROJECT_NAME="USV HMI Backend"

# Database
MYSQL_ROOT_PASSWORD="${mysql_root_password}"
MYSQL_DATABASE="${mysql_database}"
MYSQL_USER="${mysql_user}"
MYSQL_PASSWORD="${mysql_password}"

# AWS Cognito Configuration
COGNITO_REGION="${cognito_region}"
COGNITO_USER_POOL_ID="${cognito_user_pool_id}"
COGNITO_APP_CLIENT_ID="${cognito_app_client_id}"

# AWS API Gateway and IoT Configuration
AWS_REGION="${aws_region}"
AWS_IOT_ENDPOINT="${aws_iot_endpoint}"
API_GATEWAY_WS_ENDPOINT="${api_gateway_ws_endpoint}"
API_GATEWAY_HTTP_ENDPOINT="${api_gateway_http_endpoint}"

# InfluxDB Configuration
INFLUXDB_URL="${influxdb_url}"
INFLUXDB_TOKEN="${influxdb_token}"
INFLUXDB_ORG="${influxdb_org}"
INFLUXDB_BUCKET="${influxdb_bucket}"
EOF

chown ubuntu:ubuntu /home/ubuntu/Sentinel/infra/.env

# Desactivar BuildKit (CRÍTICO)
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0

# Esperar Docker REALMENTE
until docker info >/dev/null 2>&1; do
  sleep 5
done

# Levantar contenedores DESDE LA RUTA CORRECTA
cd /home/ubuntu/Sentinel/infra/docker
sudo /usr/local/bin/docker-compose --env-file ../.env up -d --build