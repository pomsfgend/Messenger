
import express, { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNextFunction } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { MulterError } from 'multer';

import { initializeDb } from './db.js';
import { initializeWebSocket } from './websocket.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import mediaRoutes from './mediaRoutes.js'; // New secure media route

dotenv.config();

// --- Environment Variable Validation ---
const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_super_secret_jwt_key_that_is_long_and_random') {
    if (isProduction) {
        console.error("\nFATAL ERROR: JWT_SECRET is not set in a production environment.");
        (process as any).exit(1);
    }
    process.env.JWT_SECRET = 'dev_insecure_secret_key_please_replace';
    console.warn("\nWARNING: JWT_SECRET is not set. Using a temporary, insecure key for development.");
}

if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY === 'your_64_character_hex_string_for_aes_256_encryption_here') {
     if (isProduction) {
        console.error("\nFATAL ERROR: ENCRYPTION_KEY is not set in a production environment.");
        (process as any).exit(1);
    }
    process.env.ENCRYPTION_KEY = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'; // 64 chars
    console.warn("\nWARNING: ENCRYPTION_KEY is not set. Using a temporary, insecure key for development.");
} else if (process.env.ENCRYPTION_KEY.length !== 64 || !/^[0-9a-fA-F]+$/.test(process.env.ENCRYPTION_KEY)) {
    console.error("\nFATAL ERROR: ENCRYPTION_KEY must be a 64-character hexadecimal string.");
    (process as any).exit(1);
}


const app = express();
const port = process.env.PORT || 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// --- Static File & Uploads Directory Setup ---
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
// Note: We are no longer serving /uploads directly for security.

// --- Database Initialization ---
initializeDb().then(() => {
    console.log('Database initialized successfully.');

    const server = http.createServer(app);
    const io = new Server(server, {
        cors: { origin: "http://localhost:5173", methods: ["GET", "POST"], credentials: true }
    });
    initializeWebSocket(io);

    // --- API Routes ---
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/messages', messageRoutes);
    app.use('/api/media', mediaRoutes); // Serve encrypted files securely

    app.get('/api', (req: ExpressRequest, res: ExpressResponse) => res.send('Server is running'));
    
    // --- Error Handling Middleware ---
    app.use((err: Error, req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
        if (err instanceof MulterError) {
            return res.status(400).json({ message: `File upload error: ${err.message}` });
        }
        console.error(err.stack);
        res.status(500).send('Something broke!');
    });

    server.listen(port, () => console.log(`Server running on http://localhost:${port}`));
}).catch(err => {
    console.error('Failed to initialize database:', err);
    (process as any).exit(1);
});
