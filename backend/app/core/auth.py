from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.models import User, RefreshToken
from app.core.security import Security
from app.schemas.schemas import UserCreate, TokenResponse
from app.config import settings

def authenticate_user(db: Session, username: str, password: str) -> Optional[TokenResponse]:
    """Autenticar usuario y retornar tokens."""
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
    """Registrar un nuevo usuario."""
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
    """Refrescar token de acceso usando refresh token."""
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
    """Revocar refresh token (logout)."""
    db_refresh_token = db.query(RefreshToken).filter(
        RefreshToken.token == refresh_token
    ).first()
    if db_refresh_token:
        db_refresh_token.is_revoked = True
        db.commit()

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()