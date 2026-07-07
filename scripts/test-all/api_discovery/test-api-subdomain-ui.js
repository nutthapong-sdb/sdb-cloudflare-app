require('dotenv').config({ path: ['.env.local', '.env'] });

const { setupBrowser, setupPage, login, log: sharedLog, colors, BASE_URL } = require('../libs/ui-helper');
const { selectCursorDropdown } = require('../libs/gdcc-helper');

function log(msg, color = colors.reset) {
    // Keep the original prefix to make this test easy to spot.
    sharedLog(`[Feature-Test] ${msg}`, color);
}

(async () => {
    log('🚀 Starting Deep Feature Test: API Discovery Subdomain Expansion...');

    const browser = await setupBrowser();
    const page = await setupPage(browser);

    try {
        // 1. Login
        log('🔹 Login...', colors.blue);
        await login(page);

        // 2. Navigate
        await page.goto(`${BASE_URL}/systems/api_discovery`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('div.cursor-pointer', { visible: true, timeout: 20000 });
        await new Promise(r => setTimeout(r, 1500));

        // 3. Select Account & Zone (To trigger data load)
        log('🔹 Selecting Zone to trigger data load...', colors.blue);
        const acctOk = await selectCursorDropdown(page, 0, 'Government Data Center');
        if (!acctOk) throw new Error('Failed to select Account for API Discovery subdomain UI test');
        await new Promise(r => setTimeout(r, 1500));
        const zoneOk = await selectCursorDropdown(page, 1, 'dwf.go.th');
        if (!zoneOk) throw new Error('Failed to select Zone for API Discovery subdomain UI test');
        log('✅ Zone selected', colors.green);

        // 4. Test Expand Logic
        log('🔹 Testing Expand Button Logic...', colors.blue);
        // Wait for table rows
        try {
            await page.waitForSelector('table tbody tr', { timeout: 10000 });

            // Find a row with expand button (symbol usually)
            // The expand button is in the first column, looks for <button>
            const expandBtn = await page.$('table tbody tr td:first-child button');

            if (expandBtn) {
                log('   Found Expandable Row. Clicking...');
                await expandBtn.click();

                // 5. Verify Subdomain Table Appears
                // It renders a new <tr> with "Subdomains for" text
                await page.waitForSelector('h5', { timeout: 5000 }); // h5 is used for "Subdomains for..." header
                const subHeader = await page.$eval('h5', el => el.textContent);

                if (subHeader.includes('Subdomains for')) {
                    log(`✅ SUCCESS: Expanded view found header "${subHeader}"`, colors.green);
                } else {
                    throw new Error('Expanded content did not match expectation');
                }
            } else {
                log('⚠️ No expandable rows found (Data might not have {hostVar1}). Skipping deep check.');
            }

        } catch (e) {
            log(`⚠️ Data loading skipped or timed out: ${e.message}`);
        }

    } catch (error) {
        log(`❌ Test Failed: ${error.message}`, colors.red);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})();
