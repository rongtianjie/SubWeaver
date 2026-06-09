"""
测试配置文件。
包含所有测试共享的 fixtures 和工具函数。
"""
from pathlib import Path

# 测试资源目录
TESTS_DIR = Path(__file__).parent
FIXTURES_DIR = TESTS_DIR / "fixtures"
