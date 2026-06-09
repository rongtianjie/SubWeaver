import os

from app.config import settings
from app.startup_checker.checker import CheckResult


async def check_whisper_model() -> CheckResult:
    """检查 Whisper 模型文件是否存在，缺失时引导下载"""
    download_root = settings.WHISPER_MODEL_DIR
    os.makedirs(download_root, exist_ok=True)

    models_to_check = ["tiny", "base", "small", "medium", "large"]
    # Whisper 模型文件命名规则：{name}.pt
    available = []
    missing = []

    for model_name in models_to_check:
        model_path = os.path.join(download_root, f"{model_name}.pt")
        if os.path.exists(model_path):
            size_mb = os.path.getsize(model_path) / (1024 * 1024)
            available.append(f"{model_name} ({size_mb:.0f}MB)")
        else:
            missing.append(model_name)

    if not missing:
        return CheckResult(
            name="Whisper 模型",
            status=True,
            severity="info",
            message=f"可用模型: {', '.join(available)}",
        )

    guide_lines = [
        "以下模型缺失，可通过以下方式下载：",
    ]
    for m in missing:
        guide_lines.append(f"  python -c \"import whisper; whisper.load_model('{m}', download_root='{download_root}')\"")
    guide_lines.append("建议至少下载 'base' 或 'small' 模型。")

    return CheckResult(
        name="Whisper 模型",
        status=len(available) > 0,  # 只要有可用模型就算通过
        severity="warning" if len(available) > 0 else "error",
        message=f"可用: {', '.join(available) if available else '无'} | 缺失: {', '.join(missing)}",
        guide="\n".join(guide_lines),
    )
