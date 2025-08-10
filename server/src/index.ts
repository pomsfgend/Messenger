import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import './types'; // Import for declaration merging
import http from 'http';
import https from 'https';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import Turn from 'node-turn';
import { MulterError } from 'multer';
import { __dirname } from './utils';
import { config } from './config'; // Import hardcoded config
import { initializeDb, getDb } from './db';
import { initializeWebSocket } from './websocket';
import { initializePush } from './push';
import { protect, isModeratorOrAdmin } from './auth';
import authRoutes, { initializeAuthServices } from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import messageRoutes from './routes/messageRoutes';
import mediaRoutes from './mediaRoutes';
import adminRoutes from './routes/adminRoutes';
import notificationRoutes from './routes/notificationRoutes';
import statsRoutes from './routes/statsRoutes';
import turnRoutes from './routes/turnRoutes';
import { setIo } from './websocketStore';


const app = express();
const port = config.PORT;
const useHttps = config.USE_HTTPS;

const allowedOrigins = [
    'http://localhost:5174',
    'https://localhost:5174',
    'http://bulkhead.hopto.org',
    'https://bulkhead.hopto.org'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files securely through the media route, NOT statically.
// app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
// Serve public assets
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

const getPublicIp = (): Promise<string> => {
    return new Promise((resolve, reject) => {
        https.get('https://api.ipify.org?format=json', (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.ip);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
};


const startServer = async () => {
    try {
        await initializeDb();
        console.log("Database initialized successfully.");
        
        // Cleanup presence state on startup
        console.log("Cleaning up presence state: marking all users as offline...");
        await getDb().run("UPDATE users SET last_seen = ? WHERE last_seen IS NULL", [new Date().toISOString()]);
        
        // Attempt to assign admin role on startup
        console.log("Attempting to assign initial admin roles...");
        const adminIds = config.ADMIN_IDS;
        if (adminIds && adminIds.length > 0) {
            const placeholders = adminIds.map(() => '?').join(',');
            await getDb().run(`UPDATE users SET role = 'admin' WHERE uniqueId IN (${placeholders})`, adminIds);
        }

        let server;
        if (useHttps) {
            const certsDir = path.join(__dirname, '..', '.certs');
            const keyPath = path.join(certsDir, 'acme.key');
            const certPath = path.join(certsDir, 'acme.cer');

            if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
                const options = {
                    key: fs.readFileSync(keyPath),
                    cert: fs.readFileSync(certPath),
                };
                server = https.createServer(options, app);
                console.log(`HTTPS certificates loaded from ${certsDir}. Server will run in secure mode.`);
            } else {
                console.warn(`⚠️ WARNING: HTTPS is enabled (USE_HTTPS=true), but certificate files were not found in ${certsDir}. Server is falling back to HTTP.`);
                server = http.createServer(app);
            }
        } else {
            server = http.createServer(app);
        }

        const publicIp = await getPublicIp().catch(err => {
            console.error("🔴 FAILED to fetch public IP. TURN server may not work correctly over the internet.", err.message);
            return config.TURN_PUBLIC_IP; // Fallback to config
        });
        console.log(`✅ Public IP detected: ${publicIp}. Using for TURN server.`);

        const turnServer = new Turn({
            authMech: 'long-term',
            credentials: {
                [config.TURN_USERNAME]: config.TURN_PASSWORD
            },
            listeningPort: 3478,
            minPort: 50000,
            maxPort: 50100,
            externalIps: publicIp,
        });
        turnServer.start();
        console.log("✅ TURN server started on port 3478.");
        app.set('turnServer', turnServer);
        app.set('publicIp', publicIp); // Store for routes

        const io = new Server(server, {
            cors: {
                origin: allowedOrigins,
                credentials: true
            },
            // FIX: Increase ping timeout and interval to prevent "transport close" errors on slow networks.
            pingTimeout: 60000,
            pingInterval: 25000,
        } as any);
        
        setIo(io); // Store the io instance globally
        app.set('io', io); // For access in routes

        initializePush();
        initializeAuthServices(io);
        initializeWebSocket(io);
        
        app.use('/api/auth', authRoutes);
        app.use('/api/users', protect, userRoutes);
        app.use('/api/messages', protect, messageRoutes);
        app.use('/api/media', protect, mediaRoutes);
        app.use('/api/admin', protect, isModeratorOrAdmin, adminRoutes);
        app.use('/api/notifications', notificationRoutes);
        app.use('/api/stats', statsRoutes); // Public stats endpoint
        app.use('/api/turn-creds', protect, turnRoutes); // TURN credentials endpoint

        // Health check endpoint
        app.get('/api/health', (req: Request, res: Response) => res.status(200).json({ status: 'ok' }));

        // Global error handler
        app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            console.error("Global error handler caught:", err.stack);
            if (err instanceof MulterError) {
                return res.status(400).json({ message: `File upload error: ${err.message}` });
            }
            if (!res.headersSent) {
                res.status(500).json({ message: 'An unexpected server error occurred.' });
            }
        });

        server.listen(port, () => {
            console.log(`🚀 Server is listening on ${useHttps ? 'https' : 'http'}://localhost:${port}`);
        });

    } catch (error) {
        console.error("Failed to start the server:", error);
        (process as any).exit(1);
    }
};

startServer();