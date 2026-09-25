from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from .config import settings
from .models.models import Base

# Configuración del engine con pool y timeouts para MySQL
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={
        "connect_timeout": 10,
        "read_timeout": 10,
        "write_timeout": 10,
    }
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """
    Genera y provee una sesión de base de datos relacional para cada petición HTTP.
    
    Cierra la sesión automáticamente una vez completada la petición.
    
    Yields:
        Session: Sesión activa de SQLAlchemy para interactuar con MySQL.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """
    Crea todas las tablas definidas en los modelos declarativos de SQLAlchemy.
    
    Se invoca típicamente en el evento de inicio (startup) de la aplicación.
    """
    Base.metadata.create_all(bind=engine)