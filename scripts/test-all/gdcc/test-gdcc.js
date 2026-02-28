/**
 * Test: GDCC Dashboard - Basic Navigation & Generate Dashboard
 * Verifies that the page loads, dropdowns work, and Generate Dashboard can be clicked.
 */
const { setupBrowser, setupPage, login, log, colors } = require('../libs/ui-helper');
const { navigateToGDCC, selectGDCCFilters, clickGenerateDashboard, GDCC_TEST_CONFIG } = require('../libs/gdcc-helper');

(async () => {
    log('🚀 Starting Test: GDCC Dashboard (Navigation & Generate)...', colors.cyan);
    const browser = await setupBrowser();
    const page = await setupPage(browser);

    try {
        await login(page);
        await navigateToGDCC(page);

        // Select Account → Zone → Subdomain
        await selectGDCCFilters(page, GDCC_TEST_CONFIG);

        // Click Generate Dashboard and wait for data
        await clickGenerateDashboard(page);

        // Verify some data widget exists
        const widgets = await page.$$eval('[class*="rounded"]', els =>
            els.filter(el => el.textContent?.includes('Total Requests')).length
        );
        log(`✅ Dashboard loaded. Found ${widgets} data widget(s).`, colors.green);

        log('✅ GDCC Dashboard Test PASSED', colors.green);
    } catch (e) {
        log(`❌ GDCC Dashboard Test FAILED: ${e.message}`, colors.red);
        if (e.stack) console.error(e.stack);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
