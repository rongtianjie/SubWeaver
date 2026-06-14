import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Loader2, Users, Search, MoreHorizontal, Shield, ShieldOff,
  CheckCircle2, XCircle, Trash2, KeyRound, Clock, FileText,
  ChevronLeft, ChevronRight, Copy, Check, Ban, Timer,
} from 'lucide-react';
import type { UserItem, UserListResponse, Task } from '@/types';

const PAGE_SIZE = 20;

function formatTime(isoStr: string | null): string {
  if (!isoStr) return '--';
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function StatusBadgeIcon({ status }: { status: Task['status'] }) {
  const config: Record<Task['status'], { icon: React.ReactNode; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'default'; label: string }> = {
    pending: { icon: <Clock className="w-3 h-3" />, variant: 'secondary', label: '等待中' },
    queued: { icon: <Timer className="w-3 h-3" />, variant: 'default', label: '排队中' },
    processing: { icon: <Loader2 className="w-3 h-3 animate-spin" />, variant: 'warning', label: '处理中' },
    completed: { icon: <CheckCircle2 className="w-3 h-3" />, variant: 'success', label: '已完成' },
    failed: { icon: <XCircle className="w-3 h-3" />, variant: 'destructive', label: '失败' },
    cancelled: { icon: <Ban className="w-3 h-3" />, variant: 'secondary', label: '已取消' },
  };
  const c = config[status];
  if (!c) return null;
  return (
    <Badge variant={c.variant} className="gap-1 shrink-0 text-xs">
      {c.icon}
      {c.label}
    </Badge>
  );
}

export default function UserManagement() {
  const [data, setData] = useState<UserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Dialog states
  const [passwordDialog, setPasswordDialog] = useState<{ user: UserItem; password: string } | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; action: () => void; loading: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // User tasks modal
  const [tasksDialog, setTasksDialog] = useState<{ user: UserItem; tasks: Task[]; total: number; page: number; loading: boolean } | null>(null);

  const loadUsers = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers({ page: p, page_size: PAGE_SIZE, q: q || undefined });
      setData(res.data);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers(page, searchQuery);
  }, [page, searchQuery, loadUsers]);

  const handleSearch = () => {
    setPage(1);
    setSearchQuery(searchInput);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleToggleActive = async (user: UserItem) => {
    const newState = user.is_active ? '禁用' : '启用';
    setConfirmDialog({
      title: `${newState}用户`,
      description: user.is_active
        ? `确定要禁用用户「${user.username}」吗？禁用后该用户将无法登录系统。`
        : `确定要启用用户「${user.username}」吗？启用后该用户可以正常登录。`,
      action: async () => {
        setActionLoading(true);
        try {
          await adminApi.toggleUserActive(user.id);
          loadUsers(page, searchQuery);
        } catch {
          // ignore
        }
        setActionLoading(false);
        setConfirmDialog(null);
      },
      loading: actionLoading,
    });
  };

  const handleRoleToggle = async (user: UserItem) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const newRoleLabel = newRole === 'admin' ? '管理员' : '普通用户';
    setConfirmDialog({
      title: '切换角色',
      description: `确定要将用户「${user.username}」的角色变更为「${newRoleLabel}」吗？`,
      action: async () => {
        setActionLoading(true);
        try {
          await adminApi.updateUserRole(user.id, newRole);
          loadUsers(page, searchQuery);
        } catch {
          // ignore
        }
        setActionLoading(false);
        setConfirmDialog(null);
      },
      loading: actionLoading,
    });
  };

  const handleDeleteUser = async (user: UserItem) => {
    setConfirmDialog({
      title: '删除用户',
      description: `确定要删除用户「${user.username}」吗？该用户提交的任务记录将被保留，但关联关系将解除。此操作不可撤销。`,
      action: async () => {
        setActionLoading(true);
        try {
          await adminApi.deleteUser(user.id);
          loadUsers(page, searchQuery);
        } catch {
          // ignore
        }
        setActionLoading(false);
        setConfirmDialog(null);
      },
      loading: actionLoading,
    });
  };

  const handleResetPassword = async (user: UserItem) => {
    try {
      const res = await adminApi.resetPassword(user.id);
      setPasswordDialog({ user, password: res.data.new_password });
    } catch {
      // ignore
    }
  };

  const handleCopyPassword = () => {
    if (passwordDialog) {
      navigator.clipboard.writeText(passwordDialog.password);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    }
  };

  const loadUserTasks = async (user: UserItem, p: number) => {
    setTasksDialog(prev => prev ? { ...prev, loading: true } : null);
    try {
      const res = await adminApi.listUserTasks(user.id, { page: p, page_size: 10 });
      setTasksDialog({
        user,
        tasks: res.data.tasks,
        total: res.data.total,
        page: res.data.page,
        loading: false,
      });
    } catch {
      setTasksDialog(prev => prev ? { ...prev, loading: false } : null);
    }
  };

  const handleViewTasks = (user: UserItem) => {
    setTasksDialog({ user, tasks: [], total: 0, page: 1, loading: true });
    loadUserTasks(user, 1);
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="用户管理" description="管理系统中的所有用户账号" />

      {/* 搜索栏 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索用户名或邮箱..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-9"
              />
            </div>
            <Button variant="secondary" onClick={handleSearch} size="sm">
              搜索
            </Button>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(1); }}
              >
                清除
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 用户列表 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              用户列表
            </CardTitle>
            {data && (
              <span className="text-xs text-muted-foreground">
                共 {data.total} 条
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.users.length === 0 ? (
            <div className="py-12 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-muted mb-3">
                <Users className="w-6 h-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? '没有找到匹配的用户' : '暂无用户'}
              </p>
            </div>
          ) : (
            <>
              {/* 表头（桌面端可见） */}
              <div className="hidden md:grid grid-cols-[1.2fr_1.5fr_0.7fr_0.6fr_0.5fr_0.9fr_60px] gap-4 px-6 py-3 text-xs text-muted-foreground border-b border-border/50 font-medium">
                <span>用户名</span>
                <span>邮箱</span>
                <span>角色</span>
                <span>状态</span>
                <span>任务数</span>
                <span>注册时间</span>
                <span>操作</span>
              </div>

              {/* 用户行 */}
              <div className="divide-y divide-border/50">
                {data.users.map((user) => (
                  <div key={user.id} className="px-6 py-3 hover:bg-muted/40 transition-colors">
                    {/* 桌面端 */}
                    <div className="hidden md:grid grid-cols-[1.2fr_1.5fr_0.7fr_0.6fr_0.5fr_0.9fr_60px] gap-4 items-center">
                      <span className="text-sm font-medium truncate" title={user.username}>
                        {user.username}
                      </span>
                      <span className="text-sm text-muted-foreground truncate" title={user.email}>
                        {user.email}
                      </span>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="w-fit text-xs">
                        {user.role === 'admin' ? '管理员' : '用户'}
                      </Badge>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-success' : 'bg-muted-foreground/40'}`} />
                        <span className="text-sm text-muted-foreground">
                          {user.is_active ? '活跃' : '已禁用'}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">{user.task_count}</span>
                      <span className="text-sm text-muted-foreground truncate" title={formatTime(user.created_at)}>
                        {formatTime(user.created_at)}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => handleRoleToggle(user)}>
                            {user.role === 'admin' ? (
                              <><ShieldOff className="w-4 h-4 mr-2" />降级为用户</>
                            ) : (
                              <><Shield className="w-4 h-4 mr-2" />提升为管理员</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                            {user.is_active ? (
                              <><XCircle className="w-4 h-4 mr-2" />禁用账号</>
                            ) : (
                              <><CheckCircle2 className="w-4 h-4 mr-2" />启用账号</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewTasks(user)}>
                            <FileText className="w-4 h-4 mr-2" />查看任务
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                            <KeyRound className="w-4 h-4 mr-2" />重置密码
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteUser(user)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />删除用户
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* 移动端 */}
                    <div className="md:hidden space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">{user.username}</span>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="text-xs shrink-0">
                            {user.role === 'admin' ? '管理员' : '用户'}
                          </Badge>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => handleRoleToggle(user)}>
                              {user.role === 'admin' ? <><ShieldOff className="w-4 h-4 mr-2" />降级为用户</> : <><Shield className="w-4 h-4 mr-2" />提升为管理员</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                              {user.is_active ? <><XCircle className="w-4 h-4 mr-2" />禁用账号</> : <><CheckCircle2 className="w-4 h-4 mr-2" />启用账号</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewTasks(user)}>
                              <FileText className="w-4 h-4 mr-2" />查看任务
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                              <KeyRound className="w-4 h-4 mr-2" />重置密码
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteUser(user)}>
                              <Trash2 className="w-4 h-4 mr-2" />删除用户
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{user.email}</span>
                        <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-success' : 'bg-muted-foreground/40'}`} />
                          {user.is_active ? '活跃' : '已禁用'}
                        </div>
                        <span>任务数: {user.task_count}</span>
                        <span>{formatTime(user.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">
                    第 {data.page} / {totalPages} 页
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={data.page <= 1}
                      onClick={() => { const np = data.page - 1; setPage(np); }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={data.page >= totalPages}
                      onClick={() => { const np = data.page + 1; setPage(np); }}
                    >
                      下一页
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 确认操作弹窗 */}
      <Dialog open={confirmDialog !== null} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title}</DialogTitle>
            <DialogDescription>{confirmDialog?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              取消
            </Button>
            <Button
              variant={confirmDialog?.title.includes('删除') ? 'destructive' : 'default'}
              onClick={confirmDialog?.action}
              disabled={confirmDialog?.loading}
            >
              {confirmDialog?.loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码弹窗 */}
      <Dialog open={passwordDialog !== null} onOpenChange={(open) => { if (!open) { setPasswordDialog(null); setPasswordCopied(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>密码已重置</DialogTitle>
            <DialogDescription>
              用户「{passwordDialog?.user.username}」的密码已重置为：
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 p-4 bg-muted rounded-xl">
            <code className="flex-1 text-lg font-mono font-bold tracking-wider text-center select-all">
              {passwordDialog?.password}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={handleCopyPassword}
            >
              {passwordCopied ? (
                <><Check className="w-4 h-4 mr-1 text-success" />已复制</>
              ) : (
                <><Copy className="w-4 h-4 mr-1" />复制</>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            请将此密码安全地转交给用户，刷新页面后将无法再次查看。
          </p>
          <DialogFooter>
            <Button onClick={() => { setPasswordDialog(null); setPasswordCopied(false); }}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看用户任务弹窗 */}
      <Dialog
        open={tasksDialog !== null}
        onOpenChange={(open) => { if (!open) setTasksDialog(null); }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              用户任务 — {tasksDialog?.user.username}
            </DialogTitle>
            <DialogDescription>
              共 {tasksDialog?.total || 0} 个任务
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
            {tasksDialog?.loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : tasksDialog && tasksDialog.tasks.length > 0 ? (
              <div className="space-y-2">
                {tasksDialog.tasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate" title={task.title}>{task.title}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadgeIcon status={task.status} />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTime(task.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <FileText className="w-6 h-6 text-muted-foreground/60 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">该用户暂无任务记录</p>
              </div>
            )}
          </div>
          {/* 任务分页 */}
          {tasksDialog && tasksDialog.total > 10 && (
            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <span className="text-xs text-muted-foreground">
                第 {tasksDialog.page} / {Math.ceil(tasksDialog.total / 10)} 页
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={tasksDialog.page <= 1}
                  onClick={() => loadUserTasks(tasksDialog.user, tasksDialog.page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={tasksDialog.page >= Math.ceil(tasksDialog.total / 10)}
                  onClick={() => loadUserTasks(tasksDialog.user, tasksDialog.page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
