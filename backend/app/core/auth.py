"""
Servicios de Autenticación de Core (Autenticación Local).

Maneja los procesos de registro, autenticación, refresco de sesión y cierre de sesión
contra la base de datos relacional para esquemas de autenticación no basados en Cognito.
"""

from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.models import User, RefreshToken
from app.core.security import Security
from app.schemas.schemas import UserCreate, TokenResponse
from app.config import settings

def authenticate_user(db: Session, username: str, password: str) -> Optional[TokenResponse]:
    """
    Autentica un usuario local y retorna un par de tokens (Access y Refresh).
    
    Busca al usuario por nombre de usuario o dirección de correo electrónico,
    verifica su contraseña y el estado activo. Si es exitoso, persiste un
    nuevo token de refresco en la base de datos.
    
    Args:
        db (Session): Sesión de base de datos activa.
        username (str): Nombre de usuario o correo electrónico.
        password (str): Contraseña en texto plano.
        
    Returns:
        Optional[TokenResponse]: Objeto con access_token y refresh_token.
        
    Raises:
        HTTPException (401): Si las credenciales son incorrectas.
        HTTPException (400): Si la cuenta de usuario está inactiva.
    """
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = db.query(User).filter(User.email == username).first()
    if not user or not Security.verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    # Crear tokens
    access_token = Security.create_access_token(subject=user.username)
    refresh_token = Security.create_refresh_token(subject=user.username)

    # Guardar refresh token en BD
    db_refresh_token = RefreshToken(
        token=refresh_token,
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(db_refresh_token)
    db.commit()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)

def register_user(db: Session, user: UserCreate) -> User:
    """
    Registra un nuevo usuario local en el sistema.
    
    Valida la disponibilidad única del nombre de usuario y correo, encripta
    la contraseña usando bcrypt y almacena el registro en MySQL.
    
    Args:
        db (Session): Sesión de base de datos activa.
        user (UserCreate): Datos del nuevo usuario.
        
    Returns:
        User: El registro de usuario recién creado e insertado.
        
    Raises:
        HTTPException (400): Si el nombre de usuario o correo electrónico ya están registrados.
    """
    # Verificar si el usuario ya existe
    db_user = db.query(User).filter(
        (User.username == user.username) | (User.email == user.email)
    ).first()
    if db_user:
        if db_user.username == user.username:
            raise HTTPException(status_code=400, detail="Username already registered")
        else:
            raise HTTPException(status_code=400, detail="Email already registered")

    # Crear usuario
    hashed_password = Security.get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        role=user.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def refresh_access_token(db: Session, refresh_token: str) -> TokenResponse:
    """
    Genera un nuevo token de acceso a partir de un token de refresco local.
    
    Verifica la validez de firma, expiración y estado de revocación en BD.
    
    Args:
        db (Session): Sesión de base de datos activa.
        refresh_token (str): Token de refresco local.
        
    Returns:
        TokenResponse: Objeto conteniendo el nuevo access_token.
        
    Raises:
        HTTPException (401): Si el refresh token no es válido, ha expirado o fue revocado.
    """
    # Verificar refresh token
    username = Security.verify_refresh_token(refresh_token)
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    # Verificar que el refresh token existe en BD y no está revocado
    db_refresh_token = db.query(RefreshToken).filter(
        RefreshToken.token == refresh_token,
        RefreshToken.is_revoked == False
    ).first()
    if not db_refresh_token or db_refresh_token.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired or revoked"
        )

    # Crear nuevo access token
    access_token = Security.create_access_token(subject=username)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)

def logout_user(db: Session, refresh_token: str):
    """
    Invalida (revoca) una sesión activa basada en refresh token.
    
    Marca `is_revoked = True` en la base de datos MySQL para impedir futuros refrescos.
    
    Args:
        db (Session): Sesión de base de datos activa.
        refresh_token (str): Token a revocar.
    """
    db_refresh_token = db.query(RefreshToken).filter(
        RefreshToken.token == refresh_token
    ).first()
    if db_refresh_token:
        db_refresh_token.is_revoked = True
        db.commit()

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Obtiene un registro de usuario por su nombre de usuario."""
    return db.query(User).filter(User.username == username).first()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Obtiene un registro de usuario por su correo electrónico."""
    return db.query(User).filter(User.email == email).first()