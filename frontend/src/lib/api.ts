import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：注入 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理 token 过期
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
    return Promise.reject(error);
  }
);

export default api;

// ===== 认证 API =====
export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post('/auth/register', data),

  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data),

  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),

  getMe: () => api.get('/auth/me'),

  checkAdminExists: () => api.get('/auth/admin-exists'),

  registerAdmin: (data: { username: string; email: string; password: string }) =>
    api.post('/auth/register-admin', data),
};

// ===== 任务 API =====
export const taskApi = {
  getDefaults: () => api.get('/tasks/defaults'),

  create: (formData: FormData) =>
    api.post('/tasks', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  list: (params?: { page?: number; page_size?: number; status?: string }) =>
    api.get('/tasks', { params }),

  get: (id: string) => api.get(`/tasks/${id}`),

  delete: (id: string) => api.delete(`/tasks/${id}`),

  cancel: (id: string) => api.put(`/tasks/${id}/cancel`),

  getOutputs: (id: string) => api.get(`/tasks/${id}/outputs`),

  getQueueStatus: () => api.get('/tasks/queue'),

  getStreamUrl: (id: string) => `/api/v1/tasks/${id}/stream`,

  downloadUrl: (taskId: string, outputId: string) =>
    `/api/v1/tasks/${taskId}/outputs/${outputId}/download`,
};

// ===== 健康检查 API =====
export const healthApi = {
  check: () => api.get('/health'),
  ready: () => api.get('/health/ready'),
};

// ===== 管理后台 API =====
export const adminApi = {
  listTasks: (params?: { page?: number; page_size?: number; status?: string }) =>
    api.get('/admin/tasks', { params }),

  retryTask: (id: string) => api.put(`/admin/tasks/${id}/retry`),

  cancelTask: (id: string) => api.put(`/admin/tasks/${id}/cancel`),

  deleteTask: (id: string) => api.delete(`/admin/tasks/${id}`),

  listUsers: (params?: { q?: string; page?: number; page_size?: number }) =>
    api.get('/admin/users', { params }),

  toggleUserActive: (userId: string) =>
    api.put(`/admin/users/${userId}/toggle-active`),

  deleteUser: (userId: string) =>
    api.delete(`/admin/users/${userId}`),

  resetPassword: (userId: string) =>
    api.post(`/admin/users/${userId}/reset-password`),

  listUserTasks: (userId: string, params?: { page?: number; page_size?: number; status?: string }) =>
    api.get(`/admin/users/${userId}/tasks`, { params }),

  updateUserRole: (userId: string, role: string) =>
    api.put(`/admin/users/${userId}/role`, { role }),

  getConfig: () => api.get('/admin/config'),

  updateConfig: (key: string, value: unknown, description?: string) =>
    api.put(`/admin/config/${key}`, { value, description }),

  getStats: () => api.get('/admin/stats'),

  getHealth: () => api.get('/admin/health'),

  testLlm: (data?: { base_url?: string; api_key?: string; model?: string }) =>
    api.post('/admin/llm/test', data || {}),

  fetchLlmModels: (data: { base_url: string; api_key: string }) =>
    api.post('/admin/llm/fetch-models', data),

  listLogFiles: () => api.get('/admin/logs'),

  getLogContent: (filename: string, tail?: number) =>
    api.get(`/admin/logs/${encodeURIComponent(filename)}`, { params: { tail } }),

  getLogStreamUrl: (filename: string) =>
    `/api/v1/admin/logs/${encodeURIComponent(filename)}/stream`,
};

// ===== 模型管理 API =====
export const modelApi = {
  list: () => api.get('/models'),

  download: (name: string) => api.post(`/models/${name}/download`),

  deleteAll: () => api.delete('/models'),
};
