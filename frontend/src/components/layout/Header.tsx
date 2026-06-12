import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LogOut, User, Film, ShieldAlert } from 'lucide-react';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [noAdmin, setNoAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (user) {
      setChecking(false);
      return;
    }
    authApi.checkAdminExists()
      .then((res) => setNoAdmin(!res.data.exists))
      .catch(() => setNoAdmin(false))
      .finally(() => setChecking(false));
  }, [user]);

  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
          <Film className="w-6 h-6" />
          <span>Whisper 字幕</span>
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
                我的任务
              </Link>
              {user.role === 'admin' && (
                <Link to="/admin" className="text-sm text-gray-600 hover:text-gray-900">
                  管理后台
                </Link>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <User className="w-4 h-4" />
                <span>{user.username}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => { logout(); navigate('/'); }}>
                <LogOut className="w-4 h-4 mr-1" />
                退出
              </Button>
            </>
          ) : noAdmin && !checking ? (
            <Link to="/admin/setup">
              <Button size="sm">
                <ShieldAlert className="w-4 h-4 mr-1" />
                初始化管理后台
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button variant="outline" size="sm">登录</Button>
              </Link>
              <Link to="/register">
                <Button size="sm">注册</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
