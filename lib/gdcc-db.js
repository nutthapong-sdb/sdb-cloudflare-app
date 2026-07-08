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

        // Debug: Check directory writability
        try {
            const testFile = path.join(dbDir, '.write_test');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            console.log(`✅ Verifying directory is writable: ${dbDir}`);
        } catch (e) {
            console.error(`❌ VERIFICATION FAILED: Directory is NOT writable: ${dbDir}`, e.message);
        }

        // Open database connection
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // Set performance and concurrency pragmas
        await db.exec('PRAGMA journal_mode = WAL');
        await db.exec('PRAGMA synchronous = NORMAL');
        console.log(`✅ GDCC Database connected (WAL mode): ${dbPath}`);
        console.log(`👤 Process User: ${process.env.USER || 'unknown'}`);

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

        CREATE TABLE IF NOT EXISTS gdcc_departments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS gdcc_department_domains (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          department_id INTEGER NOT NULL,
          domain TEXT NOT NULL,
          zone_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (department_id) REFERENCES gdcc_departments(id) ON DELETE CASCADE,
          UNIQUE(department_id, domain)
        );

        CREATE TABLE IF NOT EXISTS gdcc_sync_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          zone_id TEXT NOT NULL,
          zone_name TEXT NOT NULL,
          account_name TEXT NOT NULL,
          requested_by TEXT,
          api_token TEXT NOT NULL,
          status TEXT NOT NULL,
          current_phase TEXT,
          current_domain TEXT,
          current_date DATE,
          current_date_started_at DATETIME,
          zone_total_steps INTEGER DEFAULT 0,
          zone_completed_steps INTEGER DEFAULT 0,
          subdomain_total_days INTEGER DEFAULT 0,
          subdomain_completed_days INTEGER DEFAULT 0,
          rate_limit_count INTEGER DEFAULT 0,
          last_rate_limited_date DATE,
          last_rate_limited_domain TEXT,
          last_error TEXT,
          stop_requested INTEGER DEFAULT 0,
          retry_requested INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          started_at DATETIME,
          finished_at DATETIME,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS gdcc_sync_job_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          zone_id TEXT NOT NULL,
          zone_name TEXT NOT NULL,
          account_name TEXT NOT NULL,
          requested_by TEXT,
          rate_limit_count INTEGER DEFAULT 0,
          last_rate_limited_date DATE,
          last_rate_limited_domain TEXT,
          zone_total_steps INTEGER DEFAULT 0,
          zone_completed_steps INTEGER DEFAULT 0,
          completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME,
          started_at DATETIME,
          finished_at DATETIME,
          duration_seconds INTEGER DEFAULT 0
        );
      `);

        await db.exec(`CREATE INDEX IF NOT EXISTS idx_gdcc_sync_jobs_zone_status ON gdcc_sync_jobs(zone_id, status)`);
        await db.exec(`CREATE INDEX IF NOT EXISTS idx_gdcc_sync_job_history_completed_at ON gdcc_sync_job_history(completed_at DESC)`);

        try {
            await db.exec(`ALTER TABLE gdcc_sync_jobs ADD COLUMN api_token TEXT`);
        } catch (_) {}
        try {
            await db.exec(`ALTER TABLE gdcc_sync_jobs ADD COLUMN last_rate_limited_date DATE`);
        } catch (_) {}
        try {
            await db.exec(`ALTER TABLE gdcc_sync_jobs ADD COLUMN last_rate_limited_domain TEXT`);
        } catch (_) {}
        try {
            await db.exec(`ALTER TABLE gdcc_sync_jobs ADD COLUMN finished_at DATETIME`);
        } catch (_) {}
        try {
            await db.exec(`ALTER TABLE gdcc_sync_jobs ADD COLUMN current_date_started_at DATETIME`);
        } catch (_) {}
        try {
            await db.exec(`ALTER TABLE gdcc_sync_jobs ADD COLUMN retry_requested INTEGER DEFAULT 0`);
        } catch (_) {}

        // Migration: Add template_id column if it doesn't exist
        try {
            await db.exec(`ALTER TABLE gdcc_auto_reports ADD COLUMN template_id TEXT DEFAULT 'default'`);
        } catch (e) {
            // Column might already exist, ignore error
        }

        // Migration: Update gdcc_departments to allow duplicate names across different accounts
        try {
            const tableInfo = await db.all(`PRAGMA table_info(gdcc_departments)`);
            const hasAccountId = tableInfo.some(col => col.name === 'account_id');
            
            // We need to check if we need to recreate the table to fix the UNIQUE constraint
            const createSql = await db.get(`SELECT sql FROM sqlite_master WHERE name = 'gdcc_departments'`);
            
            if (createSql && (createSql.sql.includes('zone_id') || (createSql.sql.includes('UNIQUE') && createSql.sql.includes('"name"')))) {
                console.log('🔄 Migrating gdcc_departments to support duplicate names in different accounts...');
                
                await db.exec('BEGIN TRANSACTION');
                
                // 1. Create temporary table with correct schema
                await db.exec(`
                    CREATE TABLE gdcc_departments_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        account_id TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(name, account_id)
                    )
                `);
                
                // 2. Copy data (try to map zone_id to account_id if possible, or just leave null for manual fix)
                // Since we don't have a reliable mapping here without complex queries, we'll just migrate the names
                await db.exec(`
                    INSERT INTO gdcc_departments_new (id, name, created_at)
                    SELECT id, name, created_at FROM gdcc_departments
                `);
                
                // 3. Drop old, rename new
                await db.exec(`DROP TABLE gdcc_departments`);
                await db.exec(`ALTER TABLE gdcc_departments_new RENAME TO gdcc_departments`);
                
                await db.exec('COMMIT');
                console.log('✅ gdcc_departments migration complete.');
            } else if (!hasAccountId) {
                await db.exec(`ALTER TABLE gdcc_departments ADD COLUMN account_id TEXT`);
                await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_dept_name_account ON gdcc_departments(name, account_id)`);
            }
        } catch (e) {
            console.error('❌ Migration Error (gdcc_departments):', e.message);
            try { await db.exec('ROLLBACK'); } catch(re) {}
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

        CREATE TABLE IF NOT EXISTS gdcc_report_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT,
          account_id TEXT NOT NULL,
          account_name TEXT,
          zone_id TEXT NOT NULL,
          zone_name TEXT NOT NULL,
          subdomains TEXT NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          template_id TEXT DEFAULT 'default',
          promoted_hosts TEXT,
          export_separated INTEGER DEFAULT 0,
          export_thai_digits INTEGER DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending',
          progress INTEGER DEFAULT 0,
          status_message TEXT,
          file_name TEXT,
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

export const createSyncJob = async ({ zoneId, zoneName, accountName, requestedBy, apiToken }) => {
    const database = await getGdccDb();
    const result = await database.run(
        `INSERT INTO gdcc_sync_jobs (zone_id, zone_name, account_name, requested_by, api_token, status)
         VALUES (?, ?, ?, ?, ?, 'queued')`,
        [zoneId, zoneName, accountName, requestedBy || null, apiToken]
    );
    return result.lastID;
};

export const getSyncJobById = async (id) => {
    const database = await getGdccDb();
    return await database.get(`SELECT * FROM gdcc_sync_jobs WHERE id = ?`, [id]);
};

export const getSyncJobs = async () => {
    const database = await getGdccDb();
    return await database.all(`SELECT * FROM gdcc_sync_jobs ORDER BY created_at DESC, id DESC`);
};

export const getActiveSyncJobForZone = async (zoneId) => {
    const database = await getGdccDb();
    return await database.get(
        `SELECT * FROM gdcc_sync_jobs WHERE zone_id = ? AND status IN ('queued', 'running', 'cancelling') ORDER BY id DESC LIMIT 1`,
        [zoneId]
    );
};

export const claimQueuedSyncJob = async () => {
    const database = await getGdccDb();
    await database.exec('BEGIN IMMEDIATE TRANSACTION');
    try {
        const job = await database.get(
            `SELECT * FROM gdcc_sync_jobs WHERE status = 'queued' AND stop_requested = 0 ORDER BY created_at ASC, id ASC LIMIT 1`
        );
        if (!job) {
            await database.exec('COMMIT');
            return null;
        }
        await database.run(
            `UPDATE gdcc_sync_jobs
             SET status = 'running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND status = 'queued'`,
            [job.id]
        );
        await database.exec('COMMIT');
        return await getSyncJobById(job.id);
    } catch (error) {
        try { await database.exec('ROLLBACK'); } catch (_) {}
        throw error;
    }
};

export const updateSyncJob = async (id, updates) => {
    const database = await getGdccDb();
    const keys = Object.keys(updates || {});
    if (keys.length === 0) return await getSyncJobById(id);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    const values = keys.map(key => updates[key]);
    await database.run(
        `UPDATE gdcc_sync_jobs SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [...values, id]
    );
    return await getSyncJobById(id);
};

export const incrementSyncJobRateLimit = async (id, amount = 1) => {
    const database = await getGdccDb();
    await database.run(
        `UPDATE gdcc_sync_jobs SET rate_limit_count = rate_limit_count + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [amount, id]
    );
    return await getSyncJobById(id);
};

export const markSyncJobRateLimited = async (id, date, domain, amount = 1) => {
    const database = await getGdccDb();
    await database.run(
        `UPDATE gdcc_sync_jobs
         SET rate_limit_count = rate_limit_count + ?,
             last_rate_limited_date = ?,
             last_rate_limited_domain = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [amount, date || null, domain || null, id]
    );
    return await getSyncJobById(id);
};

export const deleteSyncJob = async (id) => {
    const database = await getGdccDb();
    await database.run(`DELETE FROM gdcc_sync_jobs WHERE id = ?`, [id]);
};

export const addCompletedSyncJobHistory = async (job) => {
    const database = await getGdccDb();
    const durationSeconds = job.started_at && job.finished_at
        ? Math.max(0, Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000))
        : 0;

    await database.run(
        `INSERT INTO gdcc_sync_job_history (
            zone_id, zone_name, account_name, requested_by,
            rate_limit_count, last_rate_limited_date, last_rate_limited_domain,
            zone_total_steps, zone_completed_steps,
            created_at, started_at, finished_at, duration_seconds
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            job.zone_id,
            job.zone_name,
            job.account_name,
            job.requested_by || null,
            job.rate_limit_count || 0,
            job.last_rate_limited_date || null,
            job.last_rate_limited_domain || null,
            job.zone_total_steps || 0,
            job.zone_completed_steps || 0,
            job.created_at || null,
            job.started_at || null,
            job.finished_at || null,
            durationSeconds,
        ]
    );

    await database.run(
        `DELETE FROM gdcc_sync_job_history
         WHERE id NOT IN (
           SELECT id FROM gdcc_sync_job_history ORDER BY completed_at DESC, id DESC LIMIT 20
         )`
    );
};

export const getCompletedSyncJobHistory = async () => {
    const database = await getGdccDb();
    return await database.all(`SELECT * FROM gdcc_sync_job_history ORDER BY completed_at DESC, id DESC LIMIT 20`);
};

export const clearCompletedSyncJobHistory = async () => {
    const database = await getGdccDb();
    await database.run(`DELETE FROM gdcc_sync_job_history`);
};

export const recoverSyncJobs = async () => {
    const database = await getGdccDb();
    await database.run(
        `UPDATE gdcc_sync_jobs
         SET status = CASE WHEN stop_requested = 1 THEN 'cancelled' ELSE 'queued' END,
             current_phase = CASE WHEN stop_requested = 1 THEN current_phase ELSE NULL END,
             updated_at = CURRENT_TIMESTAMP
         WHERE status = 'running'`
    );
};

export const requestStopSyncJob = async (id) => {
    const database = await getGdccDb();
    const job = await database.get(`SELECT * FROM gdcc_sync_jobs WHERE id = ?`, [id]);
    if (!job) return null;

    if (job.status === 'queued') {
        await database.run(
            `UPDATE gdcc_sync_jobs
             SET stop_requested = 1,
                 status = 'cancelled',
                 last_error = 'Stopped by user',
                 api_token = NULL,
                 retry_requested = 0,
                 finished_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [id]
        );
    } else if (job.status === 'running') {
        await database.run(
            `UPDATE gdcc_sync_jobs
             SET stop_requested = 1,
                 status = 'cancelling',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [id]
        );
    }
    return await getSyncJobById(id);
};

export const requestRetrySyncJob = async (id) => {
    const database = await getGdccDb();
    const job = await database.get(`SELECT * FROM gdcc_sync_jobs WHERE id = ?`, [id]);
    if (!job) return null;

    await database.run(
        `UPDATE gdcc_sync_jobs
         SET stop_requested = 1,
             retry_requested = 1,
             status = CASE WHEN status IN ('running', 'cancelling') THEN 'cancelling' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [id]
    );

    return await getSyncJobById(id);
};

export const purgeLatestZoneDays = async (zoneId, days = 2) => {
    const database = await getGdccDb();
    const dates = await database.all(
        `SELECT report_date FROM gdcc_daily_stats WHERE zone_id = ? GROUP BY report_date ORDER BY report_date DESC LIMIT ?`,
        [zoneId, days]
    );
    if (dates.length === 0) return [];
    const list = dates.map(row => row.report_date);
    const placeholders = list.map(() => '?').join(',');
    await database.run(
        `DELETE FROM gdcc_daily_stats WHERE zone_id = ? AND report_date IN (${placeholders})`,
        [zoneId, ...list]
    );
    return list;
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

// --- GDCC Background Report Jobs Helpers ---

export const createReportJob = async (userId, accountId, accountName, zoneId, zoneName, subdomains, startDate, endDate, templateId = 'default', promotedHosts = [], exportSeparated = false, exportThaiDigits = false) => {
    const database = await getGdccDb();
    const query = `
        INSERT INTO gdcc_report_jobs (user_id, account_id, account_name, zone_id, zone_name, subdomains, start_date, end_date, template_id, promoted_hosts, export_separated, export_thai_digits, status, progress, status_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 'Queued')
    `;
    const result = await database.run(query, [
        userId,
        accountId,
        accountName,
        zoneId,
        zoneName,
        JSON.stringify(subdomains),
        startDate,
        endDate,
        templateId,
        JSON.stringify(promotedHosts),
        exportSeparated ? 1 : 0,
        exportThaiDigits ? 1 : 0
    ]);
    const newJobId = result.lastID;

    // Cleanup old jobs exceeding 3 limit for this user
    try {
        const userJobs = await database.all(
            `SELECT id, file_name FROM gdcc_report_jobs WHERE user_id = ? ORDER BY created_at DESC`,
            [userId]
        );
        if (userJobs.length > 3) {
            const jobsToDelete = userJobs.slice(3); // Keep only the 3 latest
            for (const jobToDelete of jobsToDelete) {
                // Delete from db
                await database.run(`DELETE FROM gdcc_report_jobs WHERE id = ?`, [jobToDelete.id]);
                // Delete file from disk if file_name is present
                if (jobToDelete.file_name) {
                    const reportsDir = path.join(process.cwd(), 'public', 'reports');
                    const filePath = path.join(reportsDir, jobToDelete.file_name);
                    if (fs.existsSync(filePath)) {
                        try {
                            fs.unlinkSync(filePath);
                            console.log(`🗑️ Auto-deleted old report file: ${jobToDelete.file_name}`);
                        } catch (fileErr) {
                            console.error(`❌ Failed to delete old report file: ${jobToDelete.file_name}`, fileErr);
                        }
                    }
                }
            }
        }
    } catch (cleanupErr) {
        console.error('❌ Error during report job cleanup:', cleanupErr);
    }

    return newJobId;
};

export const updateReportJobProgress = async (id, progress, status, statusMessage = null, fileName = null, errorMessage = null) => {
    const database = await getGdccDb();
    const query = `
        UPDATE gdcc_report_jobs
        SET progress = ?, status = ?, status_message = ?, file_name = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;
    await database.run(query, [progress, status, statusMessage, fileName, errorMessage, id]);
};

export const getReportJobs = async (userId = null) => {
    const database = await getGdccDb();
    if (userId) {
        return await database.all(`SELECT * FROM gdcc_report_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 3`, [userId]);
    }
    return await database.all(`SELECT * FROM gdcc_report_jobs ORDER BY created_at DESC LIMIT 3`);
};

export const getReportJobById = async (id) => {
    const database = await getGdccDb();
    return await database.get(`SELECT * FROM gdcc_report_jobs WHERE id = ?`, [id]);
};

export const deleteReportJob = async (id) => {
    const database = await getGdccDb();
    await database.run(`DELETE FROM gdcc_report_jobs WHERE id = ?`, [id]);
};
