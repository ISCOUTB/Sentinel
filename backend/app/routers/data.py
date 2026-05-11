from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import random
import datetime
from app.schemas.schemas import SensorDataResponse, MapDataResponse, SensorItem, MetricItem, LogItem, MapCoordinates, MissionCreate, MissionResponse, TelemetryData
from app.dependencies.auth import get_current_user
from app.core.security import require_admin, require_user
from app.database import get_db
from sqlalchemy.orm import Session
from app.models.models import Mission, SensorData
import uuid

router = APIRouter(prefix="/data", tags=["data"])

@router.get("/sensors", response_model=SensorDataResponse)
def get_sensor_data(current_user = Depends(get_current_user)):
    """
    Obtener datos de sensores en tiempo real.
    Actualmente simula datos, conectar a hardware real en el futuro.
    """
    return SensorDataResponse(
        sensors=[
            SensorItem(name='Temperatura', value=f"{22 + random.random() * 6:.1f}", unit='°C'),
            SensorItem(name='Oxígeno disuelto', value=f"{5.5 + random.random() * 2.5:.2f}", unit='mg/L'),
            SensorItem(name='Turbidez', value=f"{2 + random.random() * 18:.1f}", unit='NTU'),
            SensorItem(name='pH', value=f"{6.8 + random.random() * 1.1:.2f}", unit=''),
        ],
        metrics=[
            MetricItem(label='Parameter', value=f"{900 + random.random() * 50:.1f}", unit='hPa'),
            MetricItem(label='Air pressure', value=f"{900 + random.random() * 50:.1f}", unit='hPa'),
            MetricItem(label='Air humidity', value=f"{70 + random.random() * 30:.1f}", unit='%'),
        ],
        logs=[
            LogItem(text='Sensores actualizados correctamente', time=datetime.datetime.now().strftime("%H:%M:%S")),
            LogItem(text='Lectura estable', time=datetime.datetime.now().strftime("%H:%M:%S")),
        ]
    )

@router.get("/map", response_model=MapDataResponse)
def get_map_data(current_user = Depends(get_current_user)):
    """
    Obtener datos del mapa y ubicación del USV.
    """
    return MapDataResponse(
        location="Cartagena, Colombia",
        mode="2d" if random.random() > 0.5 else "3d",
        coordinates=MapCoordinates(lat=10.3910, lng=-75.4794)
    )


@router.get("/admin-data")
def admin_data(user=Depends(require_admin)):
    """
    Endpoint solo accesible para usuarios con rol 'admin'.
    """
    return {
        "message": "Solo admins",
        "user_sub": user["sub"],
        "user_email": user["email"]
    }


@router.get("/user-data")
def user_data(user=Depends(require_user)):
    """
    Endpoint accesible para usuarios autenticados con rol 'user' o 'admin'.
    """
    return {
        "message": "Usuarios autenticados",
        "user_sub": user["sub"],
        "user_email": user["email"],
        "roles": user["roles"]
    }

@router.get("/missions")
def get_missions(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Obtener lista de misiones disponibles.
    """
    missions = db.query(Mission).order_by(Mission.start_time.desc()).all()
    return [
        {
            "id": m.id,
            "name": m.name or f"Misión {m.id}",
            "status": m.status,
            "start_time": m.start_time,
            "end_time": m.end_time
        }
        for m in missions
    ]

@router.post("/missions", response_model=MissionResponse)
def create_mission(mission_in: MissionCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Crear una nueva misión.
    """
    new_mission = Mission(
        id=str(uuid.uuid4())[:8],
        name=mission_in.name,
        status="EN_PROGRESO",
        start_time=datetime.datetime.utcnow()
    )
    db.add(new_mission)
    db.commit()
    db.refresh(new_mission)
    return new_mission

@router.patch("/missions/{mission_id}/finish", response_model=MissionResponse)
def finish_mission(mission_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Finalizar una misión existente.
    """
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Misión no encontrada")
    
    mission.status = "FINALIZADO"
    mission.end_time = datetime.datetime.utcnow()
    db.commit()
    db.refresh(mission)
    return mission

@router.post("/telemetry")
def ingest_telemetry(data: TelemetryData, db: Session = Depends(get_db)):
    """
    Ingestar datos de telemetría desde el USV (o emulador).
    """
    mission = db.query(Mission).filter(Mission.id == data.mission_id).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Misión no encontrada o no válida")
    
    if mission.status == "FINALIZADO":
        raise HTTPException(status_code=400, detail="La misión ya está finalizada")

    new_sensor_data = SensorData(
        mission_id=mission.id,
        timestamp=datetime.datetime.utcnow(),
        temperature=data.temperatura_agua_c,
        dissolved_oxygen=data.oxigeno_disuelto_ppm,
        ph=data.ph_agua,
        turbidity=data.turbidez_ntu,
        battery_level=data.bateria_porcentaje
    )
    
    db.add(new_sensor_data)
    db.commit()
    return {"status": "success", "message": "Telemetría registrada"}