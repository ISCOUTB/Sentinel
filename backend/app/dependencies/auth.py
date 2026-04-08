from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User
from app.config import settings
import requests
from jose import jwt, JWTError


_jwks_cache = None
_jwks_cache_time = None

def get_jwks():
    """Get Cognito public keys for JWT verification"""
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
    """Verify Cognito JWT token"""
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

    # If the user existed before Cognito linkage, associate by email when available.
    if not user and email:
        user = db.query(User).filter(User.email == email).first()
        if user and not user.cognito_sub:
            user.cognito_sub = sub
            db.add(user)
            db.commit()
            db.refresh(user)

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