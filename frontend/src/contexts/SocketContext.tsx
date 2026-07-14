import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useLocation } from 'react-router-dom';

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType>({ socket: null });

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');

    const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD && typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : 'http://localhost:3001/api/v1');
    const SOCKET_URL = API_URL.replace('/api/v1', '');
    const SOCKET_PATH = `${API_URL.includes('/api/v1') ? '/api/v1' : ''}/socket.io`;

    // Connect with auth token if available, otherwise connect anonymously to track public guests
    const newSocket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      auth: token ? { token } : undefined,
      transports: ['polling', 'websocket'],
      secure: SOCKET_URL.startsWith('https'),
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    newSocket.on('connect', () => {
      console.log('🟢 Socket connected:', newSocket.id);
      newSocket.emit('page-view', { path: window.location.pathname });
      setSocket(newSocket);
    });

    newSocket.on('disconnect', () => {
      console.log('🔴 Socket disconnected');
    });

    newSocket.on('session:terminated', (data: { message?: string, blockedPath?: string }) => {
      if (data.blockedPath) {
        const blockedPages = JSON.parse(localStorage.getItem('blocked_pages') || '[]');
        if (!blockedPages.includes(data.blockedPath)) {
          blockedPages.push(data.blockedPath);
          localStorage.setItem('blocked_pages', JSON.stringify(blockedPages));
        }
        
        // If they are currently on that path, redirect them
        if (data.blockedPath === '*' || window.location.pathname === data.blockedPath) {
          const redirectPath = data.blockedPath === '*' ? 'all pages' : data.blockedPath;
          window.location.href = `/blocked?path=${encodeURIComponent(redirectPath)}`;
        }
      }
    });

    newSocket.on('session:unblocked', (data: { path: string }) => {
      const blockedPages = JSON.parse(localStorage.getItem('blocked_pages') || '[]');
      const newBlocked = blockedPages.filter((p: string) => p !== data.path);
      localStorage.setItem('blocked_pages', JSON.stringify(newBlocked));
      
      // If we are currently on the blocked page for this path, send them back
      if (window.location.pathname === '/blocked') {
        const params = new URLSearchParams(window.location.search);
        const urlPath = params.get('path');
        if (urlPath === data.path || (urlPath === 'all pages' && data.path === '*')) {
          window.location.href = data.path === '*' ? '/' : data.path;
        }
      }
    });

    newSocket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [user?.uuid]);

  // Emit current page URL when route changes
  useEffect(() => {
    if (socket) {
      socket.emit('page-view', { path: location.pathname });
    }
  }, [socket, location.pathname]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
