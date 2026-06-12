# SubWeaver — Frontend

React 19 + TypeScript + Vite + Tailwind CSS 4 + Radix UI.

## Overview

This is the frontend for **SubWeaver**, a web-based audio/video transcription and subtitle generation service. It provides a modern dashboard for task creation, progress tracking, file management, and an admin panel.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19, TypeScript |
| **Build** | Vite |
| **Styling** | Tailwind CSS 4 |
| **Components** | Radix UI |
| **HTTP Client** | Axios |
| **Routing** | React Router v7 |
| **SSE** | EventSource for real-time progress and logs |

## Development

```bash
# Install dependencies
npm install

# Start dev server (requires backend at :8765)
npm run dev

# Build for production
npm run build
```

The dev server runs on `http://localhost:5173` and proxies API requests to the backend.

## Project Structure

```
src/
├── components/
│   ├── layout/        # Layout components (Layout, AdminLayout, Sidebar)
│   ├── shared/        # Shared components (AuthDialog, FileUpload, etc.)
│   └── ui/            # Base UI components (Button, Card, Modal, etc.)
├── hooks/             # Custom hooks (useAuth, useSSE, useModels)
├── lib/               # Utilities and API client (api.ts, utils.ts)
├── pages/             # Page views
│   └── admin/         # Admin sub-pages
├── types/             # TypeScript interfaces
├── App.tsx            # Route configuration
└── main.tsx           # Entry point
```

## Docker

The frontend is served via Nginx in production. See the root `Dockerfile` for build details.
