const { setupBrowser, setupPage, login, log, colors, checkAnyDownload, BASE_URL } = require('../libs/ui-helper');
const path = require('path');

(async () => {
    log('🚀 Starting Test: GDCC System (Report)...', colors.cyan);
    const browser = await setupBrowser();
    const page = await setupPage(browser);

    try {
        await login(page);

        log('🔹 Navigating to GDCC System...', colors.blue);
        await page.goto(`${BASE_URL}/systems/gdcc`, { waitUntil: 'networkidle0' });

        // Wait specific elements
        await page.waitForSelector('button', { timeout: 10000 });

        // Test Download Logic
        log('🔹 Testing "Domain Report" Download...', colors.blue);

        // Find "Download Word" button
        const downloadBtn = await page.$('button[class*="bg-blue-600"]');
        if (downloadBtn) {
            await downloadBtn.click();
            await page.waitForTimeout(5000); // Wait for processing
        } else {
            // Try to find via text (Fallback)
            const buttons = await page.$$('button');
            for (const btn of buttons) {
                const text = await btn.evaluate(e => e.textContent);
                if (text.includes('Download Word')) {
                    await btn.click();
                    await page.waitForTimeout(5000);
                    break;
                }
            }
        }

        // Verify Download
        const success = await checkAnyDownload();
        if (!success) throw new Error('GDCC Report Download Failed');

        log('✅ GDCC Test Passed', colors.green);

    } catch (e) {
        log(`❌ GDCC Test Failed: ${e.message}`, colors.red);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
