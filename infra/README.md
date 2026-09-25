# Sentinel Infrastructure: IaC Terraform y Contenedores Docker

Este directorio contiene los scripts de aprovisionamiento de infraestructura en la nube (AWS) y las recetas para el levantamiento de entornos de desarrollo local multicontenedor.

---

## 📂 Estructura del Componente

```
infra/
├── docker/
│   └── docker-compose.yml   # Receta multicontenedor para simulación local
├── container/
│   ├── iot-influx-bridge/   # Puente desacoplado MQTT -> InfluxDB (Python)
│   │   ├── app/main.py      # Script del puente con parseador Line Protocol
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── README.md
└── terraform/               # Módulos de infraestructura en AWS (IaC)
    ├── main.tf              # Declaración principal de red, Cognito e IoT Core
    ├── variables.tf         # Variables de entrada parametrizadas
    ├── providers.tf         # Proveedores oficiales (AWS, InfluxDB, etc.)
    ├── outputs.tf           # Datos expuestos al concluir el despliegue
    ├── cognito/             # Módulo de Autenticación Cognito
    ├── gateway-http/        # API Gateway HTTP para balanceo del Backend
    ├── iot/                 # Configuración de AWS IoT Core y reglas de desvío
    ├── lambda_influxdb_iotcore/ # Función lambda de ingesta para base de datos
    ├── tsdb-sentinel/       # Despliegue e inicialización de la instancia InfluxDB
    ├── vm-sentinel/         # Instancia EC2 que corre el backend
    │   └── scripts/
    │       └── user_data.sh # Script shell de inicialización y bootstrap
    └── websocket/           # API Gateway WebSocket para comunicación en vivo
```

---

## 🐳 Entorno Local (Docker Compose)

El archivo `docker/docker-compose.yml` permite simular los servicios en local para simplificar el ciclo de desarrollo.

### Levantar entorno local
Desde la raíz del repositorio, ejecuta:
```bash
docker-compose -f infra/docker/docker-compose.yml --env-file .env up -d --build
```

### Servicios Locales Expuestos
* **MySQL (db)**: Puerto 3306. Motor relacional local.
* **InfluxDB (sentinel-influxdb)**: Puerto 8086. Motor de series temporales.
* **Adminer**: Puerto 8080. Interfaz gráfica web de MySQL.
* **Backend**: Puerto 8000. Servidor FastAPI.
* **Frontend**: Puerto 3000 o 5173. HMI React.
* **Bridge**: Contenedor interno que consume de AWS IoT Core y escribe en el InfluxDB local.

---

## ☁️ Aprovisionamiento en Nube (AWS Terraform)

El proyecto despliega una topología segura y modularizada en AWS:

```
                  ┌──────────────────────┐
                  │    AWS IoT Core      │
                  └──────────┬───────────┘
                             │
                             ▼
 ┌───────────────┐   ┌───────────────┐   ┌────────────────┐
 │  AWS Cognito  │   │  API Gateway  │   │   InfluxDB     │
 └───────┬───────┘   └───────┬───────┘   └────────┬───────┘
         │                   │                    │
         ▼                   ▼                    ▼
 ┌───────────────┐   ┌───────────────┐   ┌────────────────┐
 │ HMI Frontend  │──▶│  FastAPI VM   │──▶│ MySQL Metadata │
 └───────────────┘   └───────────────┘   └────────────────┘
```

### Flujo de Inicialización y Bootstrap (`user_data.sh`)
Cuando Terraform aprovisiona la instancia EC2 (`vm-sentinel`), se inyecta un script de automatización (`user_data.sh`) que ejecuta las siguientes fases:
1. Actualiza el sistema e instala Docker Engine y Docker Compose.
2. Clona el repositorio git del proyecto apuntando a la rama seleccionada (`TF_VAR_repo_branch`).
3. Construye dinámicamente un archivo `.env` local en la máquina virtual, inyectando las variables de base de datos, credenciales de AWS y claves secretas recuperadas desde los outputs de Terraform.
4. Ejecuta `docker-compose up -d --build` para encender el Backend, MySQL y el Influx Bridge en la máquina virtual.

### Comandos de Despliegue
1. Exporta tus variables de entorno locales:
   ```bash
   export $(grep -v '^#' .env | xargs)
   ```
2. Inicializa Terraform y descarga módulos:
   ```bash
   cd infra/terraform
   terraform init
   ```
3. Verifica el plan de recursos y aplica:
   ```bash
   terraform plan
   terraform apply
   ```
4. Al concluir, el terminal imprimirá el `instance_public_ip` de la máquina virtual para acceder al sistema.
