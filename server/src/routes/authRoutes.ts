import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb } from '../db';
import { protect } from '../auth';
import { config } from '../config';
import { OAuth2Client } from 'google-auth-library';
import TelegramBot from 'node-telegram-bot-api';
import { User, Message } from '../types';
import { Server as SocketIOServer } from 'socket.io';
import '../types'; // Import for declaration merging
import { getIo } from '../websocketStore';
import { CHAT_CONTACT_USER_FIELDS } from '../sharedConstants';
import { push } from '../push'; // Import push for notifications

const router = express.Router();
let googleClient: OAuth2Client | null = null;
export let bot: TelegramBot | null = null;

const TELEGRAM_BOT_TOKEN = config.TELEGRAM_BOT_TOKEN;
const TELEGRAM_GATEWAY_TOKEN = config.TELEGRAM_GATEWAY_TOKEN;
const GOOGLE_CLIENT_ID = config.GOOGLE_CLIENT_ID;

// In-memory store for phone verification codes.
const phoneCodeStore: Record<string, { code: string; expires: number; verified?: boolean }> = {};
// In-memory store for two-factor authentication codes.
const twoFactorCodeStore: Record<string, { code: string; expires: number }> = {};


// In-memory store for users who are currently replying via Telegram
const replyContextCache = new Map<number, { chatId: string }>();

const initializeBotListeners = () => {
    if (!bot) return;

    // Handler for the /start command to send a magic login link
    bot.onText(/\/start/, async (msg) => {
        const telegramId = msg.chat.id.toString();
        const db = getDb();
        const user = await db.get('SELECT * FROM users WHERE telegram_id = ?', telegramId);
        if (user && msg.from) {
            const token = crypto.randomBytes(20).toString('hex');
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min expiry
            await db.run('INSERT INTO magic_links (token, userId, expiresAt) VALUES (?, ?, ?)', [token, user.id, expiresAt]);
            
            // This URL needs to match the frontend route
            const loginUrl = `${config.USE_HTTPS ? 'https' : 'http'}://localhost:5174/auth/magic/${token}`;
            
            await bot.sendMessage(telegramId, `Welcome back, ${user.name}!\nClick the link to log in to the web messenger:\n${loginUrl}`);
        } else {
            await bot.sendMessage(telegramId, "Your Telegram account is not linked. Please log in via the web app first and link your account in your profile settings.");
        }
    });

    // Handler for the "Reply" button callback
    bot.on('callback_query', async (callbackQuery) => {
        if (!bot) return;
        const msg = callbackQuery.message;
        const data = callbackQuery.data;

        if (msg && data && data.startsWith('reply_')) {
            const chatId = data.split('_')[1];
            const telegramId = msg.chat.id;

            replyContextCache.set(telegramId, { chatId });
            await bot.sendMessage(telegramId, `Replying to chat. Send your message now. (To cancel, send /cancel)`);
            await bot.answerCallbackQuery(callbackQuery.id);
        }
    });

    // Handler for text messages, checks for reply context
    bot.on('message', async (msg) => {
        // Ignore commands
        if (msg.text?.startsWith('/')) return;

        const telegramId = msg.chat.id;
        const replyContext = replyContextCache.get(telegramId);
        
        if (replyContext) {
            const { chatId } = replyContext;
            const db = getDb();
            const sender = await db.get<User>('SELECT * FROM users WHERE telegram_id = ?', telegramId.toString());

            if (sender && msg.text) {
                const io = getIo();
                
                // Construct and save the message as if it came from the web app
                const newMessage: Message = {
                    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    chatId,
                    senderId: sender.id,
                    content: msg.text,
                    timestamp: new Date().toISOString(),
                    type: 'text',
                    isEdited: false,
                    isDeleted: false,
                    reactions: {},
                };

                await db.run(
                    'INSERT INTO messages (id, chatId, senderId, content, timestamp, type) VALUES (?, ?, ?, ?, ?, ?)',
                    [newMessage.id, newMessage.chatId, newMessage.senderId, newMessage.content, newMessage.timestamp, 'text']
                );
                
                // Emit to the chat room via WebSocket
                const senderInfo = await db.get<User>(`SELECT ${CHAT_CONTACT_USER_FIELDS} FROM users WHERE id = ?`, sender.id);
                const payload = { ...newMessage, sender: senderInfo };
                io.to(chatId).emit('newMessage', payload);
                
                // Also notify the other user in the private chat for sidebar updates
                const partnerId = chatId.split('-').find(id => id !== sender.id);
                if (partnerId) {
                    io.to(partnerId).emit('newMessage', payload);
                }

                await bot.sendMessage(telegramId, `✅ Message sent!`);
            }
            
            replyContextCache.delete(telegramId);
        }
    });
    
    // Handler for cancelling a reply
    bot.onText(/\/cancel/, (msg) => {
        const telegramId = msg.chat.id;
        if (replyContextCache.has(telegramId)) {
            replyContextCache.delete(telegramId);
            bot?.sendMessage(telegramId, 'Reply cancelled.');
        }
    });
};

export const initializeAuthServices = (socketIo: SocketIOServer) => {
    // Initialize Google Client
    if (GOOGLE_CLIENT_ID) {
        googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
        console.log("✅ Google Auth Client initialized.");
    } else {
        console.warn("⚠️  WARNING: GOOGLE_CLIENT_ID not found in config.ts. Google Login will be disabled.");
    }
    
    // Initialize Telegram Bot
    try {
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN.length > 20) {
            if (bot) {
                console.log("Stopping existing Telegram Bot polling to re-initialize...");
                bot.stopPolling({ cancel: true }); 
            }
            bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
            
            bot.removeAllListeners();

            console.log("✅ Telegram Bot initialized successfully with polling.");
            initializeBotListeners();
        } else {
            console.warn("⚠️  WARNING: TELEGRAM_BOT_TOKEN not found or is invalid in config.ts. Telegram features will be disabled.");
        }
    } catch (error: any) {
        console.error("🔴 FAILED to initialize Telegram Bot.", error.message);
        bot = null;
    }
}


const userFieldsToSelect = 'id, username, name, uniqueId, gender, dob, createdAt, telegram_id, phone_number, is_anonymous, avatar_url, profile_setup, role, is_banned, ban_reason, ban_expires_at, google_id, mute_expires_at, mute_reason, last_seen, profile_color, message_color, description, profile_emoji, profile_emoji_density, profile_emoji_rotation, privacy_show_phone, privacy_show_telegram, privacy_show_dob, privacy_show_description, privacy_show_last_seen, privacy_show_typing, is_2fa_enabled';

const transformUser = (dbUser: any): User => {
    if (!dbUser) return dbUser;
    return {
        ...dbUser,
        telegramId: dbUser.telegram_id,
        phoneNumber: dbUser.phone_number,
        isAnonymous: !!dbUser.is_anonymous,
        avatarUrl: dbUser.avatar_url,
        profileSetup: !!dbUser.profile_setup,
        isBanned: !!dbUser.is_banned,
        banReason: dbUser.ban_reason,
        banExpiresAt: dbUser.ban_expires_at,
        googleId: dbUser.google_id,
        muteExpiresAt: dbUser.mute_expires_at,
        muteReason: dbUser.mute_reason,
        lastSeen: dbUser.last_seen,
        is_2fa_enabled: !!dbUser.is_2fa_enabled
    };
};

const generateToken = (res: Response, userId: string) => {
    const secret = config.JWT_SECRET;
    if (!secret) {
        console.error("FATAL: JWT_SECRET is not defined in config.ts file!");
        throw new Error("Server configuration error.");
    }
    const token = jwt.sign({ id: userId }, secret, { expiresIn: '30d' });

    const isSecure = process.env.NODE_ENV === 'production' || config.USE_HTTPS;

    res.cookie('token', token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? 'none' : 'lax', // FIX: Use 'none' for HTTPS to support cross-site requests.
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: '/', // CRITICAL FIX: Ensure cookie is valid for all API routes
    });
};

const handle2FAChallenge = async (res: Response, user: User) => {
    if (!user.telegram_id || !bot) {
        return res.status(400).json({ message: '2FA is enabled but Telegram is not linked or bot is not configured.' });
    }
    const code = crypto.randomInt(100000, 999999).toString();
    twoFactorCodeStore[user.id] = { code, expires: Date.now() + 5 * 60 * 1000 }; // 5 minute expiry
    try {
        await bot.sendMessage(user.telegram_id, `Your login confirmation code is: ${code}`);
        return res.status(202).json({ twoFactorRequired: true, userId: user.id });
    } catch (e: any) {
        console.error("Failed to send 2FA code via Telegram:", e.message);
        return res.status(500).json({ message: "Failed to send 2FA code." });
    }
}

// --- REST API Routes ---
router.get('/me', protect, async (req: Request, res: Response) => {
    const db = getDb();
    try {
        const user = await db.get(`SELECT ${userFieldsToSelect} FROM users WHERE id = ?`, req.user!.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(transformUser(user));
    } catch (error) {
        console.error("Error fetching current user:", error);
        res.status(500).json({ message: 'Server error while fetching user data.' });
    }
});

router.post('/register', async (req: Request, res: Response) => {
    const { username, password, name } = req.body;
    if (!username || !password || !name) {
        return res.status(400).json({ message: 'Please provide username, password, and name.' });
    }

    const db = getDb();
    try {
        const existingUser = await db.get("SELECT id FROM users WHERE username = ? AND is_anonymous = 0", username);
        if (existingUser) {
            return res.status(409).json({ message: "This name is taken by a registered user." });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const newUser = {
            id: `user_${crypto.randomBytes(8).toString('hex')}`,
            username,
            password_hash: passwordHash,
            name,
            uniqueId: username,
            createdAt: new Date().toISOString(),
        };

        await db.run(
            'INSERT INTO users (id, username, password_hash, name, uniqueId, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
            [newUser.id, newUser.username, newUser.password_hash, newUser.name, newUser.uniqueId, newUser.createdAt]
        );

        generateToken(res, newUser.id);
        const userForClient = await db.get(`SELECT ${userFieldsToSelect} FROM users WHERE id = ?`, newUser.id);
        res.status(201).json(transformUser(userForClient));
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

router.post('/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const db = getDb();
    const user = await db.get('SELECT * FROM users WHERE username = ? AND is_anonymous = 0', username);

    if (user && await bcrypt.compare(password, user.password_hash)) {
        if (user.is_2fa_enabled) {
            return handle2FAChallenge(res, transformUser(user));
        }
        generateToken(res, user.id);
        const userForClient = await db.get(`SELECT ${userFieldsToSelect} FROM users WHERE id = ?`, user.id);
        res.json(transformUser(userForClient));
    } else {
        res.status(401).json({ message: 'Invalid username or password' });
    }
});

router.post('/anonymous-login', async (req: Request, res: Response) => {
    const { username: displayName } = req.body; // Rename for clarity
    if (!displayName) {
        return res.status(400).json({ message: 'Guest username is required.' });
    }

    const db = getDb();
    try {
        // FIX: Generate a unique internal username for guests to prevent DB constraint errors.
        const internalUsername = `guest_${crypto.randomBytes(6).toString('hex')}`;
        const uniqueId = `guest_${crypto.randomBytes(4).toString('hex')}`;
        
        const newGuestUser = {
            id: `user_${crypto.randomBytes(8).toString('hex')}`,
            username: internalUsername, // Use unique internal name for the username column
            name: displayName,         // Use user-provided name for display
            uniqueId: uniqueId,
            createdAt: new Date().toISOString(),
            is_anonymous: 1,
        };
        
        await db.run('INSERT INTO users (id, username, name, uniqueId, createdAt, is_anonymous) VALUES (?, ?, ?, ?, ?, ?)', 
            [newGuestUser.id, newGuestUser.username, newGuestUser.name, newGuestUser.uniqueId, newGuestUser.createdAt, newGuestUser.is_anonymous]);
        
        generateToken(res, newGuestUser.id);
        const userForClient = await db.get(`SELECT ${userFieldsToSelect} FROM users WHERE id = ?`, newGuestUser.id);
        res.status(201).json(transformUser(userForClient));
    } catch (error) {
        console.error("Guest login error:", error);
        res.status(500).json({ message: 'Server error during guest login.' });
    }
});

router.post('/google', async (req: Request, res: Response) => {
    if (!googleClient) return res.status(503).json({ message: 'Google Sign-In is not configured on the server.' });
    
    const { credential } = req.body;
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.sub || !payload.email || !payload.name) {
            return res.status(400).json({ message: 'Invalid Google token.' });
        }

        const db = getDb();
        let user = await db.get('SELECT * FROM users WHERE google_id = ?', payload.sub);
        
        if (!user) {
            user = await db.get('SELECT * FROM users WHERE username = ? AND is_anonymous = 0', payload.email);
            if (user) {
                await db.run('UPDATE users SET google_id = ? WHERE id = ?', [payload.sub, user.id]);
            } else {
                const newUser = {
                    id: `user_${crypto.randomBytes(8).toString('hex')}`,
                    username: payload.email,
                    name: payload.name,
                    uniqueId: payload.email,
                    createdAt: new Date().toISOString(),
                    google_id: payload.sub,
                    avatar_url: payload.picture,
                };
                await db.run(
                    'INSERT INTO users (id, username, name, uniqueId, createdAt, google_id, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [newUser.id, newUser.username, newUser.name, newUser.uniqueId, newUser.createdAt, newUser.google_id, newUser.avatar_url]
                );
                user = await db.get('SELECT * FROM users WHERE id = ?', newUser.id);
            }
        }
        
        if (user.is_2fa_enabled) {
            return handle2FAChallenge(res, transformUser(user));
        }

        generateToken(res, user.id);
        const userForClient = await db.get(`SELECT ${userFieldsToSelect} FROM users WHERE id = ?`, user.id);
        res.json(transformUser(userForClient));

    } catch (error) {
        console.error("Google auth error:", error);
        res.status(500).json({ message: 'Server error during Google Sign-In.' });
    }
});

router.post('/telegram-login', async (req: Request, res: Response) => {
    const authData = req.body;
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = authData;

    if (!TELEGRAM_BOT_TOKEN) return res.status(503).json({ message: 'Telegram login is not configured.' });
    if (!id || !hash) return res.status(400).json({ message: 'Invalid Telegram data.' });
    
    // Validate hash
    const dataCheckString = Object.keys(authData)
      .filter(key => key !== 'hash')
      .map(key => `${key}=${authData[key]}`)
      .sort()
      .join('\n');
    
    const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (hmac !== hash) {
        return res.status(401).json({ message: 'Telegram data is not authentic.' });
    }
    
    const db = getDb();
    try {
        let user = await db.get('SELECT * FROM users WHERE telegram_id = ?', id.toString());
        if (!user) {
            const newUser = {
                id: `user_${crypto.randomBytes(8).toString('hex')}`,
                username: `tg_${username || id}`,
                name: `${first_name}${last_name ? ' ' + last_name : ''}`,
                uniqueId: `tg_${username || id}`,
                createdAt: new Date().toISOString(),
                telegram_id: id.toString(),
                avatar_url: photo_url,
            };
            await db.run(
                'INSERT INTO users (id, username, name, uniqueId, createdAt, telegram_id, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [newUser.id, newUser.username, newUser.name, newUser.uniqueId, newUser.createdAt, newUser.telegram_id, newUser.avatar_url]
            );
            user = await db.get('SELECT * FROM users WHERE id = ?', newUser.id);
        }

        if (user.is_2fa_enabled) {
            return handle2FAChallenge(res, transformUser(user));
        }

        generateToken(res, user.id);
        const userForClient = await db.get(`SELECT ${userFieldsToSelect} FROM users WHERE id = ?`, user.id);
        res.json(transformUser(userForClient));
    } catch (error) {
        res.status(500).json({ message: 'Server error during Telegram login.' });
    }
});

router.post('/magic-link-login', async (req: Request, res: Response) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token is required.' });

    const db = getDb();
    try {
        const link = await db.get('SELECT * FROM magic_links WHERE token = ?', token);
        if (!link || new Date(link.expiresAt) < new Date()) {
            return res.status(401).json({ message: 'Invalid or expired login link.' });
        }
        
        await db.run('DELETE FROM magic_links WHERE token = ?', token);

        const user = await db.get(`SELECT * FROM users WHERE id = ?`, link.userId);
        if (!user) {
            return res.status(404).json({ message: 'User associated with this link not found.'});
        }

        generateToken(res, user.id);
        const userForClient = await db.get(`SELECT ${userFieldsToSelect} FROM users WHERE id = ?`, user.id);
        res.json(transformUser(userForClient));

    } catch (error) {
        console.error("Magic link login error:", error);
        res.status(500).json({ message: 'Server error during magic link login.' });
    }
});

router.post('/logout', (_req: Request, res: Response) => {
    res.cookie('token', '', {
        httpOnly: true,
        expires: new Date(0),
        secure: process.env.NODE_ENV === 'production' || config.USE_HTTPS,
        sameSite: (process.env.NODE_ENV === 'production' || config.USE_HTTPS) ? 'none' : 'lax',
    });
    res.status(200).json({ message: 'Logged out successfully' });
});

router.post('/phone-request-code', async (req: Request, res: Response) => {
    const { phoneNumber, isRegistering } = req.body;
    if (!bot) return res.status(503).json({ message: "Telegram features are disabled."});
    
    const db = getDb();
    try {
        const user = await db.get("SELECT id FROM users WHERE phone_number = ?", phoneNumber);
        if (isRegistering && user) {
            return res.status(409).json({ message: "This phone number is already registered." });
        }
        if (!isRegistering && !user) {
            return res.status(404).json({ message: "This phone number is not registered." });
        }

        const code = crypto.randomInt(100000, 999999).toString();
        phoneCodeStore[phoneNumber] = { code, expires: Date.now() + 5 * 60 * 1000 };
        
        if (user) {
            const tgUser = await db.get("SELECT telegram_id FROM users WHERE id = ?", user.id);
            if (tgUser && tgUser.telegram_id) {
                await bot.sendMessage(tgUser.telegram_id, `Your verification code is: ${code}`);
                return res.json({ message: "Verification code sent to your linked Telegram account."});
            }
        }
        // Fallback or for registration
        if (TELEGRAM_GATEWAY_TOKEN) {
             await bot.sendMessage(TELEGRAM_GATEWAY_TOKEN, `Code for ${phoneNumber}: ${code}`);
             return res.json({ message: "Verification code sent." });
        }
        
        res.status(500).json({ message: "Could not send verification code."});

    } catch (error) {
        res.status(500).json({ message: 'Failed to send code.' });
    }
});

router.post('/phone-verify-code', async (req: Request, res: Response) => {
    const { phoneNumber, code } = req.body;
    const stored = phoneCodeStore[phoneNumber];
    if (stored && stored.code === code && stored.expires > Date.now()) {
        stored.verified = true;
        res.json({ message: "Code verified successfully." });
    } else {
        res.status(400).json({ message: "Invalid or expired code." });
    }
});

router.post('/phone-register', async (req: Request, res: Response) => {
    const { phoneNumber, username, password } = req.body;
    const stored = phoneCodeStore[phoneNumber];

    if (!stored || !stored.verified) {
        return res.status(403).json({ message: "Phone number not verified." });
    }
    
    const db = getDb();
    const existingUser = await db.get("SELECT id FROM users WHERE username = ? AND is_anonymous = 0", username);
    if (existingUser) {
        return res.status(409).json({ message: "Username is already taken." });
    }
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    const newUser = {
        id: `user_${crypto.randomBytes(8).toString('hex')}`,
        username,
        name: username,
        uniqueId: username,
        password_hash: passwordHash,
        phone_number: phoneNumber,
        createdAt: new Date().toISOString(),
    };
    
    await db.run('INSERT INTO users (id, username, name, uniqueId, password_hash, phone_number, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [newUser.id, newUser.username, newUser.name, newUser.uniqueId, newUser.password_hash, newUser.phone_number, newUser.createdAt]);
    
    delete phoneCodeStore[phoneNumber];
    
    const userForClient = await db.get(`SELECT ${userFieldsToSelect} FROM users WHERE id = ?`, newUser.id);
    res.status(201).json(transformUser(userForClient));
});

router.post('/phone-login', async (req: Request, res: Response) => {
    const { phoneNumber, code } = req.body;
    const db = getDb();
    
    const stored = phoneCodeStore[phoneNumber];
    if (!stored || stored.code !== code || stored.expires < Date.now()) {
        return res.status(401).json({ message: "Invalid or expired code." });
    }
    
    const user = await db.get("SELECT * FROM users WHERE phone_number = ?", phoneNumber);
    if (!user) {
        return res.status(404).json({ message: "User not found." });
    }
    
    delete phoneCodeStore[phoneNumber];

    if (user.is_2fa_enabled) {
        return handle2FAChallenge(res, transformUser(user));
    }
    
    generateToken(res, user.id);
    const userForClient = await db.get(`SELECT ${userFieldsToSelect} FROM users WHERE id = ?`, user.id);
    res.json(transformUser(userForClient));
});


// --- 2FA Routes ---
router.post('/2fa/enable-request', protect, async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const telegramAuthData = req.body;
    
    if (!bot || !TELEGRAM_BOT_TOKEN) return res.status(503).json({ message: 'Telegram features are disabled.' });
    if (!telegramAuthData.id) return res.status(400).json({ message: 'Invalid Telegram data.' });

    const dataCheckString = Object.keys(telegramAuthData).filter(k => k !== 'hash').map(k => `${k}=${telegramAuthData[k]}`).sort().join('\n');
    const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (hmac !== telegramAuthData.hash) {
        return res.status(401).json({ message: 'Telegram data is not authentic.' });
    }
    
    const telegramId = telegramAuthData.id.toString();
    const code = crypto.randomInt(100000, 999999).toString();
    twoFactorCodeStore[userId] = { code, expires: Date.now() + 5 * 60 * 1000 };

    try {
        await bot.sendMessage(telegramId, `Your 2FA verification code is: ${code}`);
        res.json({ message: 'Verification code sent to your Telegram.', telegramId });
    } catch (e: any) {
        res.status(500).json({ message: `Failed to send code: ${e.message}` });
    }
});

router.post('/2fa/enable-verify', protect, async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { code, telegramId } = req.body;
    const stored = twoFactorCodeStore[userId];

    if (stored && stored.code === code && stored.expires > Date.now()) {
        const db = getDb();
        await db.run('UPDATE users SET is_2fa_enabled = 1, telegram_id = ? WHERE id = ?', [telegramId, userId]);
        delete twoFactorCodeStore[userId];
        res.json({ message: '2FA enabled successfully!' });
    } else {
        res.status(400).json({ message: 'Invalid or expired code.' });
    }
});

router.post('/2fa/disable', protect, async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const db = getDb();
    await db.run('UPDATE users SET is_2fa_enabled = 0 WHERE id = ?', userId);
    res.json({ message: '2FA disabled successfully.' });
});

router.post('/2fa/login-verify', async (req: Request, res: Response) => {
    const { userId, code } = req.body;
    const stored = twoFactorCodeStore[userId];
    
    if (stored && stored.code === code && stored.expires > Date.now()) {
        delete twoFactorCodeStore[userId];
        const db = getDb();
        const user = await db.get(`SELECT ${userFieldsToSelect} FROM users WHERE id = ?`, userId);
        if (user) {
            generateToken(res, userId);
            res.json(transformUser(user));
        } else {
            res.status(404).json({ message: 'User not found.' });
        }
    } else {
        res.status(401).json({ message: 'Invalid or expired 2FA code.' });
    }
});

export { router as default };