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
        # 计算统计
        total = len(results)
        passed = sum(1 for r in results if r.status)
        failed = sum(1 for r in results if not r.status and r.severity == "error")
        warnings = sum(1 for r in results if not r.status and r.severity == "warning")

        logger.info("=" * 60)
        logger.info(f"  系统环境检查报告 (共 {total} 项)")
        logger.info("=" * 60)

        for r in results:
            if r.status:
                logger.info(f"  [PASS] {r.name} - {r.message}")
            else:
                if r.severity == "error":
                    logger.error(f"  [FAIL] {r.name} - {r.message}")
                elif r.severity == "warning":
                    logger.warning(f"  [WARN] {r.name} - {r.message}")
                else:
                    logger.info(f"  [INFO] {r.name} - {r.message}")

                if r.guide:
                    logger.info(f"  {'':>8}└─ 解决建议:")
                    for line in r.guide.strip().split("\n"):
                        logger.info(f"  {'':>10}{line}")

        logger.info("=" * 60)
        summary_parts = []
        if passed > 0:
            summary_parts.append(f"通过: {passed}")
        if warnings > 0:
            summary_parts.append(f"警告: {warnings}")
        if failed > 0:
            summary_parts.append(f"失败: {failed}")
        logger.info(f"  检查结果摘要: {' | '.join(summary_parts)}")
        logger.info("=" * 60)

        if failed > 0:
            logger.error("  存在关键错误，部分功能不可用，请修复后重启服务")
            logger.info("=" * 60)
        elif warnings > 0:
            logger.warning("  所有核心功能检查通过，存在非关键警告，建议查看")
            logger.info("=" * 60)
        else:
            logger.info("  所有检查通过！系统可正常运行")
            logger.info("=" * 60)

        return failed == 0


# 全局单例
checker = StartupChecker()
