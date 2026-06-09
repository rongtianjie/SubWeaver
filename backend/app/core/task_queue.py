import math
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task


class TaskQueue:
    """基于 PostgreSQL 的顺序队列管理（SKIP LOCKED）"""

    def __init__(self):
        self.avg_task_duration = 300  # 初始默认值（秒），运行后动态调整

    async def enqueue(self, task_id: UUID, db: AsyncSession):
        """将任务加入队列，计算位置和等待时间"""
        result = await db.execute(
            select(func.count(Task.id)).where(Task.status.in_(["pending", "queued", "processing"]))
        )
        queued_count = result.scalar() or 0

        result = await db.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if task:
            task.queue_position = queued_count  # 当前排队数即为该任务位置
            task.estimated_seconds = int((queued_count) * self.avg_task_duration)

    async def dequeue(self, db: AsyncSession) -> Task | None:
        """
        Worker 调用：原子性地取回一个 pending 任务。
        使用 FOR UPDATE SKIP LOCKED 避免多个 Worker 竞争。
        """
        result = await db.execute(
            select(Task)
            .where(Task.status == "pending")
            .order_by(Task.created_at)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        task = result.scalar_one_or_none()
        if task:
            task.status = "queued"
        return task

    async def update_queue_positions(self, db: AsyncSession):
        """任务完成后刷新剩余 pending 任务的队列信息"""
        result = await db.execute(
            select(Task)
            .where(Task.status == "pending")
            .order_by(Task.created_at)
        )
        pending_tasks = result.scalars().all()
        for i, t in enumerate(pending_tasks):
            t.queue_position = i + 1
            t.estimated_seconds = int((i + 1) * self.avg_task_duration)

    async def recalculate_avg_duration(self, db: AsyncSession):
        """从已完成任务重新计算平均耗时"""
        result = await db.execute(
            select(func.avg(
                func.extract("epoch", Task.completed_at - Task.started_at)
            )).where(Task.status == "completed")
        )
        avg = result.scalar()
        if avg and avg > 0:
            self.avg_task_duration = math.ceil(avg)

    async def get_queue_info(self, db: AsyncSession) -> dict:
        """获取当前队列状态"""
        pending_count = await db.scalar(
            select(func.count(Task.id)).where(Task.status == "pending")
        )
        processing_count = await db.scalar(
            select(func.count(Task.id)).where(Task.status == "processing")
        )
        return {
            "pending_count": pending_count or 0,
            "processing_count": processing_count or 0,
            "avg_duration": self.avg_task_duration,
        }


# 全局单例
task_queue = TaskQueue()
