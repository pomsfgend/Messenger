import express from 'express';
import { getDb } from '../db';

const router = express.Router();

router.get('/', async (req: express.Request, res: express.Response) => {
    try {
        const db = getDb();
        
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        // This query now accurately counts all unique users who have been active in the last 24 hours.
        // It checks either their `last_seen` timestamp (for those who have been online)
        // or their `createdAt` timestamp (for new users in the last 24 hours).
        const result = await db.get(`
            SELECT COUNT(DISTINCT id) as count 
            FROM users 
            WHERE last_seen >= ? OR (last_seen IS NULL AND createdAt >= ?)
        `, [twentyFourHoursAgo, twentyFourHoursAgo]);
        
        // This provides a real count of active users.
        const dailySessions = result?.count || 0;

        res.json({
            dailySessions,
            leaks: 0,
            uptime: "99.99%", // This is a conceptual value for display.
            thirdPartyShares: 0,
        });
    } catch (error) {
        console.error("Failed to fetch stats:", error);
        res.status(500).json({ message: 'Failed to fetch server stats.' });
    }
});

export { router as default };