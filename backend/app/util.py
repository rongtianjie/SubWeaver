import asyncio
import re
import whisper
from whisper.utils import get_writer
from openai import OpenAI, AsyncOpenAI
import srt
from loguru import logger
import subprocess


def video_to_audio(video_path, audio_path):
    """使用 ffmpeg 将视频文件转换为音频文件"""
    command = ["ffmpeg", "-i", video_path, "-q:a", "0", "-map", "a", audio_path, "-y"]
    subprocess.run(command, check=True)

def read_srt_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()
    return list(srt.parse(content))

def write_srt_file(file_path, subtitles):
    with open(file_path, 'w', encoding='utf-8') as file:
        file.write(srt.compose(subtitles))
        
def translate_to_chinese(text, client, model):
    completion = client.chat.completions.create(
            model=model,
            messages=[
                # {"role": "system", "content": "You are a professional translator. You translate a film script from English to Simplified Chinese. You will only reply the translated text."},
                {"role": "user", "content": f"Please translate the following English subtitles from a movie or video into Chinese and only provide the translated text: {text}"},
            ],
            temperature=0.8,
            max_tokens=100
        )
    return completion.choices[0].message.content

def translate_subtitles(subtitles, client, model):
    translated_subtitles = []
    total = len(subtitles)
    for i, subtitle in enumerate(subtitles):
        if i > 0 and i % 10 == 0:
            logger.info(f"翻译进度: {i}/{total}")
        english_text = subtitle.content
        chinese_translation = translate_to_chinese(english_text, client, model)
        # print(f"Translating: {english_text} -> {chinese_translation}")
        
        # Combine English and Chinese in the content
        combined_text = f"{english_text}\n{chinese_translation}"
        
        # Create a new subtitle object with combined text
        translated_subtitles.append(srt.Subtitle(index=subtitle.index,
                                                 start=subtitle.start,
                                                 end=subtitle.end,
                                                 content=combined_text))
    return translated_subtitles


LANG_NAME_MAP = {
    "zh": "Simplified Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "ru": "Russian",
    "pt": "Portuguese",
    "ar": "Arabic",
    "th": "Thai",
    "vi": "Vietnamese",
}

# 源语言名称映射（Whisper 检测到的语言代码 → 可读名称，prompt 中会拼接）
SOURCE_LANG_NAME_MAP = {
    "en": "English",
    "ja": "Japanese",
    "zh": "Chinese",
    "ko": "Korean",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "ru": "Russian",
    "pt": "Portuguese",
    "ar": "Arabic",
    "th": "Thai",
    "vi": "Vietnamese",
    "it": "Italian",
    "nl": "Dutch",
    "pl": "Polish",
    "tr": "Turkish",
    "id": "Indonesian",
}


# 思考/推理过程标识模式列表，匹配任一即视为思考行
_THINKING_PATTERNS = [
    re.compile(r"^(Thinking\s*Process|思考过程)[：:]", re.MULTILINE),
    re.compile(r"^\d+[\.、]\s+\*\*", re.MULTILINE),          # "1.  **Analyze..."
    re.compile(r"^\s*\*\s+\*\*", re.MULTILINE),               # "* **Analyze..."
    re.compile(r"^\s*\*{2}(Analyze|Determine|Consider|Translate|Check|Verify|Review|Identify|Evaluate|Break\s*down|Plan|Step|Reason|Reflect|思考|分析|解析|评估|确定|检查|验证)\b", re.MULTILINE),
    re.compile(r"^(\d+[\.、]\s+)?(Let me|First,|Second,|Next,|Finally,|Here[’']s|I['']ll|I need to|I should|I can|The (user|input|text|task|request|constraint|meaning|translation))\b", re.MULTILINE | re.IGNORECASE),
    re.compile(r"^\s*\*\s+(Source|Target|Input|Output|Task|Role|Context|Meaning|Breakdown|Language|Script|Grammar)\b", re.MULTILINE),
]


def _is_thinking_line(stripped: str) -> bool:
    """判断一行文本是否属于思考/推理过程"""
    if not stripped:
        return False
    return any(p.search(stripped) for p in _THINKING_PATTERNS)


def _clean_thinking_content(text: str) -> str:
    """
    过滤 LLM 返回内容中的思考/推理过程，仅保留实际翻译结果。
    
    作为 extra_body 禁用思考模式的兜底方案，处理以下常见格式：
    - <think>...</think> 标签
    - Thinking Process: / 思考过程： 标题及后续分析段落
    - 编号的结构化分析步骤
    - 元数据 bullet point 分析行
    """
    if not text:
        return text

    # 1. 移除 <think> 标签及其内容（Qwen、DeepSeek 等模型的思考格式）
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)

    # 2. 逐行过滤
    lines = cleaned.split("\n")
    result_lines = []
    in_thinking = False

    for line in lines:
        stripped = line.strip()

        if _is_thinking_line(stripped):
            in_thinking = True
            continue

        if in_thinking:
            # 空行或缩进的辅助内容，继续跳过
            if not stripped or stripped.startswith(("* ", "- ", "  ", "\t")):
                continue
            # 遇到非思考内容，退出思考区域并保留此行
            in_thinking = False
            result_lines.append(line)
        else:
            result_lines.append(line)

    # 3. 再次扫描：移除残留的纯分析行（可能在非连续区域）
    final_lines = []
    for line in result_lines:
        stripped = line.strip()
        if _is_thinking_line(stripped):
            continue
        if stripped.startswith(("* ", "- ")) and any(kw in stripped for kw in ("Analyze", "分析", "思考", "Input", "Output", "Task", "Role")):
            continue
        final_lines.append(line)

    result = "\n".join(final_lines).strip()
    # 如果过滤后为空，说明 LLM 只输出了思考内容，回退使用原文
    return result if result else text


async def _translate_single_async(subtitle, client: AsyncOpenAI, model: str, semaphore: asyncio.Semaphore, target_lang: str = "zh", source_lang: str = "en") -> srt.Subtitle:
    """异步翻译单条字幕，使用 Semaphore 控制并发"""
    target_name = LANG_NAME_MAP.get(target_lang, target_lang)
    source_name = SOURCE_LANG_NAME_MAP.get(source_lang, source_lang.capitalize() if len(source_lang) <= 3 else source_lang)
    async with semaphore:
        try:
            completion = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": f"You are a professional translator. You translate subtitles from a movie or video from {source_name} to {target_name}. You will only reply the translated text."},
                    {"role": "user", "content": f"Please translate the following {source_name} subtitle text into {target_name}: {subtitle.content}"},
                ],
                temperature=0.8,
                max_tokens=256,
                extra_body={"chat_template_kwargs": {"enable_thinking": False}},
            )
            translated_text = _clean_thinking_content(completion.choices[0].message.content)
        except Exception as e:
            logger.warning(f"翻译单条字幕失败 (index={subtitle.index}): {e}，保留原文")
            translated_text = subtitle.content

        combined_text = f"{subtitle.content}\n{translated_text}"
        return srt.Subtitle(
            index=subtitle.index,
            start=subtitle.start,
            end=subtitle.end,
            content=combined_text,
        )


async def translate_subtitles_async(subtitles, client: AsyncOpenAI, model: str, concurrency: int = 3, target_lang: str = "zh", source_lang: str = "en") -> list:
    """异步并发翻译字幕，保留逐条翻译的稳定性，通过 Semaphore 控制并发数"""
    semaphore = asyncio.Semaphore(concurrency)
    total = len(subtitles)
    target_name = LANG_NAME_MAP.get(target_lang, target_lang)
    source_name = SOURCE_LANG_NAME_MAP.get(source_lang, source_lang.capitalize() if len(source_lang) <= 3 else source_lang)
    logger.info(f"开始并发翻译 {total} 条字幕从 {source_name} 到 {target_name}，并发数: {concurrency}")

    tasks = [
        _translate_single_async(sub, client, model, semaphore, target_lang=target_lang, source_lang=source_lang)
        for sub in subtitles
    ]
    results = await asyncio.gather(*tasks)

    logger.info(f"翻译完成: {total}/{total}")
    return list(results)