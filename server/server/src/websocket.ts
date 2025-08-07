
import { Server, Socket } from 'socket.io';
import { getDb } from './db.js';
import jwt from 'jsonwebtoken';
import { Message } from './types.js';

interface AuthenticatedSocket extends Socket {
    user?: { id: string };
}

export const initializeWebSocket = (io: Server) => {
    const db = getDb();

    io.use((socket: AuthenticatedSocket, next) => {
        const token = socket.handshake.headers.cookie?.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
                socket.user = { id: decoded.id };
                next();
            } catch (err) {
                next(new Error('Authentication error'));
            }
        } else {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket: AuthenticatedSocket) => {
        console.log(`User connected: ${socket.id}, userId: ${socket.user?.id}`);

        socket.on('joinRoom', (chatId: string) => {
            socket.join(chatId);
            console.log(`User ${socket.user?.id} joined room ${chatId}`);
        });

        socket.on('leaveRoom', (chatId: string) => {
            socket.leave(chatId);
            console.log(`User ${socket.user?.id} left room ${chatId}`);
        });

        socket.on('sendMessage', async (data: Partial<Message> & { mediaMimetype?: string }) => {
            if (!socket.user || !data.chatId) return;

            const senderId = socket.user.id;
            
            const message: Message = {
                id: `msg_${Date.now()}`,
                chatId: data.chatId,
                senderId,
                content: data.content || '',
                timestamp: new Date().toISOString(),
                type: data.type || 'text',
                mediaUrl: data.mediaUrl,
                mediaMimetype: data.mediaMimetype
            };

            try {
                await db.run(
                    'INSERT INTO messages (id, chatId, senderId, content, timestamp, type, media_url, media_mimetype) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [message.id, message.chatId, message.senderId, message.content, message.timestamp, message.type, message.mediaUrl, message.mediaMimetype]
                );

                io.to(message.chatId).emit('newMessage', message);
            } catch (error) {
                console.error('Failed to save or broadcast message:', error);
                socket.emit('messageError', { message: 'Failed to send message.' });
            }
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });
};
