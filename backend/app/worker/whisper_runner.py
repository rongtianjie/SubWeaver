"""Whisper 转录封装（带模型缓存和实时进度）"""
import os
import sys
import threading

import whisper
import tqdm
from loguru import logger

# 访问 whisper.transcribe 的实际子模块（包 __init__.py 将其导出为函数，遮蔽了模块）
_wt_module = sys.modules['whisper.transcribe']


# 线程安全的进度存储
_transcribe_progress: dict[str, float] = {}
_progress_lock = threading.Lock()


class _ProgressTqdm(tqdm.tqdm):
    """替换 whisper 内部 tqdm，捕获逐帧进度并存入共享内存"""

    def __init__(self, *args, task_id=None, **kwargs):
        super().__init__(*args, **kwargs)
        self._task_id = task_id

    def update(self, n=1):
        super().update(n)
        if self._task_id and self.total and self.total > 0:
            with _progress_lock:
                _transcribe_progress[self._task_id] = self.n / self.total


def get_transcribe_progress(task_id: str) -> float | None:
    """获取某任务的语音识别进度比率 (0.0 ~ 1.0)，None 表示尚未开始"""
    with _progress_lock:
        return _transcribe_progress.get(task_id)


def clear_transcribe_progress(task_id: str):
    """清理进度记录"""
    with _progress_lock:
        _transcribe_progress.pop(task_id, None)


class WhisperRunner:
    """Whisper 模型管理，带缓存避免重复加载"""

    def __init__(self):
        self._model_cache: dict[str, whisper.Whisper] = {}
        self._cache_lock = threading.Lock()

    def _is_checksum_error(self, error: Exception) -> bool:
        """判断是否为 SHA256 校验错误"""
        return "SHA256 checksum" in str(error).lower()

    def _redownload_model(self, model_name: str, download_root: str | None) -> whisper.Whisper:
        """删除损坏的模型文件并重新下载"""
        model_path = os.path.join(download_root, f"{model_name}.pt") if download_root else f"{model_name}.pt"
        if os.path.exists(model_path):
            logger.warning(f"检测到损坏的模型文件 ({model_path})，正在删除并重新下载...")
            os.remove(model_path)
        logger.info(f"重新下载 Whisper 模型: {model_name}")
        return whisper.load_model(model_name, download_root=download_root)

    def get_model(self, model_name: str, download_root: str | None = None) -> whisper.Whisper:
        """获取模型（缓存已加载的模型），线程安全"""
        with self._cache_lock:
            if model_name not in self._model_cache:
                try:
                    logger.info(f"加载 Whisper 模型: {model_name}")
                    self._model_cache[model_name] = whisper.load_model(
                        model_name, download_root=download_root
                    )
                except Exception as e:
                    if self._is_checksum_error(e):
                        logger.warning(f"模型 {model_name} SHA256 校验失败，将自动删除并重新下载: {e}")
                        self._model_cache[model_name] = self._redownload_model(model_name, download_root)
                    else:
                        raise
            return self._model_cache[model_name]

    def transcribe(self, model_name: str, audio_path: str, download_root: str | None = None, **kwargs) -> dict:
        """转录音频文件（无进度回调）"""
        model = self.get_model(model_name, download_root)
        return model.transcribe(audio_path, **kwargs)

    def transcribe_with_progress(
        self, model_name: str, audio_path: str, task_id: str,
        download_root: str | None = None, **kwargs
    ) -> dict:
        """
        转录音频文件，同时将帧级进度写入共享内存供外部轮询。

        原理：whisper.transcribe 内部使用 ``tqdm.tqdm(total=content_frames, ...)``
        逐帧追踪进度。此处将 ``whisper.transcribe`` 模块中的 ``tqdm`` 替换为自定
        义的 ``_ProgressTqdm``，它在每次 ``update()`` 时将已完成比例写入线程安全
        的字典。调用方可通过 ``get_transcribe_progress(task_id)`` 实时读取。
        """
        model = self.get_model(model_name, download_root)

        original_tqdm = _wt_module.tqdm.tqdm
        try:
            _wt_module.tqdm.tqdm = lambda *args, **kw: _ProgressTqdm(
                *args, task_id=task_id, **kw
            )
            # verbose=False → 让 whisper 激活 tqdm 实例（默认 None 时 disable=True）
            return model.transcribe(audio_path, verbose=False, **kwargs)
        finally:
            _wt_module.tqdm.tqdm = original_tqdm


whisper_runner = WhisperRunner()
