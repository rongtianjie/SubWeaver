# 纯 Docker 化改造 + 日志系统

## 背景与目标

将项目从"原生部署 + Docker 可选"转变为**仅支持 Docker Compose 部署**，彻底移除所有 CLI 交互和终端提示，同时保留 stdout 日志供 `docker logs` 查看。新增持久化日志系统和 Web 端管理员日志查看功能（支持历史查看和实时流式推送）。

## 涉及文件

### 新增文件（3 个）
- `backend/app/core/logging.py` - loguru 日志配置（控制台 + 文件双输出）
- `backend/docker-entrypoint.sh` - Docker 入口脚本（执行迁移 → 启动服务）

### 修改文件（9 个）
- `backend/app/startup_checker/checker.py` - `print_report()` 改为 loguru logger
- `backend/app/util.py` - 移除 tqdm，替换为 logger 输出
- `backend/app/main.py` - lifespan 开头调用 `setup_logging()`
- `backend/requirements.txt` - 移除 tqdm 依赖
- `backend/Dockerfile` - CMD → ENTRYPOINT，添加 entrypoint 脚本
- `backend/app/schemas/admin.py` - 新增 `LogFileInfo`, `LogContent` Schema
- `backend/app/api/v1/admin.py` - 新增 3 个日志路由（列表/查看/SSE）
- `frontend/src/lib/api.ts` - 新增日志相关 API 方法
- `frontend/src/types/index.ts` - 新增日志相关 TS 类型
- `frontend/src/pages/Admin.tsx` - 新增"系统日志"标签页 + LogViewer 组件

### 删除文件（6 个）
- `archive/`（整个目录）- 旧 CLI 脚本
- `backend/util.py` - `app/util.py` 的残留副本

## 实施步骤

### Step 1: 清理 archive 目录 + 删除重复的 backend/util.py

删除不再需要的旧 CLI 脚本和残留文件。

### Step 2: 移除 tqdm

`backend/app/util.py` 中将 `from tqdm import tqdm` 替换为 `from loguru import logger`，`for ... in tqdm(...)` 改为 `for ... in ...` 并每隔 10 条输出一次 `logger.info` 进度。`backend/requirements.txt` 中移除 `tqdm>=4.67.0`。

### Step 3: print_report() 改为 loguru

`backend/app/startup_checker/checker.py` 中 `print_report()` 所有 `print()` 替换为 `logger.info/warning/error`，保留方法签名和返回值。

### Step 4: 创建 logging.py 核心日志模块

新建 `backend/app/core/logging.py`，配置 loguru：
- **Handler 1** → stdout（供 Docker logs，带颜色）
- **Handler 2** → `/app/storage/logs/app.log`，每天零点轮转，保留 30 天，压缩 gz
- **Handler 3** → `/app/storage/logs/error.log`，仅 ERROR 级别，同样轮转策略

### Step 5: main.py 中初始化日志

在 `lifespan` 函数最开头调用 `setup_logging()`，确保所有后续日志都受管控。

### Step 6: 创建 docker-entrypoint.sh

新建 `backend/docker-entrypoint.sh`，执行：
1. `alembic upgrade head` — 自动数据库迁移
2. `exec uvicorn app.main:app --host 0.0.0.0 --port 8000` — 启动服务（`exec` 保证信号传递）

### Step 7: 修改 Dockerfile

`CMD ["uvicorn", ...]` → `ENTRYPOINT ["/docker-entrypoint.sh"]`，复制并授权 entrypoint 脚本。

### Step 8: 新增日志 API

在 `backend/app/schemas/admin.py` 添加 `LogFileInfo`, `LogContent` Schema。在 `backend/app/api/v1/admin.py` 添加：
- `GET /admin/logs` — 列出日志文件（含日期、大小）
- `GET /admin/logs/{filename}` — 查看文件内容（支持 tail 参数、.gz 文件）
- `GET /admin/logs/{filename}/stream` — SSE 实时推送新内容（每秒轮询文件变化）

### Step 9: 新增前端日志页面

`frontend/src/types/index.ts` 添加 `LogFileInfo`, `LogContent`。`frontend/src/lib/api.ts` 添加日志 API 方法。`frontend/src/pages/Admin.tsx` 在标签导航新增"系统日志"tab，添加 `LogViewer` 组件（左侧文件列表 + 右侧日志内容 + 实时/自动滚动切换）。

## 日志流架构

```
Loguru Logger
  ├── Handler 1 → stdout (docker logs 可见)
  ├── Handler 2 → /app/storage/logs/app.log (每天轮转 .gz)
  └── Handler 3 → /app/storage/logs/error.log (仅 ERROR)
                        │
                        ▼
                 Admin API (REST + SSE)
                        │
                        ▼
                 前端 Admin 页面 "系统日志" 标签
```

## 验证方式

1. `docker compose build backend` — 构建镜像
2. `docker compose up -d` — 启动服务
3. `docker compose logs backend` — 控制台有彩色日志
4. `docker compose exec backend ls /app/storage/logs/` — 日志文件已生成
5. 管理员页面 → "系统日志" → 查看历史日志 / 实时日志
6. `docker compose down -v && docker compose up -d` — 全新部署自动迁移通过
