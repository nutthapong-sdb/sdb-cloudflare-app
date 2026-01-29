import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';
import path from 'path';

import fs from 'fs';

let db = null;

export const getDb = async () => {
    if (db) return db;

    try {
        const dbDir = path.resolve(process.cwd(), 'db');
        if (!fs.existsSync(dbDir)) {
            console.log(`📂 Creating database directory at: ${dbDir}`);
            fs.mkdirSync(dbDir, { recursive: true });
        }

        const dbPath = path.join(dbDir, 'sdb_users.db');
        console.log(`📂 Connecting to database at: ${dbPath}`);

        // Open database connection
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // Create Users table if not exists
        await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'admin',
          owner_name TEXT
        )
      `);

        // Check if root user exists
        const rootUser = await db.get('SELECT * FROM users WHERE username = ?', ['root']);

        // Add cloudflare_api_token column if not exists
        const columns = await db.all("PRAGMA table_info(users)");
        const hasTokenColumn = columns.some(col => col.name === 'cloudflare_api_token');
        if (!hasTokenColumn) {
            console.log('⚡ Adding cloudflare_api_token column to users table...');
            await db.exec('ALTER TABLE users ADD COLUMN cloudflare_api_token TEXT');
        }

        if (!rootUser) {
            console.log('⚡ Creating initial ROOT user...');
            const hashedPassword = await bcrypt.hash('password', 10);
            await db.run(
                'INSERT INTO users (username, password, role, owner_name) VALUES (?, ?, ?, ?)',
                ['root', hashedPassword, 'root', 'Root']
            );
        }

        return db;
    } catch (error) {
        console.error('❌ Database Error:', error);
        throw error;
    }
};
