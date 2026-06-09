# B/S 架构音视频转文字/字幕服务平台 — 实现计划

## 项目目录结构

```
whisper-platform/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                       # FastAPI 入口, lifespan 生命周期管理
│   │   ├── config.py                     # 配置中心（环境变量 + .env）
│   │   ├── database.py                   # PostgreSQL 异步连接管理
│   │   ├── dependencies.py               # 依赖注入（get_db, get_current_user）
│   │   │
│   │   ├── api/v1/                       # API 路由层
│   │   │   ├── __init__.py
│   │   │   ├── auth.py                   # 注册、登录、Token 刷新
│   │   │   ├── tasks.py                  # 任务 CRUD、队列状态、SSE 进度
│   │   │   ├── files.py                  # 文件上传/下载/管理
│   │   │   ├── admin.py                  # 管理员接口
│   │   │   └── health.py                 # 健康检查
│   │   │
│   │   ├── models/                       # SQLAlchemy ORM 模型
│   │   │   ├── __init__.py
│   │   │   ├── user.py                   # User 表
│   │   │   ├── task.py                   # Task 表（含队列字段）
│   │   │   ├── task_output.py            # TaskOutput 表
│   │   │   └── system_config.py          # SystemConfig KV 表
│   │   │
│   │   ├── schemas/                      # Pydantic 请求/响应模型
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── task.py
│   │   │   ├── file.py
│   │   │   └── admin.py
│   │   │
│   │   ├── services/                     # 业务逻辑层
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   ├── task_service.py           # 任务创建、队列管理
│   │   │   ├── file_service.py           # 文件上传/清理
│   │   │   └── config_service.py
│   │   │
│   │   ├── worker/                       # 后台任务执行（独立进程）
│   │   │   ├── __init__.py
│   │   │   ├── worker.py                 # Worker 主循环（SKIP LOCKED 拉取任务）
│   │   │   ├── whisper_runner.py         # Whisper 转录封装（模型缓存）
│   │   │   ├── translator.py             # LLM 翻译封装（OpenAI 兼容）
│   │   │   └── yt_dlp_downloader.py      # yt-dlp 下载封装
│   │   │
│   │   ├── core/                         # 基础设施
│   │   │   ├── __init__.py
│   │   │   ├── security.py              # JWT/密码哈希
│   │   │   ├── storage.py               # 文件存储抽象层
│   │   │   └── task_queue.py            # PostgreSQL 队列管理
│   │   │
│   │   └── startup_checker/             # 启动环境检查模块
│   │       ├── __init__.py
│   │       ├── checker.py               # 检查引擎
│   │       └── checks/
│   │           ├── __init__.py
│   │           ├── db_check.py           # PostgreSQL 连接检查
│   │           ├── whisper_check.py      # Whisper 模型文件检查 + 下载引导
│   │           ├── llm_check.py          # LLM API 连通性检查
│   │           └── ffmpeg_check.py       # ffmpeg 系统依赖检查
│   │
│   ├── alembic/                          # 数据库迁移
│   ├── storage/uploads/                  # 用户上传文件
│   ├── storage/outputs/                  # 任务输出文件
│   ├── models/                           # Whisper 模型文件
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx / App.tsx / routes.tsx
│   │   ├── pages/                        # Home, Login, Register, Dashboard, TaskDetail, Admin
│   │   ├── components/                   # layout/, task/, file/, admin/
│   │   ├── hooks/                        # useAuth, useTasks, useSSE
│   │   ├── lib/                          # api.ts (axios), utils.ts
│   │   └── types/                        # TypeScript 类型定义
│   ├── Dockerfile + nginx.conf
│   └── package.json / vite.config.ts / tailwind.config.ts
│
├── docker-compose.yml                    # 编排（db + backend + frontend）
├── docker-compose.dev.yml                # 开发编排
└── .gitignore
```

---

## 第一阶段：后端核心管线 + 基础 API（MVP）

### Task 1：项目初始化与骨架搭建
- 初始化 `backend/` 项目结构
- `config.py`: 环境变量读取（DATABASE_URL, LLM_* , WHISPER_MODEL_DIR, STORAGE_DIR, SECRET_KEY, RETENTION_DAYS, MAX_FILE_SIZE_MB 等）
- `database.py`: SQLAlchemy async engine + session 工厂
- `main.py`: FastAPI 应用 + lifespan（启动检查 + Worker 启动）
- `requirements.txt`: fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, openai, whisper, yt-dlp, srt, tqdm, loguru, python-jose, passlib, bcrypt, python-multipart, alembic, sse-starlette, pydantic-settings

### Task 2：数据库模型与迁移
- `models/user.py`: id(UUID), username, email, password_hash, role(user/admin), is_active, created_at, updated_at
- `models/task.py`: id(UUID), user_id(FK nullable), title, source_type(upload/url), source_url, source_filename, file_path, whisper_model, output_formats(JSONB), translate_target_langs(JSONB), status(pending/queued/processing/completed/failed), progress(Float), progress_message, queue_position, estimated_seconds, error_message, started_at, completed_at, created_at
  - 索引: (status, queue_position), (user_id, created_at), (created_at)
- `models/task_output.py`: id(UUID), task_id(FK CASCADE), format_type, language_pair, file_path, file_size, created_at
- `models/system_config.py`: key(PK), value(JSONB), description, updated_at
  - 预置配置：max_concurrent_tasks=1, max_file_size_mb=500, retention_days=30, supported_languages, default_whisper_model, llm_base_url, llm_api_key, llm_model, guest_task_limit=3
- Alembic 初始化 + 初始迁移

### Task 3：核心服务层
- `core/task_queue.py`: TaskQueue 类
  - `enqueue()`: 计算 queue_position + estimated_seconds
  - `dequeue()`: SELECT FOR UPDATE SKIP LOCKED 取一个 pending 任务
  - `update_queue_positions()`: 刷新队列位序
  - 平均任务耗时从已完成任务的历史数据计算（AVG_TASK_DURATION 动态调整）
- `core/security.py`: JWT token 创建/验证 + bcrypt 密码哈希
- `core/storage.py`: 文件存储抽象（本地实现，预留 S3 接口）

### Task 4：启动环境检查模块
- `startup_checker/checker.py`: CheckResult 模型 + StartupChecker 引擎（注册/执行检查项）
- `checks/db_check.py`: PostgreSQL 连接测试（SELECT 1）
- `checks/whisper_check.py`: 检查 `models/` 目录下的 .pt 文件，缺失时打印下载引导（可选的自动下载提示）
- `checks/llm_check.py`: 调用 OpenAI 兼容 API 的 `/v1/models` 检查连通性
- `checks/ffmpeg_check.py`: 执行 `ffmpeg -version` 检查
- 在 FastAPI lifespan 中执行所有检查，将结果打印到控制台，`has_errors` 决定是否启动 Worker

### Task 5：Worker 进程
- `worker/worker.py`: Worker 类
  - 主循环：每 2 秒 poll tasks 表，dequeue 一个 pending 任务
  - `process_task()`: 完整管线（下载→音频提取→Whisper 转录→格式输出→翻译→清理）
  - `_update_progress()`: 更新 progress/status/message 到 DB
- `worker/whisper_runner.py`: 带缓存的模型加载（避免重复加载）
- `worker/translator.py`: 通过 OpenAI 兼容 API 翻译，从 system_config 读取 LLM 配置
- `worker/yt_dlp_downloader.py`: 在线链接下载（支持 YouTube 等所有 yt-dlp 网站）
- 音频提取：复用 `util.py` 的 `video_to_audio()` 用 ffmpeg 提取
- 输出生成：复用 `util.py` 的 `read_srt_file()` / `write_srt_file()`

### Task 6：API 接口（核心）
- `POST /api/v1/tasks` — 创建任务（multipart 文件上传 或 JSON body 含 URL），游客和用户均可
- `GET /api/v1/tasks/{task_id}` — 获取任务详情（含进度、队列位序）
- `GET /api/v1/tasks/{task_id}/stream` — SSE 实时进度推送（每秒推送 status/progress/message/queue_position/estimated_seconds）
- `GET /api/v1/tasks/{task_id}/outputs` — 输出文件列表
- `GET /api/v1/tasks/{task_id}/outputs/{output_id}/download` — 下载输出文件
- `GET /api/v1/health` — 存活检查
- `GET /api/v1/health/ready` — 就绪检查（返回各组件状态）

**【第一阶段验证】**：
1. `docker compose up -d db` 启动 PostgreSQL
2. 运行 `uvicorn app.main:app`，观察控制台检查报告输出
3. 用 curl 创建一个上传文件任务
4. 观察 Worker 处理并完成
5. 下载输出文件验证结果

---

## 第二阶段：用户认证 + 翻译 + 链接输入

### Task 7：用户认证
- `POST /api/v1/auth/register` — 注册
- `POST /api/v1/auth/login` — 登录，返回 access_token + refresh_token
- `POST /api/v1/auth/refresh` — 刷新 token
- `GET /api/v1/auth/me` — 当前用户信息
- 中间件：可选的认证（游客用 session_id 标识，无 session 则仅限提交和查看自己刚创建的任务）

### Task 8：用户相关 API
- `GET /api/v1/tasks` — 登录用户的任务历史（分页 + 状态过滤）
- `DELETE /api/v1/tasks/{task_id}` — 删除任务（本人或管理员）

### Task 9：链接输入 + 翻译集成
- 将 Translator 模块接入 Worker 管线
- yt-dlp 下载接入 Worker（source_type='url' 时触发下载）
- 多目标语言翻译（每个目标语言生成一个独立双语 SRT 输出文件）

**【第二阶段验证】**：
1. 完整的任务管线：上传/U R L → Whisper 转录 → 翻译 → 多格式输出
2. 用户注册 / 登录 / 查看历史

---

## 第三阶段：前端 MVP

### Task 10：前端项目初始化
- React + Vite + TypeScript + shadcn/ui + Tailwind CSS
- 路由：/, /login, /register, /dashboard, /tasks/:id, /admin
- Layout 组件：Header + 内容区

### Task 11：核心页面
- **Home 页**：Tabs（上传文件 / 在线链接），FileUploader（拖拽上传）、UrlInput（粘贴链接）、ModelSelector、OutputFormatSelector、LanguageSelector（多选）、SubmitButton
- **TaskDetail 页**：ProgressBar（实时 SSE）、队列位序 + 预计等待、完成后下载按钮、失败错误信息
- **Login / Register 页**
- **Dashboard 页**：任务列表（分页 + 状态筛选）

### Task 12：API 集成
- `lib/api.ts`: axios 封装（base URL、token 注入、错误处理）
- `hooks/useAuth.ts`: 登录状态管理
- `hooks/useSSE.ts`: SSE 连接管理

**【第三阶段验证】**：所有前端页面可交互，提交任务→实时进度→下载结果

---

## 第四阶段：管理后台 + 文件管理

### Task 13：管理员 API
- `GET /api/v1/admin/tasks` — 所有任务
- `PUT /api/v1/admin/tasks/{id}/retry` — 重试失败任务
- `GET /api/v1/admin/users` + `PUT /admin/users/{id}/role` — 用户管理
- `GET /api/v1/admin/config` + `PUT /admin/config/{key}` — 系统配置
- `GET /api/v1/admin/stats` — 系统统计
- `GET /api/v1/admin/health` — 各组件健康检查

### Task 14：管理后台前端
- Admin 布局（侧边栏导航）：概览 / 任务 / 配置 / 用户
- AdminConfig 页：LLM 配置、保留天数、文件大小限制、游客限额等
- AdminTasks 页：所有任务列表 + 操作
- AdminUsers 页：用户列表 + 角色管理

### Task 15：文件定时清理
- 后台定时任务（apscheduler），扫描超过 retention_days 的已完成任务
- 清理存储文件 + 删除 task_outputs 记录（保留 task 记录供历史查询）

**【第四阶段验证】**：管理员可修改配置、管理用户和任务、系统自动清理过期文件

---

## 第五阶段：Docker 部署 + 生产化

### Task 16：Docker 化
- `backend/Dockerfile`: python:3.12-slim + ffmpeg + Python 依赖
- `frontend/Dockerfile`: node:20-alpine 构建 + nginx:alpine 运行
- `frontend/nginx.conf`: 静态文件 + API 反向代理 + SSE 支持
- `docker-compose.yml`: db(postgres:16-alpine) + backend + frontend
- `.env.example`: 配置模板

### Task 17：生产化收尾
- CORS 配置
- 请求限速（slowapi 或中间件）
- 日志配置（日志文件轮转）
- 错误处理统一化
- README 更新

**【第五阶段验证】**：`docker compose up` 一键启动，完整业务流程跑通

---

## 核心设计要点

### 队列管理（基于 PostgreSQL）
- `dequeue()` 使用 `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1` 避免 Worker 竞争
- 同一时刻只有一个 Worker 进程（单队列）
- `queue_position` 动态刷新，任务进入/完成时更新
- `estimated_seconds = position × AVG_TASK_DURATION`（AVG_TASK_DURATION 从历史任务动态计算）

### SSE 进度推送
- 前端通过 `EventSource` 连接 `/api/v1/tasks/{id}/stream`
- 后端每 1 秒从 DB 读取 task 状态推送
- 任务完成/失败后关闭连接

### Whisper 模型缓存
- `WhisperRunner.get_model()` 用 dict 缓存已加载模型
- 不同大小的模型可同时缓存（用户选择不同模型时无需重复加载）

### 启动环境检查
- lifespan 中依次检查：DB → ffmpeg → Whisper → LLM
- 检查结果输出到控制台，包含 ✅/❌ 状态和引导信息
- 关键项失败（如 DB 连不上）阻止 Worker 启动
- 非关键项失败（如 LLM 不通）不影响启动，仅影响对应功能可用性
