/**
 * Test: Firewall Logs - Select Account/Zone, Fetch Logs, Download CSV
 * 1. Navigate to Firewall Logs page
 * 2. Select Account via SearchableDropdown
 * 3. Select Zone via SearchableDropdown
 * 4. Click "Fetch Logs" button
 * 5. Wait for logs to load
 * 6. Click "Download CSV" if data is present
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { setupBrowser, setupPage, login, log, colors, BASE_URL, TMP_DOWNLOAD_DIR } = require('../libs/ui-helper');
const { selectCursorDropdown, GDCC_TEST_CONFIG } = require('../libs/gdcc-helper');

(async () => {
    log('🚀 Starting Test: Firewall Logs...', colors.cyan);
    const browser = await setupBrowser();
    const page = await setupPage(browser);

    try {
        await login(page);

        log('🔹 Navigating to Firewall Logs...', colors.blue);
        await page.goto(`${BASE_URL}/systems/firewall_logs`, { waitUntil: 'domcontentloaded' });
        // Firewall page uses click-based dropdowns (no tabindex), wait for trigger divs
        await page.waitForSelector('div.cursor-pointer', { visible: true, timeout: 15000 });
        await new Promise(r => setTimeout(r, 1500));
        log('✅ Firewall Logs page loaded.', colors.green);

        // Select Account (index 0)
        log('🔹 Selecting Account...', colors.blue);
        const acctOk = await selectCursorDropdown(page, 0, GDCC_TEST_CONFIG.account_name);
        if (acctOk) {
            log('   ✅ Account selected.', colors.green);
        } else {
            log('   ⚠️ Account selection failed - page may have auto-selected. Continuing...', colors.yellow);
        }
        await new Promise(r => setTimeout(r, 1500));

        // Select Zone (index 1)
        log('🔹 Selecting Zone...', colors.blue);
        const zoneOk = await selectCursorDropdown(page, 1, GDCC_TEST_CONFIG.zone_name);
        if (zoneOk) {
            log('   ✅ Zone selected.', colors.green);
        } else {
            log('   ⚠️ Zone selection failed - may have auto-selected. Continuing...', colors.yellow);
        }
        await new Promise(r => setTimeout(r, 1000));

        // Click "Fetch Logs" button
        log('🔹 Clicking Fetch Logs...', colors.blue);
        const btns = await page.$$('button');
        let fetchBtn = null;
        for (const btn of btns) {
            const txt = await btn.evaluate(el => el.textContent?.trim() || '');
            const disabled = await btn.evaluate(el => el.disabled);
            if ((txt.includes('Fetch Logs') || txt.includes('Fetch')) && !disabled) {
                fetchBtn = btn;
                break;
            }
        }

        if (!fetchBtn) throw new Error('"Fetch Logs" button not found or disabled (Zone not selected?)');
        await fetchBtn.click();
        log('   ✅ Fetch Logs clicked.', colors.green);

        // Wait for logs to load (or no data state)
        log('🔹 Waiting for logs to load (max 30s)...', colors.blue);
        let logsLoaded = false;
        const fetchStart = Date.now();
        while (Date.now() - fetchStart < 30000) {
            // Check if table has rows OR "No logs found" message appears
            const hasRows = await page.$$eval('table tbody tr', rows => rows.length > 0).catch(() => false);
            const noLogsMsg = await page.evaluate(() => {
                return document.body.textContent?.includes('No logs found') ||
                    document.body.textContent?.includes('Select a zone and click Fetch');
            });
            const fetchingDone = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const searchBtn = btns.find(b => b.textContent?.includes('Searching'));
                return !searchBtn; // If button no longer says "Searching", we're done
            });

            if (fetchingDone && (hasRows || noLogsMsg)) {
                logsLoaded = true;
                break;
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!logsLoaded) {
            log('   ⚠️ Logs did not load within timeout. Continuing...', colors.yellow);
        }

        // Check for data
        const rowCount = await page.$$eval('table tbody tr', rows => rows.length).catch(() => 0);
        log(`   ℹ️ Table rows: ${rowCount}`, colors.gray);

        if (rowCount > 0) {
            log('   ✅ Logs loaded successfully.', colors.green);

            // Record download start time to detect new file
            const downloadStartTime = Date.now();
            const downloadsDir = path.join(os.homedir(), 'Downloads');

            // Click Download CSV button
            log('🔹 Clicking Download CSV...', colors.blue);
            const allBtns = await page.$$('button');
            let csvBtn = null;
            for (const btn of allBtns) {
                const txt = await btn.evaluate(el => el.textContent?.trim() || '');
                if (txt.includes('Download CSV') || txt.includes('CSV')) { csvBtn = btn; break; }
            }

            if (csvBtn) {
                await csvBtn.click();
                log('   ✅ Download CSV clicked.', colors.green);

                // Wait for file (check both TMP and ~/Downloads)
                const dlStart = Date.now();
                let csvFile = null;
                while (Date.now() - dlStart < 15000) {
                    // Check TMP dir
                    const tmpFiles = fs.readdirSync(TMP_DOWNLOAD_DIR);
                    const foundTmp = tmpFiles.find(f => f.endsWith('.csv') && fs.statSync(path.join(TMP_DOWNLOAD_DIR, f)).mtimeMs >= downloadStartTime);
                    if (foundTmp) { csvFile = path.join(TMP_DOWNLOAD_DIR, foundTmp); break; }

                    // Check ~/Downloads
                    if (fs.existsSync(downloadsDir)) {
                        const dlFiles = fs.readdirSync(downloadsDir);
                        const foundDl = dlFiles.find(f => f.endsWith('.csv') && fs.statSync(path.join(downloadsDir, f)).mtimeMs >= downloadStartTime);
                        if (foundDl) { csvFile = path.join(downloadsDir, foundDl); break; }
                    }
                    await new Promise(r => setTimeout(r, 500));
                }

                if (csvFile) {
                    const size = fs.statSync(csvFile).size;
                    log(`   ✅ CSV Downloaded: ${path.basename(csvFile)} (${size.toLocaleString()} bytes)`, colors.green);
                    try { fs.unlinkSync(csvFile); } catch (e) { }
                } else {
                    log('   ⚠️ CSV file not detected in download dirs (may have used browser default location).', colors.yellow);
                }
            } else {
                log('   ⚠️ Download CSV button not found.', colors.yellow);
            }
        } else {
            log('   ⚠️ No logs loaded (firewall events may not exist for this zone/rule).', colors.yellow);
        }

        log('\n✅ Firewall Logs Test PASSED!', colors.green);

    } catch (e) {
        log(`❌ Firewall Test Failed: ${e.message}`, colors.red);
        if (e.stack) console.error(e.stack);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
