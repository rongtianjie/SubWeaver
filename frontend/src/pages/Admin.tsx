import { useEffect, useState, useRef } from 'react';
import { adminApi, modelApi, authApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { Activity, Users, FileText, HardDrive, RefreshCw, Loader2, Download, CheckCircle2, XCircle, Cpu, Trash2, AlertCircle } from 'lucide-react';
import type { ModelInfo, LogFileInfo, LogContent } from '@/types';

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
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [configs, setConfigs] = useState<Record<string, Config>>({});
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [testingLlm, setTestingLlm] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState<{ success: boolean; message: string; response?: string; latency_ms?: number } | null>(null);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchModelsError, setFetchModelsError] = useState<string | null>(null);
  const [llmForm, setLlmForm] = useState({ base_url: '', api_key: '', model: '' });
  const [llmSaveSuccess, setLlmSaveSuccess] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // 未登录时检查是否存在管理员
      authApi.checkAdminExists().then((res) => {
        if (!res.data.exists) {
          window.location.href = '/admin/setup';
        } else {
          window.location.href = '/login';
        }
      }).catch(() => {
        window.location.href = '/login';
      });
      return;
    }
    if (user.role !== 'admin') {
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
      setLlmForm({
        base_url: configRes.data['llm_base_url']?.value || '',
        api_key: configRes.data['llm_api_key']?.value || '',
        model: configRes.data['llm_model']?.value || '',
      });
    } catch (err) {
      console.error('加载管理数据失败:', err);
    } finally {
      setLoading(false);
    }
    // 单独拉取模型列表（无需认证，避免被 Promise.all 拖累）
    try {
      const modelsRes = await modelApi.list();
      setModels(modelsRes.data.models);
    } catch (err) {
      console.error('加载模型列表失败:', err);
    }
  };

  const handleDownloadModel = async (name: string) => {
    setDownloading((prev) => new Set(prev).add(name));
    try {
      await modelApi.download(name);
      // 下载完成后刷新模型列表
      const res = await modelApi.list();
      setModels(res.data.models);
    } catch (err) {
      console.error('下载模型失败:', err);
    } finally {
      setDownloading((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
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

  const updateConfig = async (key: string, value: any) => {
    const config = configs[key];
    try {
      await adminApi.updateConfig(key, value, config?.description || undefined);
      loadData();
    } catch (err) {
      console.error('更新配置失败:', err);
    }
  };

  const handleTestLlm = async () => {
    setTestingLlm(true);
    setLlmTestResult(null);
    try {
      const res = await adminApi.testLlm(llmForm);
      setLlmTestResult(res.data);
    } catch (err: any) {
      setLlmTestResult(err.response?.data?.detail || { success: false, message: '请求失败' });
    } finally {
      setTestingLlm(false);
    }
  };

  const handleSaveLlmConfig = async () => {
    await Promise.all([
      updateConfig('llm_base_url', llmForm.base_url),
      updateConfig('llm_api_key', llmForm.api_key),
      updateConfig('llm_model', llmForm.model),
    ]);
    setLlmSaveSuccess(true);
    setTimeout(() => setLlmSaveSuccess(false), 3000);
  };

  const handleFetchLlmModels = async () => {
    if (!llmForm.base_url) return;
    setFetchingModels(true);
    setFetchModelsError(null);
    setFetchedModels([]);
    try {
      const res = await adminApi.fetchLlmModels({
        base_url: llmForm.base_url,
        api_key: llmForm.api_key,
      });
      setFetchedModels(res.data.models);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || '请求失败';
      setFetchModelsError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      console.error('获取模型列表失败:', err);
    } finally {
      setFetchingModels(false);
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
          { key: 'models', label: '模型管理' },
          { key: 'llm', label: 'LLM 配置' },
          { key: 'logs', label: '系统日志' },
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>LLM 翻译配置</CardTitle>
                <CardDescription>配置 OpenAI 兼容的翻译接口</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestLlm}
                  disabled={testingLlm}
                >
                  {testingLlm ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Cpu className="w-4 h-4 mr-1.5" />
                  )}
                  测试连接
                </Button>
                {llmTestResult && (
                  <div
                    className={`p-1.5 rounded text-xs border ${
                      llmTestResult.success
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {llmTestResult.success ? (
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3 h-3 shrink-0" />
                      )}
                      <span className="max-w-[240px] truncate">{llmTestResult.message}</span>
                      {llmTestResult.success && llmTestResult.latency_ms !== undefined && (
                        <span className="ml-1 text-gray-500 shrink-0">
                          {llmTestResult.latency_ms}ms
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* API 基础地址 */}
            <div className="flex items-center justify-between py-2 border-b gap-4">
              <div className="shrink-0">
                <p className="text-sm font-medium">API 基础地址</p>
                <p className="text-xs text-gray-500">例如: http://localhost:1234/v1</p>
              </div>
              <div className="flex items-center gap-2 min-w-0 flex-1 max-w-xl">
                <Input
                  value={llmForm.base_url}
                  onChange={(e) => setLlmForm((f) => ({ ...f, base_url: e.target.value }))}
                  className="w-full text-sm"
                />
              </div>
            </div>

            {/* API 密钥 */}
            <div className="flex items-center justify-between py-2 border-b gap-4">
              <div className="shrink-0">
                <p className="text-sm font-medium">API 密钥</p>
                <p className="text-xs text-gray-500">例如: 1234, sk-xxx</p>
              </div>
              <div className="flex items-center gap-2 min-w-0 flex-1 max-w-xl">
                <Input
                  value={llmForm.api_key}
                  onChange={(e) => setLlmForm((f) => ({ ...f, api_key: e.target.value }))}
                  className="w-full text-sm"
                />
              </div>
            </div>

            {/* 模型名称 - 搜索下拉框 */}
            <div className="py-2 border-b">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">模型名称</p>
                  <p className="text-xs text-gray-500 mb-2">
                    可先用下方按钮获取模型列表，或在输入框中直接输入
                  </p>
                  <div className="relative">
                    <div className="relative">
                      <Input
                        value={llmForm.model}
                        onChange={(e) => setLlmForm((f) => ({ ...f, model: e.target.value }))}
                        className="w-full text-sm pr-8"
                      />
                      {fetchedModels.length > 0 && (
                        <button
                          onClick={() => setFetchedModels([])}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                        >✕</button>
                      )}
                    </div>
                    {fetchedModels.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border rounded-md shadow-lg">
                        {fetchedModels
                          .filter((m) => !llmForm.model || m.toLowerCase().includes(llmForm.model.toLowerCase()))
                          .slice(0, 100)
                          .map((m) => (
                            <button
                              key={m}
                              onClick={() => {
                                setLlmForm((f) => ({ ...f, model: m }));
                                setFetchedModels([]);
                              }}
                              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 ${
                                m === llmForm.model ? 'bg-blue-100 text-blue-700' : ''
                              }`}
                            >{m}</button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleFetchLlmModels}
                  disabled={fetchingModels || !llmForm.base_url}
                >
                  {fetchingModels ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  获取模型
                </Button>
                {fetchedModels.length > 0 && (
                  <span className="text-xs text-gray-400">共 {fetchedModels.length} 个模型</span>
                )}
                {!llmForm.base_url && (
                  <span className="text-xs text-amber-500">请先填写 API 基础地址</span>
                )}
              </div>
              {fetchModelsError && (
                <div className="mt-2 p-2 rounded text-xs border bg-red-50 border-red-200 text-red-700">
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{fetchModelsError}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                onClick={handleSaveLlmConfig}
                className={llmSaveSuccess ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
              >
                <CheckCircle2 className={`w-4 h-4 mr-1.5 ${llmSaveSuccess ? 'text-white' : ''}`} />
                {llmSaveSuccess ? '保存成功' : '保存配置'}
              </Button>
            </div>
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

      {activeTab === 'models' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Whisper 模型管理</CardTitle>
                <CardDescription>查看和下载 Whisper 语音识别模型，下载后可在创建任务时选用</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteAll}
                className="text-red-500 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                删除全部模型
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {models.map((model) => (
              <div
                key={model.name}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{model.label}</span>
                    <span className="text-xs text-gray-400">({model.name})</span>
                    {model.is_downloaded ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-300" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {model.description} · 约 {model.size_mb >= 1024 ? `${(model.size_mb / 1024).toFixed(1)}GB` : `${model.size_mb}MB`}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {model.is_downloaded ? (
                    <span className="text-sm text-green-600 font-medium">已下载</span>
                  ) : downloading.has(model.name) ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      <span className="text-sm text-blue-600">下载中...</span>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleDownloadModel(model.name)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      下载
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === 'logs' && <LogViewer />}
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

function LogViewer() {
  const [logFiles, setLogFiles] = useState<LogFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<LogContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState<string[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    adminApi.listLogFiles().then((res) => {
      setLogFiles(res.data);
      if (res.data.length > 0 && !selectedFile) {
        setSelectedFile(res.data[0].filename);
      }
    }).finally(() => setLoading(false));
  }, []);

  // 选中文件时加载内容
  useEffect(() => {
    if (!selectedFile) return;
    setLoadingContent(true);
    setStreamContent([]);
    setStreaming(false);
    adminApi.getLogContent(selectedFile, 200)
      .then((res) => setLogContent(res.data))
      .finally(() => setLoadingContent(false));
  }, [selectedFile]);

  // SSE 实时日志
  useEffect(() => {
    if (!selectedFile || !streaming) return;
    const es = new EventSource(adminApi.getLogStreamUrl(selectedFile));

    es.addEventListener('log', (event) => {
      const data = JSON.parse(event.data);
      setStreamContent((prev) => [...prev, data.content]);
    });

    es.addEventListener('error', () => {
      es.close();
      setStreaming(false);
    });

    return () => es.close();
  }, [selectedFile, streaming]);

  // 自动滚动
  useEffect(() => {
    if (autoScroll && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [logContent, streamContent, autoScroll]);

  const handleScroll = () => {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      {/* 左侧文件列表 */}
      <Card className="w-56 shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">日志文件</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="space-y-1">
            {logFiles.map((f) => (
              <button
                key={f.filename}
                onClick={() => { setSelectedFile(f.filename); setStreaming(false); }}
                className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                  selectedFile === f.filename
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="truncate">{f.filename}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {(f.size_bytes / 1024).toFixed(1)} KB
                </div>
              </button>
            ))}
            {logFiles.length === 0 && (
              <p className="text-sm text-gray-400 px-3 py-4 text-center">暂无日志文件</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 右侧日志内容 */}
      <Card className="flex-1">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{selectedFile || '选择日志文件'}</CardTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`px-2 py-1 text-xs rounded border transition ${
                  autoScroll ? 'bg-blue-50 border-blue-200 text-blue-600' : 'text-gray-500'
                }`}
              >
                自动滚动 {autoScroll ? 'ON' : 'OFF'}
              </button>
              <Button
                size="sm"
                variant={streaming ? 'default' : 'outline'}
                onClick={() => setStreaming(!streaming)}
              >
                {streaming ? '停止实时' : '实时日志'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingContent ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div
              ref={contentRef}
              onScroll={handleScroll}
              className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-xs leading-relaxed overflow-auto max-h-[600px] whitespace-pre-wrap"
            >
              {logContent?.content}
              {streamContent.map((chunk, i) => (
                <span key={i}>{chunk}</span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
