from loguru import logger
from pydantic import BaseModel


class CheckResult(BaseModel):
    name: str
    status: bool
    severity: str  # "error" | "warning" | "info"
    message: str
    guide: str | None = None


class StartupChecker:
    """启动检查引擎，注册并执行所有检查项"""

    def __init__(self):
        self.checks: list[tuple[str, callable]] = []

    def register(self, name: str, check_fn):
        self.checks.append((name, check_fn))

    async def run_all(self) -> list[CheckResult]:
        results = []
        for name, check_fn in self.checks:
            try:
                if check_fn.__class__.__name__ == "coroutine":
                    result = await check_fn()
                else:
                    result = await check_fn()
            except Exception as e:
                result = CheckResult(
                    name=name,
                    status=False,
                    severity="error",
                    message=str(e),
                )
            results.append(result)
        return results

    def print_report(self, results: list[CheckResult]):
        """打印检查报告到控制台"""
        logger.info("系统环境检查报告")
        logger.info("=" * 60)

        has_errors = False
        has_warnings = False

        for r in results:
            if r.status:
                logger.info(f"[PASS] {r.name} - {r.message}")
            else:
                if r.severity == "error":
                    logger.error(f"[FAIL] {r.name} - {r.message}")
                elif r.severity == "warning":
                    logger.warning(f"[WARN] {r.name} - {r.message}")
                else:
                    logger.info(f"[INFO] {r.name} - {r.message}")

                if r.guide:
                    for line in r.guide.strip().split("\n"):
                        logger.info(f"  -> {line}")

            if r.severity == "error" and not r.status:
                has_errors = True
            if r.severity == "warning" and not r.status:
                has_warnings = True

        logger.info("=" * 60)
        if has_errors:
            logger.error("存在关键错误，部分功能不可用")
        if has_warnings:
            logger.warning("存在警告，建议检查")
        if not has_errors and not has_warnings:
            logger.info("所有检查通过！")
        logger.info("=" * 60)

        return not has_errors


# 全局单例
checker = StartupChecker()
