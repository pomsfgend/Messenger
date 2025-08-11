import express from 'express';
import { getDb } from './../src/db';
import { readFileToBuffer, sanitizeMediaUrl } from './../src/fileUtils';
import path from 'path';
import fs from 'fs/promises';
import { __dirname } from './../src/utils';
import mime from 'mime-types';
import './../src/types'; // Ensures declaration merging for req.user is picked up

const router = express.Router();

router.get('/:filename', async (req: express.Request, res: express.Response) => {
    const { filename: rawFilename } = req.params;
    const currentUserId = req.user!.id;
    const db = getDb();
    
    if (!rawFilename || rawFilename.includes('..') || rawFilename.includes('/')) {
        return res.status(400).json({ message: 'Invalid filename.'});
    }

    const filename = sanitizeMediaUrl(rawFilename);

    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const filePath = path.join(uploadsDir, filename);

    try {
        let hasPermission = false;
        
        const fileExists = await fs.stat(filePath).catch(() => null);
        if (!fileExists) {
            return res.status(404).json({ message: 'File not found on disk.' });
        }

        // Avatars are public
        if (filename.includes('--avatar-')) {
            hasPermission = true;
        } 
        // Media files need permission checks
        else if (filename.includes('--media-')) {
            // CRITICAL FIX: Use a LIKE query on the basename of the file.
            // This is robust against cases where the DB might store a full or partial path.
            const mediaRecord = await db.get(`SELECT chatId FROM messages WHERE media_url LIKE ?`, [`%${filename}`]);
            
            if (mediaRecord) {
                if (mediaRecord.chatId === 'global') {
                    hasPermission = true;
                }
                else if (mediaRecord.chatId.split('-').includes(currentUserId)) {
                    hasPermission = true;
                }
            } else {
                 // Fallback for files that might not be in the DB but belong to the user (e.g., during upload preview)
                 const ownerId = filename.split('--')[0];
                 if (ownerId === currentUserId) {
                     hasPermission = true;
                 }
            }
        }
        
        if (!hasPermission) {
            console.warn(`Permission denied for user ${currentUserId} to access ${filename}`);
            return res.status(403).json({ message: 'Access denied.' });
        }
        
        const mimetype = mime.lookup(filename) || 'application/octet-stream';
        const fileBuffer = await readFileToBuffer(filePath);

        res.setHeader('Content-Type', mimetype);
        res.setHeader('Content-Length', fileBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // Cache for 1 week
        res.send(fileBuffer);

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: 'File not found on disk.' });
        }
        console.error(`Failed to serve media file ${filename}:`, error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error serving file.' });
        }
    }
});

export default router;