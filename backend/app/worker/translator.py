"""LLM 翻译封装（OpenAI 兼容接口）"""
from openai import OpenAI
from loguru import logger


class Translator:
    """翻译服务，通过 OpenAI 兼容 API 翻译字幕"""

    async def translate_srt(self, srt_path: str, target_langs: list[str],
                            base_url: str, api_key: str, model: str) -> dict[str, str]:
        """翻译 SRT 文件到多个目标语言，返回 {lang: output_path}"""
        from app.util import read_srt_file, write_srt_file, translate_subtitles
        import os

        client = OpenAI(base_url=base_url, api_key=api_key)
        subtitles = read_srt_file(srt_path)

        results = {}
        for lang in target_langs:
            logger.info(f"翻译字幕到 {lang}...")
            translated = translate_subtitles(subtitles, client, model)
            output_dir = os.path.dirname(srt_path)
            lang_path = os.path.join(output_dir, f"subtitles_{lang}.srt")
            write_srt_file(lang_path, translated)
            results[lang] = lang_path

        return results


translator = Translator()
