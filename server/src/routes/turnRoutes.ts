import express from 'express';
import { Request, Response } from 'express';
import crypto from 'crypto';
import Turn from 'node-turn';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
    const turnServer: Turn = req.app.get('turnServer');
    const publicIp: string = req.app.get('publicIp');

    if (!turnServer || !publicIp) {
        return res.status(503).json({ message: "TURN server is not available or IP not configured." });
    }
    
    // Generate temporary credentials for the client
    // These credentials are valid for 24 hours (86400 seconds)
    const username = `user-${Date.now()}`;
    const password = crypto.randomBytes(16).toString('hex');
    
    turnServer.addUser(username, password);

    // Schedule the user to be removed after 24 hours to prevent credential buildup
    setTimeout(() => {
        turnServer.removeUser(username);
    }, 86400 * 1000);
    
    const iceServer: RTCIceServer = {
        urls: `turn:${publicIp}:3478`,
        username: username,
        credential: password,
    };
    
    res.json([
        { urls: 'stun:stun.l.google.com:19302' },
        iceServer
    ]);
});

export { router as default };