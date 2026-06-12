#!/bin/bash
set -e

echo "========================================="
echo "  Whisper Platform - Docker Entrypoint"
echo "========================================="

# 执行数据库迁移
echo "[1/2] 执行数据库迁移 (alembic upgrade head)..."
alembic upgrade head
echo "[1/2] 数据库迁移完成"

# 启动 uvicorn
echo "[2/2] 启动 FastAPI 服务..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
