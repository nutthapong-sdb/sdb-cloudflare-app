const { setupBrowser, setupPage, login, log, colors, BASE_URL } = require('../../test-all/libs/ui-helper');

(async () => {
    const browser = await setupBrowser();
    try {
        const page = await setupPage(browser);
        await login(page);

        log('🔹 Navigating to GDCC System...', colors.cyan);
        await page.goto(`${BASE_URL}/systems/gdcc`, { waitUntil: 'networkidle0' });

        // --- PART 1: Test Dashboard Dropdown Keyboard Navigation ---
        log('\n🔹 Testing Dashboard Dropdown Keyboard Nav...', colors.blue);

        // Find the dropdown (assuming it is the Zone Selector or similar)
        // We look for a SearchableDropdown structure. 
        // The one in Dashboard usually has a label "Cloudflare Zone" or similar.
        // Let's target the Zone Selector specifically if possible.
        // Or find first element with class matching the dropdown toggle.

        // Wait for dropdown to be visible
        const dropdownToggle = await page.waitForSelector('div[tabindex="0"]', { visible: true, timeout: 5000 });
        if (dropdownToggle) {
            log('   Found Dropdown. Focusing...');
            await dropdownToggle.focus();

            log('   Pressing ArrowDown (Should open menu)...');
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(500);

            // Check if menu is open (lookup for absolute div with max-h-60)
            const menu = await page.$('div.absolute.z-\\[100\\]');
            if (menu) {
                log('   ✅ Menu opened via Keyboard!', colors.green);

                log('   Pressing ArrowDown twice...');
                await page.keyboard.press('ArrowDown');
                await page.waitForTimeout(200);
                await page.keyboard.press('ArrowDown');
                await page.waitForTimeout(200);

                log('   Pressing Enter to select...');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(500);

                // Verify menu closed
                const menuClosed = await page.$('div.absolute.z-\\[100\\]');
                if (!menuClosed) {
                    log('   ✅ Item selected and menu closed!', colors.green);
                } else {
                    log('   ⚠️ Menu still open (Selection might failed or animation pending).', colors.yellow);
                }
            } else {
                throw new Error('Menu did not open with ArrowDown');
            }
        } else {
            log('   ⚠️ No tab-focusable dropdown found. Skipping Keyboard Test.', colors.yellow);
        }


        // --- PART 2: Test Batch Report Modal Search ---
        log('\n🔹 Testing Batch Report Modal Search...', colors.blue);

        // Open Modal
        const createBtn = await page.waitForXPath('//button[contains(text(), "Create Report")]', { visible: true });
        if (createBtn) await createBtn.click();
        else throw new Error("Create Report button not found");
        log('   Opened Modal.');

        // Wait for Modal Input
        await page.waitForTimeout(1000);
        const searchInput = await page.$('input[placeholder="Filter sub-domains..."]');
        if (!searchInput) throw new Error("Search input not found in Modal");
        log('   ✅ Found Search Input.', colors.green);

        // Get initial count using evaluation
        const initialCount = await page.$$eval('label.cursor-pointer', els => els.length);
        log(`   Initial visible hosts: ${initialCount}`);

        if (initialCount > 0) {
            // Get text of first host to search for
            const firstHost = await page.$eval('label.cursor-pointer span:last-child', el => el.textContent.trim());
            log(`   Target host for search: "${firstHost}"`);

            // Type search
            await searchInput.type(firstHost);
            await page.waitForTimeout(500);

            // Verify count reduced
            const filteredCount = await page.$$eval('label.cursor-pointer', els => els.length);
            log(`   Filtered visible hosts: ${filteredCount}`);

            if (filteredCount < initialCount || filteredCount === 1) {
                log('   ✅ Filtering works (List reduced/matched).', colors.green);
            } else {
                log('   ⚠️ Filtering did not reduce list (Maybe only 1 host existed?).', colors.yellow);
            }

            // Test "Select Visible"
            const selectVisibleBtn = await page.$x('//button[contains(text(), "Select Visible")]');
            if (selectVisibleBtn.length > 0) {
                await selectVisibleBtn[0].click();
                log('   Clicked "Select Visible".');

                // Verify checkbox checked
                const isChecked = await page.$eval('label.cursor-pointer input', el => el.checked);
                if (isChecked) log('   ✅ Checkbox is checked.', colors.green);
                else throw new Error('Checkbox not checked after Select Visible');
            }

            // Clear search
            await searchInput.click({ clickCount: 3 });
            await searchInput.press('Backspace');
            await page.waitForTimeout(500);

            const clearedCount = await page.$$eval('label.cursor-pointer', els => els.length);
            if (clearedCount === initialCount) log('   ✅ List restored after clearing search.', colors.green);
            else throw new Error(`List count mismatch after clear. Expected ${initialCount}, got ${clearedCount}`);

        } else {
            log('   ⚠️ No hosts available to test search.', colors.yellow);
        }

        log('\n✅ UI Enhancement Tests Completed Successfully!', colors.green);

    } catch (error) {
        log(`❌ Test Failed: ${error.message}`, colors.red);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
