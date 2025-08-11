import express from 'express';
import { getDb } from '../db';
import { protect } from '../auth';
import { config } from '../config';
import '../types';

const router = express.Router();

// This endpoint allows the client to get the public key to subscribe
// The `protect` middleware was removed because the VAPID public key is not secret information.
// Removing the auth check makes the subscription process more resilient against race conditions on startup.
router.get('/vapid-public-key', (req: express.Request, res: express.Response) => {
    res.json({ publicKey: config.VAPID_PUBLIC_KEY });
});

// This endpoint saves a new push subscription for the logged-in user
router.post('/subscribe', protect, async (req: express.Request, res: express.Response) => {
    const subscription = req.body;
    const userId = req.user!.id;

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
        return res.status(400).json({ message: 'Invalid subscription object provided.' });
    }

    try {
        const db = getDb();
        await db.run(
            'INSERT OR REPLACE INTO push_subscriptions (endpoint, userId, p256dh, auth) VALUES (?, ?, ?, ?)',
            [subscription.endpoint, userId, subscription.keys.p256dh, subscription.keys.auth]
        );
        res.status(201).json({ message: 'Subscribed successfully.' });
    } catch (error) {
        console.error('Failed to save push subscription:', error);
        res.status(500).json({ message: 'Failed to subscribe client.' });
    }
});

export { router as default };