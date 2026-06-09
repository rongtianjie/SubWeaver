# Auto-subtitle-generator-based-on-whisper
# B/S 架构音视频转文字/字幕服务

**⚠️ 这是重构后的代码，原命令行工具保留在项目根目录**

## 快速开始

```bash
cd whisper-platform

# 复制环境变量配置
cp backend/.env.example backend/.env

# Docker Compose 一键启动
docker compose up -d

# 访问 http://localhost
```

## 手动启动（原生部署）

### 1. 安装依赖

使用 [uv](https://docs.astral.sh/uv/) 管理 Python 环境：

```bash
cd backend
uv sync --extra dev
```

> 未安装 uv 可执行：`curl -LsSf https://astral.sh/uv/install.sh | sh`

### 2. 启动 PostgreSQL 并创建数据库

```bash
# 使用 Docker 启动 PostgreSQL
docker compose -f docker-compose.dev.yml up -d

# 或本地已安装 PostgreSQL
createdb whisper_platform
```

### 3. 运行数据库迁移

```bash
uv run alembic upgrade head
```

### 4. 启动后端

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. 启动前端（需要 Node.js 20+）

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173

## 运行测试

```bash
cd backend

# 运行全部测试
uv run pytest

# 运行测试并查看覆盖率
uv run pytest --cov=app --cov-report=term

# 生成 HTML 覆盖率报告
uv run pytest --cov=app --cov-report=html
open htmlcov/index.html
```

测试覆盖 9 个模块，共 81 个测试用例：
- **安全模块**：密码哈希、JWT 令牌生成/验证/过期
- **数据验证**：认证、任务、管理后台的 Pydantic Schema 校验
- **启动检查**：检查引擎注册/执行/报告输出
- **文件存储**：上传/下载/清理/多任务隔离
- **任务队列**：入队/出队/位置计算/平均耗时
- **工具函数**：视频转音频、SRT 读写、翻译
- **API 端点**：注册/登录/刷新/获取用户/根路径
