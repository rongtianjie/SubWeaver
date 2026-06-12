"""add translate_llm_model to tasks

Revision ID: 002
Revises: 001
Create Date: 2025-06-12
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("translate_llm_model", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "translate_llm_model")
