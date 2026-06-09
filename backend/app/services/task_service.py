import os
from uuid import UUID
from datetime import datetime

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.models.task_output import TaskOutput
from app.core.task_queue import task_queue
from app.core.storage import storage


class TaskService:

    @staticmethod
    async def create_task(
        db: AsyncSession,
        title: str,
        source_type: str,
        whisper_model: str,
        output_formats: list,
        translate_target_langs: list | None = None,
        source_url: str | None = None,
        source_filename: str | None = None,
        file_path: str | None = None,
        user_id: UUID | None = None,
    ) -> Task:
        """创建任务"""
        task = Task(
            user_id=user_id,
            title=title or source_filename or "未命名任务",
            source_type=source_type,
            source_url=source_url,
            source_filename=source_filename,
            file_path=file_path,
            whisper_model=whisper_model,
            output_formats=output_formats,
            translate_target_langs=translate_target_langs,
            status="pending",
        )
        db.add(task)
        await db.flush()
        await task_queue.enqueue(task.id, db)
        return task

    @staticmethod
    async def get_task(db: AsyncSession, task_id: UUID) -> Task | None:
        result = await db.execute(select(Task).where(Task.id == task_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_tasks(
        db: AsyncSession,
        user_id: UUID,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
    ) -> tuple[list[Task], int]:
        query = select(Task).where(Task.user_id == user_id)
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
        return list(result.scalars().all()), total

    @staticmethod
    async def get_task_outputs(db: AsyncSession, task_id: UUID) -> list[TaskOutput]:
        result = await db.execute(
            select(TaskOutput).where(TaskOutput.task_id == task_id)
        )
        return list(result.scalars().all())

    @staticmethod
    async def delete_task(db: AsyncSession, task_id: UUID):
        task = await TaskService.get_task(db, task_id)
        if task:
            storage.delete_task_files(task_id)
            await db.delete(task)
            await task_queue.update_queue_positions(db)


task_service = TaskService()
