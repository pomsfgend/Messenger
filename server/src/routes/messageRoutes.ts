import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { getDb } from '../db';
import { User, MessageType, Message, ReactionMap } from '../types';
import { __dirname } from '../utils';
import { moveFile, sanitizeMediaUrl } from '../fileUtils';
import { Server as SocketIOServer } from 'socket.io';
import { filterUserForPrivacy } from '../privacyUtils'; // Import centralized privacy filter
import '../types'; // Ensures declaration merging for req.user is picked up
import { GLOBAL_CHAT_ID } from '../constants';

const router = express.Router();

const tempUploadDir = path.join(__dirname, '..', 'uploads', 'temp');
fs.mkdir(tempUploadDir, { recursive: true });

const upload = multer({
    dest: tempUploadDir,
    limits: { fileSize: 1 * 1024 * 1024 * 1024 }, // 1GB limit
});


// NEW: Endpoint to handle file uploads for messages
router.post('/upload', upload.single('mediaFile'), async (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    const userId = req.user!.id;
    const tempPath = req.file.path;
    const finalFilename = `${userId}--media-${Date.now()}${path.extname(req.file.originalname)}`;
    const finalPath = path.join(__dirname, '..', 'uploads', finalFilename);

    try {
        await moveFile(tempPath, finalPath);
        res.status(201).json({
            mediaUrl: finalFilename,
            type: req.file.mimetype,
            originalName: req.file.originalname
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to process uploaded file.' });
    } finally {
        await fs.unlink(tempPath).catch(() => {}); // Clean up temp file
    }
});


router.get('/:chatId', async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const { limit = 50, before } = req.query;
    const userId = req.user!.id;
    const db = getDb();

    try {
        // Check if user is part of this chat
        if (chatId !== GLOBAL_CHAT_ID && !chatId.split('-').includes(userId)) {
            return res.status(403).json({ message: "Access denied to this chat." });
        }

        let query = `
            SELECT 
                id, chatId, senderId, content, timestamp, type, 
                media_url as mediaUrl, 
                media_mimetype as mediaMimetype, 
                is_edited as isEdited, 
                is_deleted as isDeleted, 
                reactions, 
                forwarded_info as forwardedInfo, 
                read_by as readBy
            FROM messages 
            WHERE chatId = ?`;
        const params: any[] = [chatId];

        if (before) {
            query += ` AND timestamp < ?`;
            params.push(before as string);
        }

        query += ` ORDER BY timestamp DESC LIMIT ?`;
        params.push(Number(limit) + 1); // Fetch one extra to check if there are more

        const rows: any[] = await db.all(query, ...params);
        
        const hasMore = rows.length > Number(limit);
        if (hasMore) {
            rows.pop(); // Remove the extra message
        }
        
        const messages: Message[] = rows.map(row => ({
            ...row,
            reactions: row.reactions ? JSON.parse(row.reactions) : {},
            forwardedInfo: row.forwardedInfo ? JSON.parse(row.forwardedInfo) : undefined,
            readBy: row.readBy ? JSON.parse(row.readBy) : []
        })).reverse();


        // Get all unique user IDs from the fetched messages AND the chat itself
        const userIds = new Set(messages.map(m => m.senderId));
        if (chatId !== GLOBAL_CHAT_ID) {
            chatId.split('-').forEach(id => userIds.add(id));
        }
        
        const uniqueUserIds = Array.from(userIds);

        if (uniqueUserIds.length > 0) {
            const placeholders = uniqueUserIds.map(() => '?').join(',');
            const usersFromDb: User[] = await db.all(`SELECT id, name, uniqueId, avatar_url as avatarUrl, role, profile_color, message_color, last_seen, privacy_show_last_seen FROM users WHERE id IN (${placeholders})`, ...uniqueUserIds);
            
            const users = usersFromDb.reduce((acc, user) => {
                acc[user.id] = filterUserForPrivacy(user, userId);
                return acc;
            }, {} as Record<string, User>);

            res.json({ messages, users, hasMore });
        } else {
            res.json({ messages: [], users: {}, hasMore: false });
        }

    } catch (error) {
        console.error(`Failed to fetch messages for chat ${chatId}:`, error);
        res.status(500).json({ message: 'Server error while fetching messages.' });
    }
});

router.put('/:messageId', async (req: Request, res: Response) => {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;
    const db = getDb();
    const io = req.app.get('io') as SocketIOServer;

    try {
        const message = await db.get('SELECT * FROM messages WHERE id = ?', messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found.' });
        }
        if (message.senderId !== userId) {
            return res.status(403).json({ message: 'You can only edit your own messages.' });
        }
        
        await db.run('UPDATE messages SET content = ?, is_edited = 1 WHERE id = ?', [content, messageId]);
        
        io.to(message.chatId).emit('messageEdited', { id: messageId, chatId: message.chatId, content, isEdited: true });
        
        res.json({ message: 'Message edited successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to edit message.' });
    }
});

router.delete('/:messageId', async (req: Request, res: Response) => {
    const { messageId } = req.params;
    const userId = req.user!.id;
    const db = getDb();
    const io = req.app.get('io') as SocketIOServer;

    try {
        const message = await db.get('SELECT senderId, chatId, media_url FROM messages WHERE id = ?', messageId);
        if (!message) return res.status(404).json({ message: 'Message not found' });
        
        // Allow user to delete their own messages, or moderators/admins to delete any message
        if (message.senderId !== userId && req.user!.role === 'user') {
            return res.status(403).json({ message: "You don't have permission to delete this message." });
        }
        
        await db.run('DELETE FROM messages WHERE id = ?', messageId);

        if (message.media_url) {
            const filePath = path.join(__dirname, '..', 'uploads', sanitizeMediaUrl(message.media_url));
            await fs.unlink(filePath).catch(err => {
                 if(err.code !== 'ENOENT') console.error("Failed to delete media file:", err);
            });
        }
        
        io.to(message.chatId).emit('messageDeleted', { id: messageId, chatId: message.chatId });
        
        res.json({ message: 'Message deleted successfully.' });

    } catch (error) {
        res.status(500).json({ message: 'Failed to delete message.' });
    }
});

router.post('/bulk-delete', async (req: Request, res: Response) => {
    const { messageIds } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const db = getDb();
    const io = req.app.get('io') as SocketIOServer;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return res.status(400).json({ message: 'messageIds must be a non-empty array.' });
    }

    try {
        const placeholders = messageIds.map(() => '?').join(',');
        const messages = await db.all(`SELECT id, senderId, chatId, media_url FROM messages WHERE id IN (${placeholders})`, messageIds);
        
        const authorizedToDelete: string[] = [];
        const chatIdsToNotify = new Set<string>();

        for (const msg of messages) {
            if (msg.senderId === userId || userRole !== 'user') {
                authorizedToDelete.push(msg.id);
                chatIdsToNotify.add(msg.chatId);
            }
        }
        
        if (authorizedToDelete.length > 0) {
            const deletePlaceholders = authorizedToDelete.map(() => '?').join(',');
            await db.run(`DELETE FROM messages WHERE id IN (${deletePlaceholders})`, authorizedToDelete);
            
            (async () => {
                for (const msg of messages) {
                    if (msg.media_url && authorizedToDelete.includes(msg.id)) {
                        const filePath = path.join(__dirname, '..', 'uploads', sanitizeMediaUrl(msg.media_url));
                         await fs.unlink(filePath).catch(err => {
                             if(err.code !== 'ENOENT') console.error("Failed to delete media file:", err);
                         });
                    }
                }
            })();

            chatIdsToNotify.forEach(chatId => {
                io.to(chatId).emit('messagesDeleted', { messageIds: authorizedToDelete, chatId: chatId });
            });
        }
        
        res.json({ message: 'Messages deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete messages.' });
    }
});

router.post('/:messageId/react', async (req: Request, res: Response) => {
    const { messageId } = req.params;
    const { reaction } = req.body;
    const userId = req.user!.id;
    const db = getDb();

    try {
        const message = await db.get('SELECT reactions FROM messages WHERE id = ?', messageId);
        if (!message) return res.status(404).send();

        const reactions: ReactionMap = message.reactions ? JSON.parse(message.reactions) : {};
        const reactors = reactions[reaction] || [];

        if (reactors.includes(userId)) {
            reactions[reaction] = reactors.filter(id => id !== userId);
            if (reactions[reaction].length === 0) delete reactions[reaction];
        } else {
            reactions[reaction] = [...reactors, userId];
        }

        await db.run('UPDATE messages SET reactions = ? WHERE id = ?', [JSON.stringify(reactions), messageId]);
        
        res.json({ message: 'Reaction updated.' });

    } catch (error) {
        res.status(500).json({ message: 'Failed to update reaction.' });
    }
});


router.post('/forward', async (req: Request, res: Response) => {
    const { messageId, targetChatIds, hideSender } = req.body;
    const forwarderId = req.user!.id;
    const db = getDb();
    const io = req.app.get('io') as SocketIOServer;
    
    try {
        const originalMessage = await db.get('SELECT * FROM messages WHERE id = ?', messageId);
        if (!originalMessage) return res.status(404).json({ message: 'Original message not found.' });

        const originalSender = await db.get('SELECT name FROM users WHERE id = ?', originalMessage.senderId);

        for (const chatId of targetChatIds) {
            const newMessage: Message = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                chatId: chatId,
                senderId: forwarderId,
                content: originalMessage.content,
                timestamp: new Date().toISOString(),
                type: originalMessage.type,
                mediaUrl: originalMessage.media_url,
                mediaMimetype: originalMessage.media_mimetype,
                isEdited: false,
                isDeleted: false,
                forwardedInfo: hideSender ? undefined : {
                    originalSenderName: originalSender.name,
                },
            };

            await db.run(
                'INSERT INTO messages (id, chatId, senderId, content, timestamp, type, media_url, media_mimetype, forwarded_info) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [newMessage.id, newMessage.chatId, newMessage.senderId, newMessage.content, newMessage.timestamp, newMessage.type, newMessage.mediaUrl, newMessage.mediaMimetype, JSON.stringify(newMessage.forwardedInfo)]
            );

            const senderInfo = await db.get<User>('SELECT id, name, uniqueId, avatar_url FROM users WHERE id = ?', forwarderId);
            const payload = { ...newMessage, sender: senderInfo };
            io.to(chatId).emit('newMessage', payload);
            
            const partnerId = chatId.includes('-') ? chatId.split('-').find(id => id !== forwarderId) : null;
            if (partnerId) {
                io.to(partnerId).emit('newMessage', payload);
            }
        }
        
        res.json({ message: 'Message forwarded successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to forward message.' });
    }
});

router.get('/:chatId/media', async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const { type } = req.query;
    const userId = req.user!.id;
    const db = getDb();

    if (chatId !== GLOBAL_CHAT_ID && !chatId.split('-').includes(userId)) {
        return res.status(403).json({ message: "Access denied." });
    }
    
    let query = `SELECT id, chatId, senderId, content, timestamp, type, media_url as mediaUrl, media_mimetype as mediaMimetype FROM messages WHERE chatId = ? AND type != 'text'`;
    const params: any[] = [chatId];

    if (type && type !== 'all') {
        const typesToInclude = type === 'image' ? ['image', 'video', 'video_circle'] : [type];
        const placeholders = typesToInclude.map(() => '?').join(',');
        query += ` AND type IN (${placeholders})`;
        params.push(...typesToInclude);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT 100';

    try {
        const mediaMessages = await db.all(query, ...params);
        res.json(mediaMessages);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch media.' });
    }
});

export default router;