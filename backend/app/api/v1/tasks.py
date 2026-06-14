import json
import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sse_starlette.sse import EventSourceResponse

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.task import Task
from app.schemas.task import (
    TaskCreate, TaskResponse, TaskOutputResponse, TaskListResponse, QueueStatusResponse
)
from app.services.task_service import task_service
from app.services.config_service import get_config_value
from app.core.task_queue import task_queue
from app.core.storage import storage

router = APIRouter(prefix="/tasks", tags=["任务"])


def _task_to_response(task: Task) -> TaskResponse:
    return TaskResponse(
        id=str(task.id),
        user_id=str(task.user_id) if task.user_id else None,
        title=task.title,
        source_type=task.source_type,
        source_url=task.source_url,
        source_filename=task.source_filename,
        whisper_model=task.whisper_model,
        output_formats=task.output_formats,
        translate_target_langs=task.translate_target_langs,
        status=task.status,
        progress=task.progress,
        progress_message=task.progress_message,
        queue_position=task.queue_position,
        estimated_seconds=task.estimated_seconds,
        error_message=task.error_message,
        cancel_requested=task.cancel_requested,
        created_at=str(task.created_at),
        started_at=str(task.started_at) if task.started_at else None,
        completed_at=str(task.completed_at) if task.completed_at else None,
    )


@router.get("/defaults")
async def get_task_defaults(db: AsyncSession = Depends(get_db)):
    """获取创建任务的默认配置（公开接口，无需登录）"""
    default_model = await get_config_value(db, "default_whisper_model", "base")
    return {"default_whisper_model": default_model}


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    source_type: str = Form(...),
    source_url: str = Form(None),
    title: str = Form(None),
    whisper_model: str = Form("base"),
    output_formats: str = Form('["txt","srt","bilingual_srt"]'),
    translate_target_langs: str = Form(None),
    file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    """创建任务：支持上传文件或提交 URL"""
    import json

    parsed_formats = json.loads(output_formats)
    parsed_langs = json.loads(translate_target_langs) if translate_target_langs else None

    file_path = None
    source_filename = None

    if source_type == "upload":
        if not file:
            raise HTTPException(status_code=400, detail="上传模式需要提供文件")
        content = await file.read()
        # 存储文件
        from app.core.storage import storage
        import uuid
        temp_id = uuid.uuid4()
        file_path = storage.save_upload(temp_id, file.filename, content)
        source_filename = file.filename
        title = title or file.filename

    task = await task_service.create_task(
        db=db,
        title=title or "未命名任务",
        source_type=source_type,
        whisper_model=whisper_model,
        output_formats=parsed_formats,
        translate_target_langs=parsed_langs,
        source_url=source_url,
        source_filename=source_filename,
        file_path=file_path,
        user_id=current_user.id if current_user else None,
    )

    # 如果上传文件，需要更新 file_path 到正确的 task_id 目录
    if source_type == "upload" and file_path:
        import os
        from pathlib import Path
        old_dir = Path(file_path).parent
        new_path = storage.save_upload(task.id, source_filename, b"")
        # 移动文件
        import shutil
        shutil.move(file_path, new_path)
        task.file_path = new_path
        # 清理临时目录
        if old_dir.exists():
            shutil.rmtree(old_dir)
        await db.flush()

    return _task_to_response(task)


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取当前用户的任务列表（需登录）"""
    tasks, total = await task_service.get_user_tasks(db, current_user.id, page, page_size, status)
    return TaskListResponse(
        tasks=[_task_to_response(t) for t in tasks],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/queue", response_model=QueueStatusResponse)
async def get_queue_status(db: AsyncSession = Depends(get_db)):
    info = await task_queue.get_queue_info(db)
    return QueueStatusResponse(**info)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: UUID, db: AsyncSession = Depends(get_db)):
    task = await task_service.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return _task_to_response(task)


@router.delete("/{task_id}")
async def delete_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await task_service.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="无权删除此任务")
    await task_service.delete_task(db, task_id)
    return {"message": "任务已删除"}


@router.get("/{task_id}/outputs", response_model=list[TaskOutputResponse])
async def get_task_outputs(task_id: UUID, db: AsyncSession = Depends(get_db)):
    outputs = await task_service.get_task_outputs(db, task_id)
    return [
        TaskOutputResponse(
            id=str(o.id),
            task_id=str(o.task_id),
            format_type=o.format_type,
            language_pair=o.language_pair,
            file_path=o.file_path,
            file_size=o.file_size,
            created_at=str(o.created_at),
        )
        for o in outputs
    ]


@router.put("/{task_id}/cancel")
async def cancel_own_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    """取消自己的任务"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # 任务所有者或管理员可以取消
    if current_user and task.user_id and task.user_id != current_user.id:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="无权取消此任务")
    elif not current_user and task.user_id is not None:
        raise HTTPException(status_code=403, detail="无权取消此任务")

    if task.status not in ("queued", "processing"):
        raise HTTPException(status_code=400, detail="只能取消正在处理或排队中的任务")

    task.cancel_requested = True
    task.progress_message = "正在等待当前阶段结束..."
    await db.commit()
    await task_queue.update_queue_positions(db)
    await db.commit()
    return {"message": "取消请求已发送"}


@router.get("/{task_id}/outputs/{output_id}/download")
async def download_task_output(
    task_id: UUID,
    output_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """下载任务输出文件"""
    from app.models.task_output import TaskOutput
    from sqlalchemy import select

    result = await db.execute(
        select(TaskOutput).where(TaskOutput.id == output_id, TaskOutput.task_id == task_id)
    )
    output = result.scalar_one_or_none()
    if not output:
        raise HTTPException(status_code=404, detail="输出文件不存在")

    file_path = output.file_path
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件已不存在")

    filename = os.path.basename(file_path)
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{task_id}/stream")
async def stream_task_progress(task_id: UUID):
    """SSE 实时进度推送（每次轮询使用独立数据库会话，避免会话缓存导致进度数据不更新）"""
    from app.database import async_session_factory

    async def event_generator():
        while True:
            async with async_session_factory() as fresh_db:
                task = await task_service.get_task(fresh_db, task_id)
                if not task:
                    yield {"event": "error", "data": json.dumps({"message": "任务不存在"})}
                    break

                data = {
                    "status": task.status,
                    "progress": task.progress,
                    "message": task.progress_message,
                    "queue_position": task.queue_position,
                    "estimated_seconds": task.estimated_seconds,
                }
                yield {"event": "progress", "data": json.dumps(data)}

                if task.status in ("completed", "failed", "cancelled"):
                    yield {"event": task.status, "data": json.dumps(data)}
                    break

            await asyncio.sleep(1)

    return EventSourceResponse(event_generator())
