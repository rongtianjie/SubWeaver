import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { Activity, Users, FileText, HardDrive, RefreshCw, Loader2 } from 'lucide-react';

interface Stats {
  total_tasks: number;
  pending_tasks: number;
  processing_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  total_users: number;
  storage_usage_mb: number;
}

interface Config {
  key: string;
  value: any;
  description: string | null;
}

export default function Admin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [configs, setConfigs] = useState<Record<string, Config>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      window.location.href = '/';
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, configRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getConfig(),
      ]);
      setStats(statsRes.data);
      setConfigs(configRes.data);
    } catch (err) {
      console.error('加载管理数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (key: string, value: any) => {
    const config = configs[key];
    try {
      await adminApi.updateConfig(key, value, config?.description || undefined);
      loadData();
    } catch (err) {
      console.error('更新配置失败:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">管理后台</h1>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="w-4 h-4 mr-1" /> 刷新
        </Button>
      </div>

      {/* 导航标签 */}
      <div className="flex gap-2 flex-wrap border-b pb-2">
        {[
          { key: 'overview', label: '概览' },
          { key: 'config', label: '系统配置' },
          { key: 'llm', label: 'LLM 配置' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition ${
              activeTab === tab.key
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">总任务数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="text-2xl font-bold">{stats.total_tasks}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">处理中</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-yellow-500" />
                <span className="text-2xl font-bold">{stats.processing_tasks}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">用户数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-green-500" />
                <span className="text-2xl font-bold">{stats.total_users}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">存储占用</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-purple-500" />
                <span className="text-2xl font-bold">{stats.storage_usage_mb} MB</span>
              </div>
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">任务状态分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { label: '已完成', value: stats.completed_tasks, color: 'bg-green-500' },
                  { label: '等待中', value: stats.pending_tasks, color: 'bg-gray-400' },
                  { label: '处理中', value: stats.processing_tasks, color: 'bg-yellow-500' },
                  { label: '失败', value: stats.failed_tasks, color: 'bg-red-500' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="text-sm w-16">{item.label}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all`}
                        style={{
                          width: `${stats.total_tasks > 0 ? (item.value / stats.total_tasks) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-12 text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'llm' && (
        <Card>
          <CardHeader>
            <CardTitle>LLM 翻译配置</CardTitle>
            <CardDescription>配置 OpenAI 兼容的翻译接口</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ConfigField
              label="API 基础地址"
              value={configs['llm_base_url']?.value || ''}
              description="例如: http://localhost:1234/v1"
              onSave={(v) => updateConfig('llm_base_url', v)}
            />
            <ConfigField
              label="API 密钥"
              value={configs['llm_api_key']?.value || ''}
              description="例如: lm-studio, sk-xxx"
              onSave={(v) => updateConfig('llm_api_key', v)}
            />
            <ConfigField
              label="模型名称"
              value={configs['llm_model']?.value || ''}
              description="例如: lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF"
              onSave={(v) => updateConfig('llm_model', v)}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'config' && (
        <Card>
          <CardHeader>
            <CardTitle>系统配置</CardTitle>
            <CardDescription>管理系统的运行参数</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ConfigField
              label="文件保留天数"
              value={configs['retention_days']?.value || 30}
              type="number"
              description="超过此天数的输出文件将被自动清理"
              onSave={(v) => updateConfig('retention_days', Number(v))}
            />
            <ConfigField
              label="最大文件大小 (MB)"
              value={configs['max_file_size_mb']?.value || 500}
              type="number"
              description="用户上传文件的大小限制"
              onSave={(v) => updateConfig('max_file_size_mb', Number(v))}
            />
            <ConfigField
              label="游客每日任务上限"
              value={configs['guest_task_limit']?.value || 3}
              type="number"
              description="未登录用户每天可提交的任务数量"
              onSave={(v) => updateConfig('guest_task_limit', Number(v))}
            />
            <ConfigField
              label="默认 Whisper 模型"
              value={configs['default_whisper_model']?.value || 'base'}
              description="新任务的默认模型"
              onSave={(v) => updateConfig('default_whisper_model', v)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ConfigField({
  label,
  value,
  description,
  type = 'text',
  onSave,
}: {
  label: string;
  value: any;
  description?: string;
  type?: string;
  onSave: (value: any) => void;
}) {
  const [editValue, setEditValue] = useState(String(value));
  const [editing, setEditing] = useState(false);

  const handleSave = () => {
    onSave(type === 'number' ? Number(editValue) : editValue);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <Input
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-48 text-sm"
            />
            <Button size="sm" onClick={handleSave}>保存</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>取消</Button>
          </>
        ) : (
          <>
            <span className="text-sm text-gray-700">{String(value)}</span>
            <Button size="sm" variant="ghost" onClick={() => { setEditValue(String(value)); setEditing(true); }}>
              编辑
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
