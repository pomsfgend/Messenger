import express, { Request, Response } from 'express';
import crypto from 'crypto';
import Turn from 'node-turn';
import { config } from '../config';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
    const turnServer: Turn = req.app.get('turnServer');
    if (!turnServer) {
        return res.status(503).json({ message: "TURN server is not available." });
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
        urls: `turn:${config.TURN_PUBLIC_IP}:3478`,
        username: username,
        credential: password,
    };
    
    res.json([iceServer]);
});

export { router as default };