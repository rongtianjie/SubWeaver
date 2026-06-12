"""Worker 独立进程入口

在独立容器中运行，与 FastAPI 进程分离，
避免 CPU 密集的 Whisper 转录阻塞 API 请求。
"""

import asyncio
import sys
from pathlib import Path

# 确保 app 包可导入
sys.path.insert(0, str(Path(__file__).parent))

from app.core.logging import setup_logging
from app.database import async_session_factory
from app.services.config_service import init_default_configs, get_config_value
from app.startup_checker.checker import checker
from app.startup_checker.checks.db_check import check_database
from app.startup_checker.checks.ffmpeg_check import check_ffmpeg
from app.startup_checker.checks.whisper_check import check_whisper_model
from app.startup_checker.checks.llm_check import check_llm_connection
from app.config import settings

# 预导入所有 ORM 模型，确保 SQLAlchemy 关系映射可以正确解析
from app.models.user import User  # noqa: F401
from app.models.task import Task  # noqa: F401
from app.models.task_output import TaskOutput  # noqa: F401
from app.models.system_config import SystemConfig  # noqa: F401

from app.worker.worker import Worker
from loguru import logger


async def main():
    setup_logging()

    logger.info("=" * 60)
    logger.info("  Worker 独立进程启动")
    logger.info("=" * 60)

    # 初始化默认配置
    try:
        async with async_session_factory() as db:
            await init_default_configs(db)
            db_llm_model = await get_config_value(db, "llm_model")
            if db_llm_model:
                settings.LLM_MODEL = db_llm_model
    except Exception as e:
        logger.warning(f"初始化默认配置失败: {e}")

    # 注册并运行启动检查
    checker.register("数据库连接 (PostgreSQL)", check_database)
    checker.register("ffmpeg", check_ffmpeg)
    checker.register("Whisper 模型", check_whisper_model)
    checker.register("LLM 翻译接口", check_llm_connection)

    results = await checker.run_all()
    ok = checker.print_report(results)

    if not ok:
        logger.error("存在关键错误，Worker 无法启动，请修复后重启")
        sys.exit(1)

    logger.info("Worker 前置检查通过，开始处理任务...")
    worker = Worker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
