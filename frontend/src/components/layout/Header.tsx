import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { AuthDialog } from '@/components/shared/AuthDialog';
import { UserMenu } from '@/components/shared/UserMenu';
import { Film, ShieldAlert, Sparkles } from 'lucide-react';

export function Header() {
  const { user } = useAuth();
  const [noAdmin, setNoAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

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

  const openLogin = () => { setAuthView('login'); setAuthOpen(true); };
  const openRegister = () => { setAuthView('register'); setAuthOpen(true); };

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-40 w-full border-b glass">
        <div className="max-w-[1800px] mx-auto px-4 lg:px-8 xl:px-12 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="p-1.5 rounded-xl bg-gradient-to-br from-primary to-purple-500 shadow-sm group-hover:shadow-md transition-shadow">
              <Film className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              <span className="text-gradient">SubWeaver</span>
            </span>
          </Link>

          {/* Right section */}
          <nav className="flex items-center gap-2">
            <ThemeToggle />

            {user ? (
              <UserMenu />
            ) : noAdmin && !checking ? (
              <Link to="/admin/setup">
                <Button size="sm" variant="soft">
                  <ShieldAlert className="w-4 h-4" />
                  初始化管理后台
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={openLogin}>
                  登录
                </Button>
                <Button variant="default" size="sm" onClick={openRegister}>
                  <Sparkles className="w-3.5 h-3.5" />
                  注册
                </Button>
              </div>
            )}
          </nav>
        </div>

        {/* Auth Dialog */}
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialView={authView} />
      </header>
    </TooltipProvider>
  );
}
