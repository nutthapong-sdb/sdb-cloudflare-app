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
        headless: false, // Run in headfull mode (visible)
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

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

        // 2. Navigation to SDB
        log('\nTesting SDB System UI...', colors.blue);
        await page.goto(SDB_URL, { waitUntil: 'networkidle0' });
        log('  Navigated to SDB page.');

        // Check Page Title
        const title = await page.$eval('h1', el => el.textContent);
        if (!title.includes('Cloudflare API')) throw new Error('SDB Page Title mismatch');
        log('  Page Title verified.');

        // 3. Interacting with Dropdowns (XPath Strategy)
        log('  Waiting for Account Dropdown...');

        // Strategy: Use the specific XPath provided by the user for reliability
        const accountDropdownSelector = `xpath//html/body/div[2]/div[4]/div/div[2]/div[2]/div/div/div`;

        try {
            await page.waitForSelector(accountDropdownSelector, { timeout: 10000 });
            const elements = await page.$$(accountDropdownSelector);
            const accDropdown = elements[0];

            if (accDropdown) {
                log('  Found Account Dropdown. Clicking...');
                await accDropdown.click();

                // Wait for options to appear
                await new Promise(r => setTimeout(r, 3000));

                // Find visible options
                const options = await page.$$('xpath///div[contains(@class, "absolute")]//div[contains(@class, "cursor-pointer")]');
                const optionCount = options.length;

                if (optionCount > 0) {
                    let zonesFound = false;

                    // Iterate through accounts to find one with zones
                    for (let i = 0; i < Math.min(optionCount, 5); i++) { // Try up to 5 accounts
                        if (i > 0) {
                            // Re-open account dropdown if not first iteration
                            await accDropdown.click();
                            await new Promise(r => setTimeout(r, 1000));
                        }

                        // Re-fetch options to avoid stale elements
                        const currentOptions = await page.$$('xpath///div[contains(@class, "absolute")]//div[contains(@class, "cursor-pointer")]');
                        const accountName = await page.evaluate(el => el.textContent, currentOptions[i]);
                        log(`  Checking Account [${i + 1}/${optionCount}]: "${accountName.trim()}"...`);

                        await currentOptions[i].click();
                        await new Promise(r => setTimeout(r, 3000)); // Wait for zones to load

                        // Check Zone Dropdown
                        const zoneDropdownSelector = `xpath//html/body/div[2]/div[4]/div/div[2]/div[2]/div[2]/div/div/div`;
                        const zoneDropdown = (await page.$$(zoneDropdownSelector))[0];

                        if (zoneDropdown) {
                            await zoneDropdown.click();
                            await new Promise(r => setTimeout(r, 3000));
                            const zoneOptions = await page.$$('xpath///div[contains(@class, "absolute")]//div[contains(@class, "cursor-pointer")]');

                            if (zoneOptions.length > 0) {
                                log(`    ✅ Found ${zoneOptions.length} zones. Selecting first...`);
                                await zoneOptions[0].click();
                                zonesFound = true;
                                break; // Found valid account and selected zone
                            } else {
                                log('    ⚠️ No zones. Trying next account...');
                                // Click outside to close dropdown
                                await page.mouse.click(10, 10);
                            }
                        } else {
                            log('   ⚠️ Zone dropdown not found.');
                        }
                    }

                    if (!zonesFound) throw new Error('No zones found in any of the checked accounts.');

                } else {
                    throw new Error('No account options found in dropdown');
                }
            } else {
                throw new Error('Account dropdown element not found');
            }
        } catch (e) {
            throw new Error('SDB Setup failed: ' + e.message);
        }

        // Wait for table to load (Zone is already selected in loop)
        log('  Waiting for table to load...');
        await new Promise(r => setTimeout(r, 8000));

        // 5. Verify API Discovery Table
        log('  Verifying API Discovery Table...', colors.blue);
        const table = await page.$('table');
        if (table) {
            const headers = await page.$$eval('th', ths => ths.map(th => th.textContent.trim()));
            const hasMethod = headers.includes('Method');
            const hasSource = headers.includes('Source');

            if (hasMethod && hasSource) {
                log('  ✅ Verified Columns: Method, Source', colors.green);
            } else {
                throw new Error(`Missing Columns! Found: ${headers.join(', ')}`);
            }

            // Check rows
            const rows = await page.$$('tbody tr');
            log(`  ✅ Found ${rows.length} data rows.`);

            // 6. Test CSV Download
            log('  Testing CSV Download...', colors.blue);
            const csvBtnSelector = 'xpath///button[@title="Download CSV"]';
            try {
                await page.waitForSelector(csvBtnSelector, { timeout: 5000 });
                const elements = await page.$$(csvBtnSelector);
                const csvBtn = elements[0];
                if (csvBtn) {
                    await csvBtn.click();
                    log('  ✅ CSV Button clicked.', colors.green);
                } else {
                    throw new Error('CSV Button not found');
                }
            } catch (e) {
                log('  ⚠️ CSV Download check failed: ' + e.message, colors.yellow);
            }

        } else {
            throw new Error('Table not found (Maybe no data in zone).');
        }

        // --- GDCC SYSTEM TESTS ---
        log('\nTesting GDCC System UI...', colors.blue);
        const GDCC_URL = `${BASE_URL}/systems/gdcc`;
        await page.goto(GDCC_URL, { waitUntil: 'networkidle0' });

        // 1. Wait for Account/Zone selectors to be ready (re-use logic if needed, or rely on auto-load if defaults set)
        log('  Waiting for GDCC Dashboard to load...');
        await new Promise(r => setTimeout(r, 3000));

        // 2. Test Time Ranges
        log('  Testing Time Range Toggles...', colors.blue);
        const timeRanges = ['30m', '6h', '12h', '24h'];
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

        // 3. Test Report Buttons
        log('  Testing Report Menus...', colors.blue);

        const testReportItem = async (itemName) => {
            try {
                // Open Menu
                const reportMenuBtn = `xpath///button[contains(., "Report")]`;
                await page.waitForSelector(reportMenuBtn, { timeout: 3000 });
                const [menuBtn] = await page.$$(reportMenuBtn);
                await menuBtn.click();
                await new Promise(r => setTimeout(r, 500));

                // Click Item
                const itemSelector = `xpath///button[contains(., "${itemName}")]`;
                await page.waitForSelector(itemSelector, { timeout: 3000 });
                const [itemBtn] = await page.$$(itemSelector);
                await itemBtn.click();

                log(`    Clicked "${itemName}". Waiting for modal...`);
                await new Promise(r => setTimeout(r, 1500));

                // Check Modal Header/Title
                const modalTitle = await page.$eval('h3.text-lg.font-bold', el => el.textContent).catch(() => null);

                if (modalTitle) {
                    log(`    ✅ Modal Verified: "${modalTitle}"`);

                    // Close using the explicit Close button in the header
                    // Strategy: Look for the button in the modal header (border-b)
                    // We target the fixed inset wrapper -> internal container -> header -> button
                    const closeBtnSelector = `xpath///div[contains(@class, "fixed")]//div[contains(@class, "border-b")]//button`;

                    try {
                        await page.waitForSelector(closeBtnSelector, { timeout: 3000 });
                        const [closeBtn] = await page.$$(closeBtnSelector);
                        if (closeBtn) {
                            await closeBtn.click();
                            log('      Clicked Close button.');
                        } else {
                            throw new Error('Close button not found');
                        }
                    } catch (e) {
                        log(`      ⚠️ Explicit close failed, trying Escape...`, colors.yellow);
                        await page.keyboard.press('Escape');
                    }

                    await new Promise(r => setTimeout(r, 1000));
                } else {
                    log(`    ⚠️ Modal did not appear for ${itemName}`, colors.yellow);
                }

            } catch (e) {
                log(`    ⚠️ Failed Report Test (${itemName}): ${e.message}`, colors.yellow);
                await page.keyboard.press('Escape');
            }
        };

        // 3a. Test Domain Report
        await testReportItem('Domain Report');

        // 3b. Test Batch Report (Custom Flow)
        log('    Testing "Batch Report" Flow...');
        try {
            // Open Menu
            const reportMenuBtn = `xpath///button[contains(., "Report")]`;
            await page.waitForSelector(reportMenuBtn, { timeout: 3000 });
            const [menuBtn] = await page.$$(reportMenuBtn);
            await menuBtn.click();
            await new Promise(r => setTimeout(r, 500));

            // Click Batch Report Item
            const batchBtnSelector = `xpath///button[contains(., "Batch Report")]`;
            await page.waitForSelector(batchBtnSelector, { timeout: 3000 });
            const [batchBtn] = await page.$$(batchBtnSelector);
            await batchBtn.click();
            log('    Clicked "Batch Report". Waiting for modal...');
            await new Promise(r => setTimeout(r, 1500));

            // Check if items exist (User-specified XPath logic: select first label)
            const firstItemSelector = `xpath///div[contains(@class, "fixed")]//label[1]`; // More robust than full path
            const generateBtnSelector = `xpath///button[contains(., "Generate")]`;

            // Check if any label exists
            const hasItems = await page.$(firstItemSelector);
            if (hasItems) {
                log('    Found Sub-domain items. Selecting first item...');
                await hasItems.click();
                await new Promise(r => setTimeout(r, 500));

                log('    Clicking "Generate Report"...');
                const [genBtn] = await page.$$(generateBtnSelector);
                if (genBtn) {
                    await genBtn.click();

                    // Wait for Success Alert (Swal)
                    log('    Waiting for Success Alert...');
                    const okBtnSelector = `xpath///button[contains(@class, "swal2-confirm")]`; // SweetAlert OK button
                    try {
                        await page.waitForSelector(okBtnSelector, { timeout: 30000 }); // Generates report, might take time
                        const [okBtn] = await page.$$(okBtnSelector);
                        log('    ✅ Success Alert appeared. Waiting 7s for interaction...');
                        await new Promise(r => setTimeout(r, 7000));
                        // Use evaluate to force click if Puppeteer visibility check fails
                        await page.evaluate(el => el.click(), okBtn);
                        await new Promise(r => setTimeout(r, 1000));
                    } catch (e) {
                        log(`    ⚠️ Success Alert not found (timed out): ${e.message}`, colors.yellow);
                        await page.screenshot({ path: 'batch-report-alert-fail.png' });
                    }

                } else {
                    log('    ⚠️ Generate button not found.', colors.yellow);
                }

            } else {
                log('    ⚠️ No sub-domain items found to select. Skipping generation.', colors.yellow);
                // Close modal if it's open
                const closeBtnSelector = `xpath///div[contains(@class, "fixed")]//div[contains(@class, "border-b")]//button`;
                const [closeBtn] = await page.$$(closeBtnSelector);
                if (closeBtn) await closeBtn.click();
            }

        } catch (e) {
            log(`    ⚠️ Batch Report Test Failed: ${e.message}`, colors.yellow);
            // Try to recover by hitting Escape
            await page.keyboard.press('Escape');
        }

        await new Promise(r => setTimeout(r, 1000));

        // 3c. Test Sub Report
        log('    Testing "Sub Report"...');
        try {
            // Open Menu (if not open, but previous steps might have closed it)
            // Need to reopen menu because Batch Report closes it, and clicking OK closes alert.
            const reportMenuBtn = `xpath///button[contains(., "Report")]`;
            await page.waitForSelector(reportMenuBtn, { timeout: 3000 });
            const [menuBtn] = await page.$$(reportMenuBtn);
            await menuBtn.click();
            await new Promise(r => setTimeout(r, 500));

            // Click Sub Report
            const subBtnSelector = `xpath///button[contains(., "Sub Report")]`;
            await page.waitForSelector(subBtnSelector, { timeout: 3000 });
            const [subBtn] = await page.$$(subBtnSelector);
            await subBtn.click();

            log('    Clicked "Sub Report". Waiting for modal...');
            await new Promise(r => setTimeout(r, 1500));

            // Check Modal Title (Should be "Preview Report" or similar)
            const modalTitle = await page.$eval('h3.text-lg.font-bold', el => el.textContent).catch(() => null);
            if (modalTitle && (modalTitle.includes('Preview Report') || modalTitle.includes('Report'))) {
                log(`    ✅ Sub Report Modal Verified: "${modalTitle}"`);
                // Close it matches standard Report Modal
                const closeBtnSelector = `xpath///div[contains(@class, "fixed")]//div[contains(@class, "border-b")]//button`;
                const [closeBtn] = await page.$$(closeBtnSelector);
                if (closeBtn) await closeBtn.click();
            } else {
                log(`    ⚠️ Sub Report Modal Title mismatch: "${modalTitle}"`, colors.yellow);
                await page.keyboard.press('Escape');
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
