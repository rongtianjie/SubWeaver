from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ConfigUpdate(BaseModel):
    value: Any
    description: str | None = None


class ConfigResponse(BaseModel):
    key: str
    value: Any
    description: str | None = None
    updated_at: str | None = None


class AdminStats(BaseModel):
    total_tasks: int
    pending_tasks: int
    processing_tasks: int
    completed_tasks: int
    failed_tasks: int
    cancelled_tasks: int
    total_users: int
    storage_usage_mb: float


class UserRoleUpdate(BaseModel):
    role: str  # 'user' | 'admin'


class HealthCheckItem(BaseModel):
    name: str
    status: bool
    severity: str  # error / warning / info
    message: str


class LogFileInfo(BaseModel):
    filename: str
    size_bytes: int
    last_modified: str


class LogContent(BaseModel):
    filename: str
    content: str
    has_more: bool


class FileItem(BaseModel):
    """文件管理列表中的文件项"""
    id: str
    filename: str
    file_type: str  # upload / output / orphan
    format_type: str | None = None  # txt / srt / bilingual_srt
    language_pair: str | None = None
    file_size: int
    file_path: str  # 相对 storage 目录的路径
    task_id: str | None = None
    task_title: str | None = None
    created_at: str | None = None


class FileListResponse(BaseModel):
    files: list[FileItem]
    total: int
    page: int
    page_size: int


class FileDeleteRequest(BaseModel):
    file_ids: list[str]
    mode: str  # soft / hard
