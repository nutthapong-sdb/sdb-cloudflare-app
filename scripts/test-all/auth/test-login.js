const { setupBrowser, setupPage, login, log, colors, BASE_URL } = require('../libs/ui-helper');

(async () => {
    log('🚀 Starting Test: Login Flow...', colors.cyan);
    const browser = await setupBrowser();
    const page = await setupPage(browser);

    try {
        await login(page);

        // Verify final URL or unique element on Dashboard
        const url = await page.url();
        if (url.includes('/systems') || url === `${BASE_URL}/`) {
            log('✅ Redirected to Dashboard/Systems successfully', colors.green);
        } else {
            throw new Error(`Unexpected URL after login: ${url}`);
        }

    } catch (e) {
        log(`❌ Login Test Failed: ${e.message}`, colors.red);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
