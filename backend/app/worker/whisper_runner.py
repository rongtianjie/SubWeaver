"""Whisper 转录封装（带模型缓存）"""
import whisper
from loguru import logger


class WhisperRunner:
    """Whisper 模型管理，带缓存避免重复加载"""

    def __init__(self):
        self._model_cache: dict[str, whisper.Whisper] = {}

    def get_model(self, model_name: str, download_root: str | None = None) -> whisper.Whisper:
        """获取模型（缓存已加载的模型）"""
        if model_name not in self._model_cache:
            logger.info(f"加载 Whisper 模型: {model_name}")
            self._model_cache[model_name] = whisper.load_model(
                model_name, download_root=download_root
            )
        return self._model_cache[model_name]

    def transcribe(self, model_name: str, audio_path: str, download_root: str | None = None, **kwargs) -> dict:
        """转录音频文件"""
        model = self.get_model(model_name, download_root)
        return model.transcribe(audio_path, **kwargs)


whisper_runner = WhisperRunner()
