import uuid
from datetime import datetime

from sqlalchemy import String, Text, BigInteger, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TaskOutput(Base):
    __tablename__ = "task_outputs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    format_type: Mapped[str] = mapped_column(String(20), nullable=False)  # txt / srt / bilingual_srt
    language_pair: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 如 en-zh, en-ja
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # 关系
    task = relationship("Task", back_populates="outputs")
