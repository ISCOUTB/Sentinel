from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User
from app.config import settings
import json
import requests
from functools import lru_cache

# Cognito JWKS cache (token verification keys)
_jwks_cache = None
_jwks_cache_time = None

def get_jwks():
    """Get Cognito public keys for JWT verification"""
    global _jwks_cache, _jwks_cache_time
    import time
    
    # Cache for 1 hour
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
    """Verify Cognito JWT token"""
    import jwt
    from jwt.exceptions import InvalidTokenError
    
    try:
        # Get key ID from token header
        unverified = jwt.get_unverified_header(token)
        kid = unverified.get("kid")
        
        if not kid:
            raise HTTPException(status_code=401, detail="Token missing key id")
        
        # Get public key from Cognito
        jwks = get_jwks()
        rsa_key = None
        
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                rsa_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
                break
        
        if not rsa_key:
            raise HTTPException(status_code=401, detail="Unable to find key")
        
        # Verify token
        decoded = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=settings.COGNITO_APP_CLIENT_ID,
            options={"verify_signature": True}
        )
        
        return decoded
    except InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Obtiene el usuario autenticado desde JWT en Authorization header.
    Valida el token de Cognito directamente (sin depender de API Gateway).
    También soporta headers de API Gateway como fallback.
    """
    
    # Intenta obtener desde headers de API Gateway primero (si viene del Gateway)
    sub = request.headers.get("x-user-sub")
    email = request.headers.get("x-user-email")
    roles = request.headers.get("x-user-role")
    
    # Si no hay headers de Gateway, valida JWT de Cognito directamente
    if not sub:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="No autenticado")
        
        token = auth_header[7:]  # Remove "Bearer "
        decoded = verify_cognito_token(token)
        
        # Extraer datos del token
        sub = decoded.get("sub")
        email = decoded.get("email")
        # Roles de Cognito si existen en el token
        roles_str = decoded.get("cognito:groups", "")
        roles = roles_str.split(",") if isinstance(roles_str, str) else roles_str
    
    if not sub:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    # Buscar usuario en base de datos usando cognito_sub
    user = db.query(User).filter(User.cognito_sub == sub).first()
    
    # Si no existe en BD pero viene de Cognito, crear entry automático
    if not user and sub:
        user = User(
            username=email.split("@")[0] if email else f"cognito_{sub[:8]}",
            email=email,
            cognito_sub=sub,
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