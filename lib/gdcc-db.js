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
        );

        CREATE TABLE IF NOT EXISTS gdcc_auto_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id TEXT NOT NULL,
          account_name TEXT NOT NULL,
          zone_id TEXT NOT NULL,
          zone_name TEXT NOT NULL,
          subdomain TEXT NOT NULL,
          target_date DATE NOT NULL,
          interval_days INTEGER NOT NULL,
          template_id TEXT DEFAULT 'default',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

        // Migration: Add template_id column if it doesn't exist
        try {
            await db.exec(`ALTER TABLE gdcc_auto_reports ADD COLUMN template_id TEXT DEFAULT 'default'`);
        } catch (e) {
            // Column might already exist, ignore error
        }

        await db.exec(`
        CREATE TABLE IF NOT EXISTS gdcc_auto_report_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_id INTEGER NOT NULL,
          report_date DATE NOT NULL,
          file_name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (config_id) REFERENCES gdcc_auto_reports(id) ON DELETE CASCADE
        );
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

// Helper: Get latest sync date
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

// --- Auto Gen Report Helpers ---

export const saveAutoReportConfig = async (accountId, accountName, zoneId, zoneName, subdomain, targetDate, intervalDays, templateId = 'default') => {
    const database = await getGdccDb();
    const query = `
        INSERT INTO gdcc_auto_reports (account_id, account_name, zone_id, zone_name, subdomain, target_date, interval_days, template_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await database.run(query, [accountId, accountName, zoneId, zoneName, subdomain, targetDate, intervalDays, templateId]);
    return result.lastID;
};

export const getAutoReportConfigs = async () => {
    const database = await getGdccDb();
    const rows = await database.all(`SELECT * FROM gdcc_auto_reports ORDER BY created_at DESC`);

    // Also fetch the generated files for each config
    const files = await database.all(`SELECT * FROM gdcc_auto_report_files ORDER BY created_at DESC`);

    const configsWithFiles = rows.map(config => {
        return {
            ...config,
            files: files.filter(f => f.config_id === config.id)
        };
    });
    return configsWithFiles;
};

export const getAutoReportFiles = async (configId) => {
    const database = await getGdccDb();
    return await database.all(`SELECT file_name FROM gdcc_auto_report_files WHERE config_id = ?`, [configId]);
};

export const deleteAutoReportConfig = async (id) => {
    const database = await getGdccDb();
    await database.run('PRAGMA foreign_keys = ON'); // Ensure cascade delete works
    await database.run(`DELETE FROM gdcc_auto_reports WHERE id = ?`, [id]);
};

export const saveAutoReportFile = async (configId, reportDate, fileName) => {
    const database = await getGdccDb();
    const query = `
        INSERT INTO gdcc_auto_report_files (config_id, report_date, file_name)
        VALUES (?, ?, ?)
    `;
    const result = await database.run(query, [configId, reportDate, fileName]);
    return result.lastID;
};

export const deleteAutoReportFile = async (id) => {
    const database = await getGdccDb();
    await database.run(`DELETE FROM gdcc_auto_report_files WHERE id = ?`, [id]);
};
