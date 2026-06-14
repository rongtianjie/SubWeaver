"""
测试工具函数。
"""

from unittest.mock import MagicMock, patch

import pytest

from app.util import video_to_audio, read_srt_file, write_srt_file, translate_to_chinese, translate_subtitles


class TestVideoToAudio:
    """视频转音频测试"""

    @patch("app.util.subprocess.run")
    def test_video_to_audio_success(self, mock_run):
        """正常转换"""
        video_to_audio("input.mp4", "output.mp3")
        mock_run.assert_called_once_with(
            ["ffmpeg", "-i", "input.mp4", "-q:a", "0", "-map", "a", "output.mp3", "-y"],
            check=True,
        )

    @patch("app.util.subprocess.run", side_effect=FileNotFoundError)
    def test_video_to_audio_ffmpeg_missing(self, mock_run):
        """ffmpeg 未安装时应抛出异常"""
        with pytest.raises(FileNotFoundError):
            video_to_audio("input.mp4", "output.mp3")


class TestSRTFile:
    """SRT 文件读写测试"""

    def test_read_and_write_srt(self, tmp_path):
        """读写 SRT 文件"""
        sample_srt = """1
00:00:01,000 --> 00:00:04,000
Hello world

"""
        srt_file = tmp_path / "test.srt"
        srt_file.write_text(sample_srt, encoding="utf-8")

        subtitles = read_srt_file(str(srt_file))
        assert len(subtitles) == 1
        assert subtitles[0].content == "Hello world"

        # 写回
        output_file = tmp_path / "output.srt"
        write_srt_file(str(output_file), subtitles)
        assert output_file.exists()
        assert "Hello world" in output_file.read_text(encoding="utf-8")


class TestTranslation:
    """翻译功能测试"""

    @patch("app.util.OpenAI")
    def test_translate_to_chinese(self, mock_openai):
        """翻译文本到中文"""
        mock_client = MagicMock()
        mock_openai.return_value = mock_client
        mock_completion = MagicMock()
        mock_completion.choices[0].message.content = "你好世界"
        mock_client.chat.completions.create.return_value = mock_completion

        result = translate_to_chinese("Hello world", mock_client, "test-model")
        assert result == "你好世界"

    @patch("app.util.OpenAI")
    def test_translate_subtitles(self, mock_openai):
        """翻译字幕列表"""
        mock_client = MagicMock()
        mock_openai.return_value = mock_client
        mock_completion = MagicMock()
        mock_completion.choices[0].message.content = "你好世界"
        mock_client.chat.completions.create.return_value = mock_completion

        from datetime import timedelta
        import srt

        subtitles = [
            srt.Subtitle(index=1, start=timedelta(seconds=1), end=timedelta(seconds=4), content="Hello world"),
        ]

        translated = translate_subtitles(subtitles, mock_client, "test-model")
        assert len(translated) == 1
        assert "Hello world" in translated[0].content
        assert "你好世界" in translated[0].content
