"""日志系统核心模块 - loguru 配置"""

import os
import sys
from loguru import logger

# 日志目录（与 storage 在同一个 volume 下）
LOG_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "storage",
    "logs",
)


def setup_logging():
    """初始化 loguru 日志系统"""
    os.makedirs(LOG_DIR, exist_ok=True)

    # 移除默认的 handler（避免重复）
    logger.remove()

    # Handler 1: 控制台输出到 stdout（供 docker logs）
    logger.add(
        sys.stdout,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss ZZ}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
            "<level>{message}</level>"
        ),
        level="DEBUG",
        enqueue=True,
        colorize=True,
    )

    # Handler 2: 按天轮转的 app.log（保留 30 天）
    logger.add(
        os.path.join(LOG_DIR, "app.log"),
        format="{time:YYYY-MM-DD HH:mm:ss ZZ} | {level: <8} | {name}:{function}:{line} - {message}",
        level="DEBUG",
        rotation="00:00",       # 每天零点轮转
        retention="30 days",    # 保留 30 天
        compression="gz",       # 轮转后压缩
        enqueue=True,
        encoding="utf-8",
    )

    # Handler 3: 仅 ERROR 级别的 error.log（按天轮转，保留 30 天）
    logger.add(
        os.path.join(LOG_DIR, "error.log"),
        format="{time:YYYY-MM-DD HH:mm:ss ZZ} | {level: <8} | {name}:{function}:{line} - {message}",
        level="ERROR",
        rotation="00:00",
        retention="30 days",
        compression="gz",
        enqueue=True,
        encoding="utf-8",
    )

    logger.info(f"日志系统初始化完成，日志目录: {LOG_DIR}")
    return logger
