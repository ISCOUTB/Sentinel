from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    role: str = Field("user", pattern="^(admin|user)$")

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenResponse(Token):
    pass

class TokenData(BaseModel):
    username: Optional[str] = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class SensorItem(BaseModel):
    name: str
    value: str
    unit: str

class MetricItem(BaseModel):
    label: str
    value: str
    unit: str

class LogItem(BaseModel):
    text: str
    time: str

class SensorDataResponse(BaseModel):
    sensors: list[SensorItem]
    metrics: list[MetricItem]
    logs: list[LogItem]

class MapCoordinates(BaseModel):
    lat: float
    lng: float

class MapDataResponse(BaseModel):
    location: str
    mode: str
    coordinates: MapCoordinates

class MissionCreate(BaseModel):
    name: str
    points: list[MapCoordinates] = []

class MissionResponse(BaseModel):
    id: str
    name: str
    status: str
    start_time: datetime
    end_time: Optional[datetime] = None

class TelemetryData(BaseModel):
    mission_id: str
    latitud: float
    longitud: float
    temperatura_agua_c: float
    ph_agua: float
    turbidez_ntu: float
    oxigeno_disuelto_ppm: Optional[float] = None
    bateria_porcentaje: Optional[float] = None