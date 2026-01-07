import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';

let db = null;

export const getDb = async () => {
    if (db) return db;

    // Open database connection
    db = await open({
        filename: './sdb_users.db',
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

    if (!rootUser) {
        console.log('⚡ Creating initial ROOT user...');
        const hashedPassword = await bcrypt.hash('password', 10);
        await db.run(
            'INSERT INTO users (username, password, role, owner_name) VALUES (?, ?, ?, ?)',
            ['root', hashedPassword, 'root', 'Root']
        );
    }

    return db;
};
