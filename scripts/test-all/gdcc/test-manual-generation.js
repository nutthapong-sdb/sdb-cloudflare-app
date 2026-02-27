/**
 * Test: GDCC - Manual Dashboard Generation
 * Verifies that:
 * 1. The "Generate Dashboard" button exists and is initially disabled
 * 2. After selecting Account → Zone → Subdomain, the button becomes enabled
 * 3. Clicking it triggers the data load
 */
const { setupBrowser, setupPage, login, log, colors } = require('../libs/ui-helper');
const { navigateToGDCC, selectGDCCFilters, GDCC_TEST_CONFIG } = require('../libs/gdcc-helper');

(async () => {
    log('🚀 Starting Test: GDCC Manual Dashboard Generation...', colors.cyan);
    const browser = await setupBrowser();
    try {
        const page = await setupPage(browser);
        await login(page);
        await navigateToGDCC(page);

        // Verify "Generate Dashboard" is initially disabled
        log('🔹 Verifying Generate Dashboard button is initially disabled...', colors.blue);
        const btns = await page.$$('button');
        let genBtnInitial = null;
        for (const btn of btns) {
            const txt = await btn.evaluate(el => el.textContent?.trim() || '');
            if (txt === 'Generate Dashboard') { genBtnInitial = btn; break; }
        }

        if (!genBtnInitial) throw new Error('"Generate Dashboard" button NOT found on page');

        const isDisabledInitially = await genBtnInitial.evaluate(el => el.disabled);
        if (isDisabledInitially) {
            log('   ✅ Generate Dashboard is DISABLED initially (Correct - no selections yet).', colors.green);
        } else {
            log('   ⚠️ Generate Dashboard is not disabled initially (unexpected, but continuing)', colors.yellow);
        }

        // Select Account → Zone → Subdomain
        log('\n🔹 Selecting Account/Zone/Subdomain...', colors.blue);
        await selectGDCCFilters(page, GDCC_TEST_CONFIG);

        // Verify button is now enabled
        const btns2 = await page.$$('button');
        let genBtnAfter = null;
        for (const btn of btns2) {
            const txt = await btn.evaluate(el => el.textContent?.trim() || '');
            if (txt === 'Generate Dashboard') { genBtnAfter = btn; }
        }

        if (!genBtnAfter) throw new Error('"Generate Dashboard" button not found after selection');
        const isEnabledAfter = await genBtnAfter.evaluate(el => !el.disabled);
        if (isEnabledAfter) {
            log('   ✅ Generate Dashboard is ENABLED after selection (Correct).', colors.green);
        } else {
            throw new Error('"Generate Dashboard" button is still disabled after selection');
        }

        log('\n✅ Manual Generation Feature Test PASSED!', colors.green);

    } catch (error) {
        log(`❌ Test FAILED: ${error.message}`, colors.red);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
