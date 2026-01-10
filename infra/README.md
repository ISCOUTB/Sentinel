# Infraestructura Sentinel

Este directorio contiene la configuración de infraestructura para el proyecto Sentinel, incluyendo Terraform (IaC) y Docker Compose.

## Estructura

```
infra/
├── .env.example          # Plantilla de variables de entorno
├── README.md             # Esta documentación
├── terraform/            # Infraestructura como código (AWS)
│   ├── providers.tf      # Configuración de providers y versiones
│   ├── variables.tf      # Definición de variables
│   ├── compute.tf        # Recursos de cómputo (EC2, Key Pairs)
│   ├── security.tf       # Security Groups
│   ├── data.tf           # Data sources (AMIs)
│   ├── outputs.tf        # Outputs del despliegue
│   └── scripts/
│       └── user_data.sh  # Script de inicialización EC2
└── docker/               # Configuración Docker Compose
    └── docker-compose.yml
```

## Configuración de Variables (.env)

El proyecto utiliza un archivo `.env` centralizado en la raíz de `infra/` para manejar credenciales y configuración tanto de Terraform como de Docker.

### Setup Inicial

1. Copia el ejemplo:

   ```bash
   cp .env.example .env
   ```

2. Edita `.env` con tus valores reales:
   - **AWS**: Credenciales de acceso (`TF_VAR_my_access_key`, `TF_VAR_my_secret_key`)
   - **Deployment**: Rama a desplegar (`TF_VAR_repo_branch`)
   - **Secrets**: Contraseñas y claves secretas para la aplicación

### Variables Importantes

#### Terraform AWS

- `TF_VAR_my_access_key`: Access Key de AWS
- `TF_VAR_my_secret_key`: Secret Key de AWS
- `TF_VAR_region_sentinel`: Región de despliegue (default: us-east-1)

#### Deployment

- `TF_VAR_repo_branch`: Rama del repositorio a clonar en el servidor (default: develop)

#### Application Secrets

- `TF_VAR_secret_key`: Secret key del backend
- `TF_VAR_mysql_root_password`: Contraseña root de MySQL
- `TF_VAR_mysql_database`: Nombre de la base de datos
- `TF_VAR_mysql_user`: Usuario de MySQL
- `TF_VAR_mysql_password`: Contraseña del usuario MySQL

## Docker Compose (Desarrollo Local)

Los servicios (Frontend, Backend, DB, Adminer) se definen en `docker/docker-compose.yml`.

### Ejecutar Contenedores Localmente

```bash
cd docker
docker-compose --env-file ../.env up -d --build
```

> **Nota**: La bandera `--env-file ../.env` es necesaria porque el archivo `.env` está en el directorio padre (`infra/`).

### Detener Contenedores

```bash
cd docker
docker-compose down
```

## Terraform (Despliegue AWS)

### Requisitos

- Terraform v1.2.0+
- AWS CLI (opcional)
- Par de claves SSH (`mykey.pub` en el directorio `terraform/`)

### Despliegue

1. **Exportar variables de entorno**:

   ```bash
   cd infra
   export $(grep -v '^#' .env | xargs)
   ```

2. **Inicializar Terraform**:

   ```bash
   cd terraform
   terraform init
   ```

3. **Revisar el plan**:

   ```bash
   terraform plan
   ```

4. **Aplicar cambios**:
   ```bash
   terraform apply
   ```

### Automatización del Despliegue

El script `user_data.sh` se ejecuta automáticamente al iniciar la instancia EC2 y realiza:

1. ✅ Instalación de Docker y Docker Compose
2. ✅ Clonación del repositorio (rama especificada en `TF_VAR_repo_branch`)
3. ✅ Generación automática del archivo `.env` con las credenciales inyectadas desde Terraform
4. ✅ Inicio automático de los contenedores con `docker-compose`

Las variables definidas en tu `.env` local (con prefijo `TF_VAR_`) se inyectan en el servidor durante el aprovisionamiento.

### Outputs

Después de aplicar, Terraform mostrará:

- `instance_id`: ID de la instancia EC2
- `instance_public_ip`: IP pública para acceder a la aplicación

## Extender la Infraestructura

Gracias a la estructura modular, agregar nuevos servicios de AWS es sencillo:

1. **Crea un nuevo archivo `.tf`** en `terraform/` según el tipo de recurso:

   - `storage.tf` → S3, EFS
   - `database.tf` → RDS, DynamoDB
   - `network.tf` → VPC, Load Balancers
   - `monitoring.tf` → CloudWatch, SNS

2. **Define los recursos** usando la sintaxis de Terraform:

   ```hcl
   resource "aws_s3_bucket" "my_bucket" {
     bucket = "my-app-storage"
     # ... configuración
   }
   ```

3. **Agrega variables** necesarias en `variables.tf` y `.env.example`

4. **Agrega outputs** (opcional) en `outputs.tf` para exponer información útil

5. **Valida y aplica**:
   ```bash
   terraform validate
   terraform plan
   terraform apply
   ```

La estructura modular mantiene el código organizado y facilita el mantenimiento a largo plazo.

## Notas de Seguridad

- ⚠️ **Nunca** commitees el archivo `.env` al repositorio
- ⚠️ El archivo `mykey.pub` debe ser tu clave pública SSH real
- ⚠️ Cambia las contraseñas por defecto en producción
- ⚠️ Las variables `TF_VAR_*` contienen secretos que se inyectan en el servidor
