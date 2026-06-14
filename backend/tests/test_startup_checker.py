"""
测试启动检查引擎。
"""

import pytest

from app.startup_checker.checker import CheckResult, StartupChecker


class TestCheckResult:
    """CheckResult Pydantic 模型测试"""

    def test_check_result_creation(self):
        result = CheckResult(
            name="测试检查",
            status=True,
            severity="info",
            message="一切正常",
            guide=None,
        )
        assert result.name == "测试检查"
        assert result.status is True
        assert result.guide is None

    def test_check_result_with_guide(self):
        result = CheckResult(
            name="数据库检查",
            status=False,
            severity="error",
            message="连接失败",
            guide="请启动 PostgreSQL",
        )
        assert result.guide == "请启动 PostgreSQL"


class TestStartupChecker:
    """StartupChecker 引擎测试"""

    @pytest.fixture
    def checker(self):
        return StartupChecker()

    @pytest.mark.asyncio
    async def test_empty_checks(self, checker):
        """没有注册任何检查项时"""
        results = await checker.run_all()
        assert results == []

    @pytest.mark.asyncio
    async def test_single_pass_check(self, checker):
        async def pass_check():
            return CheckResult(name="pass", status=True, severity="info", message="OK")

        checker.register("pass_check", pass_check)
        results = await checker.run_all()
        assert len(results) == 1
        assert results[0].status is True

    @pytest.mark.asyncio
    async def test_single_fail_check(self, checker):
        async def fail_check():
            return CheckResult(name="fail", status=False, severity="error", message="FAILED")

        checker.register("fail_check", fail_check)
        results = await checker.run_all()
        assert len(results) == 1
        assert results[0].status is False

    @pytest.mark.asyncio
    async def test_multiple_checks(self, checker):
        async def check_a():
            return CheckResult(name="A", status=True, severity="info", message="A OK")

        async def check_b():
            return CheckResult(name="B", status=False, severity="warning", message="B fail")

        checker.register("check_a", check_a)
        checker.register("check_b", check_b)
        results = await checker.run_all()

        assert len(results) == 2
        assert results[0].name == "A"
        assert results[1].name == "B"

    @pytest.mark.asyncio
    async def test_check_raises_exception(self, checker):
        async def broken_check():
            raise RuntimeError("意外错误")

        checker.register("broken", broken_check)
        results = await checker.run_all()

        assert len(results) == 1
        assert results[0].status is False
        assert results[0].severity == "error"
        assert "意外错误" in results[0].message

    def test_print_report_all_pass(self, checker):
        results = [
            CheckResult(name="DB", status=True, severity="info", message="OK"),
            CheckResult(name="FFmpeg", status=True, severity="info", message="OK"),
        ]
        ok = checker.print_report(results)
        assert ok is True

    def test_print_report_has_errors(self, checker):
        results = [
            CheckResult(name="DB", status=True, severity="info", message="OK"),
            CheckResult(name="FFmpeg", status=False, severity="error", message="Missing"),
        ]
        ok = checker.print_report(results)
        assert ok is False

    def test_print_report_has_warnings(self, checker):
        results = [
            CheckResult(name="LLM", status=False, severity="warning", message="Not available"),
        ]
        ok = checker.print_report(results)
        assert ok is True  # 仅有 warning 不算关键错误

    def test_print_report_has_error_with_guide(self, checker):
        """错误带解决指引时，报告应正常输出且不报错"""
        results = [
            CheckResult(
                name="DB", status=False, severity="error",
                message="Connection failed",
                guide="请启动 PostgreSQL\n  docker compose up -d db",
            ),
        ]
        ok = checker.print_report(results)
        assert ok is False  # 有关键错误
