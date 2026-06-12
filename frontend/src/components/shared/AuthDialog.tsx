import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialView?: 'login' | 'register';
}

export function AuthDialog({ open, onOpenChange, initialView = 'login' }: AuthDialogProps) {
  const [view, setView] = useState<'login' | 'register'>(initialView);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset view when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setView(initialView);
      setError('');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl">{view === 'login' ? '欢迎回来' : '创建账号'}</DialogTitle>
          <DialogDescription>
            {view === 'login' ? '登录后可查看任务历史和管理文件' : '注册以使用完整功能'}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {view === 'login' ? (
            <LoginForm
              loading={loading}
              setLoading={setLoading}
              error={error}
              setError={setError}
              onSuccess={() => handleOpenChange(false)}
              onSwitchToRegister={() => { setView('register'); setError(''); }}
            />
          ) : (
            <RegisterForm
              loading={loading}
              setLoading={setLoading}
              error={error}
              setError={setError}
              onSuccess={() => { setView('login'); setError('注册成功，请登录'); }}
              onSwitchToLogin={() => { setView('login'); setError(''); }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LoginForm({
  loading, setLoading, error, setError, onSuccess, onSwitchToRegister,
}: {
  loading: boolean; setLoading: (v: boolean) => void;
  error: string; setError: (v: string) => void;
  onSuccess: () => void; onSwitchToRegister: () => void;
}) {
  const { login } = useAuth();
  const [username, setUsername] = useState(localStorage.getItem('saved_username') || '');
  const [password, setPassword] = useState(localStorage.getItem('saved_password') || '');
  const [rememberMe, setRememberMe] = useState(true);
  const [savePassword, setSavePassword] = useState(!!localStorage.getItem('saved_password'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, password, rememberMe);
      if (savePassword) {
        localStorage.setItem('saved_username', username);
        localStorage.setItem('saved_password', password);
      } else {
        localStorage.removeItem('saved_username');
        localStorage.removeItem('saved_password');
      }
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">用户名或邮箱</label>
        <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="输入用户名或邮箱" required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">密码</label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="输入密码" required />
      </div>
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={rememberMe} onChange={(e) => { setRememberMe(e.target.checked); if (!e.target.checked) setSavePassword(false); }} className="rounded border-border text-primary focus:ring-primary/30" />
          <span className="text-muted-foreground">记住我</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={savePassword} onChange={(e) => { setSavePassword(e.target.checked); if (e.target.checked) setRememberMe(true); }} className="rounded border-border text-primary focus:ring-primary/30" />
          <span className="text-muted-foreground">保存密码</span>
        </label>
      </div>
      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-2">{error}</p>}
      <Button className="w-full" type="submit" disabled={loading} size="lg">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        登录
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        还没有账号？
        <button type="button" onClick={onSwitchToRegister} className="text-primary hover:underline font-medium ml-1">立即注册</button>
      </p>
    </form>
  );
}

function RegisterForm({
  loading, setLoading, error, setError, onSuccess, onSwitchToLogin,
}: {
  loading: boolean; setLoading: (v: boolean) => void;
  error: string; setError: (v: string) => void;
  onSuccess: () => void; onSwitchToLogin: () => void;
}) {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(username, email, password);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">用户名</label>
        <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="输入用户名" required minLength={3} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">邮箱</label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="输入邮箱" required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">密码</label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="输入密码（至少6位）" required minLength={6} />
      </div>
      {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-2">{error}</p>}
      <Button className="w-full" type="submit" disabled={loading} size="lg">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        注册
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        已有账号？
        <button type="button" onClick={onSwitchToLogin} className="text-primary hover:underline font-medium ml-1">立即登录</button>
      </p>
    </form>
  );
}
