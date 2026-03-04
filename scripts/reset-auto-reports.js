const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../db/gdcc_history.db');
const reportsDir = path.resolve(__dirname, '../public/reports');

console.log('🧹 Script: Resetting Auto Report Data...');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('❌ Connection Error:', err.message);
        process.exit(1);
    }

    // 1. Delete all generated file records
    db.run('DELETE FROM gdcc_auto_report_files', [], function (err) {
        if (err) {
            console.error('❌ Error clearing gdcc_auto_report_files:', err.message);
        } else {
            console.log(`✅ Cleared ${this.changes} records from gdcc_auto_report_files.`);
        }

        // 2. Delete physical files in public/reports
        try {
            if (fs.existsSync(reportsDir)) {
                const files = fs.readdirSync(reportsDir);
                let deletedCount = 0;
                files.forEach(file => {
                    if (file !== '.gitkeep' && (file.endsWith('.doc') || file.endsWith('.docx') || file.endsWith('.html'))) {
                        fs.unlinkSync(path.join(reportsDir, file));
                        deletedCount++;
                    }
                });
                console.log(`✅ Deleted ${deletedCount} physical report files from ${reportsDir}.`);
            }
        } catch (e) {
            console.error('❌ Error deleting physical files:', e.message);
        }

        // 3. Optional: Clear configurations if --all flag is passed
        const clearAll = process.argv.includes('--all');
        if (clearAll) {
            db.run('DELETE FROM gdcc_auto_reports', [], function (err) {
                if (err) console.error('❌ Error clearing gdcc_auto_reports:', err.message);
                else console.log(`✅ Cleared ${this.changes} configurations from gdcc_auto_reports.`);

                finish();
            });
        } else {
            console.log('💡 Tip: Use "node scripts/reset-auto-reports.js --all" to also delete configurations.');
            finish();
        }

        function finish() {
            console.log('\n✨ Reset complete. You can now run the auto-report-runner.js again.');
            db.close();
        }
    });
});
