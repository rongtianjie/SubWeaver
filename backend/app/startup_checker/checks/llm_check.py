from openai import OpenAI

from app.config import settings
from app.startup_checker.checker import CheckResult


LANGUAGE_MAP = {
    "zh": "中文", "ja": "日语", "ko": "韩语", "fr": "法语",
    "de": "德语", "es": "西班牙语", "ru": "俄语", "pt": "葡萄牙语",
    "ar": "阿拉伯语", "th": "泰语", "vi": "越南语",
}


async def check_llm_connection() -> CheckResult:
    """检查 OpenAI 兼容的 LLM 接口是否可连通"""
    base_url = settings.LLM_BASE_URL
    api_key = settings.LLM_API_KEY
    configured_model = settings.LLM_MODEL

    try:
        client = OpenAI(base_url=base_url, api_key=api_key, timeout=10)
        models = client.models.list()
        model_ids = [m.id for m in models]

        if configured_model in model_ids:
            return CheckResult(
                name="LLM 翻译接口",
                status=True,
                severity="info",
                message=f"API 可连通，模型 '{configured_model}' 可用 (base_url: {base_url})",
            )
        else:
            available = model_ids[:5]
            return CheckResult(
                name="LLM 翻译接口",
                status=False,
                severity="warning",
                message=f"API 可连通但未找到配置模型 '{configured_model}'",
                guide=(
                    f"可用模型: {', '.join(available)}...\n"
                    f"请在系统配置中更新 llm_model，或修改环境变量 LLM_MODEL。\n"
                    f"当前配置: base_url={base_url}, model={configured_model}"
                ),
            )
    except Exception as e:
        return CheckResult(
            name="LLM 翻译接口",
            status=False,
            severity="warning",
            message=f"LLM API 连接失败: {e} (base_url: {base_url})",
            guide=(
                "翻译功能将不可用（转录功能不受影响）。\n"
                "请检查 LLM 服务（如 Ollama、LM Studio、OpenAI API）是否已启动：\n"
                "  - LM Studio: 确保 Local Server 已启动并监听在对应端口\n"
                "  - Ollama: 运行 ollama serve\n"
                "  - 确认 base_url 配置正确\n"
                "配置路径: 管理员后台 -> 系统配置 -> LLM 配置，或修改环境变量"
            ),
        )
