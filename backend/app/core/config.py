from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "PRAGATI"
    APP_ENV: str = "development"
    SECRET_KEY: str = "change_me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "pragati_db"

    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    NEBIUS_API_KEY: str = ""
    NEBIUS_VISION_MODEL: str = "Qwen/Qwen2.5-VL-72B-Instruct"
    NEBIUS_TEXT_MODEL: str = "meta-llama/Llama-3.3-70B-Instruct-fast"

    # Ollama kept as fallback
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "deepseek-r1:7b"

    CHROMA_PERSIST_DIR: str = "./data/vector_store"
    WEATHER_API_KEY: str = ""
    WEATHER_API_BASE: str = "http://api.weatherapi.com/v1"
    GEOCODING_API: str = "https://nominatim.openstreetmap.org"

    DATA_GOV_KEY: str = ""
    OPENCAGE_KEY: str = ""

    UPLOAD_DIR: str = "./data/uploads"
    MAX_UPLOAD_SIZE: int = 10485760

    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    @property
    def DATABASE_URL(self) -> str:
        from urllib.parse import quote_plus
        password = quote_plus(self.DB_PASSWORD)
        return f"mysql+pymysql://{self.DB_USER}:{password}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
