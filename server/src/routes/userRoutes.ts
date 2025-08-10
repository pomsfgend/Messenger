import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getDb } from '../db';
import { __dirname } from '../utils';
import { cropImage, sanitizeMediaUrl, moveFile } from '../fileUtils';
import type { User, AvatarData } from '../types';
import { Server as SocketIOServer } from 'socket.io';
import { filterUserForPrivacy } from '../privacyUtils';
import '../types';

const router = express.Router();

const tempUploadDir = path.join(__dirname, '..', 'uploads', 'temp');
fs.mkdir(tempUploadDir, { recursive: true });
const upload = multer({
    dest: tempUploadDir,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit for avatars
}).single('avatarFile');


const privacySensitiveFields = `
    u.id, u.name, u.uniqueId, u.createdAt, u.avatar_url as avatarUrl, u.role, u.last_seen as lastSeen,
    u.profile_color, u.message_color, u.description, u.profile_emoji, u.profile_emoji_density,
    u.profile_emoji_rotation, u.dob, u.phone_number as phoneNumber, u.telegram_id as telegramId,
    u.privacy_show_phone, u.privacy_show_telegram, u.privacy_show_dob, u.privacy_show_description,
    u.privacy_show_last_seen, u.privacy_show_typing
`;
const allUserFieldsForCurrentUser = 'id, username, name, uniqueId, gender, dob, createdAt, telegram_id as telegramId, phone_number as phoneNumber, is_anonymous as isAnonymous, avatar_url as avatarUrl, profile_setup as profileSetup, role, is_banned as isBanned, ban_reason as banReason, ban_expires_at as banExpiresAt, google_id as googleId, mute_expires_at as muteExpiresAt, mute_reason as muteReason, last_seen as lastSeen, profile_color, message_color, description, profile_emoji, profile_emoji_density, profile_emoji_rotation, privacy_show_phone, privacy_show_telegram, privacy_show_dob, privacy_show_description, privacy_show_last_seen, privacy_show_typing, is_2fa_enabled';


router.get('/me/chats', async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const db = getDb();
    try {
        const chats = await db.all(`
            WITH UserPartners AS (
                SELECT DISTINCT
                    CASE
                        WHEN senderId = ? THEN
                            SUBSTR(chatId, INSTR(chatId, '-') + 1)
                        ELSE
                            SUBSTR(chatId, 1, INSTR(chatId, '-') - 1)
                    END AS partnerId
                FROM messages
                WHERE (senderId = ? OR chatId LIKE ? OR chatId LIKE ?) AND chatId LIKE '%-%'
            ),
            LastMessages AS (
                SELECT
                    m.chatId,
                    m.content,
                    m.senderId,
                    m.timestamp,
                    m.type,
                    m.is_deleted,
                    ROW_NUMBER() OVER(PARTITION BY m.chatId ORDER BY m.timestamp DESC) as rn
                FROM messages m
                WHERE m.chatId LIKE '%-%'
            )
            SELECT
                p.id, p.name, p.username, p.uniqueId, p.avatar_url as avatarUrl, p.last_seen as lastSeen,
                CASE WHEN p.last_seen IS NULL THEN 1 ELSE 0 END as isOnline,
                p.profile_color, p.message_color, p.createdAt,
                lm.content as lastMessageContent,
                lm.senderId as lastMessageSenderId,
                lm.timestamp as lastMessageTimestamp,
                lm.type as lastMessageType,
                lm.is_deleted as lastMessageIsDeleted,
                ucs.is_muted,
                ucs.unread_count as unreadCount
            FROM UserPartners up
            JOIN users p ON p.id = up.partnerId
            LEFT JOIN LastMessages lm ON (
                (lm.chatId = ? || '-' || p.id OR lm.chatId = p.id || '-' || ?) AND lm.rn = 1
            )
            LEFT JOIN user_chat_states ucs ON ucs.userId = ? AND (
                ucs.chatId = ? || '-' || p.id OR ucs.chatId = p.id || '-' || ?
            )
            WHERE p.id != ?
            ORDER BY lm.timestamp DESC;
        `, [userId, userId, `${userId}-%`, `%-`+userId, userId, userId, userId, userId, userId, userId]);

        res.json(chats);
    } catch (error) {
        console.error("Failed to get chats:", error);
        res.status(500).json({ message: 'Failed to fetch chats.' });
    }
});


router.get('/search', async (req: Request, res: Response) => {
    const { q, uniqueId } = req.query;
    const db = getDb();
    try {
        if (uniqueId) {
            const user = await db.get(`SELECT id, name, uniqueId, avatar_url as avatarUrl, role FROM users WHERE uniqueId = ?`, uniqueId);
            return res.json(user ? [user] : []);
        }
        if (q) {
            const query = `%${q}%`;
            const users = await db.all(
                `SELECT id, name, uniqueId, avatar_url as avatarUrl, role
                 FROM users
                 WHERE (name LIKE ? OR uniqueId LIKE ?) AND id != ?
                 LIMIT 10`,
                [query, query, req.user!.id]
            );
            return res.json(users);
        }
        res.json([]);
    } catch (error) {
        res.status(500).json({ message: 'Search failed.' });
    }
});

router.get('/profile/:uniqueId', async (req: Request, res: Response) => {
    const { uniqueId } = req.params;
    const db = getDb();
    try {
        const user = await db.get(`SELECT ${privacySensitiveFields} FROM users u WHERE uniqueId = ?`, uniqueId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const filteredUser = filterUserForPrivacy(user, req.user!.id);
        res.json(filteredUser);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch profile' });
    }
});

router.get('/online', async (req: Request, res: Response) => {
    const db = getDb();
    try {
        const users = await db.all(`SELECT id, name, avatar_url as avatarUrl, uniqueId, profile_color, message_color FROM users WHERE last_seen IS NULL`);
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Failed to get online users.' });
    }
});

router.put('/me', async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { name, uniqueId, dob, phoneNumber, telegramId, description, profile_color, message_color, profile_emoji, emojiDensity, emojiRotation } = req.body;
    const db = getDb();
    try {
        if (uniqueId) {
            const existing = await db.get('SELECT id FROM users WHERE uniqueId = ? AND id != ?', [uniqueId, userId]);
            if (existing) {
                return res.status(409).json({ message: 'This Unique ID is already taken.' });
            }
        }
        await db.run(
            `UPDATE users SET name = ?, uniqueId = ?, dob = ?, phone_number = ?, telegram_id = ?, description = ?,
             profile_color = ?, message_color = ?, profile_emoji = ?, profile_emoji_density = ?, profile_emoji_rotation = ?, profile_setup = 1
             WHERE id = ?`,
            [name, uniqueId, dob, phoneNumber, telegramId, description, profile_color, message_color, profile_emoji, emojiDensity, emojiRotation, userId]
        );
        const updatedUser = await db.get(`SELECT ${allUserFieldsForCurrentUser}, is_2fa_enabled FROM users WHERE id = ?`, userId);
        
        const io = req.app.get('io') as SocketIOServer;
        io.to('global').emit('userProfileUpdated', {
            id: userId,
            name: updatedUser.name,
            avatarUrl: updatedUser.avatarUrl,
            uniqueId: updatedUser.uniqueId,
            profile_color: updatedUser.profile_color,
            message_color: updatedUser.message_color,
        });
        
        res.json(updatedUser);
    } catch (error) {
        console.error("Failed to update user:", error);
        res.status(500).json({ message: 'Failed to update profile.' });
    }
});

router.put('/me/privacy', async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const settings = req.body;
    const db = getDb();

    const allowedFields = [
        'privacy_show_phone', 'privacy_show_telegram', 'privacy_show_dob',
        'privacy_show_description', 'privacy_show_last_seen', 'privacy_show_typing'
    ];

    const updates = Object.keys(settings)
        .filter(key => allowedFields.includes(key))
        .map(key => ({ key, value: settings[key] ? 1 : 0 }));

    if (updates.length === 0) {
        return res.status(400).json({ message: 'No valid privacy settings provided.' });
    }

    try {
        const setClause = updates.map(u => `${u.key} = ?`).join(', ');
        const params = updates.map(u => u.value);
        params.push(userId);
        
        await db.run(`UPDATE users SET ${setClause} WHERE id = ?`, params);

        const updatedUser = await db.get(`SELECT ${allUserFieldsForCurrentUser}, is_2fa_enabled FROM users WHERE id = ?`, userId);
        res.json(updatedUser);
    } catch (error) {
        console.error('Failed to update privacy settings:', error);
        res.status(500).json({ message: 'Failed to update privacy settings.' });
    }
});

router.post('/me/avatar', upload, async (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    const userId = req.user!.id;
    const tempPath = req.file.path;
    const finalFilename = `${userId}--avatar-${Date.now()}${path.extname(req.file.originalname)}`;
    let finalPath = path.join(__dirname, '..', 'uploads', finalFilename);

    const db = getDb();
    try {
        if (req.body.crop) {
            const cropData = JSON.parse(req.body.crop);
            await cropImage(tempPath, finalPath, cropData);
        } else {
             await moveFile(tempPath, finalPath);
        }
        
        await db.run('INSERT INTO user_avatars (id, userId, filename, createdAt, mimetype) VALUES (?, ?, ?, ?, ?)',
            [`avatar_${crypto.randomBytes(8).toString('hex')}`, userId, finalFilename, new Date().toISOString(), req.file.mimetype]);
        
        await db.run('UPDATE users SET avatar_url = ? WHERE id = ?', [finalFilename, userId]);
        
        const io = req.app.get('io') as SocketIOServer;
        io.to('global').emit('userProfileUpdated', {
            id: userId,
            avatarUrl: finalFilename,
        });

        res.status(201).json({ id: '', userId, filename: finalFilename, createdAt: '', mimetype: req.file.mimetype });

    } catch (error) {
        res.status(500).json({ message: 'Failed to process avatar.' });
    } finally {
        await fs.unlink(tempPath).catch(() => {});
    }
});

router.get('/me/avatars', async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const db = getDb();
    try {
        const avatars: AvatarData[] = await db.all('SELECT * FROM user_avatars WHERE userId = ? ORDER BY createdAt DESC', userId);
        res.json(avatars.map(a => ({...a, filename: sanitizeMediaUrl(a.filename)})));
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch avatars.' });
    }
});

router.put('/me/avatar/:avatarId', async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { avatarId } = req.params;
    const db = getDb();
    try {
        const avatar = await db.get('SELECT filename FROM user_avatars WHERE id = ? AND userId = ?', [avatarId, userId]);
        if (!avatar) {
            return res.status(404).json({ message: 'Avatar not found or you do not have permission.' });
        }
        await db.run('UPDATE users SET avatar_url = ? WHERE id = ?', [avatar.filename, userId]);
        
        const io = req.app.get('io') as SocketIOServer;
        io.to('global').emit('userProfileUpdated', {
            id: userId,
            avatarUrl: avatar.filename,
        });

        res.json({ message: 'Primary avatar updated.', avatarUrl: avatar.filename });
    } catch (error) {
        res.status(500).json({ message: 'Failed to set primary avatar.' });
    }
});

router.delete('/me/avatar/:avatarId', async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { avatarId } = req.params;
    const db = getDb();
    try {
        const avatar = await db.get('SELECT filename FROM user_avatars WHERE id = ? AND userId = ?', [avatarId, userId]);
        if (!avatar) {
            return res.status(404).json({ message: 'Avatar not found or you do not have permission.' });
        }

        const user = await db.get('SELECT avatar_url FROM users WHERE id = ?', userId);
        if (user.avatar_url === avatar.filename) {
            await db.run('UPDATE users SET avatar_url = NULL WHERE id = ?', userId);
        }
        
        await db.run('DELETE FROM user_avatars WHERE id = ?', avatarId);

        const filePath = path.join(__dirname, '..', 'uploads', sanitizeMediaUrl(avatar.filename));
        await fs.unlink(filePath).catch(err => {
            if(err.code !== 'ENOENT') console.error("Failed to delete avatar file:", err);
        });
        
        const io = req.app.get('io') as SocketIOServer;
        io.to('global').emit('userProfileUpdated', {
            id: userId,
            avatarUrl: null,
        });

        res.json({ message: 'Avatar deleted.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete avatar.' });
    }
});

router.put('/me/password', async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;
    const db = getDb();

    try {
        const user = await db.get('SELECT password_hash FROM users WHERE id = ?', userId);
        if (!user || !user.password_hash) {
            return res.status(400).json({ message: 'Cannot change password for accounts without one.' });
        }
        
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }
        
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);
        
        await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, userId]);

        res.json({ message: 'Password changed successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to change password.' });
    }
});

router.delete('/me', async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const db = getDb();
    
    try {
        await db.run('BEGIN TRANSACTION');
        
        const result = await db.run('DELETE FROM users WHERE id = ?', userId);
        
        if (result.changes === 0) {
            await db.run('ROLLBACK');
            return res.status(404).json({ message: 'User not found.' });
        }
        
        await db.run('COMMIT');
        
        res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
        res.json({ message: 'Account deleted successfully.' });

    } catch (error) {
        await db.run('ROLLBACK').catch(console.error);
        res.status(500).json({ message: 'Failed to delete account.' });
    }
});

router.put('/me/chats/:chatId/state', async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { chatId } = req.params;
    const { is_muted } = req.body;

    if (typeof is_muted !== 'boolean') {
        return res.status(400).json({ message: 'is_muted must be a boolean.' });
    }

    const db = getDb();
    const io = req.app.get('io') as SocketIOServer;

    try {
        await db.run(
            `INSERT INTO user_chat_states (userId, chatId, is_muted) VALUES (?, ?, ?)
             ON CONFLICT(userId, chatId) DO UPDATE SET is_muted = excluded.is_muted`,
            [userId, chatId, is_muted ? 1 : 0]
        );
        
        io.to(userId).emit('chatStateUpdated', { chatId, is_muted });

        res.json({ message: 'Chat state updated successfully.' });
    } catch (error) {
        console.error("Failed to update chat state:", error);
        res.status(500).json({ message: 'Failed to update chat state.' });
    }
});

export default router;