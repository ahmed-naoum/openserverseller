import { io } from 'socket.io-client';

const SOCKET_URL = (import.meta as any).env?.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
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
