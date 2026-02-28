from datetime import datetime, timedelta
from typing import Any, Union, Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
import requests
from functools import lru_cache

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class Security:
    @staticmethod
    def create_access_token(
        subject: Union[str, Any], expires_delta: timedelta = None
    ) -> str:
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )
        to_encode = {"exp": expire, "sub": str(subject)}
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt

    @staticmethod
    def create_refresh_token(
        subject: Union[str, Any], expires_delta: timedelta = None
    ) -> str:
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                days=settings.REFRESH_TOKEN_EXPIRE_DAYS
            )
        to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def verify_token(token: str) -> Union[str, None]:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            username: str = payload.get("sub")
        except (jwt.ExpiredSignatureError, JWTError):
            return None
        return username

    @staticmethod
    def verify_refresh_token(token: str) -> Union[str, None]:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            token_type: str = payload.get("type")
            if token_type != "refresh":
                return None
            username: str = payload.get("sub")
        except (jwt.ExpiredSignatureError, JWTError):
            return None
        return username

    @staticmethod
    def decode_token(token: str) -> Union[dict, None]:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            return payload
        except (jwt.ExpiredSignatureError, JWTError):
            return None

    @staticmethod
    def decode_refresh_token(token: str) -> Union[dict, None]:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            token_type: str = payload.get("type")
            if token_type != "refresh":
                return None
            return payload
        except (jwt.ExpiredSignatureError, JWTError):
            return None

    # === AWS Cognito JWT Validation ===
    
    @staticmethod
    @lru_cache(maxsize=1)
    def get_cognito_jwks():
        """
        Obtiene las JWKS (JSON Web Key Set) de Cognito para validar tokens.
        Se cachea para evitar múltiples requests.
        """
        if not settings.COGNITO_USER_POOL_ID or not settings.COGNITO_REGION:
            return None
            
        jwks_url = f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}/.well-known/jwks.json"
        try:
            response = requests.get(jwks_url, timeout=5)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error obteniendo JWKS de Cognito: {e}")
            return None

    @staticmethod
    def verify_cognito_token(token: str) -> Union[dict, None]:
        """
        Valida un token JWT de AWS Cognito.
        Retorna el payload del token si es válido, None si es inválido.
        """
        if not settings.COGNITO_USER_POOL_ID:
            print("DEBUG: COGNITO_USER_POOL_ID no configurado")
            return None

        try:
            # Obtener el header del token sin verificar
            unverified_header = jwt.get_unverified_header(token)
            print(f"DEBUG: Token header: {unverified_header}")
            
            # Obtener las JWKS de Cognito
            jwks = Security.get_cognito_jwks()
            if not jwks:
                print("DEBUG: No se pudieron obtener las JWKS de Cognito")
                return None
            
            print(f"DEBUG: JWKS obtenidas correctamente")
            
            # Buscar la clave pública correspondiente
            rsa_key = {}
            for key in jwks.get("keys", []):
                if key["kid"] == unverified_header["kid"]:
                    rsa_key = {
                        "kty": key["kty"],
                        "kid": key["kid"],
                        "use": key["use"],
                        "n": key["n"],
                        "e": key["e"]
                    }
                    break
            
            if not rsa_key:
                print(f"DEBUG: No se encontró la clave RSA para kid: {unverified_header.get('kid')}")
                return None
            
            print("DEBUG: Clave RSA encontrada")
            
            # Validar el token
            issuer = f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}"
            print(f"DEBUG: Validando token con audience: {settings.COGNITO_APP_CLIENT_ID}, issuer: {issuer}")
            
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                audience=settings.COGNITO_APP_CLIENT_ID,
                issuer=issuer,
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_aud": True,
                    "verify_iss": True
                }
            )
            
            print(f"DEBUG: Token validado exitosamente. Payload: {payload}")
            return payload
            
        except JWTError as e:
            print(f"ERROR: Error validando token de Cognito (JWTError): {e}")
            return None
        except Exception as e:
            print(f"ERROR: Error inesperado validando token: {e}")
            import traceback
            traceback.print_exc()
            return None

    @staticmethod
    def verify_token_hybrid(token: str) -> Union[dict, None]:
        """
        Intenta validar el token primero con Cognito, luego con el backend local.
        Retorna el payload si es válido, None si no.
        """
        # Primero intentar con Cognito si está configurado
        if settings.COGNITO_USER_POOL_ID:
            cognito_payload = Security.verify_cognito_token(token)
            if cognito_payload:
                return cognito_payload
        
        # Si falla o no está configurado, intentar con el backend local
        local_payload = Security.decode_token(token)
        return local_payload