"""文件上传/管理业务逻辑"""
import os
from uuid import UUID

from app.core.storage import storage


class FileService:
    """文件服务：上传、存储、清理"""

    @staticmethod
    async def save_upload_file(task_id: UUID, filename: str, content: bytes) -> str:
        """保存上传文件"""
        return storage.save_upload(task_id, filename, content)

    @staticmethod
    def delete_task_files(task_id: UUID):
        """删除任务相关文件"""
        storage.delete_task_files(task_id)

    @staticmethod
    def cleanup_expired(days: int = 30):
        """清理过期文件"""
        storage.cleanup_expired(days)


file_service = FileService()
