# Sentinel Backend: FastAPI API REST

Este directorio contiene el servidor de la API REST del proyecto Sentinel, construido sobre **FastAPI** y diseñado para gestionar la persistencia relacional, la autenticación y la lógica de negocio del sistema HMI.

---

## 📂 Estructura del Componente

```
backend/
├── app/
│   ├── main.py              # Punto de entrada de la aplicación
│   ├── config.py            # Configuraciones y lectura del .env global
│   ├── database.py          # Pool de conexión SQLAlchemy a MySQL
│   ├── core/                # Lógica del núcleo
│   │   ├── auth.py          # Autenticación y registro local
│   │   └── security.py      # Hashing Bcrypt y utilidades JWT locales
│   ├── dependencies/        # Dependencias inyectadas en endpoints
│   │   └── auth.py          # Descarga JWKS y validación de tokens de AWS Cognito
│   ├── models/              # Modelos declarativos SQLAlchemy
│   │   └── models.py        # Tablas: Users, RefreshTokens, Missions, SensorData
│   ├── schemas/             # Validadores Pydantic (DTOs)
│   │   └── schemas.py       # Estructuras de datos de entrada/salida
│   └── routers/             # Enrutadores de endpoints de FastAPI
│       ├── auth.py          # Rutas de autenticación local (/register, /login)
│       ├── data.py          # Rutas de telemetría, misiones y control MQTT
│       └── reports.py       # Rutas de generación de reportes PDF (IA) y CSV
├── test_client.py           # Cliente CLI interactivo para pruebas locales
├── requirements.txt         # Dependencias de Python del proyecto
├── Dockerfile               # Instrucciones de empaquetado del contenedor
└── wait_for_db.py           # Script para retrasar arranque hasta tener conexión MySQL
```

---

## 🔐 Estrategia de Autenticación Dual

Sentinel implementa un esquema de autenticación versátil:

1. **AWS Cognito (Producción)**: El cliente frontend se autentica contra Cognito User Pools. Las peticiones REST a través de API Gateway son validadas por un Cognito Authorizer.
   * **Inyección de Cabeceras**: API Gateway inyecta las cabeceras `x-user-sub`, `x-user-email` y `x-user-role`. El backend FastAPI las extrae en `get_current_user`.
   * **Fallback de Desarrollo**: Si las cabeceras no están presentes, la dependencia `get_current_user` lee el token del header `Authorization`, descarga las claves públicas JWKS de Cognito, las almacena en caché para reducir latencia, y valida la firma del token mediante RS256.
   * **Provisionamiento Dinámico (JIT)**: Si un usuario autenticado por Cognito no existe en la base de datos relacional de Sentinel, el backend lo registra dinámicamente de forma automática.
2. **Autenticación Local (Desarrollo)**: Rutas locales protegidas por tokens firmados con una clave secreta simétrica (`HS256`), útiles para pruebas rápidas offline sin servicios AWS.

---

## 📈 Endpoints de la API

### Autenticación (`/api/v1/auth`)
* `POST /register`: Registra un usuario local.
* `POST /login`: Valida credenciales locales y emite access y refresh tokens.
* `POST /refresh`: Genera un nuevo token de acceso a partir de un refresh token.
* `GET /me`: Obtiene los datos del perfil del usuario en sesión.
* `POST /logout`: Invalida y revoca el token de refresco local.

### Datos y Control (`/api/v1/data`)
* `GET /sensors`: Consulta agregada simulada de sensores ambientales.
* `GET /map`: Consulta simulada de coordenadas del vehículo.
* `GET /missions`: Obtiene el listado procesado de misiones con hora local e identificador de secuencia.
* `POST /missions`: Registra una nueva misión y transmite las órdenes secuenciales (`PREPARE`, `SET_COORDS`, `START`) a AWS IoT Core.
* `PATCH /missions/{id}/finish`: Detiene la misión y envía comando de parada.
* `PATCH /missions/{id}/pause`: Pausa la navegación autónoma.
* `PATCH /missions/{id}/resume`: Reanuda la navegación.
* `POST /telemetry`: Ingesta directa de telemetría de sensores desde el USV.

### Reportes (`/api/v1/reports`)
* `POST /generate`: Compila y genera un PDF ejecutivo. Consulta InfluxDB, genera curvas Matplotlib en Base64, solicita análisis de calidad a Gemini AI, renderiza una plantilla Jinja2 y escribe el PDF usando WeasyPrint.
* `POST /generate_csv`: Consulta telemetría en InfluxDB y la descarga en formato CSV.

---

## 🚀 Inicio Rápido

### Requisitos
* Python 3.10 o superior
* Base de datos MySQL activa (puerto 3306)

### Configuración de dependencias locales
1. Crea un entorno virtual e instala dependencias:
   ```bash
   python3 -m venv my-venv
   source my-venv/bin/activate
   pip install -r requirements.txt
   ```
2. Asegúrate de tener configuradas las variables de entorno en tu archivo `.env` en la raíz del proyecto.
3. Ejecuta el servidor local de desarrollo:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
4. Abre [http://localhost:8000/docs](http://localhost:8000/docs) para probar los endpoints interactivamente.