"""
Enrutador de Endpoints de Autenticación de la API.

Expone rutas para operaciones básicas de usuarios locales, incluyendo
registro, inicio de sesión local, refresco de access token y revocación de sesión.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.schemas import UserCreate, UserLogin, UserResponse, TokenResponse, RefreshTokenRequest
from app.core.auth import register_user, authenticate_user, refresh_access_token, logout_user
from app.dependencies.auth import get_current_user
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    """
    Registra un nuevo usuario en la base de datos local.
    
    Valida la disponibilidad única del nombre de usuario y correo, encripta
    la contraseña y retorna el perfil del usuario creado.
    """
    return register_user(db, user)

@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Autentica credenciales y emite tokens locales (Access y Refresh).
    
    Apto para esquemas locales de desarrollo sin Cognito.
    """
    return authenticate_user(db, credentials.username, credentials.password)

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Refresca el token de acceso a partir de un token de refresco local válido.
    
    Verifica firma, expiración y estado de revocación del refresh token.
    """
    return refresh_access_token(db, request.refresh_token)

@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """
    Recupera el perfil del usuario autenticado en la solicitud actual.
    
    Extrae la información obtenida a través de la inyección de dependencia get_current_user.
    """
    return current_user["db_user"]

@router.post("/logout")
def logout(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Cierra sesión invalidando (revocando) el token de refresco en la base de datos.
    """
    logout_user(db, request.refresh_token)
    return {"message": "Logged out successfully"}