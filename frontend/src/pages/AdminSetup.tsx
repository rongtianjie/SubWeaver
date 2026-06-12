import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function AdminSetup() {
  const navigate = useNavigate();
  const { user, registerAdmin } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [adminExists, setAdminExists] = useState(false);

  useEffect(() => {
    // 如果用户已登录且是管理员，直接跳转到后台
    if (user?.role === 'admin') {
      navigate('/admin', { replace: true });
      return;
    }
    // 检查是否已有管理员
    authApi.checkAdminExists()
      .then((res) => {
        if (res.data.exists) {
          setAdminExists(true);
          // 如果已登录但不是管理员，跳转到首页
          if (user) {
            navigate('/', { replace: true });
          } else {
            navigate('/login', { replace: true });
          }
        }
      })
      .catch(() => {
        // 请求失败时允许继续（可能后端暂不可用）
      })
      .finally(() => setChecking(false));
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('两次密码输入不一致');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await registerAdmin(username, email, password);
      navigate('/admin', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || '创建管理员账号失败');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (adminExists) {
    return null;
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="p-3 rounded-full bg-amber-100">
              <ShieldAlert className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-xl">初始化管理后台</CardTitle>
          <CardDescription>
            首次使用需要创建管理员账号。请妥善保管管理员密码，该账号拥有系统全部管理权限。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">管理员用户名</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="输入管理员用户名"
                required
                minLength={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">邮箱</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="输入邮箱地址"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">密码</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码（至少6位）"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">确认密码</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                required
                minLength={6}
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded p-2">{error}</p>
            )}
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              创建管理员账号
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
