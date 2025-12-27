from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Union

class Settings(BaseSettings):
    DATABASE_URL: str = "mysql+pymysql://usv_user:usv_password@db:3306/usv_hmi"
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 360  # 6 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PROJECT_NAME: str = "USV HMI Backend"
    API_V1_STR: str = "/api/v1"
    BACKEND_CORS_ORIGINS: Union[str, List[str]] = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"

    @field_validator('BACKEND_CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse BACKEND_CORS_ORIGINS from various formats to list."""
        if isinstance(v, str):
            # Si es una string, dividirla por comas
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        elif isinstance(v, list):
            return v
        else:
            return ["http://localhost:3000", "http://localhost:5173"]

    @property
    def cors_origins(self) -> List[str]:
        """Get CORS origins as list."""
        if isinstance(self.BACKEND_CORS_ORIGINS, list):
            return self.BACKEND_CORS_ORIGINS
        return ["http://localhost:3000", "http://localhost:5173"]

settings = Settings()