import os
import shutil
from uuid import UUID
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.core.storage import storage
from app.config import settings

router = APIRouter(prefix="/files", tags=["文件管理"])


@router.get("")
async def list_uploaded_files(
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    """列出所有上传文件（需登录，游客返回空）"""
    if not current_user:
        return {"files": []}

    upload_dir = Path(storage.uploads_dir) / str(current_user.id)
    if not upload_dir.exists():
        return {"files": []}

    files_list = []
    for f in upload_dir.iterdir():
        if f.is_file():
            files_list.append({
                "filename": f.name,
                "size": f.stat().st_size,
                "modified_at": str(f.stat().st_mtime),
            })
    return {"files": files_list}


@router.delete("/{filename}")
async def delete_uploaded_file(
    filename: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除已上传的文件"""
    # 防止路径穿越攻击
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="非法文件名")

    user_dir = (Path(storage.uploads_dir) / str(current_user.id)).resolve()
    file_path = (user_dir / filename).resolve()

    if not str(file_path).startswith(str(user_dir)):
        raise HTTPException(status_code=403, detail="不允许访问该文件")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    # 检查文件是否被任务引用
    from app.models.task import Task
    from sqlalchemy import select

    result = await db.execute(
        select(Task).where(Task.file_path == str(file_path))
    )
    task = result.scalar_one_or_none()
    if task:
        raise HTTPException(status_code=400, detail="该文件正在被任务引用，请先删除相关任务")

    os.remove(file_path)
    return {"message": f"文件 {filename} 已删除"}
