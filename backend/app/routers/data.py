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
import json
import boto3
from app.config import settings

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

def utc_to_bogota(utc_dt):
    """Convierte datetime de UTC a Bogotá (UTC-5) manualmente."""
    if not utc_dt:
        return None
    return utc_dt - datetime.timedelta(hours=5)

@router.get("/missions")
def get_missions(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Obtener lista de misiones disponibles con nombre limpio, número de secuencia y hora local.
    """
    import re
    # Obtener todas las misiones ordenadas por fecha para calcular el número de secuencia
    all_missions = db.query(Mission).order_by(Mission.start_time.asc()).all()
    
    result = []
    for i, m in enumerate(all_missions):
        start_time_bog = utc_to_bogota(m.start_time)
        time_str = start_time_bog.strftime('%H:%M:%S') if start_time_bog else "N/A"
        
        # Limpiar el nombre original (quitar fecha entre paréntesis y estados previos si existen)
        raw_name = m.name or ""
        # Quita patrones como "(12/5/2026)", "(12/05/2026)" y lo que siga (como " - FINALIZADO")
        clean_name = re.sub(r'\s*\(\d{1,2}/\d{1,2}/\d{4}\).*$', '', raw_name).strip()
        
        # Evitar repetir la palabra "Misión" al inicio
        clean_name = re.sub(r'^Misión\s*\d*\s*', '', clean_name).strip()
            
        display_name = f"Misión {i+1} {clean_name} ({time_str})"
            
        result.append({
            "id": m.id,
            "name": f"{display_name} - {m.status.replace('_', ' ')}",
            "status": m.status,
            "start_time": m.start_time,
            "end_time": m.end_time
        })
        
    # Devolver invertido (más reciente primero) para la UI
    return result[::-1]

def publish_mission_command(command: str, mission_id: str, points: List = None):
    """
    Publica un comando de misión en AWS IoT Core.
    """
    try:
        endpoint = settings.IOT_ENDPOINT
        if endpoint and not endpoint.startswith("https://"):
            endpoint = f"https://{endpoint}"
            
        iot_client = boto3.client(
            'iot-data', 
            region_name=settings.COGNITO_REGION, 
            endpoint_url=endpoint,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
        )
        topic = f"{settings.IOT_THING_NAME}/orders"
        hw_cmd = command
        if command == "FINISH":
            hw_cmd = "CANCEL"

        if command == "START" and points:
            # 1. Enviar PREPARE
            prepare_payload = {
                "cmd": "PREPARE",
                "mission_id": mission_id
            }
            iot_client.publish(
                topic=topic,
                qos=1,
                payload=json.dumps(prepare_payload)
            )
            print(f"MQTT Publish: PREPARE for mission {mission_id} on topic {topic}")

            # 2. Enviar SET_COORDS
            set_coords_payload = {
                "cmd": "SET_COORDS",
                "payload": {
                    "waypoints": [{"lat": p.lat, "lon": p.lng, "alt": 0.5} for p in points],
                    "radius_m": 3.0
                },
                "mission_id": mission_id
            }
            iot_client.publish(
                topic=topic,
                qos=1,
                payload=json.dumps(set_coords_payload)
            )
            print(f"MQTT Publish: SET_COORDS for mission {mission_id} on topic {topic}")
            
        payload = {
            "cmd": hw_cmd,
            "mission_id": mission_id,
        }
            
        iot_client.publish(
            topic=topic,
            qos=1,
            payload=json.dumps(payload)
        )
        print(f"MQTT Publish: {hw_cmd} for mission {mission_id} on topic {topic}")
    except Exception as e:
        print(f"Error publishing to IoT Core ({command}): {e}")

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

    # Publicar los waypoints y comando de inicio en AWS IoT Core
    if mission_in.points:
        publish_mission_command("START", new_mission.id, mission_in.points)
            
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
    
    # Publicar comando de finalización en MQTT
    publish_mission_command("FINISH", mission.id)
    
    return mission

@router.patch("/missions/{mission_id}/pause", response_model=MissionResponse)
def pause_mission(mission_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Pausar una misión en progreso.
    """
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Misión no encontrada")
    
    mission.status = "PAUSADO"
    db.commit()
    db.refresh(mission)
    
    # Publicar comando de pausa en MQTT
    publish_mission_command("PAUSE", mission.id)
    
    return mission

@router.patch("/missions/{mission_id}/resume", response_model=MissionResponse)
def resume_mission(mission_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Reanudar una misión pausada.
    """
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Misión no encontrada")
    
    mission.status = "EN_PROGRESO"
    db.commit()
    db.refresh(mission)
    
    # Publicar comando de reanudación en MQTT
    publish_mission_command("RESUME", mission.id)
    
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