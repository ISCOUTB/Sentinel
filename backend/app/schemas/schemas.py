from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    cognito_sub: str
    email: EmailStr
    username: Optional[str] = None
    role: str = Field("user", pattern="^(admin|user)$")

class UserCreate(UserBase):
    pass

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class USVBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=50)
    description: Optional[str] = None

class USVCreate(USVBase):
    pass

class USVResponse(USVBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class SessionBase(BaseModel):
    usv_id: int
    state: str

class SessionResponse(SessionBase):
    id: int
    user_id: int
    started_at: datetime
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True

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