from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import List
import os


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", env_file_encoding="utf-8")

    # 应用
    APP_NAME: str = "SubWeaver"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # 数据库
    DATABASE_URL: str = "postgresql+asyncpg://subweaver:subweaver_secret@localhost:5432/subweaver"

    # 存储
    STORAGE_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "storage")
    MAX_FILE_SIZE_MB: int = 500

    # Whisper
    WHISPER_MODEL_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "models")
    DEFAULT_WHISPER_MODEL: str = "base"

    # 翻译 LLM（OpenAI 兼容接口）
    LLM_BASE_URL: str = "http://host.docker.internal:8000/v1"
    LLM_API_KEY: str = "1234"
    LLM_MODEL: str = ""

    # 系统配置
    RETENTION_DAYS: int = 30
    GUEST_TASK_LIMIT: int = 3
    SUPPORTED_LANGUAGES: List[str] = ["zh", "ja", "ko", "fr", "de", "es", "ru", "pt", "ar", "th", "vi"]

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:80", "http://localhost"]

    # Worker
    WORKER_POLL_INTERVAL: int = 2  # 秒


settings = Settings()
