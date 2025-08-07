import express, { type Request, type Response } from 'express';
import crypto from 'crypto';
import { config } from '../config';
import '../types'; // for req.user

const router = express.Router();

router.get('/turn-credentials', (req: Request, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    if (!config.TURN_SERVER_PASSWORD || !config.TURN_SERVER_URL) {
        console.warn("TURN server is not configured. WebRTC calls may not work reliably.");
        // Return an object without urls, client will handle it.
        return res.json({});
    }

    try {
        // Credentials are valid for 1 hour (3600 seconds)
        const expiry = Math.floor(Date.now() / 1000) + 3600;
        
        // The username for TURN with static-auth-secret is <expiry>:<some_user_identifier>
        const username = `${expiry}:${req.user.id}`;

        // The credential is the base64 of the HMAC-SHA1 of the username, using the static-auth-secret as the key.
        const hmac = crypto.createHmac('sha1', config.TURN_SERVER_PASSWORD);
        hmac.update(username);
        const credential = hmac.digest('base64');

        res.json({
            urls: config.TURN_SERVER_URL,
            username,
            credential,
        });

    } catch (error) {
        console.error("Failed to generate TURN credentials:", error);
        res.status(500).json({ message: "Failed to get TURN server credentials." });
    }
});

export default router;
