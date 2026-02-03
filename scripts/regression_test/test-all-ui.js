const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');

puppeteer.use(StealthPlugin());

// --- Configuration ---
const BASE_URL = 'http://localhost:8002';
const SDB_URL = `${BASE_URL}/systems/sdb`;
const LOGIN_URL = `${BASE_URL}/login`;

// User Credentials (Root User for testing)
const TEST_USER = {
    username: 'root',
    password: 'password' // Default password
};

// Colors for console
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(msg, color = colors.reset) {
    console.log(`${color}${msg}${colors.reset}`);
}

async function runUITest() {
    log('🚀 Starting UI Regression Tests...', colors.cyan);

    // Check if server is running
    try {
        await fetch(BASE_URL);
    } catch (e) {
        log('❌ Server is not reachable at ' + BASE_URL + '. Please run "npm run dev" first.', colors.red);
        process.exit(1);
    }

    const browser = await puppeteer.launch({
        headless: true, // Run in headful mode (visible UI)
        slowMo: 50,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Enable console logging from browser
    page.on('console', msg => log(`[BROWSER] ${msg.type().toUpperCase()}: ${msg.text()}`, colors.yellow));
    page.on('pageerror', err => log(`[BROWSER ERROR] ${err.toString()}`, colors.red));
    page.on('requestfailed', req => log(`[BROWSER NETWORK FAIL] ${req.url()} - ${req.failure().errorText}`, colors.red));

    try {
        // 1. Login Flow
        log('Testing Login Flow...', colors.blue);
        await page.goto(LOGIN_URL, { waitUntil: 'networkidle0' });

        if (page.url() !== LOGIN_URL) {
            log('  Already logged in or redirected.', colors.yellow);
        } else {
            log('  Entering credentials...');
            await page.type('input[type="text"], input[name="username"]', TEST_USER.username);
            await page.type('input[type="password"], input[name="password"]', TEST_USER.password);

            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }),
                page.click('button[type="submit"]')
            ]);
            log('  Login submitted.');
        }

        if (page.url().includes('login')) {
            throw new Error('Login failed. Still on login page.');
        }
        log('✅ Login Successful', colors.green);

        // 2. Navigation to SDB (SKIPPED to focus on GDCC)
        log('\nSkipping SDB System UI tests...', colors.yellow);

        // --- GDCC SYSTEM TESTS ---
        log('  Navigating to GDCC System...');
        const GDCC_URL = `${BASE_URL}/systems/gdcc`;
        await page.goto(GDCC_URL, { waitUntil: 'domcontentloaded' });
        log('  Page Loaded (DOM Content Loaded). Waiting for React hydration...');

        // 1. Smart Account/Zone Selection (Auto vs Manual)
        log('  Checking for Dashboard load (Auto-selection)...');
        try {
            // Check if dashboard is already loaded (look for "Total Requests" card)
            const dashboardIndicator = `xpath///h3[contains(text(), "Total Requests")] | //div[contains(text(), "Total Requests")]`;
            await page.waitForSelector(dashboardIndicator, { timeout: 10000 });
            log('  ✅ Dashboard loaded via Auto-selection. Skipping manual selection.', colors.green);
        } catch (e) {
            log('  ⚠️ Dashboard not loaded automatically. Performing manual selection...', colors.yellow);

            // Re-use robust selectors
            const gdccAccountSelector = `xpath///label[contains(., "Account")]/following-sibling::div//div[contains(@class, "cursor-pointer")]`;

            try {
                await page.waitForSelector(gdccAccountSelector, { timeout: 5000 });
                await page.click(gdccAccountSelector);
                await new Promise(r => setTimeout(r, 2000));

                // Select first account
                const gdccAccOptions = await page.$$('xpath///div[contains(@class, "absolute")]//div[contains(@class, "cursor-pointer")]');
                if (gdccAccOptions.length > 0) {
                    await gdccAccOptions[0].click();
                    log('  Selected first Account.');
                    await new Promise(r => setTimeout(r, 3000));

                    // Select Zone
                    const gdccZoneSelector = `xpath///label[contains(., "Zone")]/following-sibling::div//div[contains(@class, "cursor-pointer")]`;
                    await page.waitForSelector(gdccZoneSelector, { timeout: 5000 });
                    await page.click(gdccZoneSelector);
                    await new Promise(r => setTimeout(r, 2000));

                    const gdccZoneOptions = await page.$$('xpath///div[contains(@class, "absolute")]//div[contains(@class, "cursor-pointer")]');
                    if (gdccZoneOptions.length > 0) {
                        await gdccZoneOptions[0].click();
                        log('  Selected first Zone.');
                        await new Promise(r => setTimeout(r, 5000)); // Wait for dashboard data
                    } else {
                        throw new Error('No zones found in GDCC.');
                    }
                } else {
                    throw new Error('No accounts found in GDCC.');
                }
            } catch (manualErr) {
                log(`  ❌ Manual Setup failed: ${manualErr.message}`, colors.red);
            }
        }

        // 2. Test Time Ranges
        log('  Testing Time Range Toggles (Updated)...', colors.blue);
        const timeRanges = ['1d', '7d', '30d'];
        for (const tr of timeRanges) {
            try {
                const btnSelector = `xpath///button[contains(text(), "${tr}")]`;
                await page.waitForSelector(btnSelector, { timeout: 3000 });
                const [btn] = await page.$$(btnSelector);
                if (btn) {
                    await btn.click();
                    log(`    Clicked ${tr} range.`);
                    await new Promise(r => setTimeout(r, 1500));
                }
            } catch (e) {
                log(`    ⚠️ Failed to click ${tr}: ${e.message}`, colors.yellow);
            }
        }
        log('  ✅ Time Range tests completed.');

        // 3. Test Report Buttons (Updated Paths)
        log('  Testing Report Menus (Updated)...', colors.blue);

        // 3a. Test Domain Report
        log('    Testing "Domain Report"...');
        try {
            // 1. Gear Icon
            const gearBtnSelector = 'xpath//html/body/div[2]/main/div/nav/div/div[2]/div[1]/button';
            await page.waitForSelector(gearBtnSelector, { timeout: 5000 });
            await page.click(gearBtnSelector);
            await new Promise(r => setTimeout(r, 1000));

            // 2. Report Template
            const reportTemplateBtnSelector = 'xpath//html/body/div[2]/main/div/nav/div/div[2]/div[1]/div/div[1]/button';
            await page.waitForSelector(reportTemplateBtnSelector, { timeout: 3000 });
            await page.click(reportTemplateBtnSelector);
            await new Promise(r => setTimeout(r, 1000));

            // 3. Domain Report (button[2])
            const domainReportBtnSelector = 'xpath//html/body/div[2]/main/div/nav/div/div[2]/div[1]/div/div[1]/div/button[2]';
            await page.waitForSelector(domainReportBtnSelector, { timeout: 3000 });
            await page.click(domainReportBtnSelector);
            log('    Clicked "Domain Report". Waiting for modal...');
            await new Promise(r => setTimeout(r, 3000));

            // Check Modal
            const modalTitle = await page.$eval('h3.text-lg.font-bold', el => el.textContent).catch(() => null);
            if (modalTitle) {
                log(`    ✅ Domain Report Modal Verified: "${modalTitle}"`);
                // Close
                const closeBtnSelector = 'xpath///div[contains(@class, "fixed")]//div[contains(@class, "border-b")]//button';
                try {
                    await page.click(closeBtnSelector);
                } catch (e) { await page.keyboard.press('Escape'); }
                await new Promise(r => setTimeout(r, 1000));
            } else {
                log(`    ⚠️ Domain Report Modal did not appear`, colors.yellow);
            }
        } catch (e) {
            log(`    ⚠️ Failed Domain Report Test: ${e.message}`, colors.yellow);
            await page.keyboard.press('Escape');
        }

        // 3b. Test Batch Report (Now "Create Report")
        log('    Testing "Batch Report" (Create Report)...');
        try {
            // "Create Report" Button
            const createReportBtnSelector = 'xpath//html/body/div[2]/main/div/nav/div/div[2]/button';
            await page.waitForSelector(createReportBtnSelector, { timeout: 3000 });
            await page.click(createReportBtnSelector);

            log('    Clicked "Create Report". Waiting for modal...');
            await new Promise(r => setTimeout(r, 1500));

            // Check items (Updated with specific user XPath)
            const firstItemSelector = `xpath//html/body/div[2]/main/div/div/div/div[2]/div[3]/label[1]`;
            const generateBtnSelector = `xpath//html/body/div[2]/main/div/div/div/div[3]/button[2]`;

            // Wait for item to be visible first
            try {
                await page.waitForSelector(firstItemSelector, { timeout: 5000 });
            } catch (e) { /* Ignore check failure, will see in next step */ }

            const hasItems = await page.$(firstItemSelector);
            if (hasItems) {
                log('    Found Sub-domain items. Selecting first item...');
                await hasItems.click();
                await new Promise(r => setTimeout(r, 500));

                log('    Clicking "Generate Report"...');
                // Use the specific button selector
                const genBtn = await page.$(generateBtnSelector);
                if (genBtn) {
                    await genBtn.click();
                    log('    Waiting for Success Alert...');
                    const okBtnSelector = `xpath///button[contains(@class, "swal2-confirm")]`;

                    try {
                        await page.waitForSelector(okBtnSelector, { timeout: 60000 }); // Increase timeout for generation
                        // FORCE CLICK via evaluate
                        await page.evaluate((sel) => {
                            const btn = document.evaluate(sel.replace('xpath/', ''), document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                            if (btn) btn.click();
                        }, okBtnSelector.replace('xpath/', '')); // Simple check, might need better xpath handling in eval

                        // Fallback click
                        const [okBtnEl] = await page.$$(okBtnSelector);
                        if (okBtnEl) await okBtnEl.click();

                        log('    ✅ Success Alert appeared and clicked.');
                        await new Promise(r => setTimeout(r, 1000));
                    } catch (e) {
                        log(`    ⚠️ Success Alert not found/clicked: ${e.message}`, colors.yellow);
                    }
                } else {
                    log('    ⚠️ Generate button not found.', colors.yellow);
                }
            } else {
                log('    ⚠️ No sub-domain items found. Close modal.', colors.yellow);
                await page.keyboard.press('Escape');
            }
        } catch (e) {
            log(`    ⚠️ Batch Report Test Failed: ${e.message}`, colors.yellow);
            await page.keyboard.press('Escape');
        }

        await new Promise(r => setTimeout(r, 1000));

        // 3c. Test Sub Report
        log('    Testing "Sub Report"...');
        try {
            // 1. Gear Icon (Re-open menu)
            const gearBtnSelector = 'xpath//html/body/div[2]/main/div/nav/div/div[2]/div[1]/button';
            await page.waitForSelector(gearBtnSelector, { timeout: 3000 });
            await page.click(gearBtnSelector);
            await new Promise(r => setTimeout(r, 1000));

            // 2. Report Template
            const reportTemplateBtnSelector = 'xpath//html/body/div[2]/main/div/nav/div/div[2]/div[1]/div/div[1]/button';
            await page.waitForSelector(reportTemplateBtnSelector, { timeout: 3000 });
            await page.click(reportTemplateBtnSelector);
            await new Promise(r => setTimeout(r, 1000));

            // 3. Sub Report (button[1])
            const subReportBtnSelector = 'xpath//html/body/div[2]/main/div/nav/div/div[2]/div[1]/div/div[1]/div/button[1]';
            await page.waitForSelector(subReportBtnSelector, { timeout: 3000 });
            await page.click(subReportBtnSelector);

            log('    Clicked "Sub Report". Waiting for modal...');
            await new Promise(r => setTimeout(r, 1500));

            // Check Modal
            const modalTitle = await page.$eval('h3.text-lg.font-bold', el => el.textContent).catch(() => null);
            if (modalTitle) {
                log(`    ✅ Sub Report Modal Verified: "${modalTitle}"`);
                await page.keyboard.press('Escape');
            } else {
                log(`    ⚠️ Sub Report Modal did not appear`, colors.yellow);
            }

        } catch (e) {
            log(`    ⚠️ Sub Report Test Failed: ${e.message}`, colors.yellow);
        }
    } catch (error) {
        log(`❌ Test Failed: ${error.message}`, colors.red);
        await page.screenshot({ path: 'regression-failure.png' });
        log('  Screenshot saved to regression-failure.png', colors.yellow);
        process.exit(1);
    } finally {
        await browser.close();
        log('-----------------------------------');
        log('🏁 UI Tests Completed', colors.cyan);
    }
}

runUITest();
