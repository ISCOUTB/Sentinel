"""
Modelos Declarativos de SQLAlchemy para la Base de Datos Relacional (MySQL).

Representa el esquema relacional del sistema Sentinel, incluyendo usuarios locales,
refresh tokens (para la expiración segura de JWTs locales), misiones y las lecturas de sensores
ingestadas en tiempo real.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    """
    Representa a un usuario registrado en el sistema.
    
    Admite tanto usuarios nativos (con contraseña encriptada localmente) como
    usuarios enlazados con AWS Cognito (`cognito_sub`).
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    cognito_sub = Column(String(100), unique=True, index=True, nullable=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=True)
    role = Column(String(20), nullable=False, default="user")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    refresh_tokens = relationship("RefreshToken", back_populates="user")

class RefreshToken(Base):
    """
    Almacena tokens de refresco (Refresh Tokens) generados localmente.
    
    Usado para invalidar/revocar sesiones activas durante el logout.
    """
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(500), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="refresh_tokens")

class Mission(Base):
    """
    Representa una misión de navegación y muestreo del USV (Vehículo de Superficie No Tripulado).
    
    Almacena metadatos como el nombre, estado global de la trayectoria y marcas de tiempo.
    """
    __tablename__ = "missions"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=True)
    status = Column(String(50), default="EN_PROGRESO")
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)

    sensor_data = relationship("SensorData", back_populates="mission", cascade="all, delete-orphan")

class SensorData(Base):
    """
    Almacena lecturas ambientales del USV persistidas localmente en la base de datos relacional.
    
    Contiene mediciones de temperatura, pH, turbidez, oxígeno disuelto y estado de batería.
    Nota: Los datos detallados de series temporales de alta resolución también se envían a InfluxDB.
    """
    __tablename__ = "sensor_data"

    id = Column(Integer, primary_key=True, index=True)
    mission_id = Column(String(50), ForeignKey("missions.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    temperature = Column(Float, nullable=True)
    ph = Column(Float, nullable=True)
    turbidity = Column(Float, nullable=True)
    dissolved_oxygen = Column(Float, nullable=True)
    battery_level = Column(Float, nullable=True)

    mission = relationship("Mission", back_populates="sensor_data")