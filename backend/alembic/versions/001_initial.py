"""initial migration

Revision ID: 001
Revises:
Create Date: 2025-01-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 开启 uuid-ossp 扩展
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # users 表
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("username", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="user"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # tasks 表
    op.create_table(
        "tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("source_type", sa.String(20), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("source_filename", sa.String(255), nullable=True),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("whisper_model", sa.String(20), nullable=False, server_default="base"),
        sa.Column("output_formats", JSONB, nullable=False, server_default='["txt","srt","bilingual_srt"]'),
        sa.Column("translate_target_langs", JSONB, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending", index=True),
        sa.Column("progress", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("progress_message", sa.String(255), nullable=True),
        sa.Column("queue_position", sa.Integer(), nullable=True),
        sa.Column("estimated_seconds", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index("idx_tasks_status_position", "tasks", ["status", "queue_position"])
    op.create_index("idx_tasks_user_created", "tasks", ["user_id", "created_at"])
    op.create_index("idx_tasks_created_at", "tasks", ["created_at"])

    # task_outputs 表
    op.create_table(
        "task_outputs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("task_id", UUID(as_uuid=True), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("format_type", sa.String(20), nullable=False),
        sa.Column("language_pair", sa.String(20), nullable=True),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # system_config 表
    op.create_table(
        "system_config",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", JSONB, nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("task_outputs")
    op.drop_table("tasks")
    op.drop_table("system_config")
    op.drop_table("users")
