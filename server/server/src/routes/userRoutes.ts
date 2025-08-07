
import express, { Response as ExpressResponse } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { getDb } from '../db.js';
import { protect, AuthRequest } from '../auth.js';
import { encryptFile } from '../encryption.js';

const router = express.Router();
const userFieldsToSelect = 'id, name, uniqueId, createdAt, avatar_url';

// --- Multer setup for temporary storage ---
const upload = multer({
    dest: 'uploads/temp/', // Temporary storage
    limits: { fileSize: 5000000 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only .jpeg, .jpg, .png, and .gif files are allowed for avatars.'));
        }
    }
}).single('avatarFile');

// GET /api/users/me/chats
router.get('/me/chats', protect, async (req: AuthRequest, res: ExpressResponse) => {
    const db = getDb();
    const userId = req.user!.id;
    try {
        // Find all unique private chatIds this user is part of
        const privateChats = await db.all(`
            SELECT DISTINCT chatId FROM messages 
            WHERE type != 'text' OR (content IS NOT NULL AND content != '')
            AND ((chatId LIKE ? AND chatId LIKE '%-%') OR (senderId = ? AND chatId != 'global'))
        `, `%${userId}%`, userId);

        const privateChatPartnerIds = privateChats
            .map(p => p.chatId.split('-').find((id: string) => id !== userId))
            .filter(id => id); // Filter out undefined/empty IDs

        if (privateChatPartnerIds.length === 0) {
            return res.json([]);
        }

        // Fetch user details for these partners
        const placeholders = privateChatPartnerIds.map(() => '?').join(',');
        const users = await db.all(
            `SELECT ${userFieldsToSelect} FROM users WHERE id IN (${placeholders})`,
            privateChatPartnerIds
        );
        res.json(users);
    } catch (error) {
        console.error("Failed to fetch user chats:", error);
        res.status(500).json({ message: 'Failed to fetch user chats' });
    }
});

// GET /api/users/search?uniqueId=...
router.get('/search', protect, async (req: AuthRequest, res: ExpressResponse) => {
    const { uniqueId } = req.query;
    if (!uniqueId) {
        return res.status(400).json({ message: 'Unique ID query parameter is required' });
    }
    const db = getDb();
    try {
        const user = await db.get(`SELECT ${userFieldsToSelect} FROM users WHERE uniqueId = ?`, uniqueId);
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to search for user' });
    }
});


// PUT /api/users/me (update profile) with encryption
router.put('/me', protect, (req: AuthRequest, res: ExpressResponse) => {
    upload(req, res, async (err: any) => {
        if (err) {
            return res.status(400).json({ message: err.message });
        }

        const { name, uniqueId, gender, dob } = req.body;
        const userId = req.user!.id;
        
        if (!name || !uniqueId) {
            return res.status(400).json({ message: 'Name and Unique ID are required' });
        }

        const db = getDb();
        try {
            const existingUser = await db.get('SELECT id FROM users WHERE uniqueId = ? AND id != ?', uniqueId, userId);
            if (existingUser) {
                return res.status(400).json({ message: 'Unique ID is already taken.' });
            }

            let avatarUrl = req.body.avatarUrl; // Keep old URL if no new file
            if (req.file) {
                const userUploadsDir = path.join('uploads', userId);
                await fs.mkdir(userUploadsDir, { recursive: true });

                const encryptedFilename = `avatar-${Date.now()}.enc`;
                const finalPath = path.join(userUploadsDir, encryptedFilename);
                
                await encryptFile(req.file.path, finalPath);
                
                await fs.unlink(req.file.path); // Delete temp file
                
                avatarUrl = encryptedFilename; // Store only the filename
            }

            await db.run(
                'UPDATE users SET name = ?, uniqueId = ?, gender = ?, dob = ?, avatar_url = ?, profile_setup = 1 WHERE id = ?',
                [name, uniqueId, gender, dob, avatarUrl, userId]
            );

            const updatedUser = await db.get('SELECT id, username, name, uniqueId, gender, dob, createdAt, telegram_id, is_anonymous, avatar_url, profile_setup FROM users WHERE id = ?', userId);
            res.json(updatedUser);

        } catch (error) {
            console.error(error);
            if (req.file) await fs.unlink(req.file.path).catch(console.error); // Cleanup temp file on error
            res.status(500).json({ message: 'Failed to update profile' });
        }
    });
});

export default router;
