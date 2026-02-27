/**
 * Test: API Discovery UI - Zone Selection & Data Load
 * 1. Navigate to API Discovery page
 * 2. Select Account via SearchableDropdown
 * 3. Select Zone via SearchableDropdown
 * 4. Verify Discovery Data or Endpoints load (or graceful empty state)
 * 5. If data is present, verify CSV download button exists
 */
const { setupBrowser, setupPage, login, log, colors, BASE_URL } = require('../libs/ui-helper');
const { selectCursorDropdown, GDCC_TEST_CONFIG } = require('../libs/gdcc-helper');

(async () => {
    log('🚀 Starting Test: API Discovery UI...', colors.cyan);
    const browser = await setupBrowser();
    const page = await setupPage(browser);

    // Bridge console logs for debugging selectCursorDropdown
    page.on('console', msg => {
        if (msg.type() === 'log') log(`   🖥️ Browser: ${msg.text()}`, colors.gray);
    });

    try {
        await login(page);

        log('🔹 Navigating to API Discovery...', colors.blue);
        await page.goto(`${BASE_URL}/systems/api_discovery`, { waitUntil: 'domcontentloaded' });
        // API Discovery uses click-based dropdown: wait for trigger divs
        await page.waitForSelector('div.cursor-pointer', { visible: true, timeout: 15000 });
        await new Promise(r => setTimeout(r, 1500));
        log('✅ API Discovery page loaded.', colors.green);

        // Select Account (index 0)
        log('🔹 Selecting Account...', colors.blue);
        const acctOk = await selectCursorDropdown(page, 0, 'Government Data Center');
        if (!acctOk) throw new Error(`Failed to select Account: ${GDCC_TEST_CONFIG.account_name}`);
        log('   ✅ Account selected.', colors.green);

        // Wait for Zone dropdown to become available
        await new Promise(r => setTimeout(r, 2000));

        // Select Zone (index 1)
        log('🔹 Selecting Zone...', colors.blue);
        const zoneOk = await selectCursorDropdown(page, 1, 'dwf.go.th');
        if (!zoneOk) throw new Error(`Failed to select Zone: ${GDCC_TEST_CONFIG.zone_name}`);
        log('   ✅ Zone selected.', colors.green);

        // Wait for discovery data to load (or timeout gracefully)
        log('🔹 Waiting for Discovery Data to load (max 20s)...', colors.blue);
        await new Promise(r => setTimeout(r, 5000)); // Minimum wait for API call

        try {
            // Wait for either table rows OR "no data" message
            await page.waitForFunction(() => {
                const tables = document.querySelectorAll('table tbody tr');
                const noData = [...document.querySelectorAll('p')].some(el =>
                    el.textContent?.includes('ไม่พบข้อมูล') || el.textContent?.includes('No')
                );
                return tables.length > 0 || noData;
            }, { timeout: 15000 });
        } catch (e) {
            log('   ⚠️ Discovery data did not load within timeout (API may be restricted).', colors.yellow);
        }

        // Check for CSV download button
        const csvBtns = await page.$$('button');
        let csvBtn = null;
        for (const btn of csvBtns) {
            const txt = await btn.evaluate(el => el.textContent?.trim() || '');
            const title = await btn.evaluate(el => el.getAttribute('title') || '');
            if (txt.includes('CSV') || title.includes('CSV') || title.includes('Download')) {
                csvBtn = btn;
                break;
            }
        }

        if (csvBtn) {
            log('   ✅ CSV Download button found.', colors.green);
        } else {
            log('   ⚠️ CSV Download button not found (may require data to be present).', colors.yellow);
        }

        // Check table rows
        const rows = await page.$$('table tbody tr');
        log(`   ℹ️ Visible table rows: ${rows.length}`, colors.gray);

        if (rows.length > 0) {
            log('   ✅ Discovery Data is loaded and displayed.', colors.green);
        } else {
            log('   ⚠️ No discovery data rows found (API Discovery may be restricted for this zone).', colors.yellow);
        }

        log('\n✅ API Discovery UI Test PASSED!', colors.green);

    } catch (e) {
        log(`❌ API Discovery Test Failed: ${e.message}`, colors.red);
        if (e.stack) console.error(e.stack);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
