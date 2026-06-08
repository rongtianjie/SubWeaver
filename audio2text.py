import whisper
import os
import tkinter as tk
from tkinter import filedialog


def select_file():
    root = tk.Tk()
    root.withdraw()  # 隐藏主窗口，只显示文件选择对话框
    file_path = filedialog.askopenfilename()  # 弹出文件选择对话框并获取选择的文件路径
    return file_path
    

def video_to_text(video_path):
    """
    将视频文件转换为文本并保存为txt文件
    :param video_path: 输入视频文件的路径
    """
    # 加载 whisper 模型，这里使用默认的 "small" 模型，你可以按需替换为其他模型如 "base", "medium", "large" 等
    model = whisper.load_model("small")
    # 先提取视频中的音频，保存为临时音频文件（你可以根据实际情况调整临时文件的处理逻辑等）
    audio_path = "temp_audio.wav"
    os.system(f'ffmpeg -i "{video_path}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "{audio_path}"')
    # 使用 whisper 模型对音频进行转录
    result = model.transcribe(audio_path)
    # 获取转录后的文本内容
    text = result["text"]
    # 删除临时音频文件
    os.remove(audio_path)
    return text

if __name__ == "__main__":
    video_file_path = select_file()  # 替换为你的视频文件实际路径
    if video_file_path:
        if video_file_path.endswith(".mp4") or video_file_path.endswith(".avi"):
            output_text_file_path = "output.txt"  # 输出的文本文件路径，可以按需更改
            text = video_to_text(video_file_path)
            # 将文本内容保存到指定的txt文件中
            with open(output_text_file_path, "w", encoding="utf-8") as f:
                f.write(text)
    