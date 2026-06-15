# Sentinel: Sistema de Control y Monitoreo de Calidad de Agua para USV

Sentinel es una plataforma de software de grado industrial diseñada para el monitoreo ambiental y el control en tiempo real de Vehículos de Superficie No Tripulados (USV - Unmanned Surface Vehicles). El sistema permite planificar rutas autónomas, visualizar telemetría física y ambiental mediante vistas 2D/3D interactivas, recopilar datos del agua y generar reportes ejecutivos automatizados con Inteligencia Artificial.

---

## 🏗️ Arquitectura General

El ecosistema de Sentinel está compuesto por servicios distribuidos en la nube (AWS) y contenedores locales:

```mermaid
graph TD
    %% Nodos
    USV[Vehículo USV / Emulador] -->|MQTT / TLS 1.2| IoT[AWS IoT Core]
    
    subgraph Cliente (HMI)
        React[Frontend React / Vite]
    end
    
    subgraph Nube AWS
        APIGW[AWS API Gateway]
        Cognito[AWS Cognito User/Identity Pools]
        Lambda[AWS Lambda Router]
    end
    
    subgraph Infraestructura Servidora
        FastAPI[Backend FastAPI]
        MySQL[(MySQL Metadata DB)]
        InfluxDB[(InfluxDB TSDB)]
        Bridge[Puente IoT Python]
    end

    %% Flujos de datos y control
    React -->|1. Autenticación| Cognito
    React -->|2. Obtiene credenciales temporales| Cognito
    React -->|3. Conexión wss / SigV4| IoT
    React -->|4. Peticiones REST / JWT| APIGW
    APIGW --> FastAPI
    
    FastAPI -->|Metadatos y Usuarios| MySQL
    FastAPI -->|Query Flux| InfluxDB
    FastAPI -->|Análisis de Calidad| Gemini[Google Gemini API]
    
    IoT -->|Tópico Orders| USV
    USV -->|Tópico Telemetry| IoT
    
    IoT -->|Eventos de Datos| Bridge
    Bridge -->|Ingesta Line Protocol| InfluxDB
```

### Componentes Principales
1. **Frontend (React + TS)**: Interfaz de Operador (HMI) con soporte 2D (Leaflet) y 3D (React Three Fiber) para representar la navegación del vehículo, y validación visual de waypoints mediante la inspección cromática de Tiles de OpenStreetMap.
2. **Backend (FastAPI)**: API REST que maneja el ciclo de vida de las misiones, la autenticación local de respaldo y la generación de reportes ejecutivos combinando consultas Flux a InfluxDB y la API de Gemini AI.
3. **Base de Datos Relacional (MySQL)**: Persistencia de usuarios locales, misiones creadas y marcas de tiempo de inicio/fin.
4. **Base de Datos de Series Temporales (InfluxDB v2)**: Almacenamiento optimizado de alta velocidad para la telemetría de sensores enviada continuamente por el USV.
5. **Puente IoT (Influx Bridge)**: Servicio desacoplado escrito en Python que consume la telemetría desde AWS IoT Core mediante MQTT y la inyecta eficientemente en InfluxDB.
6. **AWS IoT Core**: Broker MQTT que distribuye órdenes y telemetría de forma segura mediante WebSockets firmados por SigV4 y certificados TLS.

---

## 📂 Estructura de Carpetas

```
Sentinel/
├── backend/               # Servidor de API REST (FastAPI)
│   ├── app/               # Lógica de negocio (routers, core, dependencies, models, schemas)
│   ├── main.py            # Punto de entrada de la aplicación
│   └── wait_for_db.py     # Script helper de espera de base de datos
├── frontend/              # Cliente web HMI (React + TypeScript + Vite)
│   ├── src/               # Código fuente (components, contexts, hooks, services, pages, api)
│   └── index.html         # Archivo raíz HTML5
├── database/              # Scripts de inicialización SQL
│   └── init.sql           # Estructura inicial de tablas MySQL
├── infra/                 # Infraestructura como Código (Terraform) y Docker
│   ├── terraform/         # Módulos de Terraform para desplegar en AWS (EC2, Cognito, IoT Core)
│   ├── docker/            # Configuración de Docker Compose para entorno local
│   └── container/         # Contenedores auxiliares (Puente MQTT-InfluxDB)
├── tests/                 # Scripts de prueba y simulación del USV
│   └── iot-emulator/      # Emulador de telemetría de navegación y sensores en Node.js
└── .env.example           # Plantilla de variables de entorno global
```

---

## ⚙️ Configuración y Variables de Entorno

### 1. Variables Globales (`.env` en la raíz)
Copia la plantilla de ejemplo y completa los parámetros reales:
```bash
cp .env.example .env
```
Campos principales a configurar:
* `DATABASE_URL`: Conexión MySQL, ej. `mysql+pymysql://usv_user:usv_password@db:3306/usv_hmi`.
* `SECRET_KEY`: Frase secreta para firma de tokens JWT locales.
* `GEMINI_API_KEY`: API Key de Google AI Studio para el análisis de calidad de agua.
* `COGNITO_USER_POOL_ID` y `COGNITO_APP_CLIENT_ID`: Identificadores del User Pool para login.
* `IOT_ENDPOINT`: Dirección ATS de tu AWS IoT Core (p. ej. `aXXXXXXXXXXXXX-ats.iot.us-east-1.amazonaws.com`).

### 2. Variables de Terraform (`terraform.tfvars`)
En la carpeta raíz o en `infra/terraform/`, configura tus credenciales de AWS y parámetros de red:
```bash
cp terraform.tfvars.example terraform.tfvars
```

---

## 🚀 Ejecución en Desarrollo (Local)

La forma más rápida de arrancar todo el ecosistema localmente es utilizando Docker Compose:

```bash
# 1. Asegúrate de estar en la raíz de Sentinel y tener Docker activo
# 2. Levanta los contenedores apuntando al archivo .env global
docker-compose -f infra/docker/docker-compose.yml --env-file .env up -d --build
```

Esto iniciará los siguientes servicios locales:
* **HMI Frontend**: Accesible en [http://localhost:3000](http://localhost:3000) o [http://localhost:5173](http://localhost:5173).
* **API Backend**: Accesible en [http://localhost:8000](http://localhost:8000). Documentación interactiva en [http://localhost:8000/docs](http://localhost:8000/docs).
* **MySQL**: Puerto 3306.
* **InfluxDB v2**: Puerto 8086.
* **Adminer**: Administrador de MySQL en [http://localhost:8080](http://localhost:8080).
* **Influx Bridge**: Contenedor interno escuchando telemetría de AWS.

---

## ☁️ Despliegue en AWS (Producción)

Sentinel está diseñado para aprovisionarse automáticamente en AWS usando Terraform:

1. **Inicializar y validar la infraestructura**:
   ```bash
   cd infra/terraform
   terraform init
   terraform validate
   ```
2. **Revisar el plan y aplicar**:
   ```bash
   terraform plan
   terraform apply
   ```
   *Esto desplegará una instancia EC2 configurada mediante `user_data.sh` que instalará Docker, clonará la rama del repositorio seleccionada (`TF_VAR_repo_branch`), inyectará las variables de entorno de forma segura e iniciará los contenedores en producción.*

---

## 🎮 Simulación y Pruebas

Para validar el flujo completo de telemetría sin un USV físico, utiliza el emulador de Node.js provisto:

```bash
cd tests/iot-emulator

# 1. Instalar dependencias
npm install

# 2. Configurar certificados de AWS IoT en la carpeta certs/
# (Colocar: amazon-root-ca.pem, certificate.pem.crt, private.pem.key)

# 3. Arrancar la simulación de trayectoria
npm start
```
*El simulador emite tramas JSON periódicas en los tópicos correspondientes simulando la navegación autónoma del vehículo.*

---

## 🛠️ Troubleshooting

### 1. Error de Conexión a la Base de Datos (`wait_for_db.py` falla)
* **Causa**: MySQL no se ha inicializado a tiempo o las credenciales no coinciden.
* **Solución**: Valida los valores de `DB_USER` y `DB_PASSWORD` en tu `.env`. Ejecuta `docker-compose logs db` para verificar el estado del motor SQL.

### 2. Error `ResourceAlreadyExistsException` en el Frontend
* **Causa**: Al conectar el WebSocket, el SDK intenta asociar la política IoT al IdentityId, pero esta ya está adjunta.
* **Solución**: Es una advertencia inofensiva y se maneja de forma segura en `iot-config.ts` ignorando la excepción.

### 3. Reportes en PDF vacíos o sin Gráficos
* **Causa**: InfluxDB no contiene registros de telemetría con la marca `mission_id` de la misión seleccionada dentro del rango de tiempo consultado.
* **Solución**: Asegúrate de haber ejecutado el emulador de IoT o transmitido telemetría mientras la misión se encontraba activa (`EN_PROGRESO`).

---

## 📦 Dependencias Principales

### Backend
* **FastAPI / Uvicorn**: Framework web asíncrono de alto rendimiento.
* **SQLAlchemy / PyMySQL**: Mapeador relacional e interfaz MySQL.
* **Pydantic v2**: Validación y estructuración de modelos de datos.
* **google-generativeai**: SDK oficial de Gemini para el análisis inteligente.
* **WeasyPrint / Jinja2**: Compilación de plantillas HTML y renderizado PDF de calidad.
* **Matplotlib / Pandas**: Generación de gráficos y tratamiento de datos estructurados.

### Frontend
* **React / Vite**: Compilador y librería base de la interfaz.
* **Leaflet / React-Leaflet**: Biblioteca cartográfica e interactiva de mapas 2D.
* **Three.js / React Three Fiber / Drei**: Motor gráfico 3D para la orientación del vehículo.
* **AWS SDK (Credential Provider, Client IoT)**: Conexión SigV4 y firma de WebSocket.
* **Recharts**: Renderizado de gráficos de tendencias en tiempo real.
* **Tailwind CSS / Shadcn UI**: Sistema estético de componentes visuales.
