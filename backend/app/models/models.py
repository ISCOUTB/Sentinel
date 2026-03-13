from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum

Base = declarative_base()

class SessionState(str, enum.Enum):
    INACTIVE = "Inactive"
    PREPARATION = "Preparation"
    ACTIVE = "Active"
    MISSION = "Mission"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    cognito_sub = Column(String(100), unique=True, index=True, nullable=False)
    username = Column(String(50), nullable=True) # Optional now as cognito_sub is primary
    email = Column(String(100), unique=True, index=True, nullable=False)
    role = Column(String(20), nullable=False, default="user")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sessions = relationship("Session", back_populates="user")
    websocket_connections = relationship("WebSocketConnection", back_populates="user")

class USV(Base):
    __tablename__ = "usvs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    sessions = relationship("Session", back_populates="usv")

class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    usv_id = Column(Integer, ForeignKey("usvs.id"), nullable=False)
    state = Column(Enum(SessionState), default=SessionState.PREPARATION, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="sessions")
    usv = relationship("USV", back_populates="sessions")
    websocket_connections = relationship("WebSocketConnection", back_populates="session")

class WebSocketConnection(Base):
    __tablename__ = "websocket_connections"

    connection_id = Column(String(100), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="websocket_connections")
    session = relationship("Session", back_populates="websocket_connections")