import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { formatFileSize, formatTime } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Search, File, Film, FileText, HardDrive,
  Download, Trash2, Eye, ChevronLeft, ChevronRight,
  AlertCircle, X,
} from 'lucide-react';
import type { FileItem, FileListResponse } from '@/types';

const PAGE_SIZE = 20;

const TEXT_EXTENSIONS = new Set(['.txt', '.srt', '.vtt', '.ass', '.json', '.md', '.csv']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.avi', '.mov', '.mkv']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.wma']);

function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.substring(dot).toLowerCase();
}

function getFileIcon(filename: string) {
  const ext = getFileExtension(filename);
  if (VIDEO_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext)) return Film;
  if (TEXT_EXTENSIONS.has(ext)) return FileText;
  return File;
}

function formatFileType(type: string): string {
  switch (type) {
    case 'upload': return '上传文件';
    case 'output': return '输出文件';
    case 'orphan': return '孤立文件';
    default: return type;
  }
}

function getFileTypeColor(type: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (type) {
    case 'upload': return 'default';
    case 'output': return 'secondary';
    case 'orphan': return 'outline';
    default: return 'secondary';
  }
}

export default function FileManagement() {
  const [data, setData] = useState<FileListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Preview
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<FileItem[]>([]);
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard'>('soft');
  const [deleting, setDeleting] = useState(false);

  // Error
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async (p: number, q: string, ft: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listFiles({
        page: p,
        page_size: PAGE_SIZE,
        q: q || undefined,
        file_type: ft || undefined,
      });
      setData(res.data);
      setSelectedIds(new Set());
    } catch {
      setError('加载文件列表失败');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFiles(page, searchQuery, typeFilter);
  }, [page, searchQuery, typeFilter, loadFiles]);

  const handleSearch = () => {
    setPage(1);
    setSearchQuery(searchInput);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value === 'all' ? '' : value);
    setPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    if (!data) return;
    if (checked) {
      setSelectedIds(new Set(data.files.map((f) => f.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 获取 token 用于带认证的请求
  const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('access_token')
      || sessionStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handlePreview = async (file: FileItem) => {
    // 清理上一个 blob URL
    if (previewMediaUrl) {
      URL.revokeObjectURL(previewMediaUrl);
      setPreviewMediaUrl(null);
    }

    setPreviewFile(file);
    setPreviewContent(null);
    setPreviewLoading(true);

    const ext = getFileExtension(file.filename);
    const isText = TEXT_EXTENSIONS.has(ext);
    const isMedia = VIDEO_EXTENSIONS.has(ext) || AUDIO_EXTENSIONS.has(ext);

    try {
      const url = adminApi.getFilePreviewUrl(file.id);
      const headers = getAuthHeaders();

      if (isText) {
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('预览请求失败');
        const data = await res.json();
        setPreviewContent(data.content);
      } else if (isMedia) {
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('媒体文件加载失败');
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        setPreviewMediaUrl(blobUrl);
      }
    } catch (err) {
      console.error('预览加载失败:', err);
      setPreviewContent('预览加载失败');
    }

    setPreviewLoading(false);
  };

  // 关闭预览时清理 blob URL
  const handleClosePreview = () => {
    if (previewMediaUrl) {
      URL.revokeObjectURL(previewMediaUrl);
      setPreviewMediaUrl(null);
    }
    setPreviewFile(null);
    setPreviewContent(null);
  };

  // 带认证的文件下载
  const handleDownload = async (file: FileItem) => {
    try {
      const token = localStorage.getItem('access_token')
        || sessionStorage.getItem('access_token');
      const res = await fetch(adminApi.getFileDownloadUrl(file.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('下载失败');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('下载失败:', err);
    }
  };

  const openDeleteDialog = (files: FileItem[]) => {
    setDeleteTargets(files);
    const allOrphan = files.every((f) => f.file_type === 'orphan');
    setDeleteMode(allOrphan ? 'hard' : 'soft');
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deleteTargets.length === 0) return;
    setDeleting(true);
    try {
      await adminApi.deleteFiles({
        file_ids: deleteTargets.map((f) => f.id),
        mode: deleteMode,
      });
      setDeleteDialogOpen(false);
      setDeleteTargets([]);
      loadFiles(page, searchQuery, typeFilter);
    } catch {
      setError('删除文件失败');
    }
    setDeleting(false);
  };

  const handleDeleteSingle = (file: FileItem) => {
    openDeleteDialog([file]);
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const targets = data?.files.filter((f) => selectedIds.has(f.id)) || [];
    openDeleteDialog(targets);
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="文件管理" description="管理用户上传的媒体文件及生成的字幕文本文件" />

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Search + Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索文件名..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-9"
              />
            </div>
            <Button variant="secondary" onClick={handleSearch} size="sm">
              搜索
            </Button>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(1); }}
              >
                清除
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Select value={typeFilter || 'all'} onValueChange={handleTypeFilterChange}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="upload">上传文件</SelectItem>
                  <SelectItem value="output">输出文件</SelectItem>
                  <SelectItem value="orphan">孤立文件</SelectItem>
                </SelectContent>
              </Select>

              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBatchDelete}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  删除选中 ({selectedIds.size})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              文件列表
            </CardTitle>
            {data && (
              <span className="text-xs text-muted-foreground">
                共 {data.total} 个文件
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.files.length === 0 ? (
            <div className="py-12 text-center">
              <div className="inline-flex p-3 rounded-2xl bg-muted mb-3">
                <File className="w-6 h-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm text-muted-foreground">
                {searchQuery || typeFilter ? '没有找到匹配的文件' : '暂无文件'}
              </p>
            </div>
          ) : (
            <>
              {/* 表头（桌面端可见） */}
              <div className="hidden md:grid grid-cols-[36px_1.5fr_0.8fr_0.6fr_0.8fr_0.8fr_120px] gap-4 px-6 py-3 text-xs text-muted-foreground border-b border-border/50 font-medium items-center">
                <div>
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={data.files.length > 0 && selectedIds.size === data.files.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </div>
                <span>文件名</span>
                <span>类型</span>
                <span>大小</span>
                <span>关联任务</span>
                <span>创建时间</span>
                <span className="text-center">操作</span>
              </div>

              {/* 文件行 */}
              <div className="divide-y divide-border/50">
                {data.files.map((file) => {
                  const Icon = getFileIcon(file.filename);
                  return (
                    <div key={file.id} className="px-6 py-3 hover:bg-muted/40 transition-colors">
                      {/* 桌面端 */}
                      <div className="hidden md:grid grid-cols-[36px_1.5fr_0.8fr_0.6fr_0.8fr_0.8fr_120px] gap-4 items-center">
                        <div>
                          <input
                            type="checkbox"
                            className="rounded border-border"
                            checked={selectedIds.has(file.id)}
                            onChange={() => handleSelectOne(file.id)}
                          />
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate" title={file.filename}>
                            {file.filename}
                          </span>
                        </div>
                        <Badge variant={getFileTypeColor(file.file_type)} className="w-fit text-xs">
                          {formatFileType(file.file_type)}
                        </Badge>
                        <span className="text-sm text-muted-foreground" title={`${file.file_size} 字节`}>
                          {formatFileSize(file.file_size)}
                        </span>
                        <span className="text-sm text-muted-foreground truncate" title={file.task_title || '-'}>
                          {file.task_title || <span className="text-muted-foreground/60">-</span>}
                        </span>
                        <span className="text-sm text-muted-foreground truncate">
                          {file.created_at ? formatTime(file.created_at) : <span className="text-muted-foreground/60">-</span>}
                        </span>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            title="预览"
                            onClick={() => handlePreview(file)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            title="下载"
                            onClick={() => handleDownload(file)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            title="删除"
                            onClick={() => handleDeleteSingle(file)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* 移动端 */}
                      <div className="md:hidden space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              className="rounded border-border shrink-0"
                              checked={selectedIds.has(file.id)}
                              onChange={() => handleSelectOne(file.id)}
                            />
                            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium truncate">{file.filename}</span>
                          </div>
                          <Badge variant={getFileTypeColor(file.file_type)} className="text-xs shrink-0">
                            {formatFileType(file.file_type)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pl-7">
                          <span className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            {formatFileSize(file.file_size)}
                          </span>
                          {file.task_title && (
                            <span className="truncate max-w-[200px]" title={file.task_title}>
                              {file.task_title}
                            </span>
                          )}
                          {file.created_at && <span>{formatTime(file.created_at)}</span>}
                        </div>
                        <div className="flex items-center gap-2 pl-7">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handlePreview(file)}
                          >
                            <Eye className="w-3.5 h-3.5" />预览
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleDownload(file)}
                          >
                            <Download className="w-3.5 h-3.5" />下载
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteSingle(file)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />删除
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">
                    第 {data.page} / {totalPages} 页
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={data.page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={data.page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      下一页
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 预览弹窗 */}
      <Dialog open={previewFile !== null} onOpenChange={(open) => !open && handleClosePreview()}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate">{previewFile?.filename}</DialogTitle>
            {previewFile && (
              <DialogDescription>
                {formatFileType(previewFile.file_type)}
                {' · '}
                {formatFileSize(previewFile.file_size)}
                {previewFile.task_title && <> · 任务: {previewFile.task_title}</>}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0">
            {previewLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : previewFile && TEXT_EXTENSIONS.has(getFileExtension(previewFile.filename)) ? (
              <pre className="text-sm p-4 bg-muted/50 rounded-xl overflow-x-auto whitespace-pre-wrap break-all max-h-[50vh] font-mono leading-relaxed">
                {previewContent || '暂无内容'}
              </pre>
            ) : previewMediaUrl ? (
              <div className="flex items-center justify-center py-8">
                {VIDEO_EXTENSIONS.has(getFileExtension(previewFile!.filename)) ? (
                  <video
                    controls
                    className="max-w-full max-h-[60vh] rounded-xl"
                    src={previewMediaUrl}
                  >
                    您的浏览器不支持视频播放
                  </video>
                ) : AUDIO_EXTENSIONS.has(getFileExtension(previewFile!.filename)) ? (
                  <audio
                    controls
                    className="w-full max-w-md"
                    src={previewMediaUrl}
                  >
                    您的浏览器不支持音频播放
                  </audio>
                ) : null}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            {previewFile && (
              <Button
                variant="outline"
                onClick={() => handleDownload(previewFile)}
              >
                <Download className="w-4 h-4 mr-1.5" />
                下载文件
              </Button>
            )}
            <Button onClick={handleClosePreview}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!open && !deleting) {
          setDeleteDialogOpen(false);
          setDeleteTargets([]);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              删除 {deleteTargets.length > 1 ? `${deleteTargets.length} 个文件` : '文件'}
            </DialogTitle>
            <DialogDescription>
              {deleteTargets.length > 1
                ? `确定要删除选中的 ${deleteTargets.length} 个文件吗？`
                : `确定要删除「${deleteTargets[0]?.filename}」吗？`
              }
            </DialogDescription>
          </DialogHeader>

          {/* 删除模式选择 */}
          {!deleteTargets.every((f) => f.file_type === 'orphan') && (
            <div className="space-y-3 py-2">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  name="deleteMode"
                  className="mt-0.5"
                  checked={deleteMode === 'soft'}
                  onChange={() => setDeleteMode('soft')}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">仅移除记录</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    仅从数据库中移除文件记录，保留磁盘上的实际文件。后续可以再次删除物理文件。
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-xl border border-destructive/30 cursor-pointer hover:bg-destructive/5 transition-colors">
                <input
                  type="radio"
                  name="deleteMode"
                  className="mt-0.5"
                  checked={deleteMode === 'hard'}
                  onChange={() => setDeleteMode('hard')}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-destructive">同时删除文件</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    同时删除数据库记录和磁盘上的实际文件，此操作不可撤销。
                  </p>
                </div>
              </label>
            </div>
          )}

          {deleteTargets.every((f) => f.file_type === 'orphan') && (
            <p className="text-sm text-destructive py-2">
              孤立文件无数据库记录，删除后将从磁盘上永久移除。
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeleteDialogOpen(false); setDeleteTargets([]); }}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {deleteMode === 'hard' ? '确认删除' : '确认移除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
