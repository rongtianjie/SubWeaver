from pydantic import BaseModel


class LlmTestRequest(BaseModel):
    base_url: str | None = None
    api_key: str | None = None
    model: str | None = None


class LlmFetchModelsRequest(BaseModel):
    base_url: str
    api_key: str


import os
from uuid import UUID
import json
import gzip
from datetime import datetime
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.models.task import Task
from app.schemas.admin import ConfigUpdate, ConfigResponse, AdminStats, UserRoleUpdate, HealthCheckItem, LogFileInfo, LogContent
from app.services.config_service import get_all_configs, set_config_value, get_config_value
from app.config import settings
from app.startup_checker.checker import checker
from app.startup_checker.checks.db_check import check_database
from app.startup_checker.checks.ffmpeg_check import check_ffmpeg
from app.startup_checker.checks.whisper_check import check_whisper_model
from app.startup_checker.checks.llm_check import check_llm_connection
from app.core.logging import LOG_DIR

router = APIRouter(prefix="/admin", tags=["管理后台"])


@router.get("/tasks")
async def admin_list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    query = select(Task)
    count_query = select(func.count(Task.id))

    if status:
        query = query.where(Task.status == status)
        count_query = count_query.where(Task.status == status)

    total = await db.scalar(count_query) or 0
    result = await db.execute(
        query.order_by(desc(Task.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    tasks = result.scalars().all()

    return {
        "tasks": [
            {
                "id": str(t.id),
                "user_id": str(t.user_id) if t.user_id else None,
                "title": t.title,
                "source_type": t.source_type,
                "status": t.status,
                "progress": t.progress,
                "whisper_model": t.whisper_model,
                "created_at": str(t.created_at),
                "completed_at": str(t.completed_at) if t.completed_at else None,
            }
            for t in tasks
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.put("/tasks/{task_id}/retry")
async def retry_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status != "failed":
        raise HTTPException(status_code=400, detail="只能重试失败的任务")
    task.status = "pending"
    task.error_message = None
    task.progress = 0.0
    task.progress_message = None
    await db.commit()
    return {"message": "任务已重新加入队列"}


@router.get("/users")
async def admin_list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()
    return {
        "users": [
            {
                "id": str(u.id),
                "username": u.username,
                "email": u.email,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": str(u.created_at),
            }
            for u in users
        ]
    }


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: UUID,
    data: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if data.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="角色必须是 user 或 admin")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.role = data.role
    await db.commit()
    return {"message": f"用户角色已更新为 {data.role}"}


@router.get("/config")
async def admin_get_config(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return await get_all_configs(db)


@router.put("/config/{key}")
async def admin_update_config(
    key: str,
    data: ConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    await set_config_value(db, key, data.value, data.description)
    await db.commit()
    return {"message": f"配置 {key} 已更新"}


@router.get("/stats", response_model=AdminStats)
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    total_tasks = await db.scalar(select(func.count(Task.id))) or 0
    pending = await db.scalar(select(func.count(Task.id)).where(Task.status == "pending")) or 0
    processing = await db.scalar(select(func.count(Task.id)).where(Task.status.in_(["queued", "processing"]))) or 0
    completed = await db.scalar(select(func.count(Task.id)).where(Task.status == "completed")) or 0
    failed = await db.scalar(select(func.count(Task.id)).where(Task.status == "failed")) or 0
    total_users = await db.scalar(select(func.count(User.id))) or 0

    # 估算存储使用量
    storage_usage = 0.0
    from app.config import settings
    storage_dir = settings.STORAGE_DIR
    if os.path.exists(storage_dir):
        for dirpath, _, filenames in os.walk(storage_dir):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    storage_usage += os.path.getsize(fp)
                except OSError:
                    pass

    return AdminStats(
        total_tasks=total_tasks,
        pending_tasks=pending,
        processing_tasks=processing,
        completed_tasks=completed,
        failed_tasks=failed,
        total_users=total_users,
        storage_usage_mb=round(storage_usage / (1024 * 1024), 2),
    )


@router.post("/llm/test")
async def test_llm_connection(
    req: LlmTestRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """测试 LLM 配置是否可用：发送 'hi' 并检查返回"""
    # 优先使用请求体传入的参数，其次从 DB / 环境变量读取
    base_url = req.base_url or await get_config_value(db, "llm_base_url") or settings.LLM_BASE_URL
    api_key = req.api_key or await get_config_value(db, "llm_api_key") or settings.LLM_API_KEY
    model = req.model or await get_config_value(db, "llm_model") or settings.LLM_MODEL

    from openai import OpenAI
    import time
    try:
        client = OpenAI(base_url=base_url, api_key=api_key, timeout=15)
        start = time.perf_counter()
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=10,
        )
        elapsed = round((time.perf_counter() - start) * 1000)
        reply = resp.choices[0].message.content.strip() if resp.choices else ""
        return {
            "success": True,
            "message": f"LLM 连接成功，模型 '{model}' 正常响应",
            "response": reply,
            "latency_ms": elapsed,
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "message": f"连接失败: {e}",
                "config": {"base_url": base_url, "model": model},
            },
        )


@router.post("/llm/fetch-models")
async def fetch_llm_models(
    req: LlmFetchModelsRequest,
    admin: User = Depends(require_admin),
):
    """获取 LLM 后端支持的所有模型列表"""
    from openai import OpenAI
    try:
        client = OpenAI(base_url=req.base_url, api_key=req.api_key, timeout=15)
        models = client.models.list()
        # 过滤掉非聊天模型（如 OMLX 返回的 MarkItDown，其 max_model_len 为 null）
        model_ids = sorted([
            m.id for m in models
            if not (
                hasattr(m, 'model_extra')
                and m.model_extra
                and 'max_model_len' in m.model_extra
                and m.model_extra.get('max_model_len') is None
            )
        ])
        return {"models": model_ids}
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"获取模型列表失败: {e}",
        )


@router.get("/health", response_model=list[HealthCheckItem])
async def admin_health(
    admin: User = Depends(require_admin),
):
    import asyncio
    results = await asyncio.gather(
        check_database(),
        check_ffmpeg(),
        check_whisper_model(),
        check_llm_connection(),
        return_exceptions=True,
    )
    return [
        HealthCheckItem(name=r.name, status=r.status, severity=r.severity, message=r.message)
        for r in results if not isinstance(r, Exception)
    ]


@router.get("/logs", response_model=list[LogFileInfo])
async def list_log_files(
    admin: User = Depends(require_admin),
):
    """列出日志目录下的所有日志文件"""
    if not os.path.exists(LOG_DIR):
        return []

    files = []
    for f in sorted(os.listdir(LOG_DIR)):
        fpath = os.path.join(LOG_DIR, f)
        if os.path.isfile(fpath) and (f.endswith(".log") or f.endswith(".log.gz")):
            mtime = datetime.fromtimestamp(os.path.getmtime(fpath))
            files.append(LogFileInfo(
                filename=f,
                size_bytes=os.path.getsize(fpath),
                last_modified=mtime.isoformat(),
            ))
    # 按最后修改时间倒序
    files.sort(key=lambda x: x.last_modified, reverse=True)
    return files


@router.get("/logs/{filename}", response_model=LogContent)
async def read_log_file(
    filename: str,
    tail: int = Query(200, ge=10, le=5000, description="读取尾部行数"),
    admin: User = Depends(require_admin),
):
    """读取指定日志文件的内容（支持 .gz 文件）"""
    log_path = os.path.join(LOG_DIR, filename)

    # 安全校验：防止路径穿越
    real_path = os.path.realpath(log_path)
    real_log_dir = os.path.realpath(LOG_DIR)
    if not real_path.startswith(real_log_dir):
        raise HTTPException(status_code=403, detail="不允许访问该文件")

    if not os.path.exists(real_path):
        raise HTTPException(status_code=404, detail="日志文件不存在")

    try:
        if filename.endswith(".gz"):
            with gzip.open(real_path, "rt", encoding="utf-8") as f:
                lines = f.readlines()
        else:
            with open(real_path, "r", encoding="utf-8") as f:
                lines = f.readlines()

        total_lines = len(lines)
        start = max(0, total_lines - tail)
        content = "".join(lines[start:])

        return LogContent(
            filename=filename,
            content=content,
            has_more=start > 0,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取日志失败: {e}")


@router.get("/logs/{filename}/stream")
async def stream_log_file(
    filename: str,
    admin: User = Depends(require_admin),
):
    """SSE 实时推送日志文件新内容"""
    import asyncio

    log_path = os.path.join(LOG_DIR, filename)
    real_path = os.path.realpath(log_path)
    real_log_dir = os.path.realpath(LOG_DIR)
    if not real_path.startswith(real_log_dir):
        raise HTTPException(status_code=403, detail="不允许访问该文件")
    if not os.path.exists(real_path):
        raise HTTPException(status_code=404, detail="日志文件不存在")

    async def event_generator() -> AsyncGenerator[dict, None]:
        last_size = os.path.getsize(real_path)

        # 先推送当前文件大小（供前端判断是否需要重新读取）
        yield {"event": "init", "data": json.dumps({"size": last_size})}

        while True:
            await asyncio.sleep(1)
            try:
                current_size = os.path.getsize(real_path)
                if current_size > last_size:
                    if filename.endswith(".gz"):
                        with gzip.open(real_path, "rt", encoding="utf-8") as f:
                            f.seek(last_size)
                            new_content = f.read()
                    else:
                        with open(real_path, "r", encoding="utf-8") as f:
                            f.seek(last_size)
                            new_content = f.read()

                    if new_content:
                        yield {"event": "log", "data": json.dumps({"content": new_content})}

                    last_size = current_size
            except Exception:
                yield {"event": "error", "data": json.dumps({"message": "读取日志失败"})}
                break

    return EventSourceResponse(event_generator())
