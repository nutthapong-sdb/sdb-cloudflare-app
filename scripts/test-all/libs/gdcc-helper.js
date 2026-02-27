/**
 * GDCC UI Helper
 * Shared logic for interacting with the GDCC Dashboard page via Puppeteer.
 * Logic is based on the working implementation in scripts/auto-report-runner.js
 */

const { log, colors, BASE_URL } = require('./ui-helper');

// Default GDCC test config - matches real data
const GDCC_TEST_CONFIG = {
    account_name: 'Government Data Center and Cloud service (GDCC)',
    zone_name: 'dwf.go.th',
    subdomain: 'ALL_SUBDOMAINS',
};

/**
 * Select from a "cursor-pointer div" style SearchableDropdown
 * Used in Firewall Logs and API Discovery pages (which differ from GDCC's tabindex-based dropdown).
 *
 * Strategy:
 * 1. Find all div[cursor-pointer] elements that look like dropdown triggers
 * 2. Click the Nth one (by dropdownIndex)
 * 3. Wait for `input[placeholder="Search..."]` to appear
 * 4. Type searchText, wait for items, click match
 *
 * @param {object} page - Puppeteer page
 * @param {number} dropdownIndex - 0=Account, 1=Zone
 * @param {string} searchText - text to search and select
 * @returns {boolean}
 */
async function selectCursorDropdown(page, dropdownIndex, searchText) {
    // Find all clickable "trigger" divs (div with cursor-pointer class)
    const triggers = await page.$$('div.cursor-pointer');
    if (triggers.length <= dropdownIndex) {
        log(`❌ Cursor dropdown at index ${dropdownIndex} not found (${triggers.length} found).`, colors.red);
        return false;
    }

    // Click trigger using evaluate to ensure React onClick fires
    let popupOpened = false;
    for (let attempt = 0; attempt < 5; attempt++) {
        // Use evaluate to dispatch a proper click on the correct trigger at index
        await page.evaluate((idx) => {
            const divs = Array.from(document.querySelectorAll('div.cursor-pointer'));
            if (divs[idx]) divs[idx].click();
        }, dropdownIndex);
        await new Promise(r => setTimeout(r, 800));
        const inputs = await page.$$('input[placeholder="Search..."], input[placeholder="พิมพ์เพื่อค้นหา..."]');
        if (inputs.length > 0) { popupOpened = true; break; }
    }
    if (!popupOpened) {
        log(`❌ Dropdown popup at index ${dropdownIndex} did not open.`, colors.red);
        return false;
    }

    // Type in search
    const inputs = await page.$$('input[placeholder="Search..."], input[placeholder="พิมพ์เพื่อค้นหา..."]');
    const activeInput = inputs[inputs.length - 1];
    await page.evaluate(input => {
        input.focus();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }, activeInput);
    await activeInput.type(searchText);
    await new Promise(r => setTimeout(r, 800));

    // Wait for dropdown list items
    try {
        await page.waitForFunction(() => {
            const items = document.querySelectorAll('div.absolute.z-\\[100\\] div, div[class*="absolute"][class*="z-[100]"] div');
            if (items.length > 0) {
                const txt = items[0].textContent || '';
                if (txt.includes('Loading...') || txt.includes('กำลังโหลด...')) return false;
                return true;
            }
            return false;
        }, { timeout: 10000 });
    } catch (e) {
        log(`⚠️ Dropdown items timeout at index ${dropdownIndex}.`, colors.yellow);
    }

    // Find matching item and click
    log(`   🔎 Searching for item matching: "${searchText}"`, colors.gray);
    const clickResult = await page.evaluate((text) => {
        const searchTextLower = text.trim().toLowerCase();
        // Broader search for items - any element inside the dropdown container
        const container = document.querySelector('div.absolute.z-\\[100\\], div[class*="absolute"][class*="z-[100]"]');
        if (!container) return { success: false, reason: 'No dropdown container found' };

        const items = Array.from(container.querySelectorAll('*'));
        console.log(`Dropdown container has ${items.length} sub-elements`);

        for (const item of items) {
            const t = (item.textContent || '').trim().toLowerCase();
            // Log the first few items to console if we are failing
            if (items.length < 5) console.log(`Item text: "${t}"`);

            if (t.includes(searchTextLower)) {
                // Determine the best element to click: the one with onMouseDown or a specific class
                const target = item.closest('[onmousedown]') || item.closest('div.cursor-pointer') || item;
                console.log(`Matched! Clicking target with text: "${target.textContent.substring(0, 20)}..."`);
                target.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                return { success: true, matchedText: t };
            }
        }
        return { success: false, itemsFound: items.length, firstItemText: items[0]?.textContent };
    }, searchText);

    if (!clickResult.success) {
        log(`❌ Match failed: ${clickResult.reason || 'Not found'}. Found ${clickResult.itemsFound || 0} items. First: "${clickResult.firstItemText}"`, colors.red);
        return false;
    }
    log(`   ✅ Matched: "${clickResult.matchedText.substring(0, 40)}..."`, colors.green);
    await new Promise(r => setTimeout(r, 1000));
    return true;
}

/**
 * Navigate to GDCC page and wait for Account Dropdown to be ready.
 */
async function navigateToGDCC(page) {
    log('🔹 Navigating to GDCC System...', colors.blue);
    await page.goto(`${BASE_URL}/systems/gdcc`, { waitUntil: 'domcontentloaded' });

    // Wait for account dropdown trigger to appear
    await page.waitForSelector('div.relative > div[tabindex="0"]', { visible: true, timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500)); // extra settle time for API calls
    log('✅ GDCC page loaded.', colors.green);
}

/**
 * Interact with a SearchableDropdown by index position on the page.
 * Copied and adapted from auto-report-runner.js
 *
 * @param {object} page - Puppeteer page
 * @param {number} dropdownIndex - 0=Account, 1=Zone, 2=Subdomain
 * @param {string} searchText - Text to search/select
 * @returns {boolean} - true if selected successfully
 */
async function selectDropdown(page, dropdownIndex, searchText) {
    const dropdownTriggers = await page.$$('div.relative > div[tabindex="0"]');
    if (dropdownTriggers.length <= dropdownIndex) {
        log(`❌ Dropdown at index ${dropdownIndex} not found (only ${dropdownTriggers.length} found).`, colors.red);
        return false;
    }

    // Click Trigger - retry until search input appears
    let popupOpened = false;
    for (let attempt = 0; attempt < 10; attempt++) {
        await page.evaluate(el => el.click(), dropdownTriggers[dropdownIndex]);
        await new Promise(r => setTimeout(r, 1000));

        const searchInputs = await page.$$('input[placeholder="Search..."]');
        if (searchInputs.length > 0) {
            popupOpened = true;
            break;
        }
    }

    if (!popupOpened) {
        log(`❌ Dropdown popup did not open after retrying.`, colors.red);
        return false;
    }

    // Clear input and type search text
    const activeSearchInputs = await page.$$('input[placeholder="Search..."]');
    const activeInput = activeSearchInputs[activeSearchInputs.length - 1];

    await page.evaluate((input) => {
        input.focus();
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }, activeInput);

    await activeInput.type(searchText);
    await new Promise(r => setTimeout(r, 1000));

    // Wait for dropdown items to render
    try {
        await page.waitForFunction((textToFind) => {
            const items = document.querySelectorAll('div[class*="absolute z-[100]"] > div');
            if (items.length > 0) {
                const text = items[0].textContent;
                if (text && text.includes('Loading...')) return false;
                return true;
            }
            return false;
        }, { timeout: 10000 }, searchText);
    } catch (e) {
        log('⚠️ Timeout waiting for Dropdown items to load.', colors.yellow);
    }

    // Find and click the matching item
    const clickTargetHandle = await page.evaluateHandle((textToFind) => {
        const dropdownPopupList = document.querySelectorAll('div[class*="absolute z-[100]"] > div');
        for (const item of Array.from(dropdownPopupList)) {
            const labelDiv = item.querySelector('div.font-medium') || item;
            const textCont = labelDiv.textContent || '';
            if (textCont.trim().toLowerCase().includes(textToFind.trim().toLowerCase())) {
                return item;
            }
        }
        return null;
    }, searchText);

    if (clickTargetHandle && await clickTargetHandle.evaluate(el => el !== null)) {
        await page.evaluate((item) => {
            const event = new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true });
            item.dispatchEvent(event);
        }, clickTargetHandle);
        await clickTargetHandle.dispose();
    } else {
        const count = await page.evaluate(() => document.querySelectorAll('div[class*="absolute z-[100]"] > div').length);
        log(`❌ Could not select dropdown item: "${searchText}" (found ${count} items)`, colors.red);
        return false;
    }

    await new Promise(r => setTimeout(r, 1500));
    return true;
}

/**
 * Select Account → Zone → Subdomain in the GDCC Dashboard.
 * Waits for Subdomain list to be ready after Zone is selected.
 *
 * @param {object} page
 * @param {object} config - { account_name, zone_name, subdomain }
 */
async function selectGDCCFilters(page, config = GDCC_TEST_CONFIG) {
    // 1. Account
    log(`  -> Selecting Account: ${config.account_name}`, colors.gray);
    const acctOk = await selectDropdown(page, 0, config.account_name);
    if (!acctOk) throw new Error(`Failed to select Account: ${config.account_name}`);

    // 2. Zone
    log(`  -> Selecting Zone: ${config.zone_name}`, colors.gray);
    const zoneOk = await selectDropdown(page, 1, config.zone_name);
    if (!zoneOk) throw new Error(`Failed to select Zone: ${config.zone_name}`);

    // 3. Wait for Subdomain list to be ready
    log(`  -> Waiting for Subdomain list to load...`, colors.gray);
    try {
        await page.waitForFunction(() => {
            const triggers = document.querySelectorAll('div.relative > div[tabindex="0"]');
            if (triggers.length < 3) return false;
            const txt = triggers[2]?.textContent || '';
            return txt !== '' && !txt.includes('Select Zone first') && !txt.includes('Loading');
        }, { timeout: 15000 });
    } catch (e) {
        log(`⚠️ Subdomain dropdown did not become ready in time.`, colors.yellow);
    }

    // 4. Subdomain
    log(`  -> Selecting Subdomain: ${config.subdomain}`, colors.gray);
    const searchStr = config.subdomain === 'ALL_SUBDOMAINS' ? 'Zone Overview' : config.subdomain;
    const subOk = await selectDropdown(page, 2, searchStr);
    if (!subOk) throw new Error(`Failed to select Subdomain: ${config.subdomain}`);

    log(`✅ GDCC filters selected.`, colors.green);
}

/**
 * Click "Generate Dashboard" button and wait for data to load.
 */
async function clickGenerateDashboard(page) {
    await new Promise(r => setTimeout(r, 1000));
    const btns = await page.$$('button');
    let genBtn = null;
    for (const btn of btns) {
        const txt = await btn.evaluate(el => el.textContent?.trim() || '');
        const disabled = await btn.evaluate(el => el.disabled);
        if (txt === 'Generate Dashboard' && !disabled) {
            genBtn = btn;
        }
    }
    if (!genBtn) throw new Error('Generate Dashboard button not found or is disabled');

    await genBtn.click();
    log('📊 Clicked Generate Dashboard. Waiting for data...', colors.blue);

    // Wait for it to become enabled again (data loaded)
    try {
        await page.waitForFunction(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const gen = btns.find(b => b.textContent?.trim() === 'Generate Dashboard');
            return gen && !gen.disabled;
        }, { timeout: 90000 });
        log('✅ Traffic data loaded.', colors.green);
    } catch (e) {
        log('⚠️ Timed out waiting for data load. Continuing anyway...', colors.yellow);
    }
}

/**
 * Open "Create Report" Batch Modal and generate a Domain Report.
 * For zones with no subdomains (ALL_SUBDOMAINS config), selects "No Subdomain".
 *
 * @param {object} page
 * @param {string} reportDateStr - YYYY-MM-DD
 * @param {string} subdomain - config.subdomain (to decide whether to click No Subdomain or Select All)
 */
async function generateBatchReport(page, reportDateStr, subdomain = 'ALL_SUBDOMAINS') {
    // Open Create Report modal
    await new Promise(r => setTimeout(r, 1000));
    const btns = await page.$$('button');
    let createBtn = null;
    for (const btn of btns) {
        const txt = await btn.evaluate(el => el.textContent?.trim() || '');
        const disabled = await btn.evaluate(el => el.disabled);
        if (txt === 'Create Report' && !disabled) { createBtn = btn; break; }
    }
    if (!createBtn) throw new Error('"Create Report" button not found or disabled');
    await createBtn.click();
    log('📋 Batch Report modal opened.', colors.blue);
    await new Promise(r => setTimeout(r, 1500));

    // Set date range
    const batchDateInputs = await page.$$('input[type="date"]');
    if (batchDateInputs.length >= 2) {
        for (const di of [batchDateInputs[0], batchDateInputs[1]]) {
            await page.evaluate((el, val) => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, di, reportDateStr);
        }
        log(`📅 Date range set to ${reportDateStr}`, colors.gray);
    }

    // Select host(s)
    await new Promise(r => setTimeout(r, 500));
    if (subdomain === 'ALL_SUBDOMAINS') {
        // Zone has no real subdomains → click "No Subdomain" to generate Domain Report
        const labels = await page.$$('label');
        let noSubLabel = null;
        for (const lbl of labels) {
            const txt = await lbl.evaluate(el => el.textContent?.trim() || '');
            if (txt === 'No Subdomain') { noSubLabel = lbl; break; }
        }
        if (noSubLabel) {
            await noSubLabel.click();
            log('☑️ Selected "No Subdomain" (Domain Report mode).', colors.gray);
        } else {
            log('⚠️ "No Subdomain" label not found. Trying Select All fallback.', colors.yellow);
            const modalBtns = await page.$$('button');
            for (const btn of modalBtns) {
                const txt = await btn.evaluate(el => el.textContent?.trim() || '');
                if (txt.includes('Select All')) { await btn.click(); break; }
            }
        }
    } else {
        const modalBtns = await page.$$('button');
        for (const btn of modalBtns) {
            const txt = await btn.evaluate(el => el.textContent?.trim() || '');
            if (txt.includes('Select All')) { await btn.click(); break; }
        }
        log('☑️ Selected all hosts.', colors.gray);
    }

    // Click Generate
    await new Promise(r => setTimeout(r, 500));
    const generateBtns = await page.$$('button');
    let finalGenBtn = null;
    for (const btn of generateBtns) {
        const txt = await btn.evaluate(el => el.textContent?.trim() || '');
        const disabled = await btn.evaluate(el => el.disabled);
        if ((txt.includes('Generate') || txt.includes('Domain Report')) && !disabled) {
            finalGenBtn = btn;
        }
    }
    if (!finalGenBtn) throw new Error('Generate/Domain Report button not found in modal');
    await finalGenBtn.click();
    log('⏳ Report generation started...', colors.blue);
}

module.exports = {
    GDCC_TEST_CONFIG,
    navigateToGDCC,
    selectDropdown,
    selectCursorDropdown,
    selectGDCCFilters,
    clickGenerateDashboard,
    generateBatchReport,
};
