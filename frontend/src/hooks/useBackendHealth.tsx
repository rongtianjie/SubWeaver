import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import axios from 'axios';

export type BackendHealthStatus = 'online' | 'offline';

interface BackendHealthState {
  /** 后端是否在线 */
  backendStatus: BackendHealthStatus;
  /** 当前会话是否有效（token 仍被后端认可） */
  sessionValid: boolean;
  /** 是否正在检查中 */
  checking: boolean;
  /** 手动触发一次检查 */
  checkNow: () => Promise<void>;
}

const CHECK_INTERVAL = 30_000; // 30 秒

const BackendHealthContext = createContext<BackendHealthState | null>(null);

/**
 * 获取 token（同时检查 localStorage 和 sessionStorage）
 */
function getToken(): string | null {
  return localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
}

export function BackendHealthProvider({ children }: { children: React.ReactNode }) {
  const [backendStatus, setBackendStatus] = useState<BackendHealthStatus>('online');
  const [sessionValid, setSessionValid] = useState(true);
  const [checking, setChecking] = useState(false);

  const doCheck = useCallback(async () => {
    setChecking(true);
    try {
      // Step 1: 健康检查（无认证）
      await axios.get('/api/v1/health', { timeout: 5000 });
      setBackendStatus('online');

      // Step 2: 若有 token，验证会话有效性
      const token = getToken();
      if (token) {
        try {
          await axios.get('/api/v1/auth/me', {
            timeout: 5000,
            headers: { Authorization: `Bearer ${token}` },
          });
          setSessionValid(true);
        } catch {
          setSessionValid(false);
        }
      } else {
        // 无 token，会话状态无关
        setSessionValid(true);
      }
    } catch {
      // 后端不可达
      setBackendStatus('offline');
      // 后端离线时不改变 sessionValid（保持最后已知状态）
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    // 延迟首次检查，避免页面加载时立即触发
    const initialTimer = setTimeout(() => { doCheck(); }, 3000);
    const interval = setInterval(doCheck, CHECK_INTERVAL);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [doCheck]);

  return (
    <BackendHealthContext.Provider value={{ backendStatus, sessionValid, checking, checkNow: doCheck }}>
      {children}
    </BackendHealthContext.Provider>
  );
}

export function useBackendHealth() {
  const ctx = useContext(BackendHealthContext);
  if (!ctx) throw new Error('useBackendHealth must be used within BackendHealthProvider');
  return ctx;
}
