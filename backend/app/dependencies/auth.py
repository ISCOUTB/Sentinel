from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User



def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Obtiene el usuario autenticado desde headers
    enviados por API Gateway (JWT ya validado).
    """

    sub = request.headers.get("x-user-sub")
    email = request.headers.get("x-user-email")
    roles = request.headers.get("x-user-role")

    if not sub:
        raise HTTPException(status_code=401, detail="No autenticado")

    # Buscar usuario en base de datos usando cognito_sub
    user = db.query(User).filter(User.cognito_sub == sub).first()

    if not user:
        raise HTTPException(status_code=403, detail="Usuario no registrado")

    return {
        "sub": sub,
        "email": email,
        "roles": roles.split(",") if roles else [],
        "db_user": user
    }