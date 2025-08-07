
import express, { Response as ExpressResponse } from 'express';
import { getDb } from './db.js';
import { protect, AuthRequest } from './auth.js';
import { decryptFileStream } from './encryption.js';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// This single route handles both avatars and chat media
router.get('/:filename', protect, async (req: AuthRequest, res: ExpressResponse) => {
    const { filename } = req.params;
    const userId = req.user!.id;
    const db = getDb();

    try {
        let ownerId: string | undefined;
        let mimetype: string | undefined;

        // Check if it's an avatar
        const userAsAvatarOwner = await db.get('SELECT id FROM users WHERE id = ? AND avatar_url = ?', userId, filename);
        if (userAsAvatarOwner) {
            ownerId = userId;
            mimetype = 'image/png'; // Assume avatars are images, can be improved
        } else {
            // Check if it's a message media
            const message = await db.get('SELECT senderId, chatId, media_mimetype FROM messages WHERE media_url = ?', filename);
            if (message) {
                // User can access if they are the sender or part of the private chat
                const isSender = message.senderId === userId;
                const isReceiver = message.chatId.includes(userId);
                
                if (isSender || isReceiver || message.chatId === 'global') {
                    ownerId = message.senderId;
                    mimetype = message.media_mimetype;
                }
            }
        }

        if (!ownerId || !mimetype) {
            return res.status(404).json({ message: 'File not found or access denied.' });
        }

        const filePath = path.join('uploads', ownerId, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File not found on disk.' });
        }
        
        res.setHeader('Content-Type', mimetype);
        await decryptFileStream(filePath, res);

    } catch (error) {
        console.error(`Failed to serve media file ${filename}:`, error);
        res.status(500).json({ message: 'Error serving file.' });
    }
});

export default router;
