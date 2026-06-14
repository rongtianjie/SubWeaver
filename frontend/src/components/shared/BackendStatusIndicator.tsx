import { useBackendHealth } from '@/hooks/useBackendHealth';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 后端连接状态指示器
 * 在线：绿色图标 + "后端在线" tooltip
 * 离线：红色图标 + 脉冲动画 + "后端离线" tooltip
 */
export function BackendStatusIndicator() {
  const { backendStatus, checking } = useBackendHealth();
  const isOnline = backendStatus === 'online';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-default select-none">
          {/* 状态点 */}
          <span className="relative flex shrink-0">
            {/* 在线时的脉冲动画环 */}
            {isOnline && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40 animate-ping" />
            )}
            <span
              className={cn(
                'relative inline-flex rounded-full w-2 h-2',
                isOnline ? 'bg-emerald-500' : 'bg-red-500'
              )}
            />
          </span>
          {/* 图标 + 文本 */}
          <div className="flex items-center gap-1">
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-red-500" />
            )}
            <span
              className={cn(
                'text-xs font-medium',
                isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              )}
            >
              {isOnline ? '在线' : '离线'}
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isOnline ? '后端服务运行正常' : '后端服务无法连接'}
        {checking && ' (检查中…)'}
      </TooltipContent>
    </Tooltip>
  );
}
