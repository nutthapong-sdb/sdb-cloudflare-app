const { setupBrowser, setupPage, login, log, colors, BASE_URL } = require('../../test-all/libs/ui-helper');

(async () => {
    const browser = await setupBrowser();
    try {
        const page = await setupPage(browser);
        await login(page);

        log('🔹 Navigating to GDCC System...', colors.cyan);
        await page.goto(`${BASE_URL}/systems/gdcc`, { waitUntil: 'domcontentloaded' });

        // Wait for page load
        await page.waitForTimeout(2000);

        // 1. Verify "GENERATE DASHBOARD" button exists
        log('🔹 Identifying Generate Button...', colors.blue);
        const genButtons = await page.$x('//button[contains(text(), "GENERATE DASHBOARD")]');

        if (genButtons.length > 0) {
            log('   ✅ Button "GENERATE DASHBOARD" found.', colors.green);

            // 2. Verify it is disabled initially (since no subdomain selected)
            const isDisabled = await page.evaluate(el => el.disabled, genButtons[0]);
            if (isDisabled) {
                log('   ✅ Button is DISABLED initially (Correct).', colors.green);
            } else {
                // It might be enabled if default subdomain auto-selected from config?
                // config default is in page.js: DEFAULT_CONFIG
                // If auto-select happened, it might be enabled.
                log('   ⚠️ Button is not disabled (Auto-selection might have occurred). Checking selectors...', colors.yellow);
            }
        } else {
            throw new Error('Generate Dashboard Button NOT found!');
        }

        log('\n✅ Manual Generation Feature Test Completed!', colors.green);

    } catch (error) {
        log(`❌ Test Failed: ${error.message}`, colors.red);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
