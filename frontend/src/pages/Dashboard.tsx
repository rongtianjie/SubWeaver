import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { taskApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Task } from '@/types';
import { FileText, Clock, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const pageSize = 10;

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await taskApi.list({ page, page_size: pageSize, status });
      setTasks(res.data.tasks);
      setTotal(res.data.total);
    } catch (err) {
      console.error('加载任务失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [page, status]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此任务吗？')) return;
    try {
      await taskApi.delete(id);
      loadTasks();
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl lg:text-3xl font-bold">我的任务</h1>
        <Link to="/">
          <Button size="sm">创建新任务</Button>
        </Link>
      </div>

      {/* 状态筛选 */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: undefined, label: '全部' },
          { value: 'pending', label: '等待中' },
          { value: 'processing', label: '处理中' },
          { value: 'completed', label: '已完成' },
          { value: 'failed', label: '失败' },
        ].map((s) => (
          <Button
            key={s.label}
            variant={status === s.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setStatus(s.value); setPage(1); }}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {/* 任务列表 */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">还没有任务</p>
            <Link to="/">
              <Button variant="outline" className="mt-4">创建第一个任务</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 lg:space-y-4">
          {tasks.map((task) => (
            <Link key={task.id} to={`/tasks/${task.id}`}>
              <Card className="hover:shadow-md transition cursor-pointer">
                <CardContent className="py-4 lg:py-5 lg:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 lg:gap-3">
                        <TaskStatusIcon status={task.status} />
                        <p className="font-medium truncate text-base">{task.title}</p>
                        <TaskBadge status={task.status} />
                      </div>
                      <p className="text-xs lg:text-sm text-gray-500 mt-1.5">
                        {new Date(task.created_at).toLocaleString()}
                        {task.whisper_model && ` · 模型: ${task.whisper_model}`}
                        {task.source_filename && ` · ${task.source_filename}`}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleDelete(task.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 transition ml-4"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            上一页
          </Button>
          <span className="flex items-center text-sm text-gray-500 px-4">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}

function TaskStatusIcon({ status }: { status: Task['status'] }) {
  const icons: Record<string, React.ReactNode> = {
    pending: <Clock className="w-4 h-4 text-gray-400" />,
    queued: <Clock className="w-4 h-4 text-blue-500" />,
    processing: <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />,
    completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
  };
  return <>{icons[status]}</>;
}

function TaskBadge({ status }: { status: Task['status'] }) {
  const styles: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    queued: 'bg-blue-100 text-blue-600',
    processing: 'bg-yellow-100 text-yellow-600',
    completed: 'bg-green-100 text-green-600',
    failed: 'bg-red-100 text-red-600',
  };
  const labels: Record<string, string> = {
    pending: '等待中',
    queued: '排队中',
    processing: '处理中',
    completed: '已完成',
    failed: '失败',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${styles[status] || ''}`}>
      {labels[status] || status}
    </span>
  );
}
