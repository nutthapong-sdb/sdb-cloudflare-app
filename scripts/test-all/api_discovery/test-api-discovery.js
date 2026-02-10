const { setupBrowser, setupPage, login, log, colors, checkAnyDownload, BASE_URL } = require('../libs/ui-helper');
const path = require('path');

(async () => {
    log('🚀 Starting Test: API Discovery (Subdomain & CSV)...', colors.cyan);
    const browser = await setupBrowser();
    const page = await setupPage(browser);

    try {
        await login(page);

        log('🔹 Navigating to API Discovery...', colors.blue);
        await page.goto(`${BASE_URL}/systems/api_discovery`, { waitUntil: 'networkidle0' });

        await page.waitForSelector('h1', { timeout: 10000 });

        // Select Account & Zone (Reuse logic from previous feature test)
        log('🔹 Selecting Zone...', colors.blue);

        await page.waitForSelector('label', { timeout: 10000 });
        const dropdowns = await page.$$('label');

        if (dropdowns.length > 0) {
            // Click Account Dropdown
            const accInput = await dropdowns[0].evaluateHandle(el => el.nextElementSibling.querySelector('input, div'));
            await accInput.click();
            await page.waitForSelector('.absolute.z-[100] div[class*="cursor-pointer"]', { timeout: 5000 });
            await page.page.click('.absolute.z-[100] div[class*="cursor-pointer"]');
            await page.waitForTimeout(1000);

            // Click Zone Dropdown
            const zoneInput = await dropdowns[1].evaluateHandle(el => el.nextElementSibling.querySelector('input, div'));
            await zoneInput.click();
            await page.waitForTimeout(500); // Wait for options
            const firstZone = await page.$('.absolute.z-[100] div[class*="cursor-pointer"]');
            if (firstZone) {
                await firstZone.click();
                log('✅ Zone selected', colors.green);
                await page.waitForTimeout(3000); // Wait for API data load
            } else {
                throw new Error('No Zones available to select');
            }
        }

        // Test CSV Download
        log('🔹 Testing CSV Download...', colors.blue);
        const csvBtn = await page.$('button[title*="Download"]');
        if (csvBtn) {
            await csvBtn.click();
            await page.waitForTimeout(15000); // Wait for processing (can be slow for large data/subdomains)

            const success = await checkAnyDownload(20000); // Increased timeout for CSV generation
            if (!success) throw new Error('API Discovery CSV Download Failed (Timeout/Error)');

            log('✅ CSV Download Verified', colors.green);
        } else {
            log('⚠️ CSV Button not found (Maybe no data loaded)', colors.yellow);
        }

        // Test Expand (Optional/Best Effort check)
        const expandBtn = await page.$('table tbody tr td:first-child button');
        if (expandBtn) {
            log('🔹 Testing Expand Button...', colors.blue);
            await expandBtn.click();
            await page.waitForSelector('h5', { timeout: 5000 });
            const headers = await page.$$eval('h5', els => els.map(e => e.textContent));
            if (headers.some(h => h.includes('Subdomains'))) {
                log('✅ Expand Logic Verified (Subdomains visible)', colors.green);
            }
        }

    } catch (e) {
        log(`❌ API Discovery Test Failed: ${e.message}`, colors.red);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
