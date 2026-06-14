import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { authApi } from '@/lib/api';
import type { UserInfo } from '@/types';

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  registerAdmin: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  /** 检查并消费"主动登出"标记（一次性读取，读后自动重置） */
  consumeIntentionalLogout: () => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getToken(key: string): string | null {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
}

function setToken(key: string, value: string, persistent: boolean) {
  const storage = persistent ? localStorage : sessionStorage;
  storage.setItem(key, value);
  // 清理另一个存储，避免冲突
  const other = persistent ? sessionStorage : localStorage;
  other.removeItem(key);
}

function removeToken(key: string) {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  // 标记本次 logout 是用户主动操作（用于区分会话失效）
  const intentionalLogoutRef = useRef(false);

  useEffect(() => {
    const token = getToken('access_token');
    if (token) {
      authApi.getMe()
        .then((res) => setUser(res.data))
        .catch(() => {
          removeToken('access_token');
          removeToken('refresh_token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string, rememberMe = true) => {
    const res = await authApi.login({ username, password });
    setToken('access_token', res.data.access_token, rememberMe);
    setToken('refresh_token', res.data.refresh_token, rememberMe);
    const meRes = await authApi.getMe();
    setUser(meRes.data);
  };

  const register = async (username: string, email: string, password: string) => {
    await authApi.register({ username, email, password });
  };

  const registerAdmin = async (username: string, email: string, password: string) => {
    await authApi.registerAdmin({ username, email, password });
    // 注册成功后自动登录
    const loginRes = await authApi.login({ username, password });
    const rememberMe = !!localStorage.getItem('access_token') || !sessionStorage.getItem('access_token');
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('access_token', loginRes.data.access_token);
    storage.setItem('refresh_token', loginRes.data.refresh_token);
    const meRes = await authApi.getMe();
    setUser(meRes.data);
  };

  const logout = () => {
    intentionalLogoutRef.current = true;
    removeToken('access_token');
    removeToken('refresh_token');
    setUser(null);
  };

  const consumeIntentionalLogout = () => {
    const val = intentionalLogoutRef.current;
    intentionalLogoutRef.current = false;
    return val;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, registerAdmin, logout, consumeIntentionalLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
