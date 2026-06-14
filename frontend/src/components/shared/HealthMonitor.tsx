import { useEffect, useRef, useState } from 'react';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { useAuth } from '@/hooks/useAuth';
import { AuthDialog } from '@/components/shared/AuthDialog';
import { WifiOff, RefreshCw, X } from 'lucide-react';

/**
 * 全局健康监控组件
 * - 检测后端离线/在线状态，显示顶部状态条
 * - 检测会话失效（后端重启导致 token 失效），自动弹出重新登录对话框
 * 放置在 AuthProvider 内部，可同时访问 useAuth 和 useBackendHealth
 */
export function HealthMonitor() {
  const { backendStatus } = useBackendHealth();
  const { user, logout, consumeIntentionalLogout } = useAuth();

  // 追踪上一次的 user 值，用于检测 "从已登录→已登出" 的转变
  const prevUserRef = useRef(user);
  // 标记是否由本组件触发的 logout（避免重复弹窗）
  const logoutTriggeredByUs = useRef(false);

  // 后端在线状态相关
  const wasOnlineRef = useRef(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // 会话过期对话框
  const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);

  // 核心检测逻辑：user 从有值变为 null → 会话已失效（排除用户主动登出）
  useEffect(() => {
    const prevUser = prevUserRef.current;
    prevUserRef.current = user;

    // 当 user 从有值变为 null，且不是本组件主动触发的 logout，且不是用户主动登出
    if (prevUser && !user && !logoutTriggeredByUs.current) {
      if (!consumeIntentionalLogout()) {
        setSessionExpiredOpen(true);
      }
    }

    // 重置标记
    if (!user) {
      logoutTriggeredByUs.current = false;
    }
  }, [user]);

  // 后端离线时检测：后端恢复在线后重置 banner 关闭状态
  useEffect(() => {
    if (backendStatus === 'online' && !wasOnlineRef.current) {
      setBannerDismissed(false);
    }
    wasOnlineRef.current = backendStatus === 'online';
  }, [backendStatus]);

  // 当会话过期对话框关闭且后端在线时，主动检查是否需要 logout（兜底）
  // 场景：axios 401 拦截器已清除 token，但 user state 尚未更新
  useEffect(() => {
    if (sessionExpiredOpen) return; // 对话框已打开，无需处理
    if (backendStatus !== 'online') return;
    // 如果 user 仍然存在但 token 已被清除（由 401 拦截器清除），主动 logout
    if (user) {
      const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
      if (!token) {
        logoutTriggeredByUs.current = true;
        logout();
        setSessionExpiredOpen(true);
      }
    }
  }, [backendStatus, user, sessionExpiredOpen, logout]);

  const isOffline = backendStatus === 'offline';
  const showBanner = isOffline && !bannerDismissed;

  return (
    <>
      {/* 后端离线状态条 */}
      {showBanner && (
        <div
          role="alert"
          className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground shadow-lg"
        >
          <div className="max-w-[1800px] mx-auto px-4 lg:px-8 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm font-medium">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>无法连接到后端服务，部分功能暂不可用</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium hover:bg-destructive-foreground/10 transition-colors"
                title="刷新页面"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                刷新
              </button>
              <button
                onClick={() => setBannerDismissed(true)}
                className="p-1 rounded-md hover:bg-destructive-foreground/10 transition-colors"
                title="关闭提示"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 后端离线时占位，防止 fixed banner 遮挡页面内容 */}
      {showBanner && <div className="h-[44px]" />}

      {/* 会话过期重新登录对话框 */}
      <AuthDialog
        open={sessionExpiredOpen}
        onOpenChange={setSessionExpiredOpen}
        initialView="login"
        reason="您的登录会话已失效，请重新登录"
      />
    </>
  );
}
