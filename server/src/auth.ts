
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from './db';
import { config } from './config';
import type { User } from './types';
import './types'; // Ensures declaration merging for req.user is picked up

export const protect = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as { id: string };
        const db = getDb();
        const user: User | undefined = await db.get('SELECT id, role, is_banned as isBanned, ban_expires_at as banExpiresAt, ban_reason as banReason FROM users WHERE id = ?', decoded.id);
        
        if (!user) {
            res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }
        
        let isStillBanned = !!user.isBanned;
        if (isStillBanned && user.banExpiresAt) {
            const expiryDate = new Date(user.banExpiresAt);
            // Check if ban is temporary (not year 9999) and has expired.
             if (expiryDate < new Date() && expiryDate.getFullYear() < 9000) {
                // Ban has expired, unban the user in the database
                await db.run('UPDATE users SET is_banned = 0, ban_reason = NULL, ban_expires_at = NULL WHERE id = ?', user.id);
                isStillBanned = false;
            }
        }
        
        if (isStillBanned) {
            return res.status(403).json({ 
                message: 'You are banned from this service.',
                is_banned: true,
                ban_reason: user.banReason,
                ban_expires_at: user.banExpiresAt
            });
        }

        req.user = { id: decoded.id, role: user.role };
        next();
    } catch (err) {
        res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

export const isModeratorOrAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'moderator')) {
        next();
    } else {
        res.status(403).json({ message: 'Require Admin or Moderator Role!' });
    }
};
