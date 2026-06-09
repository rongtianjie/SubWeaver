<p align="center">
  <img src="frontend/public/hero-banner.png" alt="Auto Subtitle Generator — Banner" width="100%">
</p>

<h1 align="center">Auto Subtitle Generator</h1>

<p align="center">
  <strong>A web-based audio/video transcription and subtitle generation service powered by OpenAI Whisper, featuring multi-language translation, online video downloading, user authentication, and task queue management.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.11+-blue?logo=python" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/PostgreSQL-16+-4169E1?logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Docker-compose-2496ED?logo=docker" alt="Docker">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

---

## Overview

Auto Subtitle Generator is a modern, full-stack web application that leverages OpenAI Whisper to automatically transcribe speech from audio and video files into text and subtitles. It supports file uploads and online video URLs (YouTube, etc.), generates multiple output formats (TXT, SRT, bilingual SRT), and translates subtitles into various languages via an OpenAI-compatible LLM API.

Built with FastAPI + React + PostgreSQL, it features a clean dashboard, real-time progress streaming via SSE, user authentication, admin panel, and Docker Compose deployment for easy setup.

---

## Features

### 🎯 Core Capabilities
- **Multi-source input** — Upload local audio/video files or provide an online video URL (YouTube, etc.)
- **AI-powered transcription** — Multiple Whisper model sizes (`tiny`, `base`, `small`, `medium`, `large`) to balance speed and accuracy
- **Flexible output formats** — Plain text (TXT), standard subtitles (SRT), bilingual subtitles (SRT with original + translation)
- **Multi-language translation** — Translate subtitles into 11+ languages via OpenAI-compatible LLM (Chinese, Japanese, Korean, French, German, Spanish, Russian, Portuguese, Arabic, Thai, Vietnamese, and more)
- **Real-time progress** — Server-Sent Events (SSE) for live task progress updates

### 🛠 Platform Features
- **User authentication** — Register, login, JWT with access/refresh tokens
- **Role-based access** — User and Admin roles with separate interfaces
- **Admin dashboard** — Task management, user management, system configuration, health checks, statistics
- **Guest mode** — Create transcription tasks without registration (limited quota)
- **Sequential task queue** — Fair queue with estimated wait times, real-time position updates
- **Health check system** — Automatic startup verification of database, ffmpeg, Whisper model, and LLM connection
- **Configurable file retention** — Auto-cleanup of expired files
- **Docker Compose deployment** — One-command setup with all dependencies

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy (async), Alembic |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS 4, Radix UI |
| **Database** | PostgreSQL 16 |
| **AI/ML** | OpenAI Whisper, OpenAI-compatible LLM API |
| **Media** | ffmpeg, yt-dlp |
| **Infra** | Docker, Docker Compose |
| **Testing** | pytest, pytest-cov, httpx, pytest-asyncio |

---

## Quick Start

### Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/rongtianjie/Auto-subtitle-generator-based-on-whisper.git
cd Auto-subtitle-generator-based-on-whisper

# Copy environment configuration
cp backend/.env.example backend/.env

# Start all services
docker compose up -d

# Open http://localhost in your browser
```

### Manual Setup

#### Prerequisites
- Python 3.11+ with [uv](https://docs.astral.sh/uv/)
- Node.js 20+
- PostgreSQL 16+
- ffmpeg

#### Backend

```bash
cd backend

# Install dependencies (including dev)
uv sync --extra dev

# Copy and configure environment
cp .env.example .env

# Run database migrations
uv run alembic upgrade head

# Start the backend server
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

> **Note**: For development, you only need PostgreSQL running. Use `docker compose -f docker-compose.dev.yml up -d` to start just the database.

---

## API Overview

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/auth/register` | Register a new user | No |
| `POST` | `/api/v1/auth/login` | Login | No |
| `POST` | `/api/v1/auth/refresh` | Refresh access token | Refresh token |
| `POST` | `/api/v1/tasks` | Create a transcription task | Optional (guest) |
| `GET` | `/api/v1/tasks` | List user tasks | JWT |
| `GET` | `/api/v1/tasks/{id}` | Get task details | No |
| `DELETE` | `/api/v1/tasks/{id}` | Delete a task | JWT |
| `GET` | `/api/v1/tasks/{id}/stream` | SSE real-time progress | No |
| `GET` | `/api/v1/tasks/{id}/outputs` | List task outputs | No |
| `GET` | `/api/v1/tasks/{id}/outputs/{oid}/download` | Download output file | No |
| `GET` | `/api/v1/tasks/queue` | Get queue status | No |
| `GET` | `/api/v1/files` | List uploaded files | JWT |
| `GET` | `/api/v1/health` | Health check | No |
| `GET` | `/api/v1/admin/stats` | Platform statistics | Admin |
| `GET` | `/api/v1/admin/health` | Detailed health check | Admin |
| `GET` | `/api/v1/admin/tasks` | List all tasks | Admin |
| `GET` | `/api/v1/admin/users` | List all users | Admin |
| `PUT` | `/api/v1/admin/users/{id}/role` | Update user role | Admin |
| `GET` | `/api/v1/admin/config` | Get system config | Admin |
| `PUT` | `/api/v1/admin/config/{key}` | Update system config | Admin |

Full API documentation is available at `/docs` when the backend is running.

---

## Configuration

Configuration is managed via environment variables. Copy `backend/.env.example` to `backend/.env` and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | `change-me-in-production` | JWT signing key |
| `DATABASE_URL` | `postgresql+asyncpg://whisper:whisper_secret@localhost:5432/whisper_platform` | PostgreSQL connection |
| `LLM_BASE_URL` | `http://localhost:1234/v1` | OpenAI-compatible LLM API endpoint |
| `LLM_API_KEY` | `lm-studio` | LLM API key |
| `LLM_MODEL` | `lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF` | LLM model name |
| `MAX_FILE_SIZE_MB` | `500` | Maximum upload file size |
| `RETENTION_DAYS` | `30` | File retention period |
| `CORS_ORIGINS` | `["http://localhost:5173","http://localhost:80","http://localhost"]` | Allowed CORS origins |

---

## Testing

The project includes 81 test cases across 9 modules with comprehensive coverage:

```bash
cd backend

# Run all tests
uv run pytest

# Run with coverage report
uv run pytest --cov=app --cov-report=term

# Generate HTML coverage report
uv run pytest --cov=app --cov-report=html
```

**Test coverage**:
- **Security** — Password hashing, JWT generation/validation/expiry
- **Schema validation** — Auth, task, and admin Pydantic schemas
- **Startup checker** — Check engine registration, execution, report output
- **File storage** — Upload, download, cleanup, multi-task isolation
- **Task queue** — Enqueue, dequeue, position calculation, average duration
- **Utility functions** — Video-to-audio conversion, SRT read/write, translation
- **API endpoints** — Register, login, token refresh, user info, root path

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/v1/          # REST API endpoints
│   │   ├── core/            # Security, storage, task queue
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # Business logic services
│   │   ├── worker/          # Background task worker
│   │   └── startup_checker/ # System health checks
│   ├── tests/               # Test suite
│   └── alembic/             # Database migrations
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── pages/           # Page views
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utilities and API client
│   │   └── types/           # TypeScript types
│   └── public/              # Static assets
├── storage/                 # File storage (uploads, outputs)
├── docker-compose.yml       # Production deployment
└── docker-compose.dev.yml   # Development database
```

---

## License

[MIT](LICENSE)
