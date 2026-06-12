import subprocess

from app.startup_checker.checker import CheckResult


async def check_ffmpeg() -> CheckResult:
    """检查 ffmpeg 系统依赖"""
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True, text=True, timeout=5
        )
        version_line = result.stdout.split("\n")[0] if result.stdout else "unknown"

        # 提取 ffmpeg 编译信息
        config_line = ""
        for line in result.stdout.split("\n"):
            if "configuration:" in line:
                config_line = line.strip()
                break

        # 简单统计关键编译特性
        features = []
        if config_line:
            if "--enable-libx264" in config_line:
                features.append("H.264")
            if "--enable-libx265" in config_line:
                features.append("H.265")
            if "--enable-libopus" in config_line:
                features.append("Opus")
            if "--enable-libmp3lame" in config_line:
                features.append("MP3")
            if "--enable-libfdk-aac" in config_line or "--enable-libaom" in config_line:
                features.append("AAC")

        detail = f" | 编码: {', '.join(features)}" if features else ""
        return CheckResult(
            name="ffmpeg",
            status=True,
            severity="info",
            message=f"已安装: {version_line}{detail}",
        )
    except FileNotFoundError:
        return CheckResult(
            name="ffmpeg",
            status=False,
            severity="error",
            message="ffmpeg 未安装或不在 PATH 中",
            guide=(
                "请安装 ffmpeg：\n"
                "  macOS: brew install ffmpeg\n"
                "  Ubuntu/Debian: sudo apt install ffmpeg\n"
                "  Docker: 确保 Dockerfile 中包含 ffmpeg 安装步骤"
            ),
        )
    except Exception as e:
        return CheckResult(
            name="ffmpeg",
            status=False,
            severity="error",
            message=f"ffmpeg 检查异常: {e}",
        )
