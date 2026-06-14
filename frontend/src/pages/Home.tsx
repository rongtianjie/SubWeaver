import { useState, useRef, useEffect } from 'react';
import { taskApi, modelApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskListCard } from '@/components/shared/TaskListCard';
import { Upload, Link as LinkIcon, FileAudio, Loader2, CheckCircle2, DownloadCloud, Sparkles, Zap } from 'lucide-react';
import type { Task } from '@/types';

const MODELS = [
  { value: 'tiny', label: 'Tiny', desc: '最快, 准确度最低', speed: 5 },
  { value: 'base', label: 'Base', desc: '快速', speed: 4 },
  { value: 'small', label: 'Small', desc: '推荐', speed: 3 },
  { value: 'medium', label: 'Medium', desc: '较慢, 更准确', speed: 2 },
  { value: 'large', label: 'Large', desc: '最慢, 最准确', speed: 1 },
];

const OUTPUT_FORMATS = [
  { value: 'txt', label: '纯文本 (.txt)' },
  { value: 'srt', label: '英文字幕 (.srt)' },
  { value: 'bilingual_srt', label: '双语字幕 (.srt)' },
];

const LANGUAGES = [
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日语' },
  { value: 'ko', label: '韩语' },
  { value: 'fr', label: '法语' },
  { value: 'de', label: '德语' },
  { value: 'es', label: '西班牙语' },
  { value: 'ru', label: '俄语' },
  { value: 'pt', label: '葡萄牙语' },
  { value: 'th', label: '泰语' },
  { value: 'vi', label: '越南语' },
  { value: 'ar', label: '阿拉伯语' },
];

export default function Home() {
  const [sourceType, setSourceType] = useState<'upload' | 'url'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [model, setModel] = useState('base');
  const [formats, setFormats] = useState<string[]>(['txt', 'srt', 'bilingual_srt']);
  const [langs, setLangs] = useState<string[]>(['zh']);
  const [submitting, setSubmitting] = useState(false);
  const [modelStatus, setModelStatus] = useState<Record<string, boolean>>({});
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    modelApi.list().then((res) => {
      const status: Record<string, boolean> = {};
      res.data.models.forEach((m: any) => { status[m.name] = m.is_downloaded; });
      setModelStatus(status);
    }).catch(() => {});

    // 获取默认 Whisper 模型配置
    taskApi.getDefaults().then((res) => {
      if (res.data.default_whisper_model) {
        setModel(res.data.default_whisper_model);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadRecentTasks();
  }, []);

  // 自动刷新：当有正在执行的任务时，每 3 秒刷新列表
  useEffect(() => {
    const hasRunning = recentTasks.some(t => t.status === 'processing' || t.status === 'queued');
    if (!hasRunning) return;
    const interval = setInterval(loadRecentTasks, 3000);
    return () => clearInterval(interval);
  }, [recentTasks]);

  const loadRecentTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await taskApi.list({ page: 1, page_size: 5 });
      setRecentTasks(res.data.tasks);
    } catch {
      // User may not be logged in
    } finally {
      setLoadingTasks(false);
    }
  };

  const toggleFormat = (value: string) => {
    setFormats((prev) => prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]);
  };

  const toggleLang = (value: string) => {
    setLangs((prev) => prev.includes(value) ? prev.filter((l) => l !== value) : [...prev, value]);
  };

  const handleSubmit = async () => {
    if (sourceType === 'upload' && !file) return;
    if (sourceType === 'url' && !url) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('source_type', sourceType);
      formData.append('whisper_model', model);
      formData.append('output_formats', JSON.stringify(formats));
      if (sourceType === 'upload' && file) {
        formData.append('file', file);
        formData.append('title', title || file.name);
      } else {
        formData.append('source_url', url);
        formData.append('title', title || url);
      }
      if (formats.includes('bilingual_srt') && langs.length > 0) {
        formData.append('translate_target_langs', JSON.stringify(langs));
      }
      const res = await taskApi.create(formData);
      window.location.href = `/tasks/${res.data.id}`;
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || '未知错误';
      console.error('创建任务失败:', err);
      alert(`创建任务失败: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此任务吗？')) return;
    try {
      await taskApi.delete(id);
      loadRecentTasks();
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-fade-in">
      {/* Hero Section */}
      <div className="hero-gradient rounded-3xl p-8 lg:p-12 text-center space-y-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-purple-500/5 dark:from-primary/10 dark:to-purple-500/10" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Zap className="w-4 h-4" />
            AI 驱动的字幕生成
          </div>
          <h1 className="text-3xl lg:text-5xl font-bold tracking-tight">
            音视频转字幕，
            <span className="text-gradient">一键搞定</span>
          </h1>
          <p className="text-muted-foreground text-base lg:text-lg max-w-2xl mx-auto">
            上传文件或粘贴链接，自动识别语音并生成字幕和翻译，支持多种语言和格式
          </p>
        </div>
      </div>

      {/* Create Task Card */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-primary" />
            创建新任务
          </CardTitle>
          <CardDescription>选择输入来源并配置处理选项</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 lg:p-8 lg:pt-0">
          {/* Source Type Tabs */}
          <Tabs value={sourceType} onValueChange={(v) => setSourceType(v as 'upload' | 'url')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" className="gap-2">
                <Upload className="w-4 h-4" /> 上传文件
              </TabsTrigger>
              <TabsTrigger value="url" className="gap-2">
                <LinkIcon className="w-4 h-4" /> 在线链接
              </TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 group ${
                  isDragging
                    ? 'border-primary bg-primary/10 scale-[1.02] shadow-lg'
                    : 'border-border hover:border-primary/50 hover:bg-primary/5'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                  const droppedFile = e.dataTransfer.files?.[0];
                  if (droppedFile) {
                    setFile(droppedFile);
                  }
                }}
              >
                {file ? (
                  <div className="space-y-2">
                    <div className="inline-flex p-3 rounded-2xl bg-primary/10">
                      <FileAudio className="w-8 h-8 text-primary" />
                    </div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className={`inline-flex p-3 rounded-2xl transition-colors ${
                      isDragging ? 'bg-primary/20' : 'bg-muted group-hover:bg-primary/10'
                    }`}>
                      <Upload className={`w-8 h-8 transition-colors ${
                        isDragging ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                      }`} />
                    </div>
                    <p className="text-muted-foreground">点击或拖拽文件到此处</p>
                    <p className="text-xs text-muted-foreground/60">支持 mp4, avi, mkv, mov, wav, mp3 等格式</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="video/*,audio/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            </TabsContent>
            <TabsContent value="url" className="space-y-4">
              <Input
                placeholder="粘贴 YouTube 或其他视频链接..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="text-base h-12"
              />
              <p className="text-xs text-muted-foreground">支持 YouTube、Bilibili 等 yt-dlp 支持的网站</p>
            </TabsContent>
          </Tabs>

          {/* Config Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            <div className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium">任务标题（可选）</label>
                <Input placeholder="输入任务标题..." value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Whisper 模型</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MODELS.map((m) => (
                    <label
                      key={m.value}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                        model === m.value
                          ? 'border-primary bg-primary/10 text-primary shadow-sm'
                          : 'border-transparent bg-muted/50 hover:bg-muted hover:border-border'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="model"
                          value={m.value}
                          checked={model === m.value}
                          onChange={() => setModel(m.value)}
                          className="accent-primary sr-only"
                        />
                        <div>
                          <span className="text-sm font-medium">{m.label}</span>
                          <p className="text-xs text-muted-foreground">{m.desc}</p>
                        </div>
                        {modelStatus[m.value] === true ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                        ) : modelStatus[m.value] === false ? (
                          <DownloadCloud className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                        ) : null}
                      </div>
                      <span className="text-xs text-muted-foreground flex gap-0.5">
                        {Array.from({ length: m.speed }, (_, i) => (
                          <Zap key={i} className="w-3 h-3 text-primary/60" />
                        ))}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Output Formats */}
              <div className="space-y-2">
                <label className="text-sm font-medium">输出格式</label>
                <div className="flex flex-wrap gap-2">
                  {OUTPUT_FORMATS.map((f) => (
                    <label
                      key={f.value}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm cursor-pointer transition-all duration-200 border-2 ${
                        formats.includes(f.value)
                          ? 'border-primary bg-primary/5 text-primary shadow-sm'
                          : 'border-transparent bg-muted/50 hover:bg-muted hover:border-border'
                      }`}
                    >
                      <input type="checkbox" checked={formats.includes(f.value)} onChange={() => toggleFormat(f.value)} className="accent-primary sr-only" />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Languages */}
              {formats.includes('bilingual_srt') && (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-sm font-medium">目标语言（可多选）</label>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGES.map((lang) => (
                      <label
                        key={lang.value}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm cursor-pointer transition-all duration-200 border-2 ${
                          langs.includes(lang.value)
                            ? 'border-primary bg-primary/5 text-primary shadow-sm'
                            : 'border-transparent bg-muted/50 hover:bg-muted hover:border-border'
                        }`}
                      >
                        <input type="checkbox" checked={langs.includes(lang.value)} onChange={() => toggleLang(lang.value)} className="accent-primary sr-only" />
                        {lang.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="pt-2">
                <Button
                  className="w-full lg:w-auto lg:min-w-[240px]"
                  variant="gradient"
                  size="lg"
                  disabled={submitting || (sourceType === 'upload' && !file) || (sourceType === 'url' && !url)}
                  onClick={handleSubmit}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      提交任务
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Tasks */}
      <section id="recent" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">最近任务</h2>
        </div>

        {loadingTasks ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : recentTasks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="inline-flex p-4 rounded-2xl bg-muted mb-4">
                <FileAudio className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">还没有任务，创建一个试试吧</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentTasks.map((task) => (
              <TaskListCard key={task.id} task={task} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
