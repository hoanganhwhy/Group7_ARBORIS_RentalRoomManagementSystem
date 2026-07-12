import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const VITE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
// socket.io needs the base URL, not the /api path
const SOCKET_URL = VITE_API_URL.replace('/api', '');

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // connect socket
    socketRef.current = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current?.id);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return socketRef.current;
}
