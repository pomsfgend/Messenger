
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database;

const runMigrations = async (dbInstance: Database) => {
    console.log("Running database migrations...");
    const userColumns = await dbInstance.all("PRAGMA table_info(users)");
    const userColumnNames = userColumns.map(c => c.name);

    if (!userColumnNames.includes('is_2fa_enabled')) {
        console.log("Applying migration: Adding 'is_2fa_enabled' to 'users' table.");
        await dbInstance.exec("ALTER TABLE users ADD COLUMN is_2fa_enabled INTEGER DEFAULT 0 NOT NULL");
    }

    const migrations: Record<string, string> = {
        'name': 'ALTER TABLE users ADD COLUMN name TEXT',
        'avatar_url': 'ALTER TABLE users ADD COLUMN avatar_url TEXT',
        'profile_setup': "ALTER TABLE users ADD COLUMN profile_setup INTEGER DEFAULT 0 NOT NULL",
        'role': "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user' NOT NULL",
        'google_id': 'ALTER TABLE users ADD COLUMN google_id TEXT',
        'is_banned': "ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0 NOT NULL",
        'ban_reason': 'ALTER TABLE users ADD COLUMN ban_reason TEXT',
        'ban_expires_at': 'ALTER TABLE users ADD COLUMN ban_expires_at TEXT',
        'mute_expires_at': 'ALTER TABLE users ADD COLUMN mute_expires_at TEXT',
        'mute_reason': 'ALTER TABLE users ADD COLUMN mute_reason TEXT',
        'last_seen': 'ALTER TABLE users ADD COLUMN last_seen TEXT',
        'phone_number': 'ALTER TABLE users ADD COLUMN phone_number TEXT',
        'profile_color': 'ALTER TABLE users ADD COLUMN profile_color TEXT',
        'message_color': 'ALTER TABLE users ADD COLUMN message_color TEXT',
        'description': 'ALTER TABLE users ADD COLUMN description TEXT',
        'profile_emoji': 'ALTER TABLE users ADD COLUMN profile_emoji TEXT',
        'profile_emoji_density': 'ALTER TABLE users ADD COLUMN profile_emoji_density INTEGER DEFAULT 50',
        'profile_emoji_rotation': 'ALTER TABLE users ADD COLUMN profile_emoji_rotation INTEGER DEFAULT 0',
        'privacy_show_phone': 'ALTER TABLE users ADD COLUMN privacy_show_phone INTEGER DEFAULT 1 NOT NULL',
        'privacy_show_telegram': 'ALTER TABLE users ADD COLUMN privacy_show_telegram INTEGER DEFAULT 1 NOT NULL',
        'privacy_show_dob': 'ALTER TABLE users ADD COLUMN privacy_show_dob INTEGER DEFAULT 1 NOT NULL',
        'privacy_show_description': 'ALTER TABLE users ADD COLUMN privacy_show_description INTEGER DEFAULT 1 NOT NULL',
        'privacy_show_last_seen': 'ALTER TABLE users ADD COLUMN privacy_show_last_seen INTEGER DEFAULT 1 NOT NULL',
        'privacy_show_typing': 'ALTER TABLE users ADD COLUMN privacy_show_typing INTEGER DEFAULT 1 NOT NULL',
    };
    
    for (const [column, migrationSql] of Object.entries(migrations)) {
        if (!userColumnNames.includes(column)) {
            console.log(`Applying migration: Adding '${column}' to 'users' table.`);
            await dbInstance.exec(migrationSql);
        }
    }
    
    const msgColumns = await dbInstance.all("PRAGMA table_info(messages)");
    const msgColumnNames = msgColumns.map(c => c.name);
     if (!msgColumnNames.includes('type')) {
        await dbInstance.exec("ALTER TABLE messages ADD COLUMN type TEXT DEFAULT 'text' NOT NULL");
    }
    if (!msgColumnNames.includes('media_url')) {
        await dbInstance.exec('ALTER TABLE messages ADD COLUMN media_url TEXT');
    }
    if (!msgColumnNames.includes('media_mimetype')) {
        await dbInstance.exec('ALTER TABLE messages ADD COLUMN media_mimetype TEXT');
    }
    if (!msgColumnNames.includes('is_edited')) {
        console.log("Applying migration: Adding 'is_edited' to 'messages' table.");
        await dbInstance.exec("ALTER TABLE messages ADD COLUMN is_edited INTEGER DEFAULT 0 NOT NULL");
    }
    if (!msgColumnNames.includes('is_deleted')) {
        console.log("Applying migration: Adding 'is_deleted' to 'messages' table.");
        await dbInstance.exec("ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0 NOT NULL");
    }
    if (!msgColumnNames.includes('reactions')) {
        console.log("Applying migration: Adding 'reactions' to 'messages' table.");
        await dbInstance.exec("ALTER TABLE messages ADD COLUMN reactions TEXT");
    }
    if (!msgColumnNames.includes('forwarded_info')) {
        console.log("Applying migration: Adding 'forwarded_info' to 'messages' table.");
        await dbInstance.exec("ALTER TABLE messages ADD COLUMN forwarded_info TEXT");
    }
    if (!msgColumnNames.includes('read_by')) {
        console.log("Applying migration: Adding 'read_by' to 'messages' table.");
        await dbInstance.exec("ALTER TABLE messages ADD COLUMN read_by TEXT");
    }

    const avatarColumns = await dbInstance.all("PRAGMA table_info(user_avatars)");
    const avatarColumnNames = avatarColumns.map(c => c.name);
    if (!avatarColumnNames.includes('mimetype')) {
        console.log("Applying migration: Adding 'mimetype' to 'user_avatars' table.");
        await dbInstance.exec("ALTER TABLE user_avatars ADD COLUMN mimetype TEXT");
    }
    
    const chatStateColumns = await dbInstance.all("PRAGMA table_info(user_chat_states)");
    const chatStateColumnNames = chatStateColumns.map(c => c.name);
    if (!chatStateColumnNames.includes('unread_count')) {
        console.log("Applying migration: Adding 'unread_count' to 'user_chat_states' table.");
        await dbInstance.exec("ALTER TABLE user_chat_states ADD COLUMN unread_count INTEGER DEFAULT 0 NOT NULL");
    }

    console.log("Migrations complete.");
};

export const initializeDb = async () => {
    db = await open({
        filename: './database.db',
        driver: sqlite3.Database
    });

    await db.exec(`PRAGMA foreign_keys = ON;`);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            password_hash TEXT,
            name TEXT,
            uniqueId TEXT,
            gender TEXT,
            dob TEXT,
            telegram_id TEXT,
            phone_number TEXT,
            createdAt TEXT NOT NULL,
            is_anonymous INTEGER DEFAULT 0 NOT NULL,
            avatar_url TEXT,
            profile_setup INTEGER DEFAULT 0 NOT NULL,
            role TEXT DEFAULT 'user' NOT NULL,
            google_id TEXT,
            is_banned INTEGER DEFAULT 0 NOT NULL,
            ban_reason TEXT,
            ban_expires_at TEXT,
            mute_expires_at TEXT,
            mute_reason TEXT,
            last_seen TEXT,
            profile_color TEXT,
            message_color TEXT,
            description TEXT,
            profile_emoji TEXT,
            profile_emoji_density INTEGER DEFAULT 50,
            profile_emoji_rotation INTEGER DEFAULT 0,
            privacy_show_phone INTEGER DEFAULT 1 NOT NULL,
            privacy_show_telegram INTEGER DEFAULT 1 NOT NULL,
            privacy_show_dob INTEGER DEFAULT 1 NOT NULL,
            privacy_show_description INTEGER DEFAULT 1 NOT NULL,
            privacy_show_last_seen INTEGER DEFAULT 1 NOT NULL,
            privacy_show_typing INTEGER DEFAULT 1 NOT NULL,
            is_2fa_enabled INTEGER DEFAULT 0 NOT NULL
        );
    `);
    
    // NOTE: Application logic in authRoutes.ts prevents registered users from having duplicate usernames.
    // This allows multiple guest users to have the same name without causing DB-level errors.
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uniqueId ON users(uniqueId);`);
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            chatId TEXT NOT NULL,
            senderId TEXT NOT NULL,
            content TEXT,
            timestamp TEXT NOT NULL,
            type TEXT DEFAULT 'text' NOT NULL,
            media_url TEXT,
            media_mimetype TEXT,
            is_edited INTEGER DEFAULT 0 NOT NULL,
            is_deleted INTEGER DEFAULT 0 NOT NULL,
            reactions TEXT,
            forwarded_info TEXT,
            read_by TEXT,
            FOREIGN KEY(senderId) REFERENCES users(id) ON DELETE CASCADE
        );
    `);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_chatId_timestamp ON messages(chatId, timestamp);`);


    // New table for the avatar gallery feature
    await db.exec(`
        CREATE TABLE IF NOT EXISTS user_avatars (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            filename TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            mimetype TEXT,
            FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        );
    `);

    // New table for magic link login from Telegram
    await db.exec(`
        CREATE TABLE IF NOT EXISTS magic_links (
            token TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            expiresAt TEXT NOT NULL,
            FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        );
    `);
    
    await db.exec(`
      CREATE TABLE IF NOT EXISTS user_chat_states (
        userId TEXT NOT NULL,
        chatId TEXT NOT NULL,
        is_muted INTEGER DEFAULT 0 NOT NULL,
        unread_count INTEGER DEFAULT 0 NOT NULL,
        PRIMARY KEY (userId, chatId),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // New table for Web Push Notification subscriptions
    await db.exec(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            endpoint TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        );
    `);
    
    await runMigrations(db);

    return db;
};

export const getDb = () => {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDb first.');
    }
    return db;
};