# Backend API Documentation

Este backend está construido con FastAPI y proporciona autenticación JWT completa para el sistema USV HMI.

## Estructura del Proyecto

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Punto de entrada de la aplicación
│   ├── config.py            # Configuraciones de la aplicación
│   ├── database.py          # Configuración de la base de datos
│   ├── models/              # Modelos SQLAlchemy
│   │   ├── __init__.py
│   │   └── models.py
│   ├── schemas/             # Esquemas Pydantic
│   │   ├── __init__.py
│   │   └── schemas.py
│   ├── routers/             # Endpoints de la API
│   │   ├── __init__.py
│   │   └── auth.py
│   ├── core/                # Lógica de negocio
│   │   ├── __init__.py
│   │   ├── security.py      # Funciones de seguridad (JWT, hash)
│   │   └── auth.py          # Lógica de autenticación
│   └── dependencies/        # Dependencias FastAPI
│       ├── __init__.py
│       └── auth.py
├── test_client.py           # Cliente de prueba interactivo
├── Dockerfile
├── requirements.txt
└── README.md
```

## Endpoints de Autenticación

### Registro de Usuario
- **URL**: `/api/v1/auth/register`
- **Método**: `POST`
- **Descripción**: Registra un nuevo usuario en el sistema.
- **Cuerpo de la solicitud** (JSON):
  ```json
  {
    "username": "johndoe",
    "email": "john@example.com",
    "password": "securepassword123",
    "role": "user"
  }
  ```
- **Respuesta exitosa** (200):
  ```json
  {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user",
    "is_active": true,
    "created_at": "2023-12-27T15:30:00",
    "updated_at": "2023-12-27T15:30:00"
  }
  ```
- **Errores posibles**:
  - 400: Username already registered / Email already registered

### Inicio de Sesión
- **URL**: `/api/v1/auth/login`
- **Método**: `POST`
- **Descripción**: Autentica al usuario y retorna tokens de acceso y refresco.
- **Cuerpo de la solicitud** (JSON):
  ```json
  {
    "username": "username",  // o email
    "password": "password"
  }
  ```
- **Respuesta exitosa** (200):
  ```json
  {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "token_type": "bearer"
  }
  ```
- **Errores posibles**:
  - 401: Incorrect username or password

### Refrescar Token
- **URL**: `/api/v1/auth/refresh`
- **Método**: `POST`
- **Descripción**: Genera un nuevo token de acceso usando el token de refresco.
- **Headers**:
  - `Authorization: Bearer <refresh_token>`
- **Respuesta exitosa** (200):
  ```json
  {
    "access_token": "eyJ...",
    "token_type": "bearer"
  }
  ```
- **Errores posibles**:
  - 401: Invalid refresh token

### Obtener Información del Usuario Actual
- **URL**: `/api/v1/auth/me`
- **Método**: `GET`
- **Descripción**: Obtiene la información del usuario autenticado.
- **Headers**:
  - `Authorization: Bearer <access_token>`
- **Respuesta exitosa** (200):
  ```json
  {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user",
    "is_active": true,
    "created_at": "2023-12-27T15:30:00",
    "updated_at": "2023-12-27T15:30:00"
  }
  ```
- **Errores posibles**:
  - 401: Invalid token
  - 404: User not found

### Logout
- **URL**: `/api/v1/auth/logout`
- **Método**: `POST`
- **Descripción**: Invalida el refresh token para cerrar sesión.
- **Headers**:
  - `Authorization: Bearer <refresh_token>`
- **Respuesta exitosa** (200):
  ```json
  {
    "message": "Logged out successfully"
  }
  ```
- **Errores posibles**:
  - 400: Only refresh tokens can be used for logout
  - 401: Invalid token

## Tokens
- **Access Token**: Válido por 6 horas. Usar en el header `Authorization: Bearer <access_token>` para acceder a rutas protegidas.
- **Refresh Token**: Válido por 7 días. Usar para obtener nuevos access tokens sin volver a loguear.

## Base de Datos

### Inicialización
El archivo `database/init.sql` se ejecuta automáticamente al iniciar el contenedor backend. Este script:

- **En desarrollo**: Elimina y recrea las tablas para asegurar un esquema limpio
- **En producción**: ⚠️ **ADVERTENCIA** - Actualmente elimina datos existentes. Para producción, cambiar `DROP TABLE IF EXISTS` por `CREATE TABLE IF NOT EXISTS` y usar migraciones (ej. Alembic) para preservar datos.

### Comportamiento Actual
- Las tablas `users` y `refresh_tokens` se eliminan y recrean en cada inicio
- Se insertan datos de prueba automáticamente
- **Para mantener datos entre reinicios**: Modificar `init.sql` para usar `ALTER TABLE` en lugar de `DROP TABLE`

### Migraciones Futuras
Se recomienda implementar Alembic para migraciones de esquema en producción.

## Configuración

### Variables de Entorno (.env)

| Variable | Descripción | Valor por defecto |
|----------|-------------|------------------|
| `SECRET_KEY` | Clave secreta para JWT | `your-secret-key-here` |
| `DATABASE_URL` | URL de conexión a la base de datos | `mysql+pymysql://usv_user:usv_password@db:3306/usv_hmi` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiración del token de acceso (minutos) | `360` (6 horas) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Expiración del token de refresh (días) | `7` |
| `PROJECT_NAME` | Nombre del proyecto | `USV HMI Backend` |
| `API_V1_STR` | Prefijo de la API v1 | `/api/v1` |
| `BACKEND_CORS_ORIGINS` | Orígenes permitidos para CORS | `["http://localhost:3000", "http://localhost:5173"]` |

- **Base de datos**: MySQL (configurada en docker-compose.yml)
- **Puerto**: 8000

## Inicio Rápido

### Ejecutar el servidor
```bash
# Instalar dependencias
pip install -r requirements.txt

# Ejecutar el servidor
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Probar los endpoints
Usa el cliente de prueba interactivo incluido:

```bash
python test_client.py
```

O accede a la documentación interactiva en: `http://localhost:8000/docs`

### Usar con Docker
```bash
# Desde el directorio raíz del proyecto
docker-compose -f infra/docker/docker-compose.yml up --build
```