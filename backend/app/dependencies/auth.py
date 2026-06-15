"""
Dependencias de Autenticación de FastAPI (AWS Cognito e Inyección de Usuario).

Contiene la lógica para recuperar y almacenar en caché las claves públicas (JWKS) de Cognito,
verificar la firma de tokens JWT usando firmas RS256, y recuperar o inicializar de forma
dinámica el registro del usuario en la base de datos relacional MySQL.
"""

from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User
from app.config import settings
import requests
from jose import jwt, JWTError


# Caché global para almacenar la respuesta JWKS de AWS Cognito y reducir latencia de red.
_jwks_cache = None
_jwks_cache_time = None

def get_jwks():
    """
    Recupera el conjunto de claves web de JSON (JWKS) públicas de AWS Cognito.
    
    Implementa almacenamiento en caché en memoria durante 1 hora (3600 segundos) para
    evitar peticiones de red repetitivas en cada solicitud HTTP protegida.
    
    Returns:
        dict: Claves públicas en formato JWKS.
        
    Raises:
        HTTPException (500): Si falla la conexión de red con el Identity Provider de AWS.
    """
    global _jwks_cache, _jwks_cache_time
    import time
    

    if _jwks_cache and _jwks_cache_time and (time.time() - _jwks_cache_time) < 3600:
        return _jwks_cache
    
    region = settings.COGNITO_REGION
    user_pool_id = settings.COGNITO_USER_POOL_ID
    url = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json"
    
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_cache_time = time.time()
        return _jwks_cache
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get Cognito keys: {str(e)}")

def verify_cognito_token(token: str) -> dict:
    """
    Decodifica y valida un token JWT provisto por AWS Cognito.
    
    Verifica:
    - La existencia del identificador de clave pública (kid).
    - La firma criptográfica usando el algoritmo RS256 de Cognito.
    - El emisor del token (iss) esperado.
    - El cliente de aplicación receptor del token (aud o client_id según sea IdToken o AccessToken).
    
    Args:
        token (str): Token JWT serializado.
        
    Returns:
        dict: El payload decodificado del token si la validación es correcta.
        
    Raises:
        HTTPException (401): Si alguna de las verificaciones de seguridad falla.
    """
    try:
        unverified = jwt.get_unverified_header(token)
        kid = unverified.get("kid")
        
        if not kid:
            raise HTTPException(status_code=401, detail="Token missing key id")

        jwks = get_jwks()
        public_jwk = None
        
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                public_jwk = key
                break
        
        if not public_jwk:
            raise HTTPException(status_code=401, detail="Unable to find key")
        

        decoded = jwt.decode(
            token,
            public_jwk,
            algorithms=["RS256"],
            options={
                "verify_signature": True,
                "verify_aud": False,
            },
        )

        expected_issuer = (
            f"https://cognito-idp.{settings.COGNITO_REGION}.amazonaws.com/"
            f"{settings.COGNITO_USER_POOL_ID}"
        )
        if decoded.get("iss") != expected_issuer:
            raise HTTPException(status_code=401, detail="Invalid token issuer")

        token_use = decoded.get("token_use")
        expected_client_id = settings.COGNITO_APP_CLIENT_ID

        if token_use == "id":
            if decoded.get("aud") != expected_client_id:
                raise HTTPException(status_code=401, detail="Invalid token audience")
        elif token_use == "access":
            if decoded.get("client_id") != expected_client_id:
                raise HTTPException(status_code=401, detail="Invalid token client")
        else:
            raise HTTPException(status_code=401, detail="Invalid token use")
        
        return decoded
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Dependencia de FastAPI para obtener y validar el usuario de la solicitud actual.
    
    Admite dos flujos de autenticación:
    1. Cabeceras inyectadas por API Gateway (`x-user-sub`, `x-user-email`, `x-user-role`).
    2. Verificación directa leyendo la cabecera `Authorization: Bearer <token>` y
       validando el token contra AWS Cognito (útil en desarrollo local).
       
    Si el usuario verificado por Cognito no se encuentra en la base de datos MySQL local,
    lo crea de manera dinámica (Just-In-Time provision) utilizando el correo o un fallback.
    
    Args:
        request (Request): Objeto de petición HTTP de FastAPI.
        db (Session): Sesión de la base de datos.
        
    Returns:
        dict: Un diccionario con el sub de Cognito, email, roles y el objeto de usuario `User` de la base de datos local.
        
    Raises:
        HTTPException (401): Si no se provee un token válido o cabeceras válidas.
    """
    sub = request.headers.get("x-user-sub")
    email = request.headers.get("x-user-email")
    roles = request.headers.get("x-user-role")
    
    if not sub:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="No autenticado")
        
        token = auth_header[7:]  
        decoded = verify_cognito_token(token)
        sub = decoded.get("sub")
        email = decoded.get("email")

        roles_str = decoded.get("cognito:groups", "")
        roles = roles_str.split(",") if isinstance(roles_str, str) else roles_str
    
    if not sub:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    user = db.query(User).filter(User.cognito_sub == sub).first()

    # Si el usuario ya existía antes del enlace con Cognito, asociarlo por correo.
    if not user and email:
        user = db.query(User).filter(User.email == email).first()
        if user and not user.cognito_sub:
            user.cognito_sub = sub
            db.add(user)
            db.commit()
            db.refresh(user)

    # Si no existe, crear el usuario dinámicamente en MySQL
    if not user and sub:
        username_fallback = email.split("@")[0] if email else f"cognito_{sub[:8]}"
        user = User(
            username=username_fallback,
            email=email,
            cognito_sub=sub,
            role="user",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    return {
        "sub": sub,
        "email": email,
        "roles": roles if roles else [],
        "db_user": user
    }