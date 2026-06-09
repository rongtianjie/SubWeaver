import os
import shutil
from pathlib import Path
from uuid import UUID

from app.config import settings


class StorageBackend:
    """文件存储抽象层（本地实现），后续可扩展为 S3/MinIO"""

    def __init__(self, base_dir: str = settings.STORAGE_DIR):
        self.base_dir = Path(base_dir)
        self.uploads_dir = self.base_dir / "uploads"
        self.outputs_dir = self.base_dir / "outputs"
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.outputs_dir.mkdir(parents=True, exist_ok=True)

    def save_upload(self, task_id: UUID, filename: str, content: bytes) -> str:
        """保存上传文件到 storage/uploads/{task_id}/"""
        task_dir = self.uploads_dir / str(task_id)
        task_dir.mkdir(parents=True, exist_ok=True)
        file_path = task_dir / filename
        with open(file_path, "wb") as f:
            f.write(content)
        return str(file_path)

    def get_upload_path(self, task_id: UUID, filename: str) -> str:
        return str(self.uploads_dir / str(task_id) / filename)

    def get_output_dir(self, task_id: UUID) -> str:
        output_dir = self.outputs_dir / str(task_id)
        output_dir.mkdir(parents=True, exist_ok=True)
        return str(output_dir)

    def save_output(self, task_id: UUID, filename: str, content: str | bytes) -> str:
        """保存输出文件到 storage/outputs/{task_id}/"""
        output_dir = self.outputs_dir / str(task_id)
        output_dir.mkdir(parents=True, exist_ok=True)
        file_path = output_dir / filename
        if isinstance(content, str):
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
        else:
            with open(file_path, "wb") as f:
                f.write(content)
        return str(file_path)

    def get_output_path(self, task_id: UUID, filename: str) -> str:
        return str(self.outputs_dir / str(task_id) / filename)

    def file_size(self, file_path: str) -> int:
        return os.path.getsize(file_path)

    def delete_task_files(self, task_id: UUID):
        """删除任务相关的所有文件"""
        upload_dir = self.uploads_dir / str(task_id)
        output_dir = self.outputs_dir / str(task_id)
        if upload_dir.exists():
            shutil.rmtree(upload_dir)
        if output_dir.exists():
            shutil.rmtree(output_dir)

    def cleanup_expired(self, days: int):
        """清理超过指定天数的输出文件"""
        import time

        cutoff = time.time() - days * 86400
        for task_dir in self.outputs_dir.iterdir():
            if task_dir.is_dir():
                # 检查目录修改时间
                mtime = task_dir.stat().st_mtime
                if mtime < cutoff:
                    shutil.rmtree(task_dir)
                    # 同时清理上传目录
                    upload_dir = self.uploads_dir / task_dir.name
                    if upload_dir.exists():
                        shutil.rmtree(upload_dir)


storage = StorageBackend()
