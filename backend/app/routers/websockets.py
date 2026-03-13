from fastapi import APIRouter, Request, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import WebSocketConnection, User
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websockets"])

@router.post("")
async def websocket_handler(request: Request, db: Session = Depends(get_db)):
    """
    Maneja las rutas de AWS API Gateway WebSockets ($connect, $disconnect, message).
    """
    body = await request.json() if request.method == "POST" else {}
    
    # API Gateway typically passes context in headers or integrated body
    # Depending on setup, connectionId comes in headers or body. Let's assume headers for standard HTTP Proxy integration.
    connection_id = request.headers.get("x-apigateway-connection-id")
    event_type = request.headers.get("x-apigateway-event-type") # $connect, $disconnect, message
    cognito_sub = request.headers.get("x-user-sub")

    logger.info(f"WS Event: {event_type}, Connection ID: {connection_id}, User Sub: {cognito_sub}")

    if not connection_id:
        raise HTTPException(status_code=400, detail="Missing connection_id")

    if event_type == "CONNECT":
        if not cognito_sub:
            # Note: with Cognito Authorizer on $connect, this should be present
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        user = db.query(User).filter(User.cognito_sub == cognito_sub).first()
        if not user:
             logger.warning(f"User {cognito_sub} connected but not in DB, creating basic record")
             # Auto-register if not present depending on requirements
             user = User(cognito_sub=cognito_sub, email=f"{cognito_sub}@placeholder.com")
             db.add(user)
             db.commit()
             db.refresh(user)

        # Store connection
        ws_conn = WebSocketConnection(connection_id=connection_id, user_id=user.id)
        db.add(ws_conn)
        db.commit()
        return {"status": "connected"}

    elif event_type == "DISCONNECT":
        # Remove connection
        ws_conn = db.query(WebSocketConnection).filter(WebSocketConnection.connection_id == connection_id).first()
        if ws_conn:
            db.delete(ws_conn)
            db.commit()
        return {"status": "disconnected"}

    elif event_type == "MESSAGE":
        # Handle incoming messages from WS clients if any
        # For now, just log it. Usually HMI sends commands here.
        logger.info(f"Received WS message from {connection_id}: {body}")
        
        # Example: handle 'command' type
        # if body.get("action") == "send_joystick":
        #    ... send to IoT Core topic ...
        
        return {"status": "message received"}

    else:
         logger.warning(f"Unknown WS event type: {event_type}")
         return {"status": "ok"}
