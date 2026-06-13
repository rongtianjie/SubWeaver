import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TaskStatusBadge } from '@/components/shared/TaskStatusBadge';
import { Trash2, Loader2 } from 'lucide-react';
import type { Task } from '@/types';

interface TaskListCardProps {
  task: Task;
  onDelete?: (id: string) => void;
  compact?: boolean;
}

export function TaskListCard({ task, onDelete, compact }: TaskListCardProps) {
  const progressPercent = task.progress * 100;

  return (
    <Link to={`/tasks/${task.id}`}>
      <Card className="hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group">
        <CardContent className={compact ? 'py-3 px-4' : 'py-4 px-5'}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium truncate text-sm">{task.title}</p>
                <TaskStatusBadge status={task.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {new Date(task.created_at).toLocaleString()}
                {task.whisper_model && ` · 模型: ${task.whisper_model}`}
                {task.source_filename && ` · ${task.source_filename}`}
              </p>
              {task.status === 'processing' && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {task.cancel_requested ? (
                      <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                    ) : (
                      <Loader2 className="w-3 h-3 animate-spin shrink-0 text-primary" />
                    )}
                    <span className="truncate">{task.progress_message || '处理中...'}</span>
                  </div>
                  <Progress value={progressPercent} className="h-1" />
                </div>
              )}
            </div>
            {onDelete && (
              <button
                onClick={(e) => { e.preventDefault(); onDelete(task.id); }}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0 rounded-lg hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
