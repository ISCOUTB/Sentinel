#!/usr/bin/env python3
"""
Punto de Entrada del Servidor Sentinel Backend.

Inicializa la aplicación FastAPI, configura las políticas de CORS,
registra los enrutadores para autenticación, telemetría y reportes,
y gestiona la creación inicial de tablas en la base de datos relacional.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import time
import logging

from app.config import settings
from app.database import create_tables
from app.routers.auth import router as auth_router
from app.routers.data import router as data_router
from app.routers.reports import router as reports_router

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

@app.on_event("startup")
async def startup_event():
    """
    Evento disparado al iniciar el servidor de FastAPI.
    
    Intenta crear de forma segura las tablas en la base de datos MySQL,
    con una política de reintentos exponenciales sutiles (hasta 5 intentos)
    para manejar desfases temporales en el arranque de contenedores Docker.
    """
    max_retries = 5
    for attempt in range(max_retries):
        try:
            logger.info(f"Intentando crear tablas en la base de datos (intento {attempt + 1}/{max_retries})")
            create_tables()
            logger.info("Tablas creadas exitosamente")
            break
        except Exception as e:
            logger.warning(f"Error al crear tablas (intento {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2)
            else:
                logger.error("No se pudieron crear las tablas después de varios intentos")
                raise

# Configurar CORS middleware para solicitudes del frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro de enrutadores de la API V1
app.include_router(
    auth_router,
    prefix=settings.API_V1_STR,
    tags=["authentication"],
)

app.include_router(
    data_router,
    prefix=settings.API_V1_STR,
    tags=["data"],
)

app.include_router(
    reports_router,
    prefix=settings.API_V1_STR,
    tags=["reports"],
)

@app.get("/")
def read_root():
    """
    Endpoint de bienvenida raíz del sistema.
    
    Returns:
        dict: Información básica e identificadora del backend.
    """
    return {"message": "USV HMI Backend API", "version": "1.0.0", "status": "running"}

@app.get("/health")
def health_check():
    """
    Endpoint de verificación de estado (Health Check).
    
    Usado para validar la vitalidad del servicio por balanceadores de carga o Docker.
    
    Returns:
        dict: Estado de salud del servidor.
    """
    return {"status": "healthy"}