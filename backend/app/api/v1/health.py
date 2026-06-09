from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.startup_checker.checker import checker
from app.startup_checker.checks.db_check import check_database
from app.startup_checker.checks.ffmpeg_check import check_ffmpeg
from app.startup_checker.checks.whisper_check import check_whisper_model
from app.startup_checker.checks.llm_check import check_llm_connection
from app.core.task_queue import task_queue

router = APIRouter(prefix="/health", tags=["健康检查"])


@router.get("")
async def health():
    return {"status": "ok", "service": "Whisper Platform"}


@router.get("/ready")
async def readiness(db: AsyncSession = Depends(get_db)):
    checks = await asyncio_gather_checks()
    queue_info = await task_queue.get_queue_info(db)
    all_ok = all(c.status or c.severity != "error" for c in checks)

    return {
        "status": "ok" if all_ok else "degraded",
        "checks": [c.model_dump() for c in checks],
        "queue": queue_info,
    }


async def asyncio_gather_checks():
    import asyncio
    results = await asyncio.gather(
        check_database(),
        check_ffmpeg(),
        check_whisper_model(),
        check_llm_connection(),
        return_exceptions=True,
    )
    return [r for r in results if not isinstance(r, Exception)]
