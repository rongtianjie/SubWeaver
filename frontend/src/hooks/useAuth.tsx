import { useState, useEffect, createContext, useContext } from 'react';
import { authApi } from '@/lib/api';
import type { UserInfo } from '@/types';

interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
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

  const logout = () => {
    removeToken('access_token');
    removeToken('refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
