import whisper
from whisper.utils import get_writer
from openai import OpenAI
from util import *
import os 
import yt_dlp
import json
from loguru import logger


video_path = "https://www.youtube.com/watch?v=O2CIAKVTOrc"
# whisper_model_name = "base" 
whisper_model_name = "small" 

if video_path.startswith("https://") or video_path.startswith("http://"):
    # Download the video
    
    with yt_dlp.YoutubeDL({}) as ydl:
        info = ydl.extract_info(video_path, download=False)
        video_title = info.get('title', None).replace("：", ":").replace(" ", "")
        
    ydl_opts = {
        'postprocessors': [{
            'key': 'FFmpegVideoConvertor',
            'preferedformat': 'mp4',
        }],
        'outtmpl': f'{video_title}.%(ext)s',
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        logger.info(f"{video_title}.mp4")
        if os.path.exists(f"{video_title}.mp4"):
            logger.info(f"Video {video_title}.mp4 already exists.")
        else:
            logger.info(f"Downloading video {video_title}")
            ydl.download([video_path])
            
video_path = os.path.abspath(f"{video_title}.mp4")

client = OpenAI(base_url="http://localhost:1234/v1", api_key="lm-studio")

# Extract audio from video
audio_path = os.path.basename(video_path).replace(os.path.splitext(video_path)[1], ".aac")
video_to_audio(video_path, audio_path)

# Convert audio to text with Whisper and save as SRT
model = whisper.load_model(whisper_model_name, download_root="./models")
result = model.transcribe(audio_path, language=None, initial_prompt=None)
writer = get_writer("srt", ".")
en_srt_output = os.path.basename(video_path).replace(os.path.splitext(video_path)[1], "-en.srt")
writer(result, en_srt_output)

# Read the SRT file and translate the subtitles
output_srt_file = os.path.basename(video_path).replace(os.path.splitext(video_path)[1], "-enzh.srt")
subtitles = read_srt_file(en_srt_output)
translated_subtitles = translate_subtitles(subtitles, client)
write_srt_file(output_srt_file, translated_subtitles)
logger.success(f"Translation complete. Check the file {output_srt_file} for the result.")