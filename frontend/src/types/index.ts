export interface Task {
  id: string
  user_id: string | null
  username: string | null
  title: string
  source_type: "upload" | "url"
  source_url: string | null
  source_filename: string | null
  file_size: number | null
  whisper_model: string
  translate_llm_model: string | null
  output_formats: string[]
  translate_target_langs: string[] | null
  status: "pending" | "queued" | "processing" | "completed" | "failed" | "cancelled"
  progress: number
  progress_message: string | null
  queue_position: number | null
  estimated_seconds: number | null
  error_message: string | null
  cancel_requested: boolean
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface TaskOutput {
  id: string
  task_id: string
  format_type: string
  language_pair: string | null
  file_path: string
  file_size: number | null
  created_at: string
}

export interface QueueStatus {
  pending_count: number
  processing_count: number
  avg_duration: number
}

export interface UserInfo {
  id: string
  username: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

export interface UserItem {
  id: string
  username: string
  email: string
  role: string
  is_active: boolean
  created_at: string
  task_count: number
}

export interface UserListResponse {
  users: UserItem[]
  total: number
  page: number
  page_size: number
}

export interface TaskListResponse {
  tasks: Task[]
  total: number
  page: number
  page_size: number
}

export interface ModelInfo {
  name: string
  label: string
  description: string
  size_mb: number
  is_downloaded: boolean
  download: {
    status: 'idle' | 'downloading' | 'completed' | 'error'
    progress: number
    error_message: string | null
  }
}

export interface LogFileInfo {
  filename: string
  size_bytes: number
  last_modified: string
}

export interface LogContent {
  filename: string
  content: string
  has_more: boolean
}
