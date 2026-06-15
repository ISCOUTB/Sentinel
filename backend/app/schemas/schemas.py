"""
Esquemas de Validación Pydantic (Data Transfer Objects).

Define la estructura de datos para la serialización y validación de las solicitudes
y respuestas HTTP de los endpoints en FastAPI.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    """Esquema base con atributos comunes para el manejo de usuarios."""
    username: str = Field(..., min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    role: str = Field("user", pattern="^(admin|user)$")

class UserCreate(UserBase):
    """Esquema para la creación/registro de un usuario local."""
    password: str = Field(..., min_length=8)

class UserResponse(UserBase):
    """Esquema de respuesta detallada de información de usuario."""
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    """Esquema para la solicitud de inicio de sesión."""
    username: str
    password: str

class Token(BaseModel):
    """Esquema base de tokens JWT."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenResponse(Token):
    """Esquema de respuesta tras una autenticación exitosa."""
    pass

class TokenData(BaseModel):
    """Esquema del payload decodificado de un token JWT."""
    username: Optional[str] = None

class RefreshTokenRequest(BaseModel):
    """Esquema para solicitar el refresco o revocación de un token."""
    refresh_token: str

class SensorItem(BaseModel):
    """Esquema de una lectura individual de sensor (nombre, valor y unidad)."""
    name: str
    value: str
    unit: str

class MetricItem(BaseModel):
    """Esquema de una métrica auxiliar del sistema (presión, humedad, etc)."""
    label: str
    value: str
    unit: str

class LogItem(BaseModel):
    """Esquema de una entrada de log reciente del sistema."""
    text: str
    time: str

class SensorDataResponse(BaseModel):
    """Esquema de respuesta agregado para el panel de sensores y logs en tiempo real."""
    sensors: list[SensorItem]
    metrics: list[MetricItem]
    logs: list[LogItem]

class MapCoordinates(BaseModel):
    """Esquema que representa coordenadas GPS de latitud y longitud."""
    lat: float
    lng: float

class MapDataResponse(BaseModel):
    """Esquema de respuesta para el estado espacial y ubicación del USV."""
    location: str
    mode: str
    coordinates: MapCoordinates

class MissionCreate(BaseModel):
    """Esquema para la creación e inicio de una nueva misión."""
    name: str
    points: list[MapCoordinates] = []

class MissionResponse(BaseModel):
    """Esquema de respuesta para metadatos de misiones."""
    id: str
    name: str
    status: str
    start_time: datetime
    end_time: Optional[datetime] = None

class TelemetryData(BaseModel):
    """
    Esquema de datos para la ingesta de telemetría proveniente del USV o emulador.
    
    Contiene la ubicación espacial y parámetros físico-químicos del agua.
    """
    mission_id: str
    latitud: float
    longitud: float
    temperatura_agua_c: float
    ph_agua: float
    turbidez_ntu: float
    oxigeno_disuelto_ppm: Optional[float] = None
    bateria_porcentaje: Optional[float] = None