import { Server, Socket } from 'socket.io';
import { getDb } from './db';
import jwt from 'jsonwebtoken';
import { Message, User, ReactionMap } from './types';
import { sanitizeMediaUrl } from './fileUtils';
import { bot } from './routes/authRoutes'; // Import the initialized bot
import { push } from './push';
import { config } from './config'; // Import hardcoded config
import { CHAT_CONTACT_USER_FIELDS } from './sharedConstants';
import crypto from 'crypto';

type AuthenticatedSocket = Socket & {
    user?: { id: string };
};

const userSockets = new Map<string, Set<string>>(); // userId -> Set<socket.id>
const userActiveChat = new Map<string, string>(); // userId -> chatId
const userWindowFocus = new Map<string, boolean>(); // userId -> isFocused
const activeCalls = new Map<string, string>(); // callerId -> calleeId

const addUserSocket = (userId: string, socketId: string) => {
    if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socketId);
};

const removeUserSocket = (userId: string, socketId: string) => {
    if (userSockets.has(userId)) {
        userSockets.get(userId)!.delete(socketId);
        if (userSockets.get(userId)!.size === 0) {
            userSockets.delete(userId);
        }
    }
};

const notifyContactsOfPresenceChange = async (io: Server, userId: string, online: boolean) => {
    const db = getDb();
    const contacts: { partnerId: string }[] = await db.all(`
        SELECT DISTINCT
            CASE
                WHEN SUBSTR(chatId, 1, INSTR(chatId, '-') - 1) = ? THEN SUBSTR(chatId, INSTR(chatId, '-') + 1)
                ELSE SUBSTR(chatId, 1, INSTR(chatId, '-') - 1)
            END as partnerId
        FROM messages
        WHERE chatId LIKE '%-%' AND (chatId LIKE ? OR chatId LIKE ?)`,
        [userId, `${userId}-%`, `%-${userId}`]
    );
    
    const user = await db.get('SELECT profile_color, message_color, last_seen, privacy_show_last_seen FROM users WHERE id = ?', userId);
    
    let lastSeen: string | null = null;
    if (!online) {
        lastSeen = (user?.privacy_show_last_seen === 0) ? 'recent' : (user?.last_seen || new Date().toISOString());
    }
    
    const payload = { 
        userId, 
        online, 
        lastSeen,
        profile_color: user?.profile_color, 
        message_color: user?.message_color 
    };

    const recipientIds = new Set(contacts.map(c => c.partnerId));

    recipientIds.forEach(contactId => {
        if (userSockets.has(contactId)) {
            userSockets.get(contactId)!.forEach(socketId => {
                io.to(socketId).emit(online ? 'user-online' : 'user-offline', payload);
            });
        }
    });
    io.to('global').emit(online ? 'user-online' : 'user-offline', payload);
};

export const initializeWebSocket = (io: Server) => {
    const db = getDb();

    io.use((socket: Socket, next) => {
        const authSocket = socket as AuthenticatedSocket;
        const token = authSocket.handshake.headers.cookie?.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, config.JWT_SECRET) as { id: string };
                authSocket.user = { id: decoded.id };
                next();
            } catch (err) {
                next(new Error('Authentication error'));
            }
        } else {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', async (socket: Socket) => {
        const authSocket = socket as AuthenticatedSocket;
        if (!authSocket.user) return;

        const userId = authSocket.user.id;
        authSocket.join(userId);
        addUserSocket(userId, authSocket.id);
        userWindowFocus.set(userId, true);
        
        if (userSockets.get(userId)?.size === 1) {
            await db.run('UPDATE users SET last_seen = NULL WHERE id = ?', userId);
            console.log(`User connected: ${userId}`);
            notifyContactsOfPresenceChange(io, userId, true);
        }

        authSocket.on('joinRoom', async (chatId: string) => {
            authSocket.join(chatId);
            await db.run('UPDATE user_chat_states SET unread_count = 0 WHERE userId = ? AND chatId = ?', [userId, chatId]);
        });
        
        authSocket.on('viewingChat', ({ chatId }: { chatId: string }) => {
            if (authSocket.user) {
                userActiveChat.set(authSocket.user.id, chatId);
            }
        });

        authSocket.on('stopViewingChat', ({ chatId }: { chatId: string }) => {
            if (authSocket.user && userActiveChat.get(authSocket.user.id) === chatId) {
                userActiveChat.delete(authSocket.user.id);
            }
        });
        
        authSocket.on('windowFocusChanged', ({ isFocused }: { isFocused: boolean }) => {
            if (authSocket.user) {
                userWindowFocus.set(authSocket.user.id, isFocused);
            }
        });
        
        authSocket.on('markMessagesAsRead', async ({ chatId }: { chatId: string }) => {
            if (!authSocket.user) return;
            const readerId = authSocket.user.id;
            
            await db.run(
                `INSERT INTO user_chat_states (userId, chatId, unread_count) VALUES (?, ?, 0)
                 ON CONFLICT(userId, chatId) DO UPDATE SET unread_count = 0`, [readerId, chatId]
            );

            const messagesToUpdate = await db.all(
                `SELECT id, senderId, read_by FROM messages 
                 WHERE chatId = ? AND senderId != ? AND (read_by IS NULL OR read_by NOT LIKE ?)`,
                [chatId, readerId, `%${readerId}%`]
            );

            if (messagesToUpdate.length > 0) {
                for (const msg of messagesToUpdate) {
                    const readBy: string[] = msg.read_by ? JSON.parse(msg.read_by) : [];
                    if (!readBy.includes(readerId)) {
                        readBy.push(readerId);
                        await db.run('UPDATE messages SET read_by = ? WHERE id = ?', [JSON.stringify(readBy), msg.id]);
                    }
                }
                const messageIds = messagesToUpdate.map(m => m.id);
                io.to(chatId).emit('messagesRead', { messageIds, chatId, readerId });
            }

            io.to(readerId).emit('unreadCountCleared', { chatId });
        });

        authSocket.on('sendMessage', async (data: Partial<Message> & { sender?: User }) => {
            if (!authSocket.user) return;
            const senderId = authSocket.user.id;
            const { chatId, content, type = 'text', mediaUrl, mediaMimetype, tempId } = data;

            if (!chatId || (!content && !mediaUrl)) {
                return;
            }
            
            try {
                const sender = await db.get('SELECT mute_expires_at as muteExpiresAt, mute_reason as muteReason FROM users WHERE id = ?', senderId);
                if (sender && sender.muteExpiresAt) {
                    const expiryDate = new Date(sender.muteExpiresAt);
                    if (expiryDate > new Date()) {
                        return authSocket.emit('actionFailedMute', { 
                            reason: sender.muteReason,
                            expiresAt: sender.muteExpiresAt 
                        });
                    }
                }

                const isPrivateChat = chatId.includes('-');
                let isNewChat = false;
                if (isPrivateChat) {
                    const messageCount = await db.get('SELECT COUNT(id) as count FROM messages WHERE chatId = ?', chatId);
                    isNewChat = messageCount.count === 0;
                }
                
                const partnerId = isPrivateChat ? chatId.split('-').find(id => id !== senderId) : null;
                if (partnerId) {
                    const partnerExists = await db.get('SELECT id FROM users WHERE id = ?', partnerId);
                    if (!partnerExists) {
                        console.warn(`User ${senderId} tried to message non-existent user ${partnerId}. Aborting.`);
                        return;
                    }
                }

                const newMessage: Message = {
                    id: crypto.randomUUID(),
                    chatId,
                    senderId,
                    content: content || '',
                    timestamp: new Date().toISOString(),
                    type,
                    mediaUrl,
                    mediaMimetype,
                    isEdited: false,
                    isDeleted: false,
                    reactions: {},
                };

                await db.run(
                    'INSERT INTO messages (id, chatId, senderId, content, timestamp, type, media_url, media_mimetype, is_edited, is_deleted, reactions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)',
                    [newMessage.id, newMessage.chatId, newMessage.senderId, newMessage.content, newMessage.timestamp, newMessage.type, newMessage.mediaUrl, newMessage.mediaMimetype, JSON.stringify(newMessage.reactions)]
                );
                
                const senderInfo = await db.get<User>(`SELECT ${CHAT_CONTACT_USER_FIELDS} FROM users WHERE id = ?`, senderId);
                const payload = { ...newMessage, tempId, sender: senderInfo };
                
                if (isNewChat && partnerId) {
                    const partnerInfo = await db.get(`SELECT ${CHAT_CONTACT_USER_FIELDS} FROM users WHERE id = ?`, partnerId);
                    
                    io.to(senderId).emit('newChatCreated', { 
                        contact: { ...partnerInfo, type: 'private' },
                        firstMessage: payload
                    });
                    io.to(partnerId).emit('newChatCreated', {
                        contact: { ...senderInfo, type: 'private' },
                        firstMessage: payload
                    });
                } else {
                    io.to(chatId).emit('newMessage', payload);
                    if (partnerId) {
                        // Also emit to the partner's user room to ensure sidebar updates
                        io.to(partnerId).emit('newMessage', payload);
                    }
                }
                
                if (isPrivateChat && partnerId) {
                    await db.run(
                        `INSERT INTO user_chat_states (userId, chatId, unread_count) VALUES (?, ?, 1)
                         ON CONFLICT(userId, chatId) DO UPDATE SET unread_count = unread_count + 1`,
                        [partnerId, chatId]
                    );
                    
                    const recipient = await db.get<User>('SELECT id, telegram_id, name FROM users WHERE id = ?', partnerId);
                    const chatState = await db.get('SELECT is_muted FROM user_chat_states WHERE userId = ? AND chatId = ?', [recipient?.id, chatId]);
                    
                    const recipientIsOnline = userSockets.has(partnerId);
                    
                    const shouldSendNotification = !chatState?.is_muted && 
                        (!recipientIsOnline || userActiveChat.get(partnerId) !== chatId || userWindowFocus.get(partnerId) !== true);

                    if (shouldSendNotification) {
                        const notificationPayload = JSON.stringify({
                            title: `New message from ${senderInfo?.name || 'Someone'}`,
                            body: content || (type === 'image' ? 'Sent an image' : (type === 'video' || type === 'video_circle') ? 'Sent a video' : 'Sent a file'),
                            tag: chatId,
                            url: `/app/chat/${chatId}`,
                        });
                        
                        const subscriptions = await db.all('SELECT * FROM push_subscriptions WHERE userId = ?', partnerId);
                        subscriptions.forEach(sub => {
                            const subObject = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
                            push.sendNotification(subObject, notificationPayload).catch(err => {
                                if (err.statusCode === 410) db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', sub.endpoint);
                                else console.error("Failed to send push notification:", err.body);
                            });
                        });
                        
                        if (bot && recipient?.telegram_id) {
                            try {
                                let tgText: string;
                                if (type === 'text') tgText = `💬 Новое сообщение от ${senderInfo?.name}:\n\n${content}`;
                                else if (type === 'audio') tgText = `🎤 Новое голосовое сообщение от ${senderInfo?.name}.`;
                                else tgText = `🖼️ Новое медиа-сообщение от ${senderInfo?.name}.`;
                                
                                await bot.sendMessage(recipient.telegram_id, tgText, {
                                    reply_markup: { inline_keyboard: [[{ text: "✉️ Ответить", callback_data: `reply_${chatId}` }]] }
                                });
                            } catch(e: any) {
                               console.warn(`Could not send Telegram notification to ${recipient.name}: ${e.message}`);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("Error saving message:", error);
            }
        });

        authSocket.on('start-typing', async ({ chatId }: { chatId: string }) => {
            if (!authSocket.user) return;
            try {
                const sender = await db.get('SELECT privacy_show_typing FROM users WHERE id = ?', authSocket.user.id);
                const canShowTyping = sender && sender.privacy_show_typing !== 0;
                if (canShowTyping) {
                    authSocket.to(chatId).emit('user-is-typing', { chatId, userId: authSocket.user.id });
                }
            } catch (error) {
                console.error("Error checking typing privacy:", error);
            }
        });
        
        authSocket.on('stop-typing', async ({ chatId }: { chatId: string }) => {
            if (!authSocket.user) return;
            authSocket.to(chatId).emit('user-stopped-typing', { chatId, userId: authSocket.user.id });
        });

        authSocket.on('reactToMessage', async (data: { messageId: string, reaction: string }) => {
            if (!authSocket.user) return;
            const { messageId, reaction } = data;
            const db = getDb();
            try {
                await db.run('BEGIN TRANSACTION');
                const message = await db.get('SELECT chatId, reactions FROM messages WHERE id = ?', messageId);
                if (!message) {
                    await db.run('ROLLBACK');
                    return; 
                }

                const reactions: ReactionMap = message.reactions ? JSON.parse(message.reactions) : {};
                const reactors = reactions[reaction] || [];
                
                if (reactors.includes(userId)) {
                    reactions[reaction] = reactors.filter(id => id !== userId);
                    if (reactions[reaction].length === 0) delete reactions[reaction];
                } else {
                    reactions[reaction] = [...reactors, userId];
                }

                await db.run('UPDATE messages SET reactions = ? WHERE id = ?', [JSON.stringify(reactions), messageId]);
                await db.run('COMMIT');

                io.to(message.chatId).emit('messageReactionUpdated', { messageId, reactions, chatId: message.chatId });

            } catch (e) {
                await db.run('ROLLBACK').catch(console.error);
                console.error("Failed to update reaction via WebSocket:", e);
            }
        });
        
        authSocket.on('call:start', (data) => {
            console.log(`User ${userId} is calling ${data.to}`);
            io.to(data.to).emit('call:incoming', { from: data.from, offer: data.offer });
        });

        authSocket.on('webrtc:answer', (data) => {
             console.log(`User ${userId} answered call from ${data.to}`);
            io.to(data.to).emit('webrtc:answer', { answer: data.answer });
        });
        
        authSocket.on('webrtc:ice-candidate', (data) => {
            io.to(data.to).emit('webrtc:ice-candidate', { candidate: data.candidate });
        });

        authSocket.on('call:quality-update', (data) => {
            if (data.to) {
                io.to(data.to).emit('call:quality-update', { quality: data.quality });
            }
        });

        authSocket.on('call:reject', (data) => {
            io.to(data.to).emit('call:rejected', { reason: data.reason });
        });

        authSocket.on('call:end', (data) => {
            io.to(data.to).emit('call:end');
        });


        authSocket.on('disconnect', async () => {
            removeUserSocket(userId, authSocket.id);
            io.to(activeCalls.get(userId)!).emit('call:end');
            activeCalls.delete(userId);
            
            if (!userSockets.has(userId)) {
                try {
                    userActiveChat.delete(userId);
                    userWindowFocus.delete(userId);
                    const offlineTimestamp = new Date().toISOString();
                    await db.run('UPDATE users SET last_seen = ? WHERE id = ?', [offlineTimestamp, userId]);
                    console.log(`User ${userId} marked as offline at ${offlineTimestamp}.`);
                    notifyContactsOfPresenceChange(io, userId, false);
                } catch (error) {
                    console.error(`Error during user disconnect cleanup for ${userId}:`, error);
                }
            }
        });
    });
};