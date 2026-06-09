from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_config import SystemConfig


async def get_config_value(db: AsyncSession, key: str, default=None):
    """获取系统配置值"""
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    config = result.scalar_one_or_none()
    if config:
        return config.value
    return default


async def set_config_value(db: AsyncSession, key: str, value, description: str | None = None):
    """设置系统配置值"""
    result = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    config = result.scalar_one_or_none()
    if config:
        config.value = value
        if description is not None:
            config.description = description
    else:
        config = SystemConfig(key=key, value=value, description=description)
        db.add(config)


async def get_all_configs(db: AsyncSession) -> dict:
    """获取所有系统配置"""
    result = await db.execute(select(SystemConfig))
    configs = result.scalars().all()
    return {c.key: {"value": c.value, "description": c.description, "updated_at": str(c.updated_at)} for c in configs}


async def init_default_configs(db: AsyncSession):
    """初始化默认系统配置"""
    defaults = {
        "max_concurrent_tasks": (1, "最大并发任务数"),
        "max_file_size_mb": (500, "最大上传文件大小 (MB)"),
        "retention_days": (30, "文件保留天数"),
        "guest_task_limit": (3, "游客每日任务上限"),
        "llm_base_url": ("http://localhost:1234/v1", "LLM API 基础地址"),
        "llm_api_key": ("lm-studio", "LLM API 密钥"),
        "llm_model": ("lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF", "LLM 模型名称"),
        "default_whisper_model": ("base", "默认 Whisper 模型"),
    }

    for key, (value, description) in defaults.items():
        existing = await get_config_value(db, key)
        if existing is None:
            await set_config_value(db, key, value, description)

    await db.commit()
