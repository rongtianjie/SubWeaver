import { useEffect, useState, useRef } from 'react';
import { adminApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { Loader2 } from 'lucide-react';
import type { LogFileInfo, LogContent } from '@/types';

export default function LogViewer() {
  const levelColors: Record<string, string> = {
    ERROR: 'text-red-600 dark:text-red-400',
    CRITICAL: 'text-red-700 dark:text-red-500',
    WARNING: 'text-amber-600 dark:text-amber-400',
    INFO: '',
    DEBUG: 'text-gray-500 dark:text-gray-400',
  };

  function renderLogLine(line: string, key: number) {
    const m = line.match(/^([^|]+\|\s*)([A-Z]+)(\s*\|\s*.*)$/);
    if (!m) {
      return <div key={key} className="whitespace-nowrap">{line}</div>;
    }
    const [, prefix, level, suffix] = m;
    const cls = levelColors[level];
    return (
      <div key={key} className="whitespace-nowrap">
        {prefix}<span className={cls || ''}>{level}</span>{suffix}
      </div>
    );
  }

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

  useEffect(() => {
    if (!selectedFile) return;
    setLoadingContent(true);
    setStreamContent([]);
    setStreaming(false);
    adminApi.getLogContent(selectedFile, 200)
      .then((res) => setLogContent(res.data))
      .finally(() => setLoadingContent(false));
  }, [selectedFile]);

  useEffect(() => {
    if (!selectedFile || !streaming) return;
    const es = new EventSource(adminApi.getLogStreamUrl(selectedFile));
    es.addEventListener('log', (event) => {
      const data = JSON.parse(event.data);
      setStreamContent((prev) => [...prev, data.content]);
    });
    es.addEventListener('error', () => es.close());
    return () => es.close();
  }, [selectedFile, streaming]);

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
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="系统日志" description="查看系统运行日志和实时日志流" />

      <div className="flex gap-4">
        {/* File List */}
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
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${
                    selectedFile === f.filename
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <div className="truncate">{f.filename}</div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    {(f.size_bytes / 1024).toFixed(1)} KB
                  </div>
                </button>
              ))}
              {logFiles.length === 0 && (
                <p className="text-sm text-muted-foreground px-3 py-4 text-center">暂无日志文件</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Log Content */}
        <Card className="flex-1 min-w-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{selectedFile || '选择日志文件'}</CardTitle>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-3 py-1 text-xs rounded-xl border transition-all ${
                    autoScroll ? 'bg-primary/10 border-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  自动滚动 {autoScroll ? 'ON' : 'OFF'}
                </button>
                <Button size="sm" variant={streaming ? 'default' : 'outline'} onClick={() => setStreaming(!streaming)}>
                  {streaming ? '停止实时' : '实时日志'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingContent ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div
                ref={contentRef}
                onScroll={handleScroll}
                className="bg-foreground/5 text-foreground rounded-xl p-4 font-mono text-xs leading-relaxed overflow-x-auto overflow-y-auto max-h-[600px]"
              >
                {logContent?.content?.split('\n').map((line, i) => renderLogLine(line, i))}
                {streamContent.map((chunk, i) => (
                  <span key={i} className="whitespace-nowrap">{chunk}</span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
