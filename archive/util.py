import whisper
from whisper.utils import get_writer
from openai import OpenAI
import srt
from tqdm import tqdm 
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
        
def translate_to_chinese(text, client):
    completion = client.chat.completions.create(
            model="lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF",
            messages=[
                # {"role": "system", "content": "You are a professional translator. You translate a film script from English to Simplified Chinese. You will only reply the translated text."},
                {"role": "user", "content": f"Please translate the following English subtitles from a movie or video into Chinese and only provide the translated text: {text}"},
            ],
            temperature=0.8,
            max_tokens=100
        )
    return completion.choices[0].message.content

def translate_subtitles(subtitles, client):
    translated_subtitles = []
    for subtitle in tqdm(subtitles):
        english_text = subtitle.content
        chinese_translation = translate_to_chinese(english_text, client)
        # print(f"Translating: {english_text} -> {chinese_translation}")
        
        # Combine English and Chinese in the content
        combined_text = f"{english_text}\n{chinese_translation}"
        
        # Create a new subtitle object with combined text
        translated_subtitles.append(srt.Subtitle(index=subtitle.index,
                                                 start=subtitle.start,
                                                 end=subtitle.end,
                                                 content=combined_text))
    return translated_subtitles