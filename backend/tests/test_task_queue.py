"""
测试任务队列逻辑。
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.task_queue import TaskQueue


class TestTaskQueue:
    """TaskQueue 核心逻辑测试"""

    @pytest.fixture
    def queue(self):
        return TaskQueue()

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_initial_avg_duration(self, queue):
        """初始平均耗时应为默认值 300 秒"""
        assert queue.avg_task_duration == 300

    @pytest.mark.asyncio
    async def test_enqueue_new_task(self, queue, mock_db):
        """入队新任务时应计算队列位置和预计等待"""
        # mock: 当前有 3 个 pending/queued/processing 任务
        scalar_result = MagicMock()
        scalar_result.scalar.return_value = 3
        mock_db.execute.return_value = scalar_result

        # mock: 查询任务本身
        mock_task = MagicMock()
        mock_task.id = "task-1"
        task_result = MagicMock()
        task_result.scalar_one_or_none.return_value = mock_task
        mock_db.execute.return_value = task_result

        # 第一次 execute 返回 count, 第二次返回 task
        mock_db.execute.side_effect = [scalar_result, task_result]

        await queue.enqueue("task-1", mock_db)

        assert mock_task.queue_position == 3
        assert mock_task.estimated_seconds == 3 * 300

    @pytest.mark.asyncio
    async def test_dequeue_with_pending_task(self, queue, mock_db):
        """取回 pending 任务时应标记为 queued"""
        mock_task = MagicMock()
        mock_task.status = "pending"
        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none.return_value = mock_task
        mock_db.execute.return_value = scalar_result

        task = await queue.dequeue(mock_db)
        assert task is not None
        assert task.status == "queued"

    @pytest.mark.asyncio
    async def test_dequeue_no_pending(self, queue, mock_db):
        """没有 pending 任务时应返回 None"""
        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = scalar_result

        task = await queue.dequeue(mock_db)
        assert task is None

    @pytest.mark.asyncio
    async def test_get_queue_info(self, queue, mock_db):
        """查询队列状态"""
        mock_db.scalar.side_effect = [3, 1]  # pending_count=3, processing_count=1

        info = await queue.get_queue_info(mock_db)
        assert info["pending_count"] == 3
        assert info["processing_count"] == 1
        assert info["avg_duration"] == 300

    @pytest.mark.asyncio
    async def test_recalculate_avg_duration(self, queue, mock_db):
        """从已完成任务重新计算平均耗时"""
        scalar_result = MagicMock()
        scalar_result.scalar.return_value = 150.5  # 平均 150.5 秒
        mock_db.execute.return_value = scalar_result

        await queue.recalculate_avg_duration(mock_db)
        assert queue.avg_task_duration == 151  # math.ceil(150.5)

    @pytest.mark.asyncio
    async def test_recalculate_avg_duration_no_data(self, queue, mock_db):
        """没有已完成任务时应保持默认值"""
        scalar_result = MagicMock()
        scalar_result.scalar.return_value = None
        mock_db.execute.return_value = scalar_result

        await queue.recalculate_avg_duration(mock_db)
        assert queue.avg_task_duration == 300  # 默认值不变

    @pytest.mark.asyncio
    async def test_update_queue_positions(self, queue, mock_db):
        """更新队列位置"""
        # 模拟 2 个 pending 任务
        task1 = MagicMock()
        task2 = MagicMock()
        scalar_result = MagicMock()
        scalar_result.scalars.return_value.all.return_value = [task1, task2]
        mock_db.execute.return_value = scalar_result

        await queue.update_queue_positions(mock_db)

        assert task1.queue_position == 1
        assert task1.estimated_seconds == 1 * 300
        assert task2.queue_position == 2
        assert task2.estimated_seconds == 2 * 300

    @pytest.mark.asyncio
    async def test_enqueue_zero_count(self, queue, mock_db):
        """队列为空时入队，位置应为 0"""
        scalar_result = MagicMock()
        scalar_result.scalar.return_value = 0
        mock_db.execute.return_value = scalar_result

        mock_task = MagicMock()
        task_result = MagicMock()
        task_result.scalar_one_or_none.return_value = mock_task
        mock_db.execute.side_effect = [scalar_result, task_result]

        await queue.enqueue("task-1", mock_db)

        assert mock_task.queue_position == 0
        assert mock_task.estimated_seconds == 0
