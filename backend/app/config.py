from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Union

class Settings(BaseSettings):
    """
    Configuración global del backend de Sentinel.
    
    Carga variables de entorno desde el archivo `.env` ubicado en la raíz del proyecto
    y expone configuraciones para base de datos (MySQL), autenticación (JWT local y AWS Cognito),
    base de datos de series de tiempo (InfluxDB) y AWS IoT Core.
    """
    DATABASE_URL: str = "mysql+pymysql://usv_user:usv_password@db:3306/usv_hmi"
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 360  # 6 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PROJECT_NAME: str = "USV HMI Backend"
    API_V1_STR: str = "/api/v1"
    BACKEND_CORS_ORIGINS: Union[str, List[str]] = ["http://localhost:8080", "http://localhost:3000", "http://localhost:5173", "*"]
    
    # AWS Cognito Configuration
    COGNITO_REGION: str = "us-east-1"
    COGNITO_USER_POOL_ID: str = "us-east-1_PfMPPwYKa"
    COGNITO_APP_CLIENT_ID: str = "2i6r6a7hi79epi20b5uedgeo1e"
    
    # Gemini API
    GEMINI_API_KEY: str = ""

    # InfluxDB Configuration
    INFLUXDB_URL: str = "http://sentinel-influxdb:8086"
    INFLUXDB_TOKEN: str = "sentinel-local-admin-token-please-change"
    INFLUXDB_ORG: str = "sentinel-org"
    INFLUXDB_BUCKET: str = "mission"
    
    # AWS IoT Core Configuration
    IOT_ENDPOINT: str = "a3399dxn78u8zv-ats.iot.us-east-1.amazonaws.com"
    IOT_THING_NAME: str = "USV-001"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    class Config:
        """Configuración de Pydantic BaseSettings para resolver archivos env."""
        env_file = "../../.env"
        extra = "ignore"

    @field_validator('BACKEND_CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        """
        Valida y convierte los orígenes de CORS.
        
        Soporta orígenes como strings separadas por comas o listas directas.
        
        Args:
            v: El valor crudo de BACKEND_CORS_ORIGINS (string o lista).
            
        Returns:
            List[str]: Lista con los orígenes permitidos procesados.
        """
        if isinstance(v, str):
            # Si es una string, dividirla por comas
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        elif isinstance(v, list):
            return v
        else:
            return ["http://localhost:8080", "http://localhost:3000", "http://localhost:5173"]

    @property
    def cors_origins(self) -> List[str]:
        """
        Retorna la lista final de orígenes habilitados para CORS.
        
        Returns:
            List[str]: Orígenes permitidos.
        """
        if isinstance(self.BACKEND_CORS_ORIGINS, list):
            return self.BACKEND_CORS_ORIGINS
        return ["http://localhost:8080", "http://localhost:3000", "http://localhost:5173"]

settings = Settings()