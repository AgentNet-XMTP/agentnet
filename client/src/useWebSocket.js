import { useEffect, useRef, useCallback } from 'react';

export function useWebSocket(onMessage) {
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const attemptsRef = useRef(0);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        attemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (e) {}
      };

      ws.onclose = () => {
        attemptsRef.current += 1;
        if (attemptsRef.current < 5) {
          reconnectRef.current = setTimeout(connect, 3000 * attemptsRef.current);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      // WebSocket not supported or connection failed
    }
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
