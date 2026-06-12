import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { taskApi, modelApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Link, FileAudio, Loader2, CheckCircle2, DownloadCloud } from 'lucide-react';

const MODELS = [
  { value: 'tiny', label: 'Tiny (最快, 准确度最低)', speed: '⚡' },
  { value: 'base', label: 'Base (快速)', speed: '⚡⚡' },
  { value: 'small', label: 'Small (推荐)', speed: '⚡⚡⚡' },
  { value: 'medium', label: 'Medium (较慢, 更准确)', speed: '⚡⚡⚡⚡' },
  { value: 'large', label: 'Large (最慢, 最准确)', speed: '⚡⚡⚡⚡⚡' },
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
  const navigate = useNavigate();
  const [sourceType, setSourceType] = useState<'upload' | 'url'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [model, setModel] = useState('base');
  const [formats, setFormats] = useState<string[]>(['txt', 'srt', 'bilingual_srt']);
  const [langs, setLangs] = useState<string[]>(['zh']);
  const [submitting, setSubmitting] = useState(false);
  const [modelStatus, setModelStatus] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    modelApi.list().then((res) => {
      const status: Record<string, boolean> = {};
      res.data.models.forEach((m: any) => { status[m.name] = m.is_downloaded; });
      setModelStatus(status);
    }).catch(() => {});
  }, []);

  const toggleFormat = (value: string) => {
    setFormats((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]
    );
  };

  const toggleLang = (value: string) => {
    setLangs((prev) =>
      prev.includes(value) ? prev.filter((l) => l !== value) : [...prev, value]
    );
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
      navigate(`/tasks/${res.data.id}`);
    } catch (err) {
      console.error('创建任务失败:', err);
      alert('创建任务失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">音视频转文字 / 字幕生成</h1>
        <p className="text-gray-500">上传文件或粘贴链接，自动生成字幕和翻译</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>创建新任务</CardTitle>
          <CardDescription>选择输入来源并配置处理选项</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs
            value={sourceType}
            onValueChange={(v) => setSourceType(v as 'upload' | 'url')}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">
                <Upload className="w-4 h-4 mr-2" /> 上传文件
              </TabsTrigger>
              <TabsTrigger value="url">
                <Link className="w-4 h-4 mr-2" /> 在线链接
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition"
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <div className="space-y-2">
                    <FileAudio className="w-8 h-8 mx-auto text-blue-500" />
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 mx-auto text-gray-400" />
                    <p className="text-gray-500">点击或拖拽文件到此处</p>
                    <p className="text-xs text-gray-400">支持 mp4, avi, mkv, mov, wav, mp3 等格式</p>
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
              />
              <p className="text-xs text-gray-400">支持 YouTube、Bilibili 等 yt-dlp 支持的网站</p>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <label className="text-sm font-medium">任务标题（可选）</label>
            <Input
              placeholder="输入任务标题..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Whisper 模型</label>
            <div className="grid grid-cols-1 gap-2">
              {MODELS.map((m) => (
                <label
                  key={m.value}
                  className={`flex items-center justify-between p-2 rounded border cursor-pointer transition ${
                    model === m.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="model"
                      value={m.value}
                      checked={model === m.value}
                      onChange={() => setModel(m.value)}
                      className="accent-blue-500"
                    />
                    <span className="text-sm">{m.label}</span>
                    {modelStatus[m.value] === true ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    ) : modelStatus[m.value] === false ? (
                      <DownloadCloud className="w-3.5 h-3.5 text-gray-300" />
                    ) : null}
                  </div>
                  <span className="text-xs text-gray-400">{m.speed}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">输出格式</label>
            <div className="flex flex-wrap gap-2">
              {OUTPUT_FORMATS.map((f) => (
                <label
                  key={f.value}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded border text-sm cursor-pointer transition ${
                    formats.includes(f.value)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formats.includes(f.value)}
                    onChange={() => toggleFormat(f.value)}
                    className="accent-blue-500"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          {formats.includes('bilingual_srt') && (
            <div className="space-y-2">
              <label className="text-sm font-medium">目标语言（可多选）</label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => (
                  <label
                    key={lang.value}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-sm cursor-pointer transition ${
                      langs.includes(lang.value)
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={langs.includes(lang.value)}
                      onChange={() => toggleLang(lang.value)}
                      className="accent-blue-500"
                    />
                    {lang.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            disabled={
              submitting ||
              (sourceType === 'upload' && !file) ||
              (sourceType === 'url' && !url)
            }
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                提交中...
              </>
            ) : (
              '提交任务'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
