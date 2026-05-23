import { io } from 'socket.io-client';

const API_URL = (import.meta as any).env?.VITE_API_URL || ((import.meta as any).env?.PROD && typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : 'http://localhost:3001/api/v1');
const SOCKET_URL = API_URL.replace('/api/v1', '');
const SOCKET_PATH = `${API_URL.includes('/api/v1') ? '/api/v1' : ''}/socket.io`;

export const socket = io(SOCKET_URL, {
    path: SOCKET_PATH,
    autoConnect: false,
    transports: ['polling', 'websocket'],
    secure: SOCKET_URL.startsWith('https'),
});

export function connectToCallCenter() {
    if (!socket.connected) {
        socket.connect();
    }
    socket.emit('join-room', 'callcenter');
}

export function disconnectSocket() {
    socket.disconnect();
}
