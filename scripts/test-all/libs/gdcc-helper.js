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
    // Note: option rows also use `cursor-pointer`, but they only exist after opening.
    const triggers = await page.$$('div.cursor-pointer');
    if (triggers.length <= dropdownIndex) {
        log(`❌ Cursor dropdown at index ${dropdownIndex} not found (${triggers.length} found).`, colors.red);
        return false;
    }

    // Best-effort: wait for trigger text to not be in a loading state.
    // This avoids opening an empty dropdown before async options have populated.
    try {
        await page.waitForFunction((idx) => {
            const divs = Array.from(document.querySelectorAll('div.cursor-pointer'));
            const el = divs[idx];
            if (!el) return false;
            const t = (el.textContent || '').trim();
            if (!t) return false;
            if (t.includes('Loading...') || t.includes('กำลังโหลด')) return false;
            return true;
        }, { timeout: 30000 }, dropdownIndex);
    } catch (_) {
        log(`⚠️ Cursor dropdown trigger at index ${dropdownIndex} still looks loading. Continuing...`, colors.yellow);
    }

    // Full selection can race the async options load (especially on API Discovery).
    // Retry end-to-end if the dropdown shows a "no results" placeholder.
    for (let overallAttempt = 0; overallAttempt < 4; overallAttempt++) {
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

        // Wait for dropdown list to contain actionable options (not Loading / not "no results")
        try {
            await page.waitForFunction(() => {
                const inputs = Array.from(document.querySelectorAll('input[placeholder="Search..."], input[placeholder="พิมพ์เพื่อค้นหา..."]'));
                const input = inputs[inputs.length - 1];
                if (!input) return false;

                // Search input lives in the trigger; menu is a sibling under the same root.
                const root = input.closest('div.space-y-1.relative') || input.closest('div.relative');
                if (!root) return false;

                const container = root.querySelector('div[class*="absolute"]');
                if (!container) return false;

                const txt = (container.textContent || '').trim();
                if (!txt) return false;
                if (txt.includes('Loading...') || txt.includes('กำลังโหลด...')) return false;
                if (txt.includes('ไม่พบข้อมูล') || txt.toLowerCase().includes('no results')) return false;

                // Options are rendered as clickable divs (Tailwind `cursor-pointer`) or elements with onMouseDown.
                const optionEls = container.querySelectorAll('div.cursor-pointer, [onmousedown]');
                return optionEls.length > 0;
            }, { timeout: 15000 });
        } catch (_) {
            log(`⚠️ Dropdown options not ready yet (index ${dropdownIndex}). Retrying...`, colors.yellow);
        }

        // Find matching item and click
        log(`   🔎 Searching for item matching: "${searchText}"`, colors.gray);
        const clickResult = await page.evaluate((text) => {
            const searchTextLower = (text || '').trim().toLowerCase();
            const inputs = Array.from(document.querySelectorAll('input[placeholder="Search..."], input[placeholder="พิมพ์เพื่อค้นหา..."]'));
            const input = inputs[inputs.length - 1];
            if (!input) return { success: false, reason: 'No search input found' };

            const root = input.closest('div.space-y-1.relative') || input.closest('div.relative');
            if (!root) return { success: false, reason: 'No dropdown root found' };

            const container = root.querySelector('div[class*="absolute"]');
            if (!container) return { success: false, reason: 'No dropdown container found' };

            const placeholderTxt = (container.textContent || '').trim();
            const items = Array.from(container.querySelectorAll('div.cursor-pointer, [onmousedown]'));
            for (const item of items) {
                const t = (item.textContent || '').trim().toLowerCase();
                if (!t) continue;
                if (t.includes(searchTextLower)) {
                    item.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                    return { success: true, matchedText: t };
                }
            }
            return {
                success: false,
                itemsFound: items.length,
                firstItemText: items[0]?.textContent,
                placeholderText: placeholderTxt
            };
        }, searchText);

        if (clickResult.success) {
            log(`   ✅ Matched: "${clickResult.matchedText.substring(0, 40)}..."`, colors.green);
            await new Promise(r => setTimeout(r, 1000));
            return true;
        }

        const placeholder = (clickResult.placeholderText || '').trim();
        const looksLikeEmpty = placeholder.includes('ไม่พบข้อมูล') || placeholder.toLowerCase().includes('no results');
        if (!looksLikeEmpty) {
            log(`❌ Match failed: ${clickResult.reason || 'Not found'}. Found ${clickResult.itemsFound || 0} items. First: "${clickResult.firstItemText}"`, colors.red);
            return false;
        }

        // If we only see an empty-state placeholder, options may still be loading asynchronously.
        // Close and retry.
        log(`⚠️ Dropdown shows empty results; retrying selection (attempt ${overallAttempt + 1}/4)...`, colors.yellow);
        try {
            await page.keyboard.press('Escape');
        } catch (_) {
            // ignore
        }
        await new Promise(r => setTimeout(r, 1500));
    }

    log(`❌ Failed to select "${searchText}" after retries (dropdown index ${dropdownIndex}).`, colors.red);
    return false;
}

/**
 * Navigate to GDCC page and wait for Account Dropdown to be ready.
 */
async function navigateToGDCC(page) {
    log('🔹 Navigating to GDCC System...', colors.blue);
    await page.goto(`${BASE_URL}/systems/gdcc`, { waitUntil: 'domcontentloaded' });

    // Wait for a stable page landmark first.
    await page.waitForSelector('main', { visible: true, timeout: 60000 });

    // Wait for account dropdown trigger to appear (best-effort; selection helpers will fail with good errors)
    try {
        await page.waitForSelector('div[tabindex="0"], div.space-y-1.relative', { visible: true, timeout: 60000 });
    } catch (_) {
        // Continue; selectGDCCFilters has its own robust error messages.
    }
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
    const dropdownTriggers = await page.$$('div[tabindex="0"]');
    if (dropdownTriggers.length <= dropdownIndex) {
        log(`❌ Dropdown at index ${dropdownIndex} not found (only ${dropdownTriggers.length} found).`, colors.red);
        return false;
    }

    // Wait until the trigger is interactive (placeholder is not "Loading..." / gate messages)
    try {
        await page.waitForFunction((idx) => {
            const triggers = Array.from(document.querySelectorAll('div[tabindex="0"]'));
            const el = triggers[idx];
            if (!el) return false;
            const t = (el.textContent || '').trim();
            if (!t) return false;
            if (t.includes('Loading...')) return false;
            if (t.includes('Select Account first')) return false;
            if (t.includes('Select Zone first')) return false;
            return true;
        }, { timeout: 45000 }, dropdownIndex);
    } catch (e) {
        log(`⚠️ Dropdown trigger at index ${dropdownIndex} still looks gated/loading. Continuing...`, colors.yellow);
    }

    // Click Trigger - retry until search input appears
    let popupOpened = false;
    for (let attempt = 0; attempt < 15; attempt++) {
        // Some dropdowns open on mousedown rather than click
        await page.evaluate((el) => {
            el.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
            el.click();
        }, dropdownTriggers[dropdownIndex]);
        await new Promise(r => setTimeout(r, 800));

        const searchInputs = await page.$$('input[placeholder="Search..."], input[placeholder="พิมพ์เพื่อค้นหา..."]');
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
    const activeSearchInputs = await page.$$('input[placeholder="Search..."], input[placeholder="พิมพ์เพื่อค้นหา..."]');
    const activeInput = activeSearchInputs[activeSearchInputs.length - 1];

    await page.evaluate((input) => {
        input.focus();
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }, activeInput);

    await activeInput.type(searchText);
    await new Promise(r => setTimeout(r, 1000));

    // Wait for dropdown items to render (anchor to the active search input)
    try {
        await page.waitForFunction(() => {
            const inputs = Array.from(document.querySelectorAll('input[placeholder="Search..."], input[placeholder="พิมพ์เพื่อค้นหา..."]'));
            const input = inputs[inputs.length - 1];
            if (!input) return false;

            const root = input.closest('div.space-y-1.relative') || input.closest('div.relative');
            if (!root) return false;

            const container = root.querySelector('div[class*="absolute"]');
            if (!container) return false;
            const txt = (container.textContent || '').trim();
            if (!txt) return false;
            if (txt.includes('Loading...') || txt.includes('กำลังโหลด...')) return false;
            return true;
        }, { timeout: 10000 });
    } catch (e) {
        log('⚠️ Timeout waiting for Dropdown items to load.', colors.yellow);
    }

    // Find and click the matching item (anchor to the active search input)
    const clickResult = await page.evaluate((textToFind) => {
        const inputs = Array.from(document.querySelectorAll('input[placeholder="Search..."], input[placeholder="พิมพ์เพื่อค้นหา..."]'));
        const input = inputs[inputs.length - 1];
        if (!input) return { success: false, reason: 'No search input found' };

        const root = input.closest('div.space-y-1.relative') || input.closest('div.relative');
        if (!root) return { success: false, reason: 'No dropdown root found' };

        const container = root.querySelector('div[class*="absolute"]');
        if (!container) return { success: false, reason: 'No dropdown container found' };

        const searchLower = (textToFind || '').trim().toLowerCase();
        const candidates = Array.from(container.querySelectorAll('*'));
        for (const el of candidates) {
            const t = (el.textContent || '').trim().toLowerCase();
            if (!t) continue;
            if (t.includes(searchLower)) {
                const target = el.closest('div.cursor-pointer') || el.closest('[onmousedown]') || el;
                target.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                return { success: true, matchedText: t };
            }
        }
        return { success: false, reason: 'Not found', candidates: candidates.length };
    }, searchText);

    if (!clickResult.success) {
        log(`❌ Could not select dropdown item: "${searchText}" (${clickResult.reason || 'failed'})`, colors.red);
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
    await new Promise((r) => setTimeout(r, 750));

    // Ensure the button exists and is enabled before we attempt the click.
    try {
        await page.waitForFunction(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find((b) => (b.textContent || '').trim() === 'Generate Dashboard');
            return !!(btn && !btn.disabled);
        }, { timeout: 30000 });
    } catch (_) {
        // Fall through; we'll throw a clearer error below if we still can't click.
    }

    const isTransientContextError = (err) => {
        const msg = String(err?.message || err || '');
        return (
            msg.includes('detached Frame') ||
            msg.includes('Execution context was destroyed') ||
            msg.includes('Cannot find context') ||
            msg.includes('Target closed')
        );
    };

    let clicked = false;
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            clicked = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const btn = btns.find((b) => (b.textContent || '').trim() === 'Generate Dashboard');
                if (!btn || btn.disabled) return false;
                btn.scrollIntoView({ block: 'center', inline: 'center' });
                btn.click();
                return true;
            });
            if (clicked) break;
        } catch (e) {
            lastErr = e;
            if (isTransientContextError(e)) {
                // Next.js dev/HMR can reload the page; wait for it to settle and retry.
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { });
                await new Promise((r) => setTimeout(r, 500));
                continue;
            }
            throw e;
        }

        await new Promise((r) => setTimeout(r, 500));
    }

    if (!clicked) {
        const tail = lastErr ? ` (last error: ${lastErr.message})` : '';
        throw new Error(`Generate Dashboard button not found or is disabled${tail}`);
    }

    log('📊 Clicked Generate Dashboard. Waiting for data...', colors.blue);

    // Best-effort: ensure we observed a "loading" state, then wait for enabled again.
    try {
        await page.waitForFunction(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find((b) => (b.textContent || '').trim() === 'Generate Dashboard');
            return !!(btn && btn.disabled);
        }, { timeout: 10000 });
    } catch (_) {
        // Some builds keep the button enabled; continue with the "enabled again" check.
    }

    try {
        await page.waitForFunction(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const gen = btns.find((b) => (b.textContent || '').trim() === 'Generate Dashboard');
            return !!(gen && !gen.disabled);
        }, { timeout: 90000 });
        log('✅ Traffic data loaded.', colors.green);
    } catch (_) {
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
        // Zone has no real subdomains → click "No Subdomain (Full Domain Report)" to generate Domain Report
        const labels = await page.$$('label');
        let noSubLabel = null;
        for (const lbl of labels) {
            const txt = await lbl.evaluate(el => el.textContent?.trim() || '');
            if (txt.includes('No Subdomain')) { noSubLabel = lbl; break; }
        }
        if (noSubLabel) {
            // Click via evaluate to avoid overlay/visibility issues in headless.
            await page.evaluate((el) => {
                el.scrollIntoView({ block: 'center', inline: 'center' });
                el.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                el.click();
            }, noSubLabel);
            log('☑️ Selected "No Subdomain" (Domain Report mode).', colors.gray);
        } else {
            log('⚠️ "No Subdomain" label not found. Trying Select All fallback.', colors.yellow);
            const clickedSelectAll = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const btn = btns.find(b => (b.textContent || '').trim().includes('Select All'));
                if (!btn) return false;
                btn.scrollIntoView({ block: 'center', inline: 'center' });
                btn.click();
                return true;
            });
            if (!clickedSelectAll) log('⚠️ Select All button not found in modal.', colors.yellow);
        }
    } else {
        const clickedSelectAll = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => (b.textContent || '').trim().includes('Select All'));
            if (!btn) return false;
            btn.scrollIntoView({ block: 'center', inline: 'center' });
            btn.click();
            return true;
        });
        if (!clickedSelectAll) throw new Error('Select All button not found in modal');
        log('☑️ Selected all hosts.', colors.gray);
    }

    // Click Generate (avoid accidentally clicking "Generate Dashboard")
    await new Promise(r => setTimeout(r, 500));
    const clickedGenerate = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const candidates = btns.filter(b => {
            const txt = (b.textContent || '').trim();
            if (!txt) return false;
            if (txt === 'Generate Dashboard') return false;
            if (!txt.startsWith('Generate')) return false;
            if (b.disabled) return false;
            return true;
        });

        // Prefer the last matching button (modal footer tends to be later in DOM)
        const btn = candidates[candidates.length - 1];
        if (!btn) return false;
        btn.scrollIntoView({ block: 'center', inline: 'center' });
        btn.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
        btn.click();
        return true;
    });
    if (!clickedGenerate) throw new Error('Generate button not found/clickable (modal)');
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
