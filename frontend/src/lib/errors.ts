/**
 * 从 axios 错误中提取用户友好的错误信息。
 * 优先使用后端返回的 detail 字段，否则按 HTTP 状态码和网络状况兜底。
 */
export function extractApiError(err: any, fallback: string): string {
  // 无响应：网络断开或服务不可达
  if (!err.response) {
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return '请求超时，请检查网络连接后重试';
    }
    return '无法连接到服务器，请检查网络连接';
  }

  const status = err.response.status;
  const detail = err.response.data?.detail;

  // 服务端返回了具体错误信息（如"用户名或密码错误"、"账号已被禁用"）
  if (detail && typeof detail === 'string') {
    return detail;
  }

  // 按状态码兜底
  if (status === 401 || status === 403) {
    return fallback;
  }
  if (status === 429) {
    return '操作过于频繁，请稍后再试';
  }
  if (status >= 500) {
    return '服务器内部错误，请稍后重试';
  }
  if (status === 400) {
    return '请求参数有误，请检查输入';
  }

  return fallback;
}
