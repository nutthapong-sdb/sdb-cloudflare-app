import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

let db = null;

export const getGdccDb = async () => {
    if (db) return db;

    try {
        const dbDir = path.resolve(process.cwd(), 'db');
        if (!fs.existsSync(dbDir)) {
            console.log(`📂 Creating database directory at: ${dbDir}`);
            fs.mkdirSync(dbDir, { recursive: true });
        }

        const dbPath = path.join(dbDir, 'gdcc_history.db');
        console.log(`📂 Connecting to GDCC History database at: ${dbPath}`);

        // Open database connection
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // Create table for storing daily summary data per domain
        await db.exec(`
        CREATE TABLE IF NOT EXISTS gdcc_daily_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          zone_id TEXT NOT NULL,
          domain TEXT NOT NULL,
          report_date DATE NOT NULL,
          data_json TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(zone_id, domain, report_date)
        )
      `);

        return db;
    } catch (error) {
        console.error('❌ Database Error (GDCC):', error);
        throw error;
    }
};

// Insert or Update daily stats
export const saveDailyStats = async (zone_id, domain, report_date, data_json) => {
    const database = await getGdccDb();
    const query = `
        INSERT INTO gdcc_daily_stats (zone_id, domain, report_date, data_json, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(zone_id, domain, report_date) DO UPDATE SET
        data_json = excluded.data_json,
        updated_at = CURRENT_TIMESTAMP
    `;
    await database.run(query, [zone_id, domain, report_date, typeof data_json === 'string' ? data_json : JSON.stringify(data_json)]);
};

// Fetch stats for a specific date range
export const getStatsInRange = async (zone_id, domain, start_date, end_date) => {
    const database = await getGdccDb();
    const query = `
        SELECT report_date, data_json, updated_at FROM gdcc_daily_stats
        WHERE zone_id = ? AND domain = ? AND report_date >= ? AND report_date <= ?
        ORDER BY report_date ASC
    `;
    const rows = await database.all(query, [zone_id, domain, start_date, end_date]);
    return rows.map(row => ({
        report_date: row.report_date,
        data: JSON.parse(row.data_json),
        updated_at: row.updated_at
    }));
};

// Helper: Get latest synced date
export const getLatestSyncDate = async (zone_id, domain) => {
    const database = await getGdccDb();
    const query = `
        SELECT MAX(report_date) as last_date FROM gdcc_daily_stats
        WHERE zone_id = ? AND domain = ?
    `;
    const row = await database.get(query, [zone_id, domain]);
    return row?.last_date || null;
};

// Helper: Check if a specific date already exists in DB
export const checkDateExists = async (zone_id, domain, report_date) => {
    const database = await getGdccDb();
    const row = await database.get(
        `SELECT 1 FROM gdcc_daily_stats WHERE zone_id = ? AND domain = ? AND report_date = ? LIMIT 1`,
        [zone_id, domain, report_date]
    );
    return !!row;
};

// Helper: Get latest synced dates for all zones and domains
export const getAllSyncStatus = async () => {
    const database = await getGdccDb();
    const query = `
        SELECT 
            zone_id,
            domain,
            MAX(report_date) as last_date,
            MIN(report_date) as first_date,
            json_extract(data_json, '$.zoneName') as zone_name,
            json_extract(data_json, '$.accountName') as account_name
        FROM gdcc_daily_stats
        GROUP BY zone_id, domain
    `;
    const rows = await database.all(query);
    return rows;
};

// Helper: Delete all history for a specific zone and domain
export const deleteSyncData = async (zone_id, domain) => {
    const database = await getGdccDb();
    if (domain === 'ALL_DOMAINS') {
        const query = `DELETE FROM gdcc_daily_stats WHERE zone_id = ?`;
        await database.run(query, [zone_id]);
    } else {
        const query = `DELETE FROM gdcc_daily_stats WHERE zone_id = ? AND domain = ?`;
        await database.run(query, [zone_id, domain]);
    }
};
