import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.models.task import Task
from app.schemas.admin import ConfigUpdate, ConfigResponse, AdminStats, UserRoleUpdate, HealthCheckItem
from app.services.config_service import get_all_configs, set_config_value
from app.startup_checker.checker import checker
from app.startup_checker.checks.db_check import check_database
from app.startup_checker.checks.ffmpeg_check import check_ffmpeg
from app.startup_checker.checks.whisper_check import check_whisper_model
from app.startup_checker.checks.llm_check import check_llm_connection

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
