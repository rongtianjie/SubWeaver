import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Activity, Users, FileText, HardDrive, Loader2 } from 'lucide-react';

interface Stats {
  total_tasks: number;
  pending_tasks: number;
  processing_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  total_users: number;
  storage_usage_mb: number;
}

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getStats().then((res) => setStats(res.data)).finally(() => setLoading(false));
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
    { label: '等待中', value: stats.pending_tasks, color: 'bg-muted-foreground/40' },
    { label: '处理中', value: stats.processing_tasks, color: 'bg-warning' },
    { label: '失败', value: stats.failed_tasks, color: 'bg-destructive' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="概览" description="系统运行状态一览" />

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">任务状态分布</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {statusBars.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-sm w-16 text-muted-foreground">{item.label}</span>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-500`}
                    style={{ width: `${stats.total_tasks > 0 ? (item.value / stats.total_tasks) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-12 text-right">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
