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
                message=f"连接正常 | 配置模型 '{configured_model}' 可用 | 接口: {base_url}",
            )
        else:
            available = model_ids[:5]
            total_available = len(model_ids)
            return CheckResult(
                name="LLM 翻译接口",
                status=False,
                severity="warning",
                message=f"接口连通但模型 '{configured_model}' 未找到 (接口共 {total_available} 个模型)",
                guide=(
                    f"可用模型: {', '.join(available)}...\n"
                    f"请在系统配置中更新 llm_model，或修改环境变量 LLM_MODEL。\n"
                    f"当前配置: base_url={base_url}, model={configured_model}"
                ),
            )
    except Exception as e:
        # 提取错误类型
        error_type = type(e).__name__
        # 检查超时
        timeout_hint = ""
        if "timeout" in str(e).lower() or "timed out" in str(e).lower():
            timeout_hint = " (连接超时，请检查 LLM 服务是否正常运行)"
        elif "connection refused" in str(e).lower():
            timeout_hint = " (连接被拒绝，请确认 LLM 服务已启动并监听在正确端口)"
        elif "dns" in str(e).lower() or "name or service not known" in str(e).lower():
            timeout_hint = " (DNS 解析失败，请确认 base_url 地址正确)"
        elif "401" in str(e) or "unauthorized" in str(e).lower():
            timeout_hint = " (认证失败，请检查 API Key 是否正确)"

        return CheckResult(
            name="LLM 翻译接口",
            status=False,
            severity="warning",
            message=f"连接失败 [{error_type}]: {e}{timeout_hint} | 接口: {base_url}",
            guide=(
                "翻译功能将不可用（转录功能不受影响）。\n"
                "请检查 LLM 服务（如 Ollama、LM Studio、OpenAI API）是否已启动：\n"
                "  - LM Studio: 确保 Local Server 已启动并监听在对应端口\n"
                "  - Ollama: 运行 ollama serve\n"
                "  - 确认 base_url 配置正确\n"
                "配置路径: 管理员后台 -> 系统配置 -> LLM 配置，或修改环境变量"
            ),
        )
