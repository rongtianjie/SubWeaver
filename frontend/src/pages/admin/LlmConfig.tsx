import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { Loader2, Cpu, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface Config { key: string; value: any; description: string | null; }

export default function LlmConfig() {
  const [configs, setConfigs] = useState<Record<string, Config>>({});
  const [loading, setLoading] = useState(true);
  const [testingLlm, setTestingLlm] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState<{ success: boolean; message: string; latency_ms?: number } | null>(null);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchModelsError, setFetchModelsError] = useState<string | null>(null);
  const [llmForm, setLlmForm] = useState({ base_url: '', api_key: '', model: '' });
  const [llmSaveSuccess, setLlmSaveSuccess] = useState(false);

  useEffect(() => {
    adminApi.getConfig().then((res) => {
      setConfigs(res.data);
      setLlmForm({
        base_url: res.data['llm_base_url']?.value || '',
        api_key: res.data['llm_api_key']?.value || '',
        model: res.data['llm_model']?.value || '',
      });
    }).finally(() => setLoading(false));
  }, []);

  const updateConfig = async (key: string, value: any) => {
    const config = configs[key];
    await adminApi.updateConfig(key, value, config?.description || undefined);
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
      const res = await adminApi.fetchLlmModels({ base_url: llmForm.base_url, api_key: llmForm.api_key });
      setFetchedModels(res.data.models);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || '请求失败';
      setFetchModelsError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setFetchingModels(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="LLM 翻译配置" description="配置 OpenAI 兼容的翻译接口" />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-base">翻译接口设置</CardTitle>
              <CardDescription>填写 API 信息后可用于字幕翻译功能</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleTestLlm} disabled={testingLlm}>
                {testingLlm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
                测试连接
              </Button>
              {llmTestResult && (
                <div className={`px-3 py-1.5 rounded-xl text-xs border ${
                  llmTestResult.success ? 'bg-success/10 border-success/20 text-success' : 'bg-destructive/10 border-destructive/20 text-destructive'
                }`}>
                  <div className="flex items-center gap-1.5">
                    {llmTestResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    <span className="max-w-[200px] truncate">{llmTestResult.message}</span>
                    {llmTestResult.success && llmTestResult.latency_ms !== undefined && (
                      <span className="text-muted-foreground shrink-0">{llmTestResult.latency_ms}ms</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* API Base URL */}
          <div className="flex items-center justify-between py-3 border-b border-border/50 gap-4 flex-wrap">
            <div className="shrink-0">
              <p className="text-sm font-medium">API 基础地址</p>
              <p className="text-xs text-muted-foreground">例如: http://localhost:1234/v1</p>
            </div>
            <Input value={llmForm.base_url} onChange={(e) => setLlmForm((f) => ({ ...f, base_url: e.target.value }))} className="max-w-xl" />
          </div>

          {/* API Key */}
          <div className="flex items-center justify-between py-3 border-b border-border/50 gap-4 flex-wrap">
            <div className="shrink-0">
              <p className="text-sm font-medium">API 密钥</p>
              <p className="text-xs text-muted-foreground">例如: 1234, sk-xxx</p>
            </div>
            <Input value={llmForm.api_key} onChange={(e) => setLlmForm((f) => ({ ...f, api_key: e.target.value }))} className="max-w-xl" />
          </div>

          {/* Model */}
          <div className="py-3 border-b border-border/50">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <p className="text-sm font-medium mb-1">模型名称</p>
                <p className="text-xs text-muted-foreground mb-2">可先用下方按钮获取模型列表，或在输入框中直接输入</p>
                <div className="relative">
                  <div className="relative">
                    <Input value={llmForm.model} onChange={(e) => setLlmForm((f) => ({ ...f, model: e.target.value }))} className="pr-8" />
                    {fetchedModels.length > 0 && (
                      <button onClick={() => setFetchedModels([])} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs">✕</button>
                    )}
                  </div>
                  {fetchedModels.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-card border rounded-xl shadow-lg">
                      {fetchedModels.filter((m) => !llmForm.model || m.toLowerCase().includes(llmForm.model.toLowerCase())).slice(0, 100).map((m) => (
                        <button key={m} onClick={() => { setLlmForm((f) => ({ ...f, model: m })); setFetchedModels([]); }}
                          className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted rounded-lg ${m === llmForm.model ? 'bg-primary/10 text-primary' : ''}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={handleFetchLlmModels} disabled={fetchingModels || !llmForm.base_url}>
                {fetchingModels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                获取模型
              </Button>
              {fetchedModels.length > 0 && <span className="text-xs text-muted-foreground">共 {fetchedModels.length} 个模型</span>}
              {!llmForm.base_url && <span className="text-xs text-warning">请先填写 API 基础地址</span>}
            </div>
            {fetchModelsError && (
              <div className="mt-2 p-2 rounded-xl text-xs border bg-destructive/10 border-destructive/20 text-destructive">
                <div className="flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{fetchModelsError}</span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end">
            <Button onClick={handleSaveLlmConfig} className={llmSaveSuccess ? 'bg-success hover:bg-success/90 text-white' : ''}>
              <CheckCircle2 className={`w-4 h-4 ${llmSaveSuccess ? 'text-white' : ''}`} />
              {llmSaveSuccess ? '保存成功' : '保存配置'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
