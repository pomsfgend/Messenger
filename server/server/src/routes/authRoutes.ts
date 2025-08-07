
import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { protect, AuthRequest } from '../auth.js';

const router = express.Router();

// Helper to select all user fields we want to send to the client
const userFieldsToSelect = 'id, username, name, uniqueId, gender, dob, createdAt, telegram_id, is_anonymous, avatar_url, profile_setup';


const generateToken = (res: ExpressResponse, userId: string) => {
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET!, {
        expiresIn: '30d',
    });

    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development', // Use secure cookies in production
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
};

// POST /api/auth/register
router.post('/register', async (req: ExpressRequest, res: ExpressResponse) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide username and password' });
    }

    const db = getDb();
    try {
        const existingUser = await db.get('SELECT id FROM users WHERE username = ?', username);
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const id = `user_${Date.now()}`;
        
        await db.run(
            'INSERT INTO users (id, username, password_hash, name, uniqueId, createdAt, is_anonymous, profile_setup) VALUES (?, ?, ?, ?, ?, ?, 0, 0)',
            [id, username, password_hash, username, username, new Date().toISOString()]
        );
        
        const newUser = await db.get(`SELECT ${userFieldsToSelect} FROM users WHERE id = ?`, id);
        
        generateToken(res, id);
        res.status(201).json(newUser);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// POST /api/auth/login
router.post('/login', async (req: ExpressRequest, res: ExpressResponse) => {
    const { username, password } = req.body;
    const db = getDb();
    
    try {
        const user = await db.get('SELECT * FROM users WHERE username = ? AND is_anonymous = 0', username);
        if (user && user.password_hash && (await bcrypt.compare(password, user.password_hash))) {
            generateToken(res, user.id);
            const { password_hash, ...userWithoutPassword } = user;
            res.json(userWithoutPassword);
        } else {
            res.status(401).json({ message: 'Invalid username or password' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error during login' });
    }
});


// POST /api/auth/anonymous-login
router.post('/anonymous-login', async (req: ExpressRequest, res: ExpressResponse) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ message: 'Please provide a username' });
    }

    const db = getDb();
    try {
        const existingUser = await db.get('SELECT id FROM users WHERE username = ?', username);
        if (existingUser) {
            return res.status(400).json({ message: 'Username is already taken' });
        }
        
        const id = `user_anon_${Date.now()}`;
        const name = `${username} (Guest)`;
        const uniqueId = username;

        await db.run(
            'INSERT INTO users (id, username, name, uniqueId, createdAt, is_anonymous, profile_setup) VALUES (?, ?, ?, ?, ?, 1, 1)',
            [id, username, name, uniqueId, new Date().toISOString()]
        );
        
        const newUser = await db.get(`SELECT ${userFieldsToSelect} FROM users WHERE id = ?`, id);

        generateToken(res, id);
        res.status(201).json(newUser);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during guest login' });
    }
});

// POST /api/auth/logout
router.post('/logout', (req: ExpressRequest, res: ExpressResponse) => {
    res.cookie('token', '', {
        httpOnly: true,
        expires: new Date(0),
    });
    res.status(200).json({ message: 'Logged out successfully' });
});

// GET /api/auth/me (check session)
router.get('/me', protect, async (req: AuthRequest, res: ExpressResponse) => {
    const db = getDb();
    const user = await db.get(`SELECT ${userFieldsToSelect} FROM users WHERE id = ?`, req.user!.id);
    res.json(user);
});


// POST /api/auth/telegram
router.post('/telegram', async (req: ExpressRequest, res: ExpressResponse) => {
    const userData = req.body;
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

    if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
        return res.status(500).json({ message: "Telegram login is not configured on the server." });
    }
    
    const checkString = Object.keys(userData)
        .filter(key => key !== 'hash')
        .map(key => `${key}=${userData[key]}`)
        .sort()
        .join('\n');

    const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

    if (hmac !== userData.hash) {
        return res.status(400).json({ message: 'Invalid Telegram data' });
    }

    const db = getDb();
    try {
        let user = await db.get('SELECT * FROM users WHERE telegram_id = ?', userData.id);

        if (!user) {
            // New user, register them
            const id = `user_${Date.now()}`;
            const username = userData.username || `tg_${userData.id}`;
            const name = `${userData.first_name}${userData.last_name ? ' ' + userData.last_name : ''}`;
            const uniqueId = username; // Default uniqueId to username

            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(crypto.randomBytes(20).toString('hex'), salt);

            await db.run(
                'INSERT INTO users (id, username, password_hash, name, uniqueId, telegram_id, createdAt, is_anonymous, profile_setup, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)',
                [id, username, password_hash, name, uniqueId, userData.id, new Date().toISOString(), userData.photo_url]
            );
            user = await db.get('SELECT * FROM users WHERE id = ?', id);
        }
        
        generateToken(res, user.id);
        const { password_hash, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during Telegram authentication' });
    }
});

export default router;
