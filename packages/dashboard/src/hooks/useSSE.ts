import { useEffect, useRef, useState } from 'react';

interface SSEEvent {
  type: string;
  data: unknown;
  timestamp: number;
}

export function useSSE(url: string = '/api/sse') {
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const source = new EventSource(url);
    sourceRef.current = source;

    source.onopen = () => setConnected(true);

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastEvent({
          type: data.type ?? 'message',
          data,
          timestamp: Date.now(),
        });
      } catch {
        // ignore non-JSON messages
      }
    };

    source.onerror = () => {
      setConnected(false);
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [url]);

  return { lastEvent, connected };
}
