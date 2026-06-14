import asyncio
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


async def _translate_single_async(subtitle, client: AsyncOpenAI, model: str, semaphore: asyncio.Semaphore) -> srt.Subtitle:
    """异步翻译单条字幕，使用 Semaphore 控制并发"""
    async with semaphore:
        try:
            completion = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "user", "content": f"Please translate the following English subtitles from a movie or video into Chinese and only provide the translated text: {subtitle.content}"},
                ],
                temperature=0.8,
                max_tokens=100,
            )
            translated_text = completion.choices[0].message.content
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


async def translate_subtitles_async(subtitles, client: AsyncOpenAI, model: str, concurrency: int = 3) -> list:
    """异步并发翻译字幕，保留逐条翻译的稳定性，通过 Semaphore 控制并发数"""
    semaphore = asyncio.Semaphore(concurrency)
    total = len(subtitles)
    logger.info(f"开始并发翻译 {total} 条字幕，并发数: {concurrency}")

    tasks = [
        _translate_single_async(sub, client, model, semaphore)
        for sub in subtitles
    ]
    results = await asyncio.gather(*tasks)

    logger.info(f"翻译完成: {total}/{total}")
    return list(results)