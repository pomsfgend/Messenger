
import jwt from 'jsonwebtoken';
import { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNextFunction } from 'express';
import { getDb } from './db.js';

export interface AuthRequest extends ExpressRequest {
    user?: { id: string };
    file?: Express.Multer.File;
}

export const protect = async (req: AuthRequest, res: ExpressResponse, next: ExpressNextFunction) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
        const db = getDb();
        const user = await db.get('SELECT id FROM users WHERE id = ?', decoded.id);
        
        if (!user) {
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }
        
        req.user = { id: user.id };
        next();
    } catch (error) {
        res.status(401).json({ message: 'Not authorized, token failed' });
    }
};
