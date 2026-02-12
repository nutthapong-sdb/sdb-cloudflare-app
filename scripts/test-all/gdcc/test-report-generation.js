const { setupBrowser, setupPage, login, log, colors, BASE_URL } = require('../../test-all/libs/ui-helper');

(async () => {
    const browser = await setupBrowser(); // ui-helper returns browser instance
    try {
        const page = await setupPage(browser); // pass browser to setupPage
        await login(page);

        log('🔹 Navigating to GDCC System...');
        await page.goto(`${BASE_URL}/systems/gdcc`, { waitUntil: 'networkidle0' });

        log('🔹 Waiting for Dashboard and Zone Selection...');
        // Wait for zone dropdown or data to load.
        // We look for the "Create Report" button which should be available
        const createBtn = await page.waitForXPath('//button[contains(text(), "Create Report")]', { visible: true, timeout: 15000 });

        log('🔹 Opening Create Report Modal...');
        if (createBtn) await createBtn.click();
        else throw new Error("Create Report button not found");

        await page.waitForTimeout(1000); // Wait for animation

        log('🔹 Selecting Time Range: 30 Days...');
        const rangeBtn = await page.waitForXPath('//button[contains(text(), "30 Days")]', { visible: true });
        if (rangeBtn) await rangeBtn.click();
        else throw new Error("30 Days button not found");

        log('🔹 Selecting Host (Just one for testing to be fast)...');
        // Deselect all first if needed, or find specific label
        // Button might say "Select All" or "Deselect All".
        // Let's just click the FIRST available host checkbox to ensure at least one is selected.

        // Wait for hosts list
        const labels = await page.$$('label.cursor-pointer');
        if (labels.length === 0) {
            // Check for "No sub-domains available"
            const noData = await page.$x('//div[contains(text(), "No sub-domains available")]');
            if (noData.length > 0) {
                log('⚠️ No subdomains available. Skipping test.', colors.yellow);
                await browser.close();
                return;
            }
            throw new Error("No host checkboxes found.");
        }

        // Just click the first one if not selected?
        // Or click "Deselect All" first then click first one?
        // "Deselect All" button text logic: {selected.size === hosts.length ? 'Deselect All' : 'Select All'}
        // If it says "Deselect All", click it to clear.
        const toggleAllBtn = await page.$x('//button[contains(text(), "Deselect All")]');
        if (toggleAllBtn.length > 0) {
            await toggleAllBtn[0].click();
            await page.waitForTimeout(200);
        }

        // Click first host
        await labels[0].click();
        log('✅ Selected 1st host for testing.');

        log('🔹 Clicking Generate Reports...');
        const generateBtn = await page.waitForXPath('//button[contains(text(), "Generate")]', { visible: true });

        // Monitor Console Errors
        let hasError = false;
        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // Filter out non-critical errors if any
                if (text.includes('stats is not defined') || text.includes('ReferenceError') || text.includes('TypeError')) {
                    hasError = true;
                    log(`❌ CRITICAL CONSOLE ERROR: ${text}`, colors.red);
                }
            }
        });

        // Click Generate
        await generateBtn.click();

        log('⏳ Waiting for report generation (Timeout 60s)...');

        // Wait for "Batch process finished" text in Swal
        try {
            await page.waitForXPath('//div[contains(text(), "Batch process finished")]', { visible: true, timeout: 60000 });
            log('✅ Batch Report Generation Completed Successfully!', colors.green);
        } catch (e) {
            if (hasError) {
                throw new Error("Report generation failed (Console Errors detected).");
            }
            throw new Error("Timeout waiting for completion message.");
        }

        if (hasError) {
            throw new Error("Report generation finished but Critical Errors were detected.");
        }

    } catch (error) {
        log(`❌ Test Failed: ${error.message}`, colors.red);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
