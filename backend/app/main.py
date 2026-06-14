import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import settings
from app.core.logging import setup_logging
from app.database import async_session_factory
from app.startup_checker.checker import checker
from app.startup_checker.checks.db_check import check_database
from app.startup_checker.checks.ffmpeg_check import check_ffmpeg
from app.startup_checker.checks.whisper_check import check_whisper_model
from app.startup_checker.checks.llm_check import check_llm_connection
from app.services.config_service import init_default_configs, get_config_value

# 注册检查项
checker.register("数据库连接 (PostgreSQL)", check_database)
checker.register("ffmpeg", check_ffmpeg)
checker.register("Whisper 模型", check_whisper_model)
checker.register("LLM 翻译接口", check_llm_connection)

APP_VERSION = "1.0.0"


def _log_startup_banner():
    """打印启动横幅"""
    logger.info("=" * 60)
    logger.info(f"  {settings.APP_NAME}")
    logger.info(f"  版本: {APP_VERSION}")
    logger.info(f"  日志目录: {settings.STORAGE_DIR}/logs")
    logger.info("=" * 60)


def _log_config_summary():
    """打印关键配置摘要（脱敏）"""
    db_url = settings.DATABASE_URL
    # 脱敏密码部分
    if ":" in db_url and "@" in db_url:
        prefix, rest = db_url.split("://", 1)
        user_pass, host = rest.split("@", 1)
        if ":" in user_pass:
            user, _ = user_pass.split(":", 1)
            db_url = f"{prefix}://{user}:****@{host}"

    logger.info("  关键配置:")
    logger.info(f"    ├─ 数据库: PostgreSQL")
    logger.info(f"    ├─ 数据库地址: {db_url}")
    logger.info(f"    ├─ 存储目录: {settings.STORAGE_DIR}")
    logger.info(f"    ├─ 模型目录: {settings.WHISPER_MODEL_DIR}")
    logger.info(f"    ├─ 文件限制: {settings.MAX_FILE_SIZE_MB}MB")
    logger.info(f"    ├─ 保留天数: {settings.RETENTION_DAYS}天")
    logger.info(f"    ├─ LLM 接口: {settings.LLM_BASE_URL}")
    logger.info(f"    ├─ LLM 模型: {settings.LLM_MODEL or '(未配置)'}")
    logger.info(f"    ├─ 默认模型: {settings.DEFAULT_WHISPER_MODEL}")
    logger.info(f"    └─ CORS 域名: {settings.CORS_ORIGINS}")
    logger.info("=" * 60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 初始化日志系统（最优先）
    setup_logging()

    # SECRET_KEY 安全检查
    if settings.SECRET_KEY == "change-me-in-production":
        logger.error("SECRET_KEY 使用默认值，请在 .env 中配置安全的密钥！")
        raise RuntimeError("SECRET_KEY must be changed in production. Please set it in .env file.")

    # 启动横幅
    _log_startup_banner()

    # 初始化默认配置（必须在日志摘要和启动检查之前）
    try:
        async with async_session_factory() as db:
            await init_default_configs(db)
            # 从数据库加载 LLM 模型名，覆盖 settings 中的空值
            db_llm_model = await get_config_value(db, "llm_model")
            if db_llm_model:
                settings.LLM_MODEL = db_llm_model
    except Exception as e:
        logger.warning(f"初始化默认配置失败: {e}")

    # 关键配置摘要
    _log_config_summary()

    # 启动检查
    logger.info("正在执行系统环境检查...")
    results = await checker.run_all()
    ok = checker.print_report(results)


    app.state._start_time = time.time()
    yield

    # 清理
    if hasattr(app.state, "_start_time"):
        uptime = time.time() - app.state._start_time
        logger.info(f"  服务已运行: {uptime:.0f} 秒")

    logger.info("=" * 60)
    logger.info(f"  {settings.APP_NAME} v{APP_VERSION} 服务已关闭")
    logger.info("=" * 60)


app = FastAPI(
    title=settings.APP_NAME,
    version=APP_VERSION,
    lifespan=lifespan,
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
from app.api.v1 import auth, tasks, health, admin, files, models

app.include_router(auth.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(health.router, prefix="/api/v1")
app.include_router(files.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(models.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "service": settings.APP_NAME,
        "version": "1.0.0",
        "docs": "/docs",
    }
