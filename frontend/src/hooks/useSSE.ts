import { useEffect, useRef, useState } from 'react';
import { taskApi } from '@/lib/api';

interface SSEProgress {
  status: string;
  progress: number;
  message: string | null;
  queue_position: number | null;
  estimated_seconds: number | null;
}

export function useSSE(taskId: string | null) {
  const [progress, setProgress] = useState<SSEProgress | null>(null);
  const [done, setDone] = useState(false);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!taskId) return;

    const url = taskApi.getStreamUrl(taskId);
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);

    es.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      setProgress(data);
    });

    es.addEventListener('completed', () => {
      setDone(true);
      es.close();
    });

    es.addEventListener('failed', (event) => {
      const data = JSON.parse(event.data);
      setProgress(data);
      setDone(true);
      es.close();
    });

    es.addEventListener('cancelled', () => {
      setDone(true);
      es.close();
    });

    es.addEventListener('error', () => {
      setConnected(false);
      // 网络错误时不立即标记 done，允许轮询降级
    });

    return () => {
      es.close();
    };
  }, [taskId]);

  return { progress, done, connected };
}
