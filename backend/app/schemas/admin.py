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
