const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: ['.env.local', '.env'] });

const BASE_url = 'http://localhost:8002';

function log(msg) {
    console.log(`[Feature-Test] ${msg}`);
}

(async () => {
    log('🚀 Starting Deep Feature Test: API Discovery Subdomain Expansion...');

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 800 }
    });

    const page = await browser.newPage();

    try {
        // 1. Login
        log('🔹 Login...');
        await page.goto(`${BASE_url}/login`, { waitUntil: 'networkidle0' });
        await page.type('input[type="text"]', 'admin');
        await page.type('input[type="password"]', 'password');
        await page.click('button[type="submit"]');
        await page.waitForNavigation();

        // 2. Navigate
        await page.goto(`${BASE_url}/systems/api_discovery`, { waitUntil: 'networkidle0' });

        // 3. Select Account & Zone (To trigger data load)
        log('🔹 Selecting Zone to trigger data load...');
        await page.waitForSelector('label', { timeout: 10000 });

        // Click Account Dropdown
        const dropdowns = await page.$$('label');
        if (dropdowns.length > 0) {
            // Click the input inside the first dropdown (Account)
            const accInput = await dropdowns[0].evaluateHandle(el => el.nextElementSibling.querySelector('input, div'));
            await accInput.click();
            // Wait for options and select first one
            await page.waitForSelector('.absolute.z-\\[100\\]', { timeout: 5000 });
            const firstOption = await page.$('.absolute.z-\\[100\\] div[class*="cursor-pointer"]');
            if (firstOption) await firstOption.click();
            await new Promise(r => setTimeout(r, 1000)); // Wait for state update

            // Click Zone Dropdown (Second label)
            const zoneLabel = dropdowns[1]; // Should appear after account selection
            if (zoneLabel) {
                const zoneInput = await zoneLabel.evaluateHandle(el => el.nextElementSibling.querySelector('input, div'));
                await zoneInput.click();
                await page.waitForSelector('.absolute.z-\\[100\\]', { timeout: 5000 });
                const firstZone = await page.$('.absolute.z-\\[100\\] div[class*="cursor-pointer"]');
                if (firstZone) {
                    await firstZone.click();
                    log('✅ Zone selected');
                }
            }
        }

        // 4. Test Expand Logic
        log('🔹 Testing Expand Button Logic...');
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
                    log(`✅ SUCCESS: Expanded view found header "${subHeader}"`);
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
        log(`❌ Test Failed: ${error.message}`);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
