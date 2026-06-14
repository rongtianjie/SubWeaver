"""Whisper 模型管理 API"""
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import require_admin
from app.models.user import User
from app.worker.model_manager import model_manager, AVAILABLE_MODELS

router = APIRouter(prefix="/models", tags=["模型管理"])


@router.get("")
async def list_models():
    """列出所有 Whisper 模型及其下载状态"""
    return {"models": model_manager.list_model_status()}


@router.post("/{model_name}/download")
async def download_model(model_name: str, admin: User = Depends(require_admin)):
    """下载指定 Whisper 模型"""
    if model_name not in {m["name"] for m in AVAILABLE_MODELS}:
        raise HTTPException(
            status_code=400,
            detail=f"未知模型: {model_name}，可选: {', '.join(m['name'] for m in AVAILABLE_MODELS)}",
        )

    try:
        await model_manager.download_model(model_name)
        return {"message": f"模型 {model_name} 下载完成"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("")
async def delete_all_models(admin: User = Depends(require_admin)):
    """删除所有已下载的 Whisper 模型"""
    deleted = model_manager.delete_all_models()
    return {"message": f"已删除 {deleted} 个模型文件", "deleted": deleted}
