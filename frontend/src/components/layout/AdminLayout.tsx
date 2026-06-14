import { useEffect, useState, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/lib/api';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { UserMenu } from '@/components/shared/UserMenu';
import { Separator } from '@/components/ui/separator';
import { Loader2, Film, BarChart3, Settings, Cpu, MessageSquare, FileText, Users, ArrowLeft, FolderOpen } from 'lucide-react';
import { BackendStatusIndicator } from '@/components/shared/BackendStatusIndicator';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/admin', label: '概览', icon: BarChart3, end: true },
  { to: '/admin/users', label: '用户管理', icon: Users },
  { to: '/admin/config', label: '系统配置', icon: Settings },
  { to: '/admin/models', label: '模型管理', icon: Cpu },
  { to: '/admin/llm', label: 'LLM 配置', icon: MessageSquare },
  { to: '/admin/logs', label: '系统日志', icon: FileText },
  { to: '/admin/files', label: '文件管理', icon: FolderOpen },
];

export function AdminLayout() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const collapsed = !isHovered;

  const handleNavClick = useCallback(() => {
    setIsHovered(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Not logged in: check if admin exists, then redirect appropriately
      authApi.checkAdminExists().then((res) => {
        if (!res.data.exists) {
          navigate('/admin/setup', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }).catch(() => {
        navigate('/', { replace: true });
      });
      return;
    }
    if (user.role !== 'admin') {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Top bar */}
      <header className="sticky top-0 z-40 w-full border-b glass">
        <div className="px-4 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="p-1.5 rounded-xl bg-gradient-to-br from-primary to-purple-500 shadow-sm group-hover:shadow-md transition-shadow">
                <Film className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight">
                <span className="text-gradient">SubWeaver</span>
              </span>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <span className="text-sm font-medium text-muted-foreground">管理后台</span>
          </div>
          <div className="flex items-center gap-2">
            <BackendStatusIndicator />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            'shrink-0 border-r bg-card/50 min-h-[calc(100vh-4rem)] sticky top-16 self-start transition-all duration-300 ease-in-out overflow-hidden',
            collapsed ? 'w-16' : 'w-60'
          )}
        >
          <nav className="p-2 space-y-1">
            {/* Back to home */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/"
                  onClick={handleNavClick}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-all duration-200 mb-1'
                  )}
                >
                  <ArrowLeft className="w-[18px] h-[18px] shrink-0" />
                  <span className={cn('whitespace-nowrap transition-opacity duration-300', collapsed ? 'opacity-0' : '')}>返回首页</span>
                </Link>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">返回首页</TooltipContent>}
            </Tooltip>

            <Separator className="mb-2" />

            {/* Nav items */}
            {navItems.map((item) => {
              const linkContent = ({ isActive }: { isActive: boolean }) => (
                <div
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/10 text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  <span className={cn('whitespace-nowrap transition-opacity duration-300', collapsed ? 'opacity-0' : '')}>{item.label}</span>
                </div>
              );

              return collapsed ? (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>
                    <NavLink to={item.to} end={item.end} onClick={handleNavClick}>
                      {linkContent}
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                <NavLink key={item.to} to={item.to} end={item.end} onClick={handleNavClick}>
                  {linkContent}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-6 lg:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
    </TooltipProvider>
  );
}
