import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import settings
from app.database import async_session_factory
from app.services.config_service import init_default_configs
from app.startup_checker.checker import checker
from app.startup_checker.checks.db_check import check_database
from app.startup_checker.checks.ffmpeg_check import check_ffmpeg
from app.startup_checker.checks.whisper_check import check_whisper_model
from app.startup_checker.checks.llm_check import check_llm_connection
from app.worker.worker import Worker

# 注册检查项
checker.register("数据库连接 (PostgreSQL)", check_database)
checker.register("ffmpeg", check_ffmpeg)
checker.register("Whisper 模型", check_whisper_model)
checker.register("LLM 翻译接口", check_llm_connection)

worker = Worker()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动检查
    logger.info("正在执行系统环境检查...")
    results = await checker.run_all()
    checker.print_report(results)
    has_errors = any(r.severity == "error" and not r.status for r in results)

    # 初始化默认配置
    try:
        async with async_session_factory() as db:
            await init_default_configs(db)
    except Exception as e:
        logger.warning(f"初始化默认配置失败: {e}")

    # 启动 Worker（即使有非关键错误也启动）
    if not has_errors:
        app.state.worker_task = asyncio.create_task(worker.run())
        logger.info("Worker 已启动")
    else:
        logger.warning("存在关键错误，Worker 未启动。请修复后重启服务。")

    yield

    # 清理
    await worker.stop()
    if hasattr(app.state, "worker_task"):
        app.state.worker_task.cancel()
        try:
            await app.state.worker_task
        except asyncio.CancelledError:
            pass
    logger.info("服务已关闭")


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
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
from app.api.v1 import auth, tasks, health, admin, files

app.include_router(auth.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(health.router, prefix="/api/v1")
app.include_router(files.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "service": settings.APP_NAME,
        "version": "1.0.0",
        "docs": "/docs",
    }
