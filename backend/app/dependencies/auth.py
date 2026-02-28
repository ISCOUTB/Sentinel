from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from ..database import get_db
from ..core.security import Security
from ..models.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """
    Valida el token y retorna el usuario actual.
    Soporta tokens de Cognito y tokens del backend local.
    """
    print(f"DEBUG: Recibido token (primeros 50 chars): {token[:50]}...")
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Intentar validar el token (Cognito o local)
    payload = Security.verify_token_hybrid(token)
    
    if payload is None:
        print("ERROR: Token inválido - verify_token_hybrid retornó None")
        raise credentials_exception
    
    print(f"DEBUG: Payload decodificado: {payload}")
    
    # Extraer username del payload
    # Cognito usa 'cognito:username' o 'username', el backend local usa 'sub'
    username = payload.get("cognito:username") or payload.get("username") or payload.get("sub")
    
    if username is None:
        print("ERROR: No se encontró username en el payload")
        raise credentials_exception
    
    print(f"DEBUG: Username extraído: {username}")
    
    # Buscar usuario en la base de datos
    user = db.query(User).filter(User.username == username).first()
    
    # Si el usuario no existe en la BD local pero el token es válido de Cognito,
    # crear el usuario automáticamente (auto-provisioning)
    if user is None:
        print(f"DEBUG: Usuario {username} no existe en BD, creando automáticamente...")
        # Crear usuario automáticamente desde Cognito
        email = payload.get("email", f"{username}@cognito.local")
        user = User(
            username=username,
            email=email,
            hashed_password="",  # Usuario de Cognito, no tiene password local
            role="user",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"DEBUG: Usuario {username} creado exitosamente en BD")
    else:
        print(f"DEBUG: Usuario {username} encontrado en BD")
    
    return user