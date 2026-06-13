"""Whisper 转录封装（带模型缓存）"""
import os

import whisper
from loguru import logger


class WhisperRunner:
    """Whisper 模型管理，带缓存避免重复加载"""

    def __init__(self):
        self._model_cache: dict[str, whisper.Whisper] = {}

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
        """获取模型（缓存已加载的模型），遇到 SHA256 校验错误时自动重下载"""
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
        """转录音频文件"""
        model = self.get_model(model_name, download_root)
        return model.transcribe(audio_path, **kwargs)


whisper_runner = WhisperRunner()
