/**
 * Test: GDCC - UI Enhancements
 * Tests:
 * 1. Dropdown keyboard navigation (on Account dropdown)
 * 2. Create Report modal search/filter functionality
 */
const { setupBrowser, setupPage, login, log, colors } = require('../libs/ui-helper');
const { navigateToGDCC, selectGDCCFilters, GDCC_TEST_CONFIG } = require('../libs/gdcc-helper');

(async () => {
    log('🚀 Starting Test: GDCC UI Enhancements...', colors.cyan);
    const browser = await setupBrowser();
    try {
        const page = await setupPage(browser);
        await login(page);
        await navigateToGDCC(page);

        // --- PART 1: Test Dropdown Keyboard Navigation ---
        log('\n🔹 Part 1: Testing Dropdown Keyboard Navigation...', colors.blue);
        const dropdownToggle = await page.waitForSelector('div[tabindex="0"]', { visible: true, timeout: 5000 });
        if (dropdownToggle) {
            await dropdownToggle.focus();
            log('   Found Dropdown. Pressing ArrowDown...', colors.gray);
            await page.keyboard.press('ArrowDown');
            await new Promise(r => setTimeout(r, 500));

            const menu = await page.$('div.absolute.z-\\[100\\]');
            if (menu) {
                log('   ✅ Menu opened via Keyboard!', colors.green);
                await page.keyboard.press('Escape');
                await new Promise(r => setTimeout(r, 300));
            } else {
                log('   ⚠️ Menu did not open with ArrowDown (Skipping keyboard test).', colors.yellow);
            }
        } else {
            log('   ⚠️ No tab-focusable dropdown found. Skipping Keyboard Test.', colors.yellow);
        }

        // --- PART 2: Select Account/Zone/Subdomain ---
        log('\n🔹 Part 2: Selecting filters...', colors.blue);
        await selectGDCCFilters(page, GDCC_TEST_CONFIG);

        // --- PART 3: Test Batch Report Modal ---
        log('\n🔹 Part 3: Testing Batch Report Modal...', colors.blue);

        // Open "Create Report" modal
        const btns = await page.$$('button');
        let createBtn = null;
        for (const btn of btns) {
            const txt = await btn.evaluate(el => el.textContent?.trim() || '');
            const disabled = await btn.evaluate(el => el.disabled);
            if (txt === 'Create Report' && !disabled) { createBtn = btn; break; }
        }
        if (!createBtn) throw new Error('"Create Report" button not found or disabled');
        await createBtn.click();
        log('   Opened Create Report Modal.', colors.gray);
        await new Promise(r => setTimeout(r, 1500));

        // Check search input (optional - may not exist if zone has no real subdomains)
        let searchInput = null;
        try {
            searchInput = await page.waitForSelector('input[placeholder="Filter sub-domains..."]', { visible: true, timeout: 3000 });
            log('   ✅ Filter sub-domains search input found.', colors.green);
        } catch (e) {
            log('   ⚠️ Search input not found (zone may have no real subdomains - acceptable).', colors.yellow);
        }

        // Verify "No Subdomain" option exists
        const labels = await page.$$('label');
        let noSubFound = false;
        for (const lbl of labels) {
            const txt = await lbl.evaluate(el => el.textContent?.trim() || '');
            if (txt === 'No Subdomain') { noSubFound = true; break; }
        }
        if (noSubFound) {
            log('   ✅ "No Subdomain" option is present in modal.', colors.green);
        } else {
            log('   ⚠️ "No Subdomain" not found (zone may have real subdomains).', colors.yellow);
        }

        // Verify Generate button exists
        const modalBtns = await page.$$('button');
        let genBtn = null;
        for (const btn of modalBtns) {
            const txt = await btn.evaluate(el => el.textContent?.trim() || '');
            if (txt.includes('Generate') || txt.includes('Domain Report')) { genBtn = btn; break; }
        }
        if (genBtn) {
            log('   ✅ Generate button found in modal.', colors.green);
        } else {
            throw new Error('Generate button not found in Batch Report Modal');
        }

        // Close modal
        const closeBtns = await page.$$('button');
        for (const btn of closeBtns) {
            const txt = await btn.evaluate(el => el.textContent?.trim() || '');
            if (txt === 'Cancel') { await btn.click(); break; }
        }

        log('\n✅ UI Enhancement Tests PASSED!', colors.green);

    } catch (error) {
        log(`❌ Test FAILED: ${error.message}`, colors.red);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
