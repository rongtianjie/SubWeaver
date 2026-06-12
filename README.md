<p align="center">
  <img src="frontend/public/hero-banner.png" alt="Auto Subtitle Generator — Banner" width="100%">
</p>

<h1 align="center">Auto Subtitle Generator</h1>

<p align="center">
  <strong>A web-based audio/video transcription and subtitle generation service powered by OpenAI Whisper, featuring multi-language translation, online video downloading, user authentication, task queue management, and persistent log viewer.</strong>
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

Built with FastAPI + React + PostgreSQL, it features a clean dashboard, real-time progress streaming via SSE, user authentication, admin panel, persistent logging, and Docker Compose deployment for easy setup.

---

## Features

### 🎯 Core Capabilities
- **Multi-source input** — Upload local audio/video files or provide an online video URL (YouTube, etc.)
- **AI-powered transcription** — Multiple Whisper model sizes (`tiny`, `base`, `small`, `medium`, `large`) to balance speed and accuracy
- **Whisper model management** — View download status, download, and delete Whisper models directly from the web UI
- **Flexible output formats** — Plain text (TXT), standard subtitles (SRT), bilingual subtitles (SRT with original + translation)
- **Multi-language translation** — Translate subtitles into 11+ languages via OpenAI-compatible LLM (Chinese, Japanese, Korean, French, German, Spanish, Russian, Portuguese, Arabic, Thai, Vietnamese, and more)
- **Real-time progress** — Server-Sent Events (SSE) for live task progress updates

### 🛠 Platform Features
- **User authentication** — Register, login, JWT with access/refresh tokens, "Remember Me" and password saving support
- **Initial admin setup** — Guided first-run setup page at `/admin/setup` to create the initial administrator
- **Role-based access** — User and Admin roles with separate interfaces
- **Admin dashboard** — Task management, user management, system configuration, health checks, statistics, LLM connection testing, and model list fetching
- **System log viewer** — Admin can view and stream real-time logs directly from the web UI
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

### Docker Compose (Only Supported Method)

```bash
# Clone the repository
git clone https://github.com/rongtianjie/Auto-subtitle-generator-based-on-whisper.git
cd Auto-subtitle-generator-based-on-whisper

# Copy environment configuration (Docker Compose 读取根目录的 .env)
cp backend/.env.example .env

# Start all services
docker compose up -d

# Open http://localhost in your browser
```

The backend API is also available at `http://localhost:8765`. Full API documentation is at `http://localhost:8765/docs`.

> **Note:** This project **only supports Docker Compose deployment**. Manual/native setup is no longer supported.

### Services

| Service | Port | Description |
|---------|------|-------------|
| **Frontend (Nginx)** | `80` | Web UI |
| **Backend (FastAPI)** | `8765` | REST API + SSE streams |
| **Database (PostgreSQL)** | `5432` | Primary data store |

### Environment Variables

Copy `backend/.env.example` to `backend/.env` and adjust the following key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | `change-me-in-production` | JWT signing key (change in production!) |
| `LLM_BASE_URL` | `http://host.docker.internal:1234/v1` | OpenAI-compatible LLM API endpoint for translation |
| `LLM_API_KEY` | `lm-studio` | LLM API key |
| `LLM_MODEL` | (empty) | LLM model name |
| `DB_PASSWORD` | `whisper_secret` | PostgreSQL password |
| `MAX_FILE_SIZE_MB` | `500` | Maximum upload file size |
| `RETENTION_DAYS` | `30` | File retention period |

---

## API Overview

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/auth/register` | Register a new user | No |
| `POST` | `/api/v1/auth/login` | Login | No |
| `POST` | `/api/v1/auth/refresh` | Refresh access token | Refresh token |
| `GET` | `/api/v1/auth/admin-exists` | Check if an admin exists in the system | No |
| `POST` | `/api/v1/auth/register-admin` | Register the initial admin (only when none exists) | No |
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
| `POST` | `/api/v1/admin/llm/test` | Test LLM connection and latency | Admin |
| `POST` | `/api/v1/admin/llm/fetch-models` | Fetch available models from LLM backend | Admin |
| `GET` | `/api/v1/admin/logs` | List available log files | Admin |
| `GET` | `/api/v1/admin/logs/{filename}` | Read log file content | Admin |
| `GET` | `/api/v1/admin/logs/{filename}/stream` | SSE real-time log stream | Admin |

| `GET` | `/api/v1/models` | List all Whisper models with download status | No |
| `POST` | `/api/v1/models/{name}/download` | Download a Whisper model | No |
| `DELETE` | `/api/v1/models` | Delete all downloaded Whisper models | No |

Full API documentation is available at `/docs` when the backend is running.

---

## System Logging

The service uses **loguru** for structured logging with three output targets:

| Target | Path | Description |
|--------|------|-------------|
| **stdout** | Docker logs | Colorized console output via `docker logs` |
| **app.log** | `/app/storage/logs/app.log` | All log levels, rotated daily (30 days retention, gzip compressed) |
| **error.log** | `/app/storage/logs/error.log` | Only ERROR level, same rotation policy |

### Web Log Viewer

Administrators can view logs directly from the web UI via the **System Logs** tab in the admin panel:

- **Historical logs** — Select a log file from the left sidebar to view its contents
- **Real-time streaming** — Click "实时日志" to tail the log file via SSE and watch new entries appear live
- **Auto-scroll** — Automatically scrolls when near the bottom; disable to browse freely

### Log API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/admin/logs` | List available log files | Admin |
| `GET` | `/api/v1/admin/logs/{filename}` | Read log file content (optional `?tail=N` parameter) | Admin |
| `GET` | `/api/v1/admin/logs/{filename}/stream` | SSE real-time log stream | Admin |

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
│   │   ├── core/            # Security, storage, task queue, logging
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # Business logic services
│   │   ├── worker/          # Background task worker
│   │   └── startup_checker/ # System health checks
│   ├── tests/               # Test suite
│   ├── alembic/             # Database migrations
│   └── docker-entrypoint.sh # Docker container entrypoint
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── pages/           # Page views
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utilities and API client
│   │   └── types/           # TypeScript types
│   └── public/              # Static assets
├── storage/                 # File storage (uploads, outputs, logs)
├── docker-compose.yml       # Production deployment
└── docker-compose.dev.yml   # Development database
```

---

## License

[MIT](LICENSE)
