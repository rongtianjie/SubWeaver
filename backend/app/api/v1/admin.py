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
import base64
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sse_starlette.sse import EventSourceResponse

from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.models.task import Task
from app.models.task_output import TaskOutput
from app.schemas.admin import ConfigUpdate, ConfigResponse, AdminStats, UserRoleUpdate, HealthCheckItem, LogFileInfo, LogContent, FileItem, FileListResponse, FileDeleteRequest
from app.services.config_service import get_all_configs, set_config_value, get_config_value
from app.core.task_queue import task_queue
from app.core.storage import storage
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
    query = select(Task).options(selectinload(Task.user))
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

    def _get_file_size(task: Task) -> int | None:
        if task.file_path and os.path.exists(task.file_path):
            try:
                return os.path.getsize(task.file_path)
            except OSError:
                pass
        return None

    return {
        "tasks": [
            {
                "id": str(t.id),
                "user_id": str(t.user_id) if t.user_id else None,
                "title": t.title,
                "source_type": t.source_type,
                "source_filename": t.source_filename,
                "source_url": t.source_url,
                "file_size": _get_file_size(t),
                "status": t.status,
                "progress": t.progress,
                "progress_message": t.progress_message,
                "whisper_model": t.whisper_model,
                "translate_llm_model": t.translate_llm_model,
                "username": t.user.username if t.user else None,
                "error_message": t.error_message,
                "cancel_requested": t.cancel_requested,
                "created_at": str(t.created_at),
                "started_at": str(t.started_at) if t.started_at else None,
                "completed_at": str(t.completed_at) if t.completed_at else None,
            }
            for t in tasks
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.delete("/tasks/{task_id}")
async def admin_delete_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """删除任务及其关联的媒体文件和输出文件"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # 删除存储的媒体文件和输出文件
    storage.delete_task_files(task_id)
    # 删除数据库记录（cascade 会自动删除 TaskOutput）
    await db.delete(task)
    await db.commit()
    return {"message": "任务已删除"}


@router.put("/tasks/{task_id}/cancel")
async def cancel_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status not in ("queued", "processing"):
        raise HTTPException(status_code=400, detail="只能取消正在处理或排队中的任务")

    task.cancel_requested = True
    task.progress_message = "正在等待当前阶段结束..."
    await db.commit()
    await task_queue.update_queue_positions(db)
    await db.commit()
    return {"message": "取消请求已提交，任务将在当前阶段结束后停止"}


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
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str = Query(None, description="按用户名或邮箱模糊搜索"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    query = select(User)
    count_query = select(func.count(User.id))

    if q:
        like_pattern = f"%{q}%"
        filter_cond = or_(User.username.ilike(like_pattern), User.email.ilike(like_pattern))
        query = query.where(filter_cond)
        count_query = count_query.where(filter_cond)

    total = await db.scalar(count_query) or 0
    result = await db.execute(
        query.order_by(User.created_at)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    users = result.scalars().all()

    # 获取每个用户的任务数
    from app.models.task import Task
    user_ids = [u.id for u in users]
    task_counts = {}
    if user_ids:
        tc_result = await db.execute(
            select(Task.user_id, func.count(Task.id)).where(
                Task.user_id.in_(user_ids)
            ).group_by(Task.user_id)
        )
        for row in tc_result:
            task_counts[str(row[0])] = row[1]

    return {
        "users": [
            {
                "id": str(u.id),
                "username": u.username,
                "email": u.email,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": str(u.created_at),
                "task_count": task_counts.get(str(u.id), 0),
            }
            for u in users
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.put("/users/{user_id}/toggle-active")
async def admin_toggle_user_active(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """切换用户的启用/禁用状态"""
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="不能禁用自己")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.is_active = not user.is_active
    await db.commit()
    return {
        "message": f"用户 {'已启用' if user.is_active else '已禁用'}",
        "is_active": user.is_active,
    }


@router.delete("/users/{user_id}")
async def admin_delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """删除用户，关联任务保留（user_id 置空）"""
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="不能删除自己")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    await db.delete(user)
    await db.commit()
    return {"message": "用户已删除"}


@router.post("/users/{user_id}/reset-password")
async def admin_reset_password(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """重置用户密码为随机 6 位字母数字组合"""
    import string
    import secrets
    from app.core.security import hash_password

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    alphabet = string.ascii_letters + string.digits
    new_password = ''.join(secrets.choice(alphabet) for _ in range(6))
    user.password_hash = hash_password(new_password)
    await db.commit()
    return {"new_password": new_password, "message": "密码已重置"}


@router.get("/users/{user_id}/tasks")
async def admin_list_user_tasks(
    user_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """获取指定用户的任务列表"""
    query = select(Task).options(selectinload(Task.user)).where(Task.user_id == user_id)
    count_query = select(func.count(Task.id)).where(Task.user_id == user_id)

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
                "title": t.title,
                "source_type": t.source_type,
                "source_filename": t.source_filename,
                "status": t.status,
                "progress": t.progress,
                "progress_message": t.progress_message,
                "whisper_model": t.whisper_model,
                "translate_llm_model": t.translate_llm_model,
                "created_at": str(t.created_at),
                "started_at": str(t.started_at) if t.started_at else None,
                "completed_at": str(t.completed_at) if t.completed_at else None,
            }
            for t in tasks
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
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
    from sqlalchemy import case

    # 合并为一条聚合查询替代 6 条独立 count
    status_counts = await db.execute(
        select(
            func.count(Task.id).label("total"),
            func.count(case((Task.status == "pending", 1))).label("pending"),
            func.count(case((Task.status.in_(["queued", "processing"]), 1))).label("processing"),
            func.count(case((Task.status == "completed", 1))).label("completed"),
            func.count(case((Task.status == "failed", 1))).label("failed"),
            func.count(case((Task.status == "cancelled", 1))).label("cancelled"),
        ).select_from(Task)
    )
    row = status_counts.one()
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
        total_tasks=row.total,
        pending_tasks=row.pending,
        processing_tasks=row.processing,
        completed_tasks=row.completed,
        failed_tasks=row.failed,
        cancelled_tasks=row.cancelled,
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
    timeout = await get_config_value(db, "llm_timeout") or 15

    from openai import AsyncOpenAI
    import time
    try:
        client = AsyncOpenAI(base_url=base_url, api_key=api_key, timeout=int(timeout))
        start = time.perf_counter()
        resp = await client.chat.completions.create(
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
    from openai import AsyncOpenAI
    try:
        client = AsyncOpenAI(base_url=req.base_url, api_key=req.api_key, timeout=15)
        models = await client.models.list()
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
            # gz 文件无法高效 seek，仍读取全部内容后取尾部
            with gzip.open(real_path, "rt", encoding="utf-8") as f:
                lines = f.readlines()
            total_lines = len(lines)
            start = max(0, total_lines - tail)
            content = "".join(lines[start:])
            has_more = start > 0
        else:
            # 普通日志文件：从文件末尾 seek 读取尾部 N 行
            file_size = os.path.getsize(real_path)
            # 估算需要读取的字节数（平均每行约 200 字节）
            read_bytes = min(file_size, tail * 200 + 1024)
            with open(real_path, "r", encoding="utf-8") as f:
                if read_bytes < file_size:
                    f.seek(file_size - read_bytes)
                    f.readline()  # 跳过不完整的行
                lines_buffer = f.read()

            all_lines = lines_buffer.splitlines(keepends=True)
            total_lines = len(all_lines)
            if total_lines > tail:
                content = "".join(all_lines[-tail:])
                has_more = True
            else:
                content = "".join(all_lines)
                has_more = read_bytes < file_size

        return LogContent(
            filename=filename,
            content=content,
            has_more=has_more,
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


@router.get("/files", response_model=FileListResponse)
async def list_files(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str = Query(None, description="按文件名模糊搜索"),
    file_type: str = Query(None, description="upload / output / orphan"),
    task_id: str = Query(None, description="按任务 ID 筛选"),
    sort_by: str = Query("created_at", description="filename / file_size / created_at"),
    sort_order: str = Query("desc", description="asc / desc"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """获取文件管理列表（DB 为主 + 文件系统兜底）"""
    all_items: list[dict] = []
    storage_dir = settings.STORAGE_DIR
    known_paths: set[str] = set()

    # 1. 查询所有任务的上传文件
    task_result = await db.execute(
        select(Task).options(selectinload(Task.user)).where(Task.file_path.isnot(None))
    )
    tasks = task_result.scalars().all()
    for t in tasks:
        fp = t.file_path
        if fp and os.path.exists(fp):
            rel_path = os.path.relpath(fp, storage_dir)
            known_paths.add(rel_path)
            try:
                file_size = os.path.getsize(fp)
            except OSError:
                file_size = 0
            all_items.append({
                "id": f"upload_{t.id}",
                "filename": os.path.basename(fp),
                "file_type": "upload",
                "format_type": None,
                "language_pair": None,
                "file_size": file_size,
                "file_path": rel_path,
                "task_id": str(t.id),
                "task_title": t.title,
                "created_at": str(t.created_at) if t.created_at else None,
            })

    # 2. 查询所有 TaskOutput 记录
    output_result = await db.execute(
        select(TaskOutput).options(selectinload(TaskOutput.task))
    )
    outputs = output_result.scalars().all()
    for o in outputs:
        fp = o.file_path
        if fp and os.path.exists(fp):
            rel_path = os.path.relpath(fp, storage_dir)
            known_paths.add(rel_path)
            all_items.append({
                "id": f"output_{o.id}",
                "filename": os.path.basename(fp),
                "file_type": "output",
                "format_type": o.format_type,
                "language_pair": o.language_pair,
                "file_size": o.file_size or (os.path.getsize(fp) if os.path.exists(fp) else 0),
                "file_path": rel_path,
                "task_id": str(o.task_id),
                "task_title": o.task.title if o.task else None,
                "created_at": str(o.created_at) if o.created_at else None,
            })

    # 3. 扫描文件系统发现孤立文件
    if os.path.exists(storage_dir):
        for dirpath, _, filenames in os.walk(storage_dir):
            for f in filenames:
                full_path = os.path.join(dirpath, f)
                rel_path = os.path.relpath(full_path, storage_dir)
                if rel_path not in known_paths:
                    try:
                        file_id_bytes = base64.urlsafe_b64encode(rel_path.encode()).decode()
                        all_items.append({
                            "id": f"orphan_{file_id_bytes}",
                            "filename": f,
                            "file_type": "orphan",
                            "format_type": None,
                            "language_pair": None,
                            "file_size": os.path.getsize(full_path),
                            "file_path": rel_path,
                            "task_id": None,
                            "task_title": None,
                            "created_at": None,
                        })
                    except OSError:
                        pass

    # 4. 筛选
    if q:
        q_lower = q.lower()
        all_items = [item for item in all_items if q_lower in item["filename"].lower()]
    if file_type:
        all_items = [item for item in all_items if item["file_type"] == file_type]
    if task_id:
        all_items = [item for item in all_items if item["task_id"] == task_id]

    # 5. 排序
    reverse = sort_order != "asc"
    if sort_by == "filename":
        all_items.sort(key=lambda x: x["filename"].lower(), reverse=reverse)
    elif sort_by == "file_size":
        all_items.sort(key=lambda x: x["file_size"], reverse=reverse)
    else:  # created_at
        def _sort_key(item):
            dt = item.get("created_at")
            return dt or ""
        all_items.sort(key=_sort_key, reverse=reverse)

    # 6. 分页
    total = len(all_items)
    start = (page - 1) * page_size
    end = start + page_size
    page_items = all_items[start:end]

    return FileListResponse(
        files=[FileItem(**item) for item in page_items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.delete("/files")
async def delete_files(
    req: FileDeleteRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """删除文件（支持软删除和硬删除）"""
    deleted_count = 0
    errors: list[dict] = []

    for file_id in req.file_ids:
        try:
            ftype, identifier = _parse_file_id(file_id)
        except ValueError:
            errors.append({"file_id": file_id, "error": "无效的文件 ID"})
            continue

        if ftype == "upload":
            result = await db.execute(select(Task).where(Task.id == UUID(identifier)))
            task = result.scalar_one_or_none()
            if not task or not task.file_path:
                errors.append({"file_id": file_id, "error": "文件记录不存在"})
                continue
            if task.status in ("queued", "processing"):
                errors.append({"file_id": file_id, "error": "文件关联的任务正在处理中，无法删除"})
                continue
            file_path = task.file_path
            if req.mode == "hard" and file_path and os.path.exists(file_path):
                os.remove(file_path)
            task.file_path = None
            await db.commit()
            deleted_count += 1

        elif ftype == "output":
            result = await db.execute(select(TaskOutput).where(TaskOutput.id == UUID(identifier)))
            output = result.scalar_one_or_none()
            if not output:
                errors.append({"file_id": file_id, "error": "文件记录不存在"})
                continue
            task_result = await db.execute(select(Task).where(Task.id == output.task_id))
            task = task_result.scalar_one_or_none()
            if task and task.status in ("queued", "processing"):
                errors.append({"file_id": file_id, "error": "文件关联的任务正在处理中，无法删除"})
                continue
            file_path = output.file_path
            if req.mode == "hard" and file_path and os.path.exists(file_path):
                os.remove(file_path)
            await db.delete(output)
            await db.commit()
            deleted_count += 1

        else:  # orphan
            try:
                rel_path = base64.urlsafe_b64decode(identifier.encode()).decode()
                full_path = os.path.join(settings.STORAGE_DIR, rel_path)
                real_path = os.path.realpath(full_path)
                real_storage = os.path.realpath(settings.STORAGE_DIR)
                if not real_path.startswith(real_storage):
                    errors.append({"file_id": file_id, "error": "不允许访问该文件"})
                    continue
                if os.path.exists(real_path):
                    os.remove(real_path)
                    deleted_count += 1
                else:
                    errors.append({"file_id": file_id, "error": "文件不存在"})
            except Exception:
                errors.append({"file_id": file_id, "error": "文件路径解析失败"})

    return {
        "deleted_count": deleted_count,
        "errors": errors,
    }


@router.get("/files/{file_id}/download")
async def download_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """下载文件"""
    file_path = await _resolve_file_path(file_id, db)
    if not file_path:
        raise HTTPException(status_code=404, detail="文件不存在")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件已从磁盘删除")

    filename = os.path.basename(file_path)
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream",
    )


@router.get("/files/{file_id}/preview")
async def preview_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """预览文件：媒体文件返回流，文本文件返回内容"""
    file_path = await _resolve_file_path(file_id, db)
    if not file_path:
        raise HTTPException(status_code=404, detail="文件不存在")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件已从磁盘删除")

    filename = os.path.basename(file_path)
    ext = os.path.splitext(filename)[1].lower()

    text_exts = {".txt", ".srt", ".vtt", ".ass", ".json", ".md", ".csv"}
    if ext in text_exts:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        except UnicodeDecodeError:
            with open(file_path, "r", encoding="latin-1") as f:
                content = f.read()
        return {"filename": filename, "content": content, "type": "text"}

    # 媒体文件
    media_types = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".avi": "video/x-msvideo",
        ".mov": "video/quicktime",
        ".mkv": "video/x-matroska",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".flac": "audio/flac",
        ".wma": "audio/x-ms-wma",
    }
    media_type = media_types.get(ext, "application/octet-stream")
    return FileResponse(path=file_path, media_type=media_type)


def _parse_file_id(file_id: str) -> tuple[str, str]:
    """解析 file_id 为 (类型, 标识符)"""
    if file_id.startswith("upload_"):
        return ("upload", file_id[len("upload_"):])
    elif file_id.startswith("output_"):
        return ("output", file_id[len("output_"):])
    elif file_id.startswith("orphan_"):
        return ("orphan", file_id[len("orphan_"):])
    raise ValueError(f"无效的文件 ID 格式: {file_id}")


async def _resolve_file_path(file_id: str, db: AsyncSession) -> str | None:
    """根据 file_id 解析文件绝对路径"""
    try:
        ftype, identifier = _parse_file_id(file_id)
    except ValueError:
        return None

    if ftype == "upload":
        result = await db.execute(select(Task).where(Task.id == UUID(identifier)))
        task = result.scalar_one_or_none()
        return task.file_path if task else None

    elif ftype == "output":
        result = await db.execute(select(TaskOutput).where(TaskOutput.id == UUID(identifier)))
        output = result.scalar_one_or_none()
        return output.file_path if output else None

    else:  # orphan
        try:
            rel_path = base64.urlsafe_b64decode(identifier.encode()).decode()
            full_path = os.path.join(settings.STORAGE_DIR, rel_path)
            real_path = os.path.realpath(full_path)
            real_storage = os.path.realpath(settings.STORAGE_DIR)
            if real_path.startswith(real_storage):
                return real_path
        except Exception:
            pass
        return None
