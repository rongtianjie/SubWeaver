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
        print("\n" + "=" * 60)
        print("    系统环境检查报告")
        print("=" * 60)

        has_errors = False
        has_warnings = False

        for r in results:
            icon = "✅" if r.status else "❌"
            sev_icon = {"error": "🔴", "warning": "🟡", "info": "ℹ️"}.get(r.severity, "ℹ️")
            print(f"  {icon} {sev_icon} {r.name}")
            print(f"     {r.message}")
            if not r.status and r.guide:
                print(f"     📋 解决指引:")
                for line in r.guide.strip().split("\n"):
                    print(f"       {line}")
            print()

            if r.severity == "error" and not r.status:
                has_errors = True
            if r.severity == "warning" and not r.status:
                has_warnings = True

        print("=" * 60)
        if has_errors:
            print("  ❌ 存在关键错误，部分功能不可用")
        if has_warnings:
            print("  ⚠️  存在警告，建议检查")
        if not has_errors and not has_warnings:
            print("  ✅ 所有检查通过！")
        print("=" * 60 + "\n")

        return not has_errors


# 全局单例
checker = StartupChecker()
