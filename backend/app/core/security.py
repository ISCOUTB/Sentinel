from datetime import datetime, timedelta
from typing import Any, Union, Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from app.config import settings
from app.dependencies.auth import get_current_user

# Configuración de hashing seguro
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class Security:
    """
    Manejo de seguridad local:
    - Hash y verificación de contraseñas
    - Creación de tokens JWT locales (opcional)
    
    NOTA:
    La validación de tokens Cognito NO se hace aquí.
    La hace API Gateway.
    """

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)

    # =========================
    # TOKENS LOCALES (OPCIONAL)
    # =========================

    @staticmethod
    def create_access_token(
        subject: Union[str, Any],
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Crea un JWT local.
        SOLO necesario si mantienes login propio del backend.
        """
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )

        to_encode = {
            "sub": str(subject),
            "exp": expire,
            "type": "access"
        }

        encoded_jwt = jwt.encode(
            to_encode,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )

        return encoded_jwt

    @staticmethod
    def create_refresh_token(
        subject: Union[str, Any],
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Crea un refresh token local.
        """
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                days=settings.REFRESH_TOKEN_EXPIRE_DAYS
            )

        to_encode = {
            "sub": str(subject),
            "exp": expire,
            "type": "refresh"
        }

        encoded_jwt = jwt.encode(
            to_encode,
            settings.SECRET_KEY,
            algorithm=settings.ALGORITHM
        )

        return encoded_jwt

    @staticmethod
    def decode_token(token: str) -> Optional[dict]:
        """
        Decodifica token local.
        No se usa para Cognito.
        """
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
            )
            return payload
        except (JWTError, Exception):
            return None


# =========================
# AUTORIZACIÓN POR ROLES
# =========================

def require_admin(user=Depends(get_current_user)):
    """
    Requiere que el usuario tenga rol 'admin'.
    Levanta excepción 403 si no tiene el rol.
    """
    if "admin" not in user["roles"]:
        raise HTTPException(
            status_code=403,
            detail="Requiere rol admin"
        )
    return user


def require_user(user=Depends(get_current_user)):
    """
    Requiere que el usuario tenga rol 'user' o 'admin'.
    Levanta excepción 403 si no tiene alguno de estos roles.
    """
    if not any(role in ["admin", "user"] for role in user["roles"]):
        raise HTTPException(
            status_code=403,
            detail="Requiere rol user o admin"
        )
    return user