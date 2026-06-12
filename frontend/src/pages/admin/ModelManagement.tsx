import { useEffect, useState } from 'react';
import { modelApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { Cpu, Download, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';
import type { ModelInfo } from '@/types';

export default function ModelManagement() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    modelApi.list().then((res) => setModels(res.data.models)).finally(() => setLoading(false));
  }, []);

  const handleDownload = async (name: string) => {
    setDownloading((prev) => new Set(prev).add(name));
    try {
      await modelApi.download(name);
      const res = await modelApi.list();
      setModels(res.data.models);
    } catch (err) {
      console.error('下载模型失败:', err);
    } finally {
      setDownloading((prev) => { const next = new Set(prev); next.delete(name); return next; });
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('确定要删除所有已下载的 Whisper 模型吗？删除后需要重新下载才能使用。')) return;
    try {
      await modelApi.deleteAll();
      const res = await modelApi.list();
      setModels(res.data.models);
    } catch (err) {
      console.error('删除模型失败:', err);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="模型管理"
        description="查看和下载 Whisper 语音识别模型，下载后可在创建任务时选用"
        actions={
          <Button variant="outline" size="sm" onClick={handleDeleteAll} className="text-destructive border-destructive/20 hover:bg-destructive/10">
            <Trash2 className="w-4 h-4" />
            删除全部
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6 space-y-2">
          {models.map((model) => (
            <div key={model.name} className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-primary/20 transition-all">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-muted">
                    <Cpu className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="font-medium">{model.label}</span>
                  <span className="text-xs text-muted-foreground">({model.name})</span>
                  {model.is_downloaded ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <XCircle className="w-4 h-4 text-muted-foreground/30" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 ml-10">
                  {model.description} · 约 {model.size_mb >= 1024 ? `${(model.size_mb / 1024).toFixed(1)}GB` : `${model.size_mb}MB`}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                {model.is_downloaded ? (
                  <span className="text-sm text-success font-medium">已下载</span>
                ) : downloading.has(model.name) ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-primary">下载中...</span>
                  </div>
                ) : (
                  <Button size="sm" variant="soft" onClick={() => handleDownload(model.name)}>
                    <Download className="w-4 h-4" />
                    下载
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
