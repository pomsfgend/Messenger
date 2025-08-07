
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database;

const runMigrations = async (dbInstance: Database) => {
    const userColumns = await dbInstance.all("PRAGMA table_info(users)");
    const userColumnNames = userColumns.map(c => c.name);
    if (!userColumnNames.includes('avatar_url')) {
        await dbInstance.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
    }
    if (!userColumnNames.includes('profile_setup')) {
        await dbInstance.exec('ALTER TABLE users ADD COLUMN profile_setup INTEGER DEFAULT 0 NOT NULL');
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
        console.log("Migrating database: Adding 'media_mimetype' column to messages table.");
        await dbInstance.exec('ALTER TABLE messages ADD COLUMN media_mimetype TEXT');
    }
};

export const initializeDb = async () => {
    db = await open({
        filename: './database.db',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            name TEXT,
            uniqueId TEXT UNIQUE,
            gender TEXT,
            dob TEXT,
            telegram_id TEXT UNIQUE,
            createdAt TEXT NOT NULL,
            is_anonymous INTEGER DEFAULT 0 NOT NULL,
            avatar_url TEXT,
            profile_setup INTEGER DEFAULT 0 NOT NULL
        );
    `);
    
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
            FOREIGN KEY(senderId) REFERENCES users(id)
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
