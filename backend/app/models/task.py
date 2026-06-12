import uuid
from datetime import datetime

from sqlalchemy import Boolean, String, Text, Float, Integer, DateTime, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'upload' | 'url'
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Whisper 配置
    whisper_model: Mapped[str] = mapped_column(String(20), nullable=False, default="base")

    # 翻译 LLM 配置
    translate_llm_model: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # 输出配置
    output_formats: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)  # ["txt", "srt", "bilingual_srt"]
    translate_target_langs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # ["zh", "ja", ...]

    # 状态与进度
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", index=True
    )  # pending / queued / processing / completed / failed / cancelled
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    progress_message: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # 队列信息
    queue_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # 错误信息
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 取消请求标记
    cancel_requested: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # 时间戳
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # 关系
    user = relationship("User", back_populates="tasks")
    outputs = relationship("TaskOutput", back_populates="task", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_tasks_status_position", "status", "queue_position"),
        Index("idx_tasks_user_created", "user_id", "created_at"),
        Index("idx_tasks_created_at", "created_at"),
    )
