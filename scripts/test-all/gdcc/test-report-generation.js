/**
 * Test: GDCC - Batch Report Generation (Full E2E Flow)
 * 1. Navigate to GDCC
 * 2. Select Account → Zone → Subdomain
 * 3. Generate Dashboard (load traffic data)
 * 4. Open "Create Report" modal
 * 5. Select host(s) and click Generate
 * 6. Verify a .doc file is downloaded
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { setupBrowser, setupPage, login, log, colors, TMP_DOWNLOAD_DIR } = require('../libs/ui-helper');
const { navigateToGDCC, selectGDCCFilters, clickGenerateDashboard, generateBatchReport, GDCC_TEST_CONFIG } = require('../libs/gdcc-helper');

(async () => {
    log('🚀 Starting Test: GDCC Report Generation (Full E2E)...', colors.cyan);
    const browser = await setupBrowser();
    try {
        const page = await setupPage(browser);
        await login(page);
        await navigateToGDCC(page);

        log('\n🔹 Step 1: Selecting Account/Zone/Subdomain...', colors.blue);
        await selectGDCCFilters(page, GDCC_TEST_CONFIG);

        log('\n🔹 Step 2: Generating Dashboard Data...', colors.blue);
        await clickGenerateDashboard(page);

        const today = new Date();
        const tzOffset = today.getTimezoneOffset() * 60000;
        const reportDateStr = (new Date(today.getTime() - tzOffset)).toISOString().split('T')[0];

        log('\n🔹 Step 3: Generating Batch Report...', colors.blue);
        const generateStartTime = Date.now();
        await generateBatchReport(page, reportDateStr, GDCC_TEST_CONFIG.subdomain);

        log('\n🔹 Step 4: Waiting for .doc file download (max 2 min)...', colors.blue);
        const downloadsDir = path.join(os.homedir(), 'Downloads');
        const start = Date.now();
        let downloadedFile = null;
        let downloadDir = TMP_DOWNLOAD_DIR;

        while (Date.now() - start < 120000) {
            // Check TMP dir
            const tmpFiles = fs.readdirSync(TMP_DOWNLOAD_DIR);
            const foundTmp = tmpFiles.find(f => {
                if (!(f.endsWith('.docx') || f.endsWith('.doc')) || f.endsWith('.crdownload')) return false;
                return fs.statSync(path.join(TMP_DOWNLOAD_DIR, f)).mtimeMs >= generateStartTime;
            });
            if (foundTmp) { downloadedFile = foundTmp; downloadDir = TMP_DOWNLOAD_DIR; break; }

            // Check ~/Downloads
            if (fs.existsSync(downloadsDir)) {
                const dlFiles = fs.readdirSync(downloadsDir);
                const foundDl = dlFiles.find(f => {
                    if (!(f.endsWith('.docx') || f.endsWith('.doc')) || f.endsWith('.crdownload')) return false;
                    return fs.statSync(path.join(downloadsDir, f)).mtimeMs >= generateStartTime;
                });
                if (foundDl) { downloadedFile = foundDl; downloadDir = downloadsDir; break; }
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        if (!downloadedFile) throw new Error('Timeout: No .doc file downloaded within 2 minutes');

        const fileSize = fs.statSync(path.join(downloadDir, downloadedFile)).size;
        log(`✅ Downloaded: ${downloadedFile} (${fileSize.toLocaleString()} bytes)`, colors.green);

        // Cleanup
        try { fs.unlinkSync(path.join(downloadDir, downloadedFile)); } catch (e) { }

        log('\n✅ GDCC Report Generation Test PASSED!', colors.green);

    } catch (error) {
        log(`❌ Test FAILED: ${error.message}`, colors.red);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
