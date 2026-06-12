"""Whisper 模型管理：列表查询、下载（异步后台）、删除"""
import os
import asyncio
import threading
from dataclasses import dataclass
from typing import Optional

from app.config import settings

# 预定义模型列表
AVAILABLE_MODELS = [
    {"name": "tiny", "label": "Tiny", "size_mb": 149, "description": "最快, 准确度最低"},
    {"name": "base", "label": "Base", "size_mb": 291, "description": "快速"},
    {"name": "small", "label": "Small", "size_mb": 967, "description": "推荐, 平衡速度与准确度"},
    {"name": "medium", "label": "Medium", "size_mb": 3073, "description": "较慢, 更准确"},
    {"name": "large", "label": "Large", "size_mb": 6187, "description": "最慢, 最准确"},
]


@dataclass
class DownloadTask:
    model_name: str
    status: str = "idle"  # idle | downloading | completed | error
    progress: float = 0.0  # 0~100
    error_message: Optional[str] = None


class ModelManager:
    """模型管理器，跟踪下载状态"""

    def __init__(self):
        self._downloads: dict[str, DownloadTask] = {}
        self._lock = threading.Lock()

    def get_download_task(self, model_name: str) -> Optional[DownloadTask]:
        with self._lock:
            return self._downloads.get(model_name)

    def list_model_status(self) -> list[dict]:
        """列出所有模型及其下载状态"""
        download_root = settings.WHISPER_MODEL_DIR
        os.makedirs(download_root, exist_ok=True)

        results = []
        for model in AVAILABLE_MODELS:
            name = model["name"]
            model_path = os.path.join(download_root, f"{name}.pt")
            is_downloaded = os.path.exists(model_path)

            dl_task = self.get_download_task(name)

            results.append({
                "name": name,
                "label": model["label"],
                "description": model["description"],
                "size_mb": model["size_mb"],
                "is_downloaded": is_downloaded,
                "download": {
                    "status": dl_task.status if dl_task else ("completed" if is_downloaded else "idle"),
                    "progress": dl_task.progress if dl_task else (100.0 if is_downloaded else 0.0),
                    "error_message": dl_task.error_message if dl_task else None,
                },
            })
        return results

    async def download_model(self, model_name: str) -> None:
        """后台下载模型（异步非阻塞）"""
        with self._lock:
            existing = self._downloads.get(model_name)
            if existing and existing.status == "downloading":
                raise ValueError(f"模型 {model_name} 正在下载中")

            task = DownloadTask(model_name=model_name, status="downloading", progress=0.0)
            self._downloads[model_name] = task

        # 在后台线程中执行下载
        def _do_download():
            try:
                import whisper
                download_root = settings.WHISPER_MODEL_DIR
                os.makedirs(download_root, exist_ok=True)

                whisper._download(whisper._MODELS[model_name], download_root, None)

                with self._lock:
                    if model_name in self._downloads:
                        self._downloads[model_name].status = "completed"
                        self._downloads[model_name].progress = 100.0
            except Exception as e:
                with self._lock:
                    if model_name in self._downloads:
                        self._downloads[model_name].status = "error"
                        self._downloads[model_name].error_message = str(e)

        thread = threading.Thread(target=_do_download, daemon=True)
        thread.start()

        # 轮询直到完成
        while True:
            await asyncio.sleep(0.5)
            with self._lock:
                task = self._downloads.get(model_name)
                if task and task.status in ("completed", "error"):
                    if task.status == "error":
                        raise ValueError(task.error_message)
                    return

    def delete_all_models(self) -> int:
        """删除所有已下载的 Whisper 模型文件，返回删除的文件数"""
        download_root = settings.WHISPER_MODEL_DIR
        if not os.path.exists(download_root):
            return 0

        deleted = 0
        for model in AVAILABLE_MODELS:
            model_path = os.path.join(download_root, f"{model['name']}.pt")
            if os.path.exists(model_path):
                try:
                    os.remove(model_path)
                    deleted += 1
                except OSError:
                    pass

        # 清理下载记录
        with self._lock:
            for model in AVAILABLE_MODELS:
                name = model["name"]
                if name in self._downloads:
                    del self._downloads[name]

        return deleted


# 全局单例
model_manager = ModelManager()
