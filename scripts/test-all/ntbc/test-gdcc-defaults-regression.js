/**
 * E2E Regression Test: GDCC Dashboard Defaults Setting
 * Verifies that the Account, Zone, and Subdomain selectors support "Set Default"
 * and correctly load defaults on mount.
 */

const path = require('path');
const fs = require('fs');
const { setupBrowser, setupPage, login, log, colors, BASE_URL } = require('../libs/ui-helper');
const { navigateToGDCC, selectDropdown } = require('../libs/gdcc-helper');

const GDCC_TEST_CONFIG = {
    account_name: 'Government Data Center and Cloud service (GDCC)',
    zone_name: 'alro.go.th',
    subdomain: 'ALL_SUBDOMAINS'
};

(async () => {
    log('🚀 Starting GDCC Defaults Regression Test...', colors.cyan);
    
    // Run in headless mode for CI/silent run
    process.env.HEADLESS = '1';
    
    const browser = await setupBrowser();
    let page;
    try {
        page = await setupPage(browser);
        
        await login(page);

        log('\n🔹 Step 1: Navigating to GDCC Dashboard...', colors.blue);
        await navigateToGDCC(page);

        log('\n🔹 Step 2: Clearing existing localStorage defaults for GDCC...', colors.blue);
        await page.evaluate(() => {
            const userSess = localStorage.getItem('sdb_session');
            if (userSess) {
                const user = JSON.parse(userSess);
                const userKey = String(user.id);
                localStorage.removeItem(`gdcc:dashboard:${userKey}:accountId`);
                localStorage.removeItem(`gdcc:dashboard:${userKey}:zoneId`);
                localStorage.removeItem(`gdcc:dashboard:${userKey}:subdomain`);
                console.log('🧹 Cleared defaults for user:', userKey);
            }
        });

        log('\n🔹 Step 3: Refreshing page to start from clean state...', colors.blue);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('main', { visible: true, timeout: 20000 });
        await new Promise(r => setTimeout(r, 2000));

        log('\n🔹 Step 4: Manually selecting Account, Zone, and Subdomain...', colors.blue);
        
        log(`   - Selecting Account: ${GDCC_TEST_CONFIG.account_name}`, colors.gray);
        const acctOk = await selectDropdown(page, 0, GDCC_TEST_CONFIG.account_name);
        if (!acctOk) throw new Error('Failed to select Account');

        // Click "Set Default" on Account
        log(`   - Clicking "Set Default" on Account...`, colors.gray);
        await page.evaluate(() => {
            const grid = document.querySelector('main div.grid');
            if (!grid) throw new Error('Selector grid container not found');
            const dropdowns = grid.children;
            const accountDropdown = dropdowns[0];
            const btn = accountDropdown.querySelector('button');
            if (!btn) throw new Error('Account Set Default button not found');
            btn.click();
        });
        await new Promise(r => setTimeout(r, 1500)); // wait for Swal confirmation alert to auto-close

        log(`   - Selecting Zone: ${GDCC_TEST_CONFIG.zone_name}`, colors.gray);
        const zoneOk = await selectDropdown(page, 1, GDCC_TEST_CONFIG.zone_name);
        if (!zoneOk) throw new Error('Failed to select Zone');

        // Click "Set Default" on Zone
        log(`   - Clicking "Set Default" on Zone...`, colors.gray);
        await page.evaluate(() => {
            const grid = document.querySelector('main div.grid');
            const dropdowns = grid.children;
            const zoneDropdown = dropdowns[1];
            const btn = zoneDropdown.querySelector('button');
            if (!btn) throw new Error('Zone Set Default button not found');
            btn.click();
        });
        await new Promise(r => setTimeout(r, 1500));

        log(`   - Selecting Subdomain: ALL_SUBDOMAINS`, colors.gray);
        const subOk = await selectDropdown(page, 2, 'Zone Overview');
        if (!subOk) throw new Error('Failed to select Subdomain');

        // Click "Set Default" on Subdomain
        log(`   - Clicking "Set Default" on Subdomain...`, colors.gray);
        await page.evaluate(() => {
            const grid = document.querySelector('main div.grid');
            const dropdowns = grid.children;
            const subDropdown = dropdowns[2];
            const btn = subDropdown.querySelector('button');
            if (!btn) throw new Error('Subdomain Set Default button not found');
            btn.click();
        });
        await new Promise(r => setTimeout(r, 1500));

        log('\n🔹 Step 5: Refreshing page to verify defaults auto-load...', colors.blue);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('main', { visible: true, timeout: 20000 });
        
        // Wait for cascade load to finish (up to 15 seconds)
        log('   - Waiting for cascade selectors to auto-load values...', colors.gray);
        await page.waitForFunction(() => {
            const grid = document.querySelector('main div.grid');
            if (!grid || grid.children.length < 3) return false;
            
            // Check dropdown value texts (they should be matching our selections instead of placeholders)
            const getDropdownVal = (el) => {
                const span = el.querySelector('span.truncate');
                return span ? (span.textContent || '').trim() : '';
            };
            
            const accVal = getDropdownVal(grid.children[0]);
            const zoneVal = getDropdownVal(grid.children[1]);
            const subVal = getDropdownVal(grid.children[2]);
            
            return accVal.includes('Government Data Center') &&
                   zoneVal.includes('alro.go.th') &&
                   subVal.includes('Zone Overview');
        }, { timeout: 20000 });

        log('\n🎉 SUCCESS: All dashboard defaults saved and loaded successfully in cascade order!', colors.green);

    } catch (error) {
        log(`\n❌ Defaults test FAILED: ${error.message}`, colors.red);
        if (error.stack) console.error(error.stack);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})();
