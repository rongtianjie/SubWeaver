from sqlalchemy import text

from app.database import async_session_factory
from app.startup_checker.checker import CheckResult


async def check_database() -> CheckResult:
    """检查 PostgreSQL 数据库连接"""
    try:
        async with async_session_factory() as db:
            result = await db.execute(text("SELECT 1"))
            await result.fetchone()
        return CheckResult(
            name="数据库连接 (PostgreSQL)",
            status=True,
            severity="info",
            message="PostgreSQL 连接正常",
        )
    except Exception as e:
        return CheckResult(
            name="数据库连接 (PostgreSQL)",
            status=False,
            severity="error",
            message=f"数据库连接失败: {e}",
            guide=(
                "请确保 PostgreSQL 已启动并运行：\n"
                "  1. Docker 方式: docker compose up -d db\n"
                "  2. 原生部署: 确认 postgresql 服务运行中\n"
                "  3. 检查环境变量 DATABASE_URL 是否正确配置\n"
                "  默认连接: postgresql+asyncpg://whisper:whisper_secret@localhost:5432/whisper_platform"
            ),
        )
