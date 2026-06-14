"""yt-dlp 下载封装"""
import os
import asyncio
import yt_dlp
from loguru import logger


class YtDlpDownloader:
    """在线视频下载封装"""

    async def download(self, url: str, output_dir: str) -> str:
        """下载在线视频，返回本地文件路径"""
        logger.info(f"下载在线视频: {url}")

        ydl_opts = {
            "outtmpl": os.path.join(output_dir, "%(title)s.%(ext)s"),
            "format": "bestvideo+bestaudio/best",
            "merge_output_format": "mp4",
        }

        def _download_sync():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                video_title = info.get("title", "video").replace("/", "_")
                ext = "mp4"
                return os.path.join(output_dir, f"{video_title}.{ext}")

        # 同步 yt-dlp 调用放在线程池中，避免阻塞事件循环
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _download_sync)


yt_dlp_downloader = YtDlpDownloader()
