import { Clock, CheckCircle2, XCircle, Loader2, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Task } from '@/types';

const statusConfig: Record<Task['status'], { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive'; icon: React.ReactNode }> = {
  pending: { label: '等待中', variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
  queued: { label: '排队中', variant: 'default', icon: <Timer className="w-3 h-3" /> },
  processing: { label: '处理中', variant: 'warning', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completed: { label: '已完成', variant: 'success', icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { label: '失败', variant: 'destructive', icon: <XCircle className="w-3 h-3" /> },
};

interface TaskStatusBadgeProps {
  status: Task['status'];
  size?: 'sm' | 'md';
}

export function TaskStatusBadge({ status, size = 'sm' }: TaskStatusBadgeProps) {
  const config = statusConfig[status];
  if (!config) return null;

  return (
    <Badge variant={config.variant} className={`gap-1 ${size === 'md' ? 'px-3 py-1 text-xs' : ''}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

export function TaskStatusIcon({ status }: { status: Task['status'] }) {
  const config = statusConfig[status];
  if (!config) return null;
  return <>{config.icon}</>;
}
