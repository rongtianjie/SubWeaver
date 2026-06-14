"""
测试配置管理。
"""

import os
from unittest.mock import patch

from app.config import Settings, settings


class TestSettings:
    """配置测试"""

    def test_default_settings(self):
        """验证默认配置值"""
        s = Settings()
        assert s.APP_NAME == "SubWeaver"
        assert s.DEBUG is False
        assert s.ACCESS_TOKEN_EXPIRE_MINUTES == 60
        assert s.REFRESH_TOKEN_EXPIRE_DAYS == 7
        assert s.MAX_FILE_SIZE_MB == 500
        assert s.DEFAULT_WHISPER_MODEL == "base"
        assert s.RETENTION_DAYS == 30
        assert s.GUEST_TASK_LIMIT == 3
        assert "zh" in s.SUPPORTED_LANGUAGES
        assert "ja" in s.SUPPORTED_LANGUAGES

    def test_env_override(self):
        """环境变量应能覆盖默认值"""
        with patch.dict(os.environ, {
            "APP_NAME": "Custom Name",
            "DEBUG": "true",
            "DATABASE_URL": "postgresql+asyncpg://custom:pass@localhost:5432/custom_db",
            "MAX_FILE_SIZE_MB": "1000",
            "RETENTION_DAYS": "7",
        }, clear=False):
            s = Settings()
            assert s.APP_NAME == "Custom Name"
            assert s.DEBUG is True
            assert "custom_db" in s.DATABASE_URL
            assert s.MAX_FILE_SIZE_MB == 1000
            assert s.RETENTION_DAYS == 7

    def test_cors_origins(self):
        """CORS 配置"""
        s = Settings()
        assert "http://localhost:5173" in s.CORS_ORIGINS
        assert "http://localhost:80" in s.CORS_ORIGINS

    def test_secret_key_default(self):
        """SECRET_KEY 应有默认值（生产环境应覆盖）"""
        s = Settings()
        assert s.SECRET_KEY is not None
        assert len(s.SECRET_KEY) > 0
