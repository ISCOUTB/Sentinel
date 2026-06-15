"""
Servicios de Seguridad de Core (Contraseñas y JWTs locales).

Proporciona herramientas para el hashing y verificación de contraseñas, la firma y decodificación
de tokens JWT locales, y dependencias de FastAPI para la autorización basada en roles.
"""

from datetime import datetime, timedelta
from typing import Any, Union, Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from app.config import settings
from app.dependencies.auth import get_current_user

# Configuración de hashing seguro usando Bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class Security:
    """
    Clase de utilidades para el manejo de seguridad local.
    
    Proporciona operaciones para encriptación de contraseñas y creación/validación de
    tokens JWT locales.
    
    Nota: La validación de tokens provistos por AWS Cognito se realiza en el módulo de dependencies
    o mediante AWS API Gateway.
    """

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """
        Verifica si una contraseña en texto plano coincide con su hash bcrypt.
        
        Args:
            plain_password (str): Contraseña enviada por el usuario.
            hashed_password (str): Hash bcrypt recuperado de la base de datos.
            
        Returns:
            bool: True si la contraseña es válida, False en caso contrario.
        """
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def get_password_hash(password: str) -> str:
        """
        Genera el hash bcrypt de una contraseña en texto plano.
        
        Args:
            password (str): Contraseña en texto plano a encriptar.
            
        Returns:
            str: Hash Bcrypt resultante de 60 caracteres.
        """
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
        Crea un token JWT local de acceso (Access Token) firmado digitalmente.
        
        Args:
            subject (Union[str, Any]): Identificador del usuario (nombre de usuario o email).
            expires_delta (Optional[timedelta]): Tiempo personalizado de expiración.
            
        Returns:
            str: Token JWT serializado.
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
        Crea un token JWT local de refresco (Refresh Token) firmado digitalmente.
        
        Args:
            subject (Union[str, Any]): Identificador del usuario (nombre de usuario o email).
            expires_delta (Optional[timedelta]): Tiempo personalizado de expiración.
            
        Returns:
            str: Token JWT de refresco serializado.
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
        Decodifica y valida un token JWT local firmado.
        
        Args:
            token (str): Token JWT serializado.
            
        Returns:
            Optional[dict]: Payload decodificado si es válido, None si la firma expiró o no es válida.
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

    @staticmethod
    def verify_refresh_token(token: str) -> Optional[str]:
        """
        Verifica un refresh token local y retorna el subject (username) asociado.
        
        Args:
            token (str): Token JWT de refresco.
            
        Returns:
            Optional[str]: Identificador del usuario si es válido, None en caso contrario.
        """
        payload = Security.decode_token(token)
        if not payload or payload.get("type") != "refresh":
            return None
        return payload.get("sub")


# =========================
# AUTORIZACIÓN POR ROLES
# =========================

def require_admin(user=Depends(get_current_user)):
    """
    Restringe el acceso exclusivamente a usuarios que tengan el rol 'admin'.
    
    Diseñado como dependencia de FastAPI.
    
    Args:
        user: Objeto de usuario retornado por `get_current_user`.
        
    Returns:
        dict: El payload del usuario autenticado si posee el rol requerido.
        
    Raises:
        HTTPException (403): Si el usuario no cuenta con el grupo/rol 'admin'.
    """
    if "admin" not in user["roles"]:
        raise HTTPException(
            status_code=403,
            detail="Requiere rol admin"
        )
    return user


def require_user(user=Depends(get_current_user)):
    """
    Restringe el acceso a usuarios que tengan el rol 'user' o 'admin'.
    
    Diseñado como dependencia de FastAPI.
    
    Args:
        user: Objeto de usuario retornado por `get_current_user`.
        
    Returns:
        dict: El payload del usuario autenticado si posee al menos uno de los roles.
        
    Raises:
        HTTPException (403): Si el usuario no posee los roles correspondientes.
    """
    if not any(role in ["admin", "user"] for role in user["roles"]):
        raise HTTPException(
            status_code=403,
            detail="Requiere rol user o admin"
        )
    return user