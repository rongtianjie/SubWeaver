# Auto-subtitle-generator-based-on-whisper

基于 OpenAI Whisper 的自动化字幕生成工具，支持视频语音转文字、SRT 字幕生成及中英双语翻译。

## 功能概览

| 功能 | 说明 |
|------|------|
| 🎙️ **语音转文字** | 使用 Whisper 模型将视频/音频中的语音转录为文本 |
| 📄 **SRT 字幕生成** | 自动生成带时间轴的英文字幕文件（`.srt`） |
| 🌐 **YouTube 视频下载** | 支持通过 YouTube 链接自动下载视频 |
| 🇨🇳 **中英双语翻译** | 通过本地 LLM（LM Studio）将英文字幕逐条翻译为中文，生成双语字幕 |
| 📓 **交互式 Notebook** | 提供 Jupyter Notebook 便于交互式实验和调试 |

## 项目文件

| 文件 | 功能 |
|------|------|
| `audio2text.py` | 选择本地视频文件（mp4/avi），提取音频并用 Whisper 转录为纯文本，保存到 `output.txt` |
| `generate_srt.py` | 完整的字幕工作流：支持 YouTube 视频下载 → 提取音频 → Whisper 生成英文字幕 → LLM 翻译为中英双语字幕 |
| `generate_srt.ipynb` | Jupyter Notebook 版本，分步演示 Whisper 语音识别和字幕翻译流程 |
| `util.py` | 工具函数集合：视频转音频、SRT 文件读写、调用本地 LLM 进行文本翻译 |

## 工作流程

```
视频文件 / YouTube 链接
    ↓
ffmpeg 提取音频（.aac / .wav）
    ↓
Whisper 模型语音识别
    ↓
生成英文字幕（.srt）
    ↓
本地 LLM（LM Studio）逐条翻译
    ↓
输出中英双语字幕（-enzh.srt）
```

## 依赖

- [OpenAI Whisper](https://github.com/openai/whisper) — 语音识别模型
- [ffmpeg](https://ffmpeg.org/) — 音频/视频处理
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — YouTube 视频下载
- [LM Studio](https://lmstudio.ai/) — 本地运行 LLM 用于翻译（API 兼容 OpenAI）
- Python 包：`openai`, `srt`, `tqdm`, `loguru`

## 使用方式

### 纯文本转录
```bash
python audio2text.py
# 在弹出的文件对话框中选择视频文件，输出保存到 output.txt
```

### 生成双语字幕（YouTube 视频）
1. 确保 LM Studio 已在 `http://localhost:1234` 启动
2. 修改 `generate_srt.py` 中的 `video_path` 为目标 YouTube 链接
3. 运行：
```bash
python generate_srt.py
# 输出：{视频标题}-en.srt（英文）和 {视频标题}-enzh.srt（双语）
```

### 使用 Notebook

打开 `generate_srt.ipynb`，按单元格逐步执行 Whisper 转录和字幕翻译。