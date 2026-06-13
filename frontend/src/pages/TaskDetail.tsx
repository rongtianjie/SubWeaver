import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { taskApi } from '@/lib/api';
import { useSSE } from '@/hooks/useSSE';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TaskStatusBadge } from '@/components/shared/TaskStatusBadge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Task, TaskOutput } from '@/types';
import { ArrowLeft, Download, Clock, FileText, ChevronRight, Ban, Loader2 } from 'lucide-react';

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [outputs, setOutputs] = useState<TaskOutput[]>([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const { progress, done } = useSSE(id || null);

  useEffect(() => {
    if (!id) return;
    taskApi.get(id).then((res) => setTask(res.data));
    taskApi.getOutputs(id).then((res) => setOutputs(res.data));
  }, [id]);

  useEffect(() => {
    if (progress && task) {
      setTask((prev) =>
        prev ? {
          ...prev,
          status: progress.status as Task['status'],
          progress: progress.progress,
          progress_message: progress.message,
          queue_position: progress.queue_position,
          estimated_seconds: progress.estimated_seconds,
        } : prev
      );
    }
  }, [progress]);

  useEffect(() => {
    if (done && id) {
      taskApi.getOutputs(id).then((res) => setOutputs(res.data));
    }
  }, [done, id]);

  const handleCancel = useCallback(async () => {
    if (!id) return;
    setIsCancelling(true);
    try {
      await taskApi.cancel(id);
      setTask(prev => prev ? { ...prev, cancel_requested: true, progress_message: '正在等待当前阶段结束...' } : prev);
    } catch (err: any) {
      console.error('取消任务失败:', err);
      const msg = err?.response?.data?.detail || err?.message || '未知错误';
      alert(`取消任务失败: ${msg}`);
    } finally {
      setIsCancelling(false);
      setShowCancelDialog(false);
    }
  }, [id]);

  if (!task) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  const progressPercent = task.progress * 100;

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          首页
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{task.title}</span>
      </nav>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{task.title}</CardTitle>
            <div className="flex items-center gap-2">
              <TaskStatusBadge status={task.status} size="md" />
              {task.cancel_requested ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  正在停止...
                </div>
              ) : (task.status === 'queued' || task.status === 'processing') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 h-8 gap-1"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Ban className="w-3.5 h-3.5" />
                  )}
                  {isCancelling ? '取消中...' : '停止'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress */}
          {task.status !== 'completed' && task.status !== 'failed' && task.status !== 'cancelled' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                  {task.cancel_requested ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-primary" />
                  )}
                  <span className="truncate">{task.progress_message || (task.status === 'queued' ? '排队等待中...' : '等待处理...')}</span>
                </div>
                <span className="font-medium text-primary shrink-0 ml-3">{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2.5" />
              {task.status === 'processing' && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{task.started_at ? `已运行 ${formatDuration((Date.now() - new Date(task.started_at).getTime()) / 1000)}` : '启动中...'}</span>
                  <span>Whisper {task.whisper_model}</span>
                </div>
              )}
              {(task.status === 'pending' || task.status === 'queued') && task.queue_position && (
                <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 p-3 rounded-xl border border-warning/20">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    队列位置: 第 {task.queue_position} 位
                    {task.estimated_seconds ? `，预计等待 ${Math.ceil(task.estimated_seconds / 60)} 分钟` : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Task Info */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <InfoItem label="输入来源" value={task.source_type === 'upload' ? '文件上传' : '在线链接'} />
            <InfoItem label="Whisper 模型" value={task.whisper_model} capitalize />
            {task.source_filename && <InfoItem label="文件名" value={task.source_filename} truncate />}
            <InfoItem label="创建时间" value={new Date(task.created_at).toLocaleString()} />
          </div>

          {/* Error */}
          {task.status === 'failed' && task.error_message && (
            <div className="text-sm text-destructive bg-destructive/10 p-4 rounded-xl border border-destructive/20">
              <p className="font-medium mb-1">错误信息:</p>
              <p>{task.error_message}</p>
            </div>
          )}

          {/* Output Files */}
          {task.status === 'completed' && outputs.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                输出文件
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {outputs.map((output) => (
                  <div key={output.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border border-border/50 hover:border-primary/20 transition-all group">
                    <div>
                      <p className="text-sm font-medium">{formatLabel(output)}</p>
                      <p className="text-xs text-muted-foreground">
                        {output.file_size ? `${(output.file_size / 1024).toFixed(1)} KB` : ''}
                        {output.language_pair ? ` · ${output.language_pair}` : ''}
                      </p>
                    </div>
                    <Button variant="soft" size="sm" asChild>
                      <a href={taskApi.downloadUrl(task.id, output.id)} download>
                        <Download className="w-4 h-4" /> 下载
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 停止任务确认弹窗 */}
      <Dialog open={showCancelDialog} onOpenChange={(open) => !open && setShowCancelDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认停止任务</DialogTitle>
            <DialogDescription>
              停止后，任务将被标记为"已取消"且无法继续执行。此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              返回
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  取消中...
                </>
              ) : (
                '确认停止'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ label, value, capitalize, truncate }: { label: string; value: string; capitalize?: boolean; truncate?: boolean }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className={`text-sm font-medium mt-0.5 ${capitalize ? 'capitalize' : ''} ${truncate ? 'truncate' : ''}`}>{value}</p>
    </div>
  );
}

function formatLabel(output: TaskOutput): string {
  const map: Record<string, string> = { txt: '纯文本', srt: '英文字幕', bilingual_srt: '双语字幕' };
  return map[output.format_type] || output.format_type;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${Math.round(seconds % 60)}秒`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}时${m}分`;
}
