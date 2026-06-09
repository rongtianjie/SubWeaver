import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { taskApi } from '@/lib/api';
import { useSSE } from '@/hooks/useSSE';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Task, TaskOutput } from '@/types';
import { ArrowLeft, Download, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [outputs, setOutputs] = useState<TaskOutput[]>([]);
  const { progress, done } = useSSE(id || null);

  useEffect(() => {
    if (!id) return;
    taskApi.get(id).then((res) => setTask(res.data));
    taskApi.getOutputs(id).then((res) => setOutputs(res.data));
  }, [id]);

  // SSE 推送时更新 task 状态
  useEffect(() => {
    if (progress && task) {
      setTask((prev) =>
        prev
          ? {
              ...prev,
              status: progress.status as Task['status'],
              progress: progress.progress,
              progress_message: progress.message,
              queue_position: progress.queue_position,
              estimated_seconds: progress.estimated_seconds,
            }
          : prev
      );
    }
  }, [progress]);

  // 完成后重新加载 outputs
  useEffect(() => {
    if (done && id) {
      taskApi.getOutputs(id).then((res) => setOutputs(res.data));
    }
  }, [done, id]);

  if (!task) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const progressPercent = task.progress * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4 mr-1" /> 返回首页
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{task.title}</CardTitle>
            <StatusBadge status={task.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 进度条 */}
          {task.status !== 'completed' && task.status !== 'failed' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{task.progress_message || '等待处理...'}</span>
                <span className="font-medium">{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} />
            </div>
          )}

          {/* 队列信息 */}
          {(task.status === 'pending' || task.status === 'queued') && task.queue_position && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
              <Clock className="w-4 h-4" />
              <span>
                队列位置: 第 {task.queue_position} 位
                {task.estimated_seconds
                  ? `，预计等待 ${Math.ceil(task.estimated_seconds / 60)} 分钟`
                  : ''}
              </span>
            </div>
          )}

          {/* 任务信息 */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">输入来源</span>
              <p>{task.source_type === 'upload' ? '文件上传' : '在线链接'}</p>
            </div>
            <div>
              <span className="text-gray-500">Whisper 模型</span>
              <p className="capitalize">{task.whisper_model}</p>
            </div>
            {task.source_filename && (
              <div>
                <span className="text-gray-500">文件名</span>
                <p className="truncate">{task.source_filename}</p>
              </div>
            )}
            <div>
              <span className="text-gray-500">创建时间</span>
              <p>{new Date(task.created_at).toLocaleString()}</p>
            </div>
          </div>

          {/* 错误信息 */}
          {task.status === 'failed' && task.error_message && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <p className="font-medium">错误信息:</p>
              <p>{task.error_message}</p>
            </div>
          )}

          {/* 输出文件 */}
          {task.status === 'completed' && outputs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">输出文件</h3>
              {outputs.map((output) => (
                <div
                  key={output.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium">{formatLabel(output)}</p>
                    <p className="text-xs text-gray-500">
                      {output.file_size
                        ? `${(output.file_size / 1024).toFixed(1)} KB`
                        : ''}
                      {output.language_pair ? ` | ${output.language_pair}` : ''}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={taskApi.downloadUrl(task.id, output.id)} download>
                      <Download className="w-4 h-4 mr-1" /> 下载
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: Task['status'] }) {
  const styles: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    queued: 'bg-blue-100 text-blue-600',
    processing: 'bg-yellow-100 text-yellow-600',
    completed: 'bg-green-100 text-green-600',
    failed: 'bg-red-100 text-red-600',
  };

  const icons: Record<string, React.ReactNode> = {
    processing: <Loader2 className="w-3 h-3 animate-spin" />,
    completed: <CheckCircle2 className="w-3 h-3" />,
    failed: <XCircle className="w-3 h-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || ''}`}>
      {icons[status]}
      {statusLabel(status)}
    </span>
  );
}

function statusLabel(status: Task['status']): string {
  const map: Record<string, string> = {
    pending: '等待中',
    queued: '排队中',
    processing: '处理中',
    completed: '已完成',
    failed: '失败',
  };
  return map[status] || status;
}

function formatLabel(output: TaskOutput): string {
  const map: Record<string, string> = {
    txt: '纯文本',
    srt: '英文字幕',
    bilingual_srt: '双语字幕',
  };
  return map[output.format_type] || output.format_type;
}
