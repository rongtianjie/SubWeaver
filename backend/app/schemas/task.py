from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from uuid import UUID


class TaskCreate(BaseModel):
    """创建任务请求（通过 URL 提交时）"""
    source_type: str = Field(..., pattern="^(upload|url)$")
    source_url: Optional[str] = None
    title: Optional[str] = None
    whisper_model: str = Field(default="base", pattern="^(tiny|base|small|medium|large)$")
    output_formats: List[str] = Field(default=["txt", "srt", "bilingual_srt"])
    translate_target_langs: Optional[List[str]] = None


class TaskResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    title: str
    source_type: str
    source_url: Optional[str] = None
    source_filename: Optional[str] = None
    whisper_model: str
    output_formats: List[str]
    translate_target_langs: Optional[List[str]] = None
    status: str
    progress: float
    progress_message: Optional[str] = None
    queue_position: Optional[int] = None
    estimated_seconds: Optional[int] = None
    error_message: Optional[str] = None
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TaskOutputResponse(BaseModel):
    id: str
    task_id: str
    format_type: str
    language_pair: Optional[str] = None
    file_path: str
    file_size: Optional[int] = None
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class TaskListResponse(BaseModel):
    tasks: List[TaskResponse]
    total: int
    page: int
    page_size: int


class QueueStatusResponse(BaseModel):
    pending_count: int
    processing_count: int
    avg_duration: int
