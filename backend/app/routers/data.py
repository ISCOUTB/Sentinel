"""
Enrutador de Endpoints de Datos y Misiones de Telemetría.

Gestiona las consultas de telemetría de sensores, el estado de ubicación del vehículo,
el histórico de misiones con formato de tiempo y nombres limpios, la ingesta de
telemetría desde el USV o emulador, y la publicación de comandos de control (START, PAUSE, CANCEL)
hacia AWS IoT Core a través de mensajería MQTT.
"""

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
    Obtiene lecturas de sensores ambientales en tiempo real.
    
    Actualmente simula los datos de temperatura, oxígeno disuelto, pH y turbidez.
    En implementaciones futuras, este endpoint se conectará a las fuentes de hardware reales.
    
    Returns:
        SensorDataResponse: Datos agregados de sensores, métricas y logs recientes.
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
    Obtiene las coordenadas del mapa y la ubicación del USV.
    
    Returns:
        MapDataResponse: Coordenadas espaciales de latitud, longitud y el modo de renderizado.
    """
    return MapDataResponse(
        location="Cartagena, Colombia",
        mode="2d" if random.random() > 0.5 else "3d",
        coordinates=MapCoordinates(lat=10.3910, lng=-75.4794)
    )


@router.get("/admin-data")
def admin_data(user=Depends(require_admin)):
    """
    Endpoint restringido de prueba para verificar rol de administrador.
    
    Args:
        user: Payload del usuario administrador actual.
        
    Returns:
        dict: Mensaje de éxito e identificadores del administrador.
    """
    return {
        "message": "Solo admins",
        "user_sub": user["sub"],
        "user_email": user["email"]
    }


@router.get("/user-data")
def user_data(user=Depends(require_user)):
    """
    Endpoint restringido de prueba para verificar rol de usuario general o administrador.
    
    Args:
        user: Payload del usuario autenticado.
        
    Returns:
        dict: Mensaje de éxito y roles del usuario.
    """
    return {
        "message": "Usuarios autenticados",
        "user_sub": user["sub"],
        "user_email": user["email"],
        "roles": user["roles"]
    }

def utc_to_bogota(utc_dt):
    """
    Convierte un objeto datetime con zona horaria UTC a la hora local de Bogotá (UTC-5).
    
    Args:
        utc_dt (datetime): Objeto datetime en UTC.
        
    Returns:
        datetime: Objeto datetime en hora local de Bogotá.
    """
    if not utc_dt:
        return None
    return utc_dt - datetime.timedelta(hours=5)

@router.get("/missions")
def get_missions(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Obtiene el listado de misiones de monitoreo registradas.
    
    Procesa las marcas de tiempo a hora local de Bogotá, limpia la nomenclatura del nombre
    de misión removiendo subpatrones de fechas redundantes e inyecta un número secuencial de misión.
    Retorna los resultados ordenados de forma cronológica inversa (las misiones más recientes primero).
    
    Returns:
        List[dict]: Misiones procesadas con su respectivo estado.
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
    Publica instrucciones de control de misión hacia AWS IoT Core por MQTT.
    
    Este método actúa como puente emitiendo mensajes serializados en JSON en el tópico
    de órdenes del dispositivo (`USV-001/orders` por defecto).
    
    Para la acción "START", realiza un flujo secuencial:
    1. Emite un comando "PREPARE" indicando el ID de misión asignado.
    2. Emite un comando "SET_COORDS" transmitiendo la lista de waypoints y radios de aceptación.
    3. Emite el comando de control final "START" para inicializar la navegación física.
    
    Args:
        command (str): Comando de control (START, FINISH, PAUSE, RESUME).
        mission_id (str): Identificador único de la misión en base de datos.
        points (List[MapCoordinates]): Lista de coordenadas que definen la ruta a seguir.
    """
    try:
        endpoint = settings.IOT_ENDPOINT
        if endpoint and not endpoint.startswith("https://"):
            endpoint = f"https://{endpoint}"
            
        iot_client = boto3.client(
            'iot-data', 
            region_name=settings.AWS_REGION, 
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
                payload=json.dumps(prepare_payload).encode('utf-8')
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
                payload=json.dumps(set_coords_payload).encode('utf-8')
            )
            print(f"MQTT Publish: SET_COORDS for mission {mission_id} on topic {topic}")
            
        payload = {
            "cmd": hw_cmd,
            "mission_id": mission_id,
        }
            
        iot_client.publish(
            topic=topic,
            qos=1,
            payload=json.dumps(payload).encode('utf-8')
        )
        print(f"MQTT Publish SUCCESS: {hw_cmd} for mission {mission_id} on topic {topic}")
    except Exception as e:
        print(f"!!! MQTT Publish ERROR ({command}): {str(e)}")
        import traceback
        traceback.print_exc()

@router.post("/missions", response_model=MissionResponse)
def create_mission(mission_in: MissionCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Registra e inicia una nueva misión en el sistema.
    
    Genera un identificador único aleatorio para la misión, la guarda con estado "EN_PROGRESO"
    en la base de datos relacional y despacha las coordenadas y el comando de arranque a AWS IoT Core.
    
    Args:
        mission_in (MissionCreate): Nombre de la misión y lista de waypoints.
        db (Session): Sesión de la base de datos MySQL.
        
    Returns:
        MissionResponse: Perfil de la misión recién creada.
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
    Finaliza formalmente una misión de monitoreo activa.
    
    Marca el estado de la misión como "FINALIZADO", almacena la hora exacta de término en UTC,
    y transmite la orden de finalización (CANCEL en el hardware) mediante MQTT a AWS IoT Core.
    
    Args:
        mission_id (str): Identificador único de la misión.
        db (Session): Sesión de base de datos MySQL.
        
    Returns:
        MissionResponse: Perfil actualizado de la misión.
        
    Raises:
        HTTPException (404): Si la misión con el ID provisto no existe.
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
    Pausa la navegación del vehículo de forma temporal durante la misión activa.
    
    Actualiza el estado a "PAUSADO" en base de datos y despacha el comando de pausa vía MQTT.
    
    Args:
        mission_id (str): Identificador de la misión.
        db (Session): Sesión de base de datos MySQL.
        
    Returns:
        MissionResponse: Perfil de misión con estado actualizado.
        
    Raises:
        HTTPException (404): Si la misión no existe.
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
    Reanuda una misión previamente pausada.
    
    Establece el estado como "EN_PROGRESO" en base de datos y publica la orden de reanudación vía MQTT.
    
    Args:
        mission_id (str): Identificador de la misión.
        db (Session): Sesión de base de datos MySQL.
        
    Returns:
        MissionResponse: Perfil de misión con estado restaurado.
        
    Raises:
        HTTPException (404): Si la misión no existe.
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
    Registra una lectura de telemetría proveniente del USV o emulador de hardware.
    
    Valida la existencia de la misión asociada y que ésta no haya concluido aún.
    Inserta las lecturas físico-químicas del agua y estado eléctrico en la tabla `sensor_data` de MySQL.
    
    Args:
        data (TelemetryData): Payload con métricas ambientales y coordenadas GPS actuales del USV.
        db (Session): Sesión de la base de datos MySQL.
        
    Returns:
        dict: Estado del resultado de la inserción.
        
    Raises:
        HTTPException (404): Si la misión asociada no es válida.
        HTTPException (400): Si la misión ya ha finalizado, rechazando más telemetría.
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