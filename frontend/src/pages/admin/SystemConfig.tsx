import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface Config {
  key: string;
  value: any;
  description: string | null;
}

export default function SystemConfig() {
  const [configs, setConfigs] = useState<Record<string, Config>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getConfig().then((res) => setConfigs(res.data)).finally(() => setLoading(false));
  }, []);

  const updateConfig = async (key: string, value: any) => {
    const config = configs[key];
    setSaving(key);
    try {
      await adminApi.updateConfig(key, value, config?.description || undefined);
      const res = await adminApi.getConfig();
      setConfigs(res.data);
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
    } catch (err) {
      console.error('更新配置失败:', err);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="系统配置" description="管理系统的运行参数" />

      <Card>
        <CardContent className="pt-6 space-y-1">
          <ConfigField
            label="文件保留天数"
            value={configs['retention_days']?.value || 30}
            type="number"
            description="超过此天数的输出文件将被自动清理"
            saving={saving === 'retention_days'}
            saved={savedKey === 'retention_days'}
            onSave={(v) => updateConfig('retention_days', Number(v))}
          />
          <ConfigField
            label="最大文件大小 (MB)"
            value={configs['max_file_size_mb']?.value || 500}
            type="number"
            description="用户上传文件的大小限制"
            saving={saving === 'max_file_size_mb'}
            saved={savedKey === 'max_file_size_mb'}
            onSave={(v) => updateConfig('max_file_size_mb', Number(v))}
          />
          <ConfigField
            label="游客每日任务上限"
            value={configs['guest_task_limit']?.value || 3}
            type="number"
            description="未登录用户每天可提交的任务数量"
            saving={saving === 'guest_task_limit'}
            saved={savedKey === 'guest_task_limit'}
            onSave={(v) => updateConfig('guest_task_limit', Number(v))}
          />
          <ConfigField
            label="默认 Whisper 模型"
            value={configs['default_whisper_model']?.value || 'base'}
            description="新任务的默认模型"
            saving={saving === 'default_whisper_model'}
            saved={savedKey === 'default_whisper_model'}
            onSave={(v) => updateConfig('default_whisper_model', v)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigField({
  label, value, description, type = 'text', saving, saved, onSave,
}: {
  label: string; value: any; description?: string; type?: string;
  saving?: boolean; saved?: boolean;
  onSave: (value: any) => void;
}) {
  const [editValue, setEditValue] = useState(String(value));
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    onSave(type === 'number' ? Number(editValue) : editValue);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between py-4 border-b border-border/50 last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <Input type={type} value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-48 text-sm" />
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '保存'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>取消</Button>
          </>
        ) : (
          <>
            <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-lg">{String(value)}</span>
            <Button size="sm" variant="ghost" onClick={() => { setEditValue(String(value)); setEditing(true); }}>编辑</Button>
            {saved && <CheckCircle2 className="w-4 h-4 text-success" />}
          </>
        )}
      </div>
    </div>
  );
}
