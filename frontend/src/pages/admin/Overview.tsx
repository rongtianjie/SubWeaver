import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Activity, Users, FileText, HardDrive, Loader2, Cpu, User, PlayCircle,
  Clock, CheckCircle2, XCircle, Timer, Globe, Upload, ChevronLeft, ChevronRight, AlertCircle, Ban, Trash2,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Task } from '@/types';

interface Stats {
  total_tasks: number;
  pending_tasks: number;
  processing_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  cancelled_tasks: number;
  total_users: number;
  storage_usage_mb: number;
}

interface TaskListResponse {
  tasks: Task[];
  total: number;
  page: number;
  page_size: number;
}

const PAGE_SIZE = 20;

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${Math.round(seconds % 60)}秒`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}时${m}分`;
}

function formatTime(isoStr: string | null): string {
  if (!isoStr) return '--';
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getTaskDuration(task: Task): string {
  if (task.status === 'pending' || task.status === 'queued') return '等待中';
  if (task.status === 'processing') {
    if (!task.started_at) return '处理中';
    const elapsed = (Date.now() - new Date(task.started_at).getTime()) / 1000;
    return `处理中 (${formatDuration(elapsed)})`;
  }
  if (task.status === 'failed') return '--';
  // completed
  if (!task.started_at || !task.completed_at) return '--';
  const dur = (new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / 1000;
  return formatDuration(dur);
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

function SourceTypeIcon({ source_type }: { source_type: string }) {
  if (source_type === 'url') return <Globe className="w-3.5 h-3.5 shrink-0" />;
  return <Upload className="w-3.5 h-3.5 shrink-0" />;
}

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<TaskListResponse | null>(null);
  const [allPage, setAllPage] = useState(1);
  const [loadingAll, setLoadingAll] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getStats().then((res) => setStats(res.data)).finally(() => setLoading(false));
  }, []);

  const loadActiveTasks = useCallback(async () => {
    try {
      const res = await adminApi.listTasks({ status: 'processing', page_size: 10 });
      setActiveTasks(res.data.tasks);
    } catch { /* ignore */ }
  }, []);

  const loadAllTasks = useCallback(async (page: number) => {
    setLoadingAll(true);
    try {
      const res = await adminApi.listTasks({ page, page_size: PAGE_SIZE });
      setAllTasks(res.data);
    } catch { /* ignore */ }
    setLoadingAll(false);
  }, []);

  // 首次加载及定时刷新
  useEffect(() => {
    loadActiveTasks();
    loadAllTasks(1);
    const interval = setInterval(() => {
      loadActiveTasks();
      if (allPage === 1) loadAllTasks(1);
    }, 5000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 翻页时重新加载
  const handlePageChange = (page: number) => {
    setAllPage(page);
    loadAllTasks(page);
  };

  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      await adminApi.deleteTask(taskId);
      // 刷新列表
      loadAllTasks(allPage);
      loadActiveTasks();
      // 刷新统计
      adminApi.getStats().then((res) => setStats(res.data));
    } catch (err) {
      console.error('删除任务失败:', err);
      alert('删除任务失败，请稍后重试');
    } finally {
      setDeletingId(null);
    }
  }, [allPage, loadAllTasks, loadActiveTasks]);

  const handleCancelTask = useCallback(async (taskId: string) => {
    try {
      await adminApi.cancelTask(taskId);
      // 立即更新本地状态，显示"正在停止..."
      setActiveTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, cancel_requested: true, progress_message: '正在等待当前阶段结束...' }
          : t
      ));
    } catch (err) {
      console.error('取消任务失败:', err);
    } finally {
      setCancellingId(null);
    }
  }, []);

  if (loading || !stats) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  const statCards = [
    { label: '总任务数', value: stats.total_tasks, icon: FileText, color: 'text-primary', bg: 'bg-primary/10' },
    { label: '处理中', value: stats.processing_tasks, icon: Activity, color: 'text-warning', bg: 'bg-warning/10' },
    { label: '用户数', value: stats.total_users, icon: Users, color: 'text-success', bg: 'bg-success/10' },
    { label: '存储占用', value: `${stats.storage_usage_mb} MB`, icon: HardDrive, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  const statusBars = [
    { label: '已完成', value: stats.completed_tasks, color: 'bg-success' },
    { label: '处理中', value: stats.processing_tasks, color: 'bg-warning' },
    { label: '等待中', value: stats.pending_tasks, color: 'bg-muted-foreground/40' },
    { label: '失败', value: stats.failed_tasks, color: 'bg-destructive' },
    { label: '已取消', value: stats.cancelled_tasks, color: 'bg-purple-500/40' },
  ];

  const totalPages = allTasks ? Math.ceil(allTasks.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="概览" description="系统运行状态一览" />

      {/* 4 个统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${card.bg}`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <span className="text-2xl font-bold">{card.value}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 任务状态分布 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">任务状态分布</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {statusBars.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="flex-none w-20 text-sm text-muted-foreground whitespace-nowrap overflow-visible">{item.label}</span>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-500`}
                    style={{ width: `${stats.total_tasks > 0 ? (item.value / stats.total_tasks) * 100 : 0}%` }}
                  />
                </div>
                <span className="flex-none w-10 text-sm font-medium text-right">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 待处理 / 执行中的任务 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-warning" />
            <CardTitle className="text-base">正在执行</CardTitle>
          </div>
          {activeTasks.length > 0 && (
            <Badge variant="warning" className="text-xs">
              共 {activeTasks.length} 个
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {activeTasks.length === 0 ? (
            <div className="py-8 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-muted mb-3">
                <PlayCircle className="w-6 h-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm text-muted-foreground">当前没有正在执行的任务</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeTasks.map((task) => (
                <Card key={task.id} className="border border-border/50">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate" title={task.title}>{task.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadgeIcon status={task.status} />
                        {task.status === 'processing' && !task.cancel_requested && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10 h-7 text-xs gap-1"
                            onClick={() => setCancellingId(task.id)}
                            disabled={cancellingId === task.id}
                          >
                            {cancellingId === task.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Ban className="w-3 h-3" />
                            )}
                            {cancellingId === task.id ? '取消中...' : '停止'}
                          </Button>
                        )}
                        {task.status === 'processing' && task.cancel_requested && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            正在停止...
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1" title="Whisper 模型">
                        <Cpu className="w-3.5 h-3.5" />
                        {task.whisper_model}
                      </span>
                      {task.translate_llm_model && (
                        <span className="flex items-center gap-1" title="翻译 LLM 模型">
                          <Cpu className="w-3.5 h-3.5" />
                          LLM: {task.translate_llm_model}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {task.username || '游客'}
                      </span>
                      {task.source_filename && (
                        <span className="flex items-center gap-1 truncate max-w-[200px]" title={task.source_filename}>
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          {task.source_filename}
                        </span>
                      )}
                      {task.queue_position != null && task.queue_position > 0 && (
                        <span className="flex items-center gap-1 text-muted-foreground/70">
                          <Timer className="w-3.5 h-3.5" />
                          队列位置: #{task.queue_position}
                        </span>
                      )}
                    </div>
                    {task.status === 'processing' && task.progress_message && (
                      <p className="text-xs truncate flex items-center gap-1">
                        {task.cancel_requested && (
                          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                        )}
                        <span>{task.progress_message}</span>
                      </p>
                    )}
                    {task.status === 'processing' && (
                      <div className="space-y-1">
                        <Progress value={task.progress * 100} className="h-1.5" />
                        <div className="flex items-center justify-end">
                          <p className="text-xs text-muted-foreground">
                            {Math.round(task.progress * 100)}%
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 全部任务列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">全部任务</CardTitle>
            {allTasks && (
              <span className="text-xs text-muted-foreground">
                共 {allTasks.total} 条
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingAll ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !allTasks || allTasks.tasks.length === 0 ? (
            <div className="py-12 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-muted mb-3">
                <FileText className="w-6 h-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm text-muted-foreground">暂无任务记录</p>
            </div>
          ) : (
            <>
              {/* 表头（桌面端可见） */}
              <div className="hidden md:grid grid-cols-[75px_1.2fr_0.7fr_0.8fr_0.6fr_0.6fr_0.7fr_0.6fr_60px] gap-4 px-6 py-3 text-xs text-muted-foreground border-b border-border/50 font-medium">
                <span>状态</span>
                <span>文件名</span>
                <span>提交者</span>
                <span>提交时间</span>
                <span>文件大小</span>
                <span>Whisper</span>
                <span>LLM</span>
                <span>耗时</span>
                <span>操作</span>
              </div>

              {/* 任务行 */}
              <div className="divide-y divide-border/50">
                {allTasks.tasks.map((task) => (
                  <div key={task.id} className="px-6 py-3 hover:bg-muted/40 transition-colors">
                    {/* 桌面端 */}
                    <div className="hidden md:grid grid-cols-[75px_1.2fr_0.7fr_0.8fr_0.6fr_0.6fr_0.7fr_0.6fr_60px] gap-4 items-center">
                      <StatusBadgeIcon status={task.status} />
                      <div className="flex items-center gap-1.5 min-w-0">
                        <SourceTypeIcon source_type={task.source_type} />
                        <span className="text-sm truncate" title={task.title}>
                          {task.title}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground truncate" title={task.username || '游客'}>
                        {task.username || <span className="text-muted-foreground/60">游客</span>}
                      </span>
                      <span className="text-sm text-muted-foreground truncate" title={formatTime(task.created_at)}>{formatTime(task.created_at)}</span>
                      <span className="text-sm text-muted-foreground truncate" title={formatFileSize(task.file_size)}>{formatFileSize(task.file_size)}</span>
                      <span className="text-sm text-muted-foreground truncate" title={task.whisper_model}>{task.whisper_model}</span>
                      <span className="text-sm text-muted-foreground truncate" title={task.translate_llm_model || '-'}>
                        {task.translate_llm_model || <span className="text-muted-foreground/60">-</span>}
                      </span>
                      <span className="text-sm text-muted-foreground truncate" title={getTaskDuration(task)}>{getTaskDuration(task)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        title="删除任务"
                        onClick={() => setDeletingId(task.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* 移动端 */}
                    <div className="md:hidden space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <SourceTypeIcon source_type={task.source_type} />
                          <span className="text-sm font-medium truncate">{task.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            title="删除任务"
                            onClick={() => setDeletingId(task.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          <StatusBadgeIcon status={task.status} />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {task.username || '游客'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(task.created_at)}
                        </span>
                        <span className="flex items-center gap-1" title={formatFileSize(task.file_size)}>
                          <HardDrive className="w-3 h-3" />
                          {formatFileSize(task.file_size)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Cpu className="w-3 h-3" />
                          {task.whisper_model}
                        </span>
                        {task.translate_llm_model && (
                          <span className="flex items-center gap-1">
                            <Cpu className="w-3 h-3" />
                            LLM: {task.translate_llm_model}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {getTaskDuration(task)}
                        </span>
                      </div>
                      {task.status === 'failed' && task.error_message && (
                        <p className="text-xs text-destructive truncate flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          {task.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">
                    第 {allTasks.page} / {totalPages} 页
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={allTasks.page <= 1}
                      onClick={() => handlePageChange(allTasks.page - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={allTasks.page >= totalPages}
                      onClick={() => handlePageChange(allTasks.page + 1)}
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

      {/* 取消任务确认弹窗 */}
      <Dialog open={cancellingId !== null} onOpenChange={(open) => !open && setCancellingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认停止任务</DialogTitle>
            <DialogDescription>
              停止后，任务将被标记为"已取消"且无法继续执行。此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancellingId(null)}>
              返回
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancellingId && handleCancelTask(cancellingId)}
            >
              确认停止
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除任务确认弹窗 */}
      <Dialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除任务</DialogTitle>
            <DialogDescription>
              删除后，任务记录及所有关联的媒体文件和输出文件将被永久删除，此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              返回
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && handleDeleteTask(deletingId)}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
