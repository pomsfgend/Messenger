
import express, { Response as ExpressResponse } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { getDb } from '../db.js';
import { protect, AuthRequest } from '../auth.js';
import { encryptFile } from '../encryption.js';

const router = express.Router();

// --- Multer setup for temporary storage ---
const upload = multer({
    dest: 'uploads/temp/', // All files go to temp storage first
    limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB limit
}).single('mediaFile');

// GET /api/messages/:chatId
router.get('/:chatId', protect, async (req: AuthRequest, res: ExpressResponse) => {
    const { chatId } = req.params;
    const db = getDb();

    try {
        const messages = await db.all(
            'SELECT * FROM messages WHERE chatId = ? ORDER BY timestamp ASC',
            chatId
        );
        res.json(messages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch messages' });
    }
});

// POST /api/messages/upload (for chat media with encryption)
router.post('/upload', protect, (req: AuthRequest, res: ExpressResponse) => {
    upload(req, res, async (err: any) => {
        if (err) {
            console.error("Upload error:", err);
            return res.status(400).json({ message: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'No file was uploaded.' });
        }
        
        const userId = req.user!.id;
        const tempPath = req.file.path;

        try {
            const userUploadsDir = path.join('uploads', userId);
            await fs.mkdir(userUploadsDir, { recursive: true });

            const encryptedFilename = `media-${Date.now()}${path.extname(req.file.originalname)}.enc`;
            const finalPath = path.join(userUploadsDir, encryptedFilename);

            await encryptFile(tempPath, finalPath);

            // Clean up the temporary file
            await fs.unlink(tempPath);

            res.status(201).json({
                message: 'File uploaded and encrypted successfully',
                mediaUrl: encryptedFilename, // Return only the filename
                type: req.file.mimetype, // Return the full mimetype
                originalName: req.file.originalname
            });

        } catch (error) {
            console.error("Encryption or file handling error:", error);
            await fs.unlink(tempPath).catch(console.error); // Ensure temp file cleanup
            res.status(500).json({ message: 'Failed to process file.' });
        }
    });
});

export default router;
