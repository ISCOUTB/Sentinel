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

# Frontend Cognito
TF_VAR_user_pool_id="${user_pool_id}"
TF_VAR_user_pool_client_id="${user_pool_client_id}"

# IoT bridge
AWS_IOT_ENDPOINT="${aws_iot_endpoint}"
AWS_IOT_CLIENT_ID="sentinel-influx-bridge"
AWS_IOT_CERT_PATH="/certs/device.pem.crt"
AWS_IOT_PRIVATE_KEY_PATH="/certs/private.pem.key"
AWS_IOT_CA_PATH="/certs/AmazonRootCA1.pem"
INFLUXDB_URL="${influxdb_url}"
INFLUXDB_ORG="${influxdb_org}"
INFLUXDB_USERNAME="${influxdb_username}"
INFLUXDB_PASSWORD="${influxdb_password}"
INFLUXDB_BUCKET="${influxdb_bucket}"
TOPIC_BUCKET_MAP='${topic_bucket_map}'
EOF

chown ubuntu:ubuntu /home/ubuntu/Sentinel/infra/.env

# Certificados para iot-influx-bridge
mkdir -p /home/ubuntu/Sentinel/tests/iot-emulator/certs

cat > /home/ubuntu/Sentinel/tests/iot-emulator/certs/device.pem.crt << 'EOF_CERT'
${iot_certificate_pem}
EOF_CERT

cat > /home/ubuntu/Sentinel/tests/iot-emulator/certs/private.pem.key << 'EOF_KEY'
${iot_private_key}
EOF_KEY

curl -fsSL https://www.amazontrust.com/repository/AmazonRootCA1.pem \
  -o /home/ubuntu/Sentinel/tests/iot-emulator/certs/AmazonRootCA1.pem

chown -R ubuntu:ubuntu /home/ubuntu/Sentinel/tests/iot-emulator/certs

# Desactivar BuildKit (CRÍTICO)
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0

# Esperar Docker REALMENTE
until docker info >/dev/null 2>&1; do
  sleep 5
done

# Levantar contenedores DESDE LA RUTA CORRECTA
cd /home/ubuntu/Sentinel/infra/docker
sudo docker compose --env-file ../.env up -d --build