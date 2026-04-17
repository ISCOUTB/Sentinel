from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import random
import datetime
from app.schemas.schemas import SensorDataResponse, MapDataResponse, SensorItem, MetricItem, LogItem, MapCoordinates
from app.dependencies.auth import get_current_user
from app.core.security import require_admin, require_user

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