import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { extractApiError } from '@/lib/errors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, AlertTriangle, AlertCircle } from 'lucide-react';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialView?: 'login' | 'register';
  /** 显示在对话框顶部的提示原因（如会话失效） */
  reason?: string;
}

export function AuthDialog({ open, onOpenChange, initialView = 'login', reason }: AuthDialogProps) {
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

  // 当对话框打开时，始终同步 view 到 initialView
  // 覆盖 handleOpenChange 可能被 Radix Dialog 内部吞掉的情况
  useEffect(() => {
    if (open) {
      setView(initialView);
      setError('');
    }
  }, [open, initialView]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl">{view === 'login' ? '欢迎回来' : '创建账号'}</DialogTitle>
          <DialogDescription>
            {view === 'login' ? '登录后可查看任务历史和管理文件' : '注册以使用完整功能'}
          </DialogDescription>
        </DialogHeader>

        {/* 会话失效提示 */}
        {reason && (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-600 dark:text-amber-400">{reason}</p>
          </div>
        )}

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

// 简单的 base64 编码/解码（基本混淆，防止明文直接可见）
function encodePassword(pwd: string): string {
  return btoa(unescape(encodeURIComponent(pwd)));
}

function decodePassword(encoded: string): string {
  try {
    return decodeURIComponent(escape(atob(encoded)));
  } catch {
    return '';
  }
}

function LoginForm({
  loading, setLoading, error, setError, onSuccess, onSwitchToRegister,
}: {
  loading: boolean; setLoading: (v: boolean) => void;
  error: string; setError: (v: string) => void;
  onSuccess: () => void; onSwitchToRegister: () => void;
}) {
  const { login } = useAuth();
  const savedUsername = localStorage.getItem('saved_username') || '';
  const savedPwdEncoded = localStorage.getItem('saved_pwd') || '';
  const [username, setUsername] = useState(savedUsername);
  const [password, setPassword] = useState(savedPwdEncoded ? decodePassword(savedPwdEncoded) : '');
  const [rememberMe, setRememberMe] = useState(!!savedUsername);
  const [savePassword, setSavePassword] = useState(!!savedPwdEncoded);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, password, rememberMe);
      // 保存用户名
      if (rememberMe) {
        localStorage.setItem('saved_username', username);
      } else {
        localStorage.removeItem('saved_username');
      }
      // 保存密码（base64 编码）
      if (savePassword) {
        localStorage.setItem('saved_pwd', encodePassword(password));
      } else {
        localStorage.removeItem('saved_pwd');
      }
      onSuccess();
    } catch (err: any) {
      setError(extractApiError(err, '登录失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">用户名或邮箱</label>
        <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="输入用户名或邮箱" required autoComplete="username" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">密码</label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="输入密码" required autoComplete="current-password" />
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
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
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
      setError(extractApiError(err, '注册失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">用户名</label>
        <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="输入用户名" required minLength={3} autoComplete="username" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">邮箱</label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="输入邮箱" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">密码</label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="输入密码（至少6位）" required minLength={6} autoComplete="new-password" />
      </div>
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
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
