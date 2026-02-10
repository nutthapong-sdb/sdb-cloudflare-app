const { setupBrowser, setupPage, login, log, colors, checkAnyDownload, BASE_URL } = require('../libs/ui-helper');
const path = require('path');

(async () => {
    log('🚀 Starting Test: Firewall Logs (CSV)...', colors.cyan);
    const browser = await setupBrowser();
    const page = await setupPage(browser);

    try {
        await login(page);

        log('🔹 Navigating to Firewall Logs System...', colors.blue);
        await page.goto(`${BASE_URL}/systems/firewall_logs`, { waitUntil: 'networkidle0' });

        // Wait for page to load (Search input is key)
        await page.waitForSelector('input[placeholder*="Search"]', { timeout: 10000 });

        // Find "Download CSV" button (Green)
        log('🔹 Testing CSV Download...', colors.blue);
        const downloadBtn = await page.$('button[class*="bg-green-600"]');

        if (downloadBtn) {
            await downloadBtn.click();
            await page.waitForTimeout(5000); // Wait for processing
        } else {
            // Find by text
            const buttons = await page.$$('button');
            for (const btn of buttons) {
                const text = await btn.evaluate(e => e.textContent);
                if (text.includes('CSV') || text.includes('Download')) {
                    await btn.click();
                    await page.waitForTimeout(5000);
                    break;
                }
            }
        }

        // Verify Download
        const success = await checkAnyDownload();
        if (!success) throw new Error('Firewall CSV Download Failed');

        log('✅ Firewall Test Passed', colors.green);

    } catch (e) {
        log(`❌ Firewall Test Failed: ${e.message}`, colors.red);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
