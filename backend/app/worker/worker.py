import os
import asyncio
import subprocess
from uuid import UUID

from whisper.utils import get_writer
from loguru import logger

from app.config import settings
from app.worker.whisper_runner import whisper_runner
from app.worker.translator import translator
from app.worker.yt_dlp_downloader import yt_dlp_downloader
from app.core.task_queue import task_queue
from app.core.storage import storage
from app.models.task import Task
from app.models.task_output import TaskOutput
from app.database import async_session_factory
from sqlalchemy import select, update


class Worker:
    """后台任务 Worker，顺序处理任务队列"""

    def __init__(self):
        self._running = False

    async def run(self):
        """Worker 主循环"""
        self._running = True
        logger.info("Worker 已启动，等待任务...")

        while self._running:
            try:
                async with async_session_factory() as db:
                    task = await task_queue.dequeue(db)
                    if task:
                        await db.commit()
                        await self._process_task(task)
                    else:
                        await db.commit()

                await asyncio.sleep(settings.WORKER_POLL_INTERVAL)
            except Exception as e:
                logger.error(f"Worker 循环异常: {e}")
                await asyncio.sleep(5)

    async def stop(self):
        self._running = False

    async def _process_task(self, task: Task):
        """处理单个任务"""
        task_id = task.id
        logger.info(f"开始处理任务: {task_id} ({task.title})")

        try:
            async with async_session_factory() as db:
                result = await db.execute(select(Task).where(Task.id == task_id))
                t = result.scalar_one()
                t.status = "processing"
                t.started_at = __import__("datetime").datetime.now().astimezone()
                await db.commit()

            # Step 1: 获取输入源 (0% → 10%)
            await self._update_progress(task_id, 0.05, "正在准备输入文件...")
            input_path = await self._get_input(task)

            # Step 2: 提取音频 (10% → 20%)
            await self._update_progress(task_id, 0.1, "正在提取音频...")
            audio_path = self._extract_audio(input_path, task_id)

            # Step 3: Whisper 转录 (20% → 60%)
            await self._update_progress(task_id, 0.2, "正在进行语音识别...")
            model = whisper_runner.get_model(task.whisper_model, settings.WHISPER_MODEL_DIR)
            result = model.transcribe(audio_path, language=None)

            # Step 4: 生成输出文件 (60% → 70%)
            await self._update_progress(task_id, 0.6, "正在生成输出文件...")
            output_files = await self._generate_outputs(result, task)

            # Step 5: 翻译 (70% → 95%)
            if task.translate_target_langs and len(task.translate_target_langs) > 0:
                await self._update_progress(task_id, 0.7, "正在进行翻译...")
                await self._translate_outputs(task, output_files)

            # Step 6: 清理临时文件
            self._cleanup_temp(task_id, audio_path)

            # 标记完成
            await self._complete_task(task_id)
            logger.success(f"任务完成: {task_id} ({task.title})")

        except Exception as e:
            logger.error(f"任务失败: {task_id}: {e}")
            await self._fail_task(task_id, str(e))

    async def _get_input(self, task: Task) -> str:
        """获取输入文件路径"""
        if task.source_type == "upload" and task.file_path:
            return task.file_path
        elif task.source_type == "url" and task.source_url:
            # yt-dlp 下载
            return await yt_dlp_downloader.download(task.source_url, storage.get_output_dir(task.id))

    def _extract_audio(self, video_path: str, task_id: UUID) -> str:
        """用 ffmpeg 提取音频"""
        output_dir = storage.get_output_dir(task_id)
        audio_path = os.path.join(output_dir, "audio.aac")

        command = [
            "ffmpeg", "-i", video_path,
            "-q:a", "0", "-map", "a",
            audio_path, "-y"
        ]
        subprocess.run(command, check=True, capture_output=True)
        return audio_path

    async def _generate_outputs(self, whisper_result: dict, task: Task) -> dict:
        """生成各种格式的输出文件"""
        from app.util import read_srt_file, write_srt_file

        output_dir = storage.get_output_dir(task.id)
        output_files = {}
        formats = task.output_formats or ["txt", "srt"]

        # 生成纯文本
        if "txt" in formats:
            txt_path = os.path.join(output_dir, "transcript.txt")
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(whisper_result["text"])
            output_files["txt"] = txt_path
            await self._save_output_record(task.id, "txt", None, txt_path)

        # 生成 SRT
        if "srt" in formats or "bilingual_srt" in formats:
            writer = get_writer("srt", output_dir)
            srt_path = os.path.join(output_dir, "subtitles.srt")
            writer(whisper_result, "subtitles.srt")
            output_files["srt"] = os.path.join(output_dir, "subtitles.srt")
            await self._save_output_record(task.id, "srt", None, os.path.join(output_dir, "subtitles.srt"))

        return output_files

    async def _translate_outputs(self, task: Task, output_files: dict):
        """翻译字幕到多种目标语言"""
        from app.services.config_service import get_config_value

        if "srt" not in output_files:
            return

        srt_path = output_files["srt"]

        async with async_session_factory() as db:
            base_url = await get_config_value(db, "llm_base_url", settings.LLM_BASE_URL)
            api_key = await get_config_value(db, "llm_api_key", settings.LLM_API_KEY)
            model = await get_config_value(db, "llm_model", settings.LLM_MODEL)

        # 将翻译 LLM 模型保存到任务记录
        async with async_session_factory() as db:
            await db.execute(
                update(Task)
                .where(Task.id == task.id)
                .values(translate_llm_model=model)
            )
            await db.commit()

        translated = await translator.translate_srt(srt_path, task.translate_target_langs, base_url, api_key, model)
        for lang, lang_path in translated.items():
            await self._save_output_record(task.id, "bilingual_srt", f"en-{lang}", lang_path)

    async def _save_output_record(self, task_id: UUID, format_type: str, language_pair: str | None, file_path: str):
        """保存输出文件记录到数据库"""
        from app.database import async_session_factory
        from app.models.task_output import TaskOutput

        async with async_session_factory() as db:
            file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
            output = TaskOutput(
                task_id=task_id,
                format_type=format_type,
                language_pair=language_pair,
                file_path=file_path,
                file_size=file_size,
            )
            db.add(output)
            await db.commit()

    def _cleanup_temp(self, task_id: UUID, audio_path: str):
        """清理临时文件"""
        if os.path.exists(audio_path):
            os.remove(audio_path)

    async def _update_progress(self, task_id: UUID, progress: float, message: str):
        """更新任务进度"""
        async with async_session_factory() as db:
            await db.execute(
                update(Task)
                .where(Task.id == task_id)
                .values(progress=progress, progress_message=message)
            )
            await db.commit()

    async def _complete_task(self, task_id: UUID):
        """标记任务完成"""
        import datetime
        async with async_session_factory() as db:
            await db.execute(
                update(Task)
                .where(Task.id == task_id)
                .values(
                    status="completed",
                    progress=1.0,
                    progress_message="任务完成",
                    completed_at=datetime.datetime.now().astimezone(),
                )
            )
            await db.commit()
            await task_queue.update_queue_positions(db)
            await task_queue.recalculate_avg_duration(db)
            await db.commit()

    async def _fail_task(self, task_id: UUID, error: str):
        """标记任务失败"""
        async with async_session_factory() as db:
            await db.execute(
                update(Task)
                .where(Task.id == task_id)
                .values(status="failed", error_message=error)
            )
            await db.commit()
            await task_queue.update_queue_positions(db)
            await db.commit()
