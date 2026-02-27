const { setupBrowser, setupPage, login, log, colors, BASE_URL, TMP_DOWNLOAD_DIR } = require('./test-all/libs/ui-helper');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

(async () => {
    log('=====================================', colors.blue);
    log('🤖 SDB Cloudflare - Auto Report Runner', colors.blue);
    log('=====================================', colors.blue);

    // 1. Fetch configs
    let configsWithFiles = [];
    try {
        // We can interact with DB directly, but simpler to hit our API
        // Wait, UI helper uses BASE_URL which points to http://localhost:8002 typically.
        const res = await axios.get(`${BASE_URL}/api/auto-report`);
        if (res.data.success) {
            configsWithFiles = res.data.data;
        } else {
            throw new Error(res.data.message);
        }
    } catch (e) {
        log(`❌ Failed to fetch auto-report configs: ${e.message}`, colors.red);
        if (e.code === 'ECONNREFUSED') {
            log('⚠️ Make sure the Next.js server is running', colors.yellow);
        }
        process.exit(1);
    }

    if (configsWithFiles.length === 0) {
        log('✅ No auto gen report configurations found. Exiting.', colors.green);
        process.exit(0);
    }

    // Determine pending tasks
    const pendingTasks = [];
    const now = new Date();

    configsWithFiles.forEach(config => {
        let cursorDate = new Date(config.target_date);
        const originalDate = new Date(config.target_date);
        const originalDay = originalDate.getDate();
        const isSpecialMonthly = (config.interval_days === 30 && (originalDay === 30 || originalDay === 31));

        // Loop from target date up to today (or yesterday, depending on how you view "target date")
        // If cursorDate is <= today, it's due.
        while (cursorDate <= now) {
            // we use local date string for exact YYYY-MM-DD to match inputs
            const tzOffset = cursorDate.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(cursorDate.getTime() - tzOffset)).toISOString().split('T')[0];
            const reportDateStr = localISOTime;

            const alreadyGenerated = config.files.some(f => f.report_date.startsWith(reportDateStr));

            if (!alreadyGenerated) {
                pendingTasks.push({
                    config,
                    reportDateStr,
                    rawDate: new Date(cursorDate)
                });
            }

            // Advance by interval
            if (isSpecialMonthly) {
                if (cursorDate.getTime() === originalDate.getTime()) {
                    // First jump: end of month -> 1st of month+2
                    cursorDate = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 2, 1);
                } else {
                    // Subsequent jumps: 1st of month -> 1st of next month
                    cursorDate = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 1);
                }
            } else {
                cursorDate.setDate(cursorDate.getDate() + config.interval_days);
            }
        }
    });

    if (pendingTasks.length === 0) {
        log('✅ All configured reports are up to date. No pending tasks.', colors.green);
        process.exit(0);
    }

    log(`🚀 Found ${pendingTasks.length} pending auto-report tasks. Starting Headless Chrome...`, colors.cyan);

    const browser = await setupBrowser();
    try {
        const page = await setupPage(browser);

        // Pipe browser console to terminal
        page.on('console', msg => {
            const txt = msg.text();
            if (txt.includes('Step') || txt.includes('Capturing') || txt.includes('Fetching') || txt.includes('Packing') || txt.includes('Preparing')) {
                log(`    [Browser] ${txt}`, colors.cyan);
            } else if (msg.type() === 'error') {
                log(`    [Browser Error] ${txt}`, colors.red);
            }
        });

        // Login
        const username = process.env.TEST_USER || 'root';
        const password = process.env.TEST_PASSWORD || 'password';

        log('🔹 Performing Login...', colors.blue);
        try { await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 }); } catch (e) { }

        if (page.url().includes('/login')) {
            await page.waitForSelector('input[type="text"]', { visible: true });
            await page.type('input[type="text"]', username);
            await page.type('input[type="password"]', password);
            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => { }),
            ]);
        }
        if (page.url().includes('/login')) throw new Error('Login Failed. Check credentials in .env.local');
        log('✅ Login Successful', colors.green);

        // Process tasks
        for (let i = 0; i < pendingTasks.length; i++) {
            const task = pendingTasks[i];
            const { config, reportDateStr } = task;

            log(`-------------------------------------`, colors.cyan);
            log(`🔄 Task ${i + 1}/${pendingTasks.length}: [${config.account_name}] ${config.zone_name} - ${config.subdomain}`, colors.magenta);
            log(`📅 Target Date: ${reportDateStr}`, colors.white);

            // Navigate to GDCC
            await page.goto(`${BASE_URL}/systems/gdcc`, { waitUntil: 'domcontentloaded' });

            // To fix this correctly and efficiently:
            // 1. We still need to select the Account and Zone on the main page so "Create Report" button knows which zone's subdomains to show.
            // 2. But we DO NOT need to select Subdomain or click "Generate Dashboard" (that's the slow part).

            const selectSimpleDropdown = async (dropdownIndex, searchText) => {
                const dropdownTriggers = await page.$$('div.relative > div[tabindex="0"]');
                if (dropdownTriggers.length > dropdownIndex) {
                    await page.evaluate(el => el.click(), dropdownTriggers[dropdownIndex]);
                    await new Promise(r => setTimeout(r, 800));
                    const searchInputs = await page.$$('input[placeholder="Search..."]');
                    const activeInput = searchInputs[searchInputs.length - 1];
                    if (activeInput) {
                        await activeInput.type(searchText);
                        await new Promise(r => setTimeout(r, 800));
                        await page.evaluate((textToFind) => {
                            const items = document.querySelectorAll('div[class*="absolute z-[100]"] > div');
                            for (const item of Array.from(items)) {
                                if (item.textContent.toLowerCase().includes(textToFind.toLowerCase())) {
                                    const ev = new MouseEvent('mousedown', { bubbles: true });
                                    item.dispatchEvent(ev);
                                    return;
                                }
                            }
                        }, searchText);
                    }
                    await new Promise(r => setTimeout(r, 1000));
                    return true;
                }
                return false;
            };

            const selectDropdownRobust = async (index, searchText) => {
                log(`    [Action] Selecting "${searchText}" in dropdown ${index}...`, colors.gray);

                // Wait for the specific dropdown to be ready (not Loading)
                await page.waitForFunction((idx) => {
                    const triggers = document.querySelectorAll('div.relative > div[tabindex="0"]');
                    return triggers[idx] && !triggers[idx].textContent.includes('Loading');
                }, { timeout: 20000 }, index);

                const triggers = await page.$$('div.relative > div[tabindex="0"]');
                await triggers[index].click();
                await new Promise(r => setTimeout(r, 1000));

                const searchInputs = await page.$$('input[placeholder="Search..."], input[placeholder="Filter..."]');
                if (searchInputs && searchInputs.length > 0) {
                    const activeInput = searchInputs[searchInputs.length - 1];

                    // Clear existing text
                    await activeInput.click({ clickCount: 3 });
                    await page.keyboard.press('Backspace');
                    await new Promise(r => setTimeout(r, 200));

                    // Type the exact value
                    await activeInput.type(searchText, { delay: 30 });
                    await new Promise(r => setTimeout(r, 1000));

                    // Press ArrowDown to focus the search result, then Enter to select
                    await page.keyboard.press('ArrowDown');
                    await new Promise(r => setTimeout(r, 200));
                    await page.keyboard.press('Enter');
                } else {
                    log(`      ⚠️ WARNING: Could not find search input for dropdown.`, colors.yellow);
                    // Fallback blind keyboard navigation just in case
                    await page.keyboard.type(searchText, { delay: 30 });
                    await new Promise(r => setTimeout(r, 500));
                    await page.keyboard.press('ArrowDown');
                    await new Promise(r => setTimeout(r, 200));
                    await page.keyboard.press('Enter');
                }

                await new Promise(r => setTimeout(r, 1500));

                // Verify selection
                const finalTxt = await triggers[index].evaluate(el => el.textContent);
                if (finalTxt.toLowerCase().includes(searchText.toLowerCase().substring(0, 5)) ||
                    searchText.toLowerCase().includes(finalTxt.toLowerCase().substring(0, 5))) {
                    return true;
                }
                log(`      ⚠️ Verification failed. Current text: "${finalTxt.trim()}"`, colors.yellow);
                return false;
            };

            log(`  -> Setting context: Account=${config.account_name} (using manual steps)`, colors.gray);

            const userSelector = 'body > div.flex.min-h-screen.bg-black > main > div > main > div.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3.gap-6.mb-4.p-5.rounded-xl.border.border-dashed.bg-gray-900\\/40.border-gray-800 > div:nth-child(1) > div > div';

            try {
                // 1. เปิดไปที่หน้า cf report แล้วรอ 5 วินาทีก่อนกดที่ปุ่ม account
                log(`    [Action] Waiting 5 seconds before clicking account dropdown...`, colors.gray);
                await new Promise(r => setTimeout(r, 5000));

                await page.waitForSelector(userSelector, { visible: true, timeout: 10000 });
                await page.click(userSelector);
                log(`    [Action] Clicked the custom selector.`, colors.gray);

                // 2. พิมพ์ชื่อ account ที่ได้มาจากใน db
                log(`    [Action] Typing account name...`, colors.gray);
                const searchInputs = await page.$$('input[placeholder="Search..."], input[placeholder="Filter..."]');
                if (searchInputs && searchInputs.length > 0) {
                    await searchInputs[searchInputs.length - 1].type(config.account_name, { delay: 50 });
                } else {
                    await page.keyboard.type(config.account_name, { delay: 50 });
                }

                // 3. เช็คว่าใน dropdown มีข้อมูลขึ้นหรือไม่
                log(`    [Action] Waiting for option to appear...`, colors.gray);
                try {
                    await page.waitForFunction((searchText) => {
                        const options = document.querySelectorAll('div[class*="absolute z-[100]"] > div');
                        for (let opt of options) {
                            // Trim and replace multiple spaces to mimic previous resilient approach
                            const txt = opt.textContent.toLowerCase().replace(/\s+/g, ' ');
                            const tgt = searchText.toLowerCase().trim().replace(/\s+/g, ' ');
                            if (txt.includes(tgt)) return true;
                        }
                        return false;
                    }, { timeout: 10000 }, config.account_name);

                    log(`    [Action] Option found. Pressing ArrowDown and Enter...`, colors.gray);
                    await page.keyboard.press('ArrowDown');
                    await new Promise(r => setTimeout(r, 200));
                    await page.keyboard.press('Enter');
                    await new Promise(r => setTimeout(r, 500));
                } catch (e) {
                    log(`    [Action] Option not found or timeout. Pressing Enter anyway.`, colors.gray);
                    await page.keyboard.press('Enter');
                }

                // 4. ไม่ต้องรอ กดช่องเลือก Domain
                log(`    [Action] Clicking Domain dropdown...`, colors.gray);
                const zoneSelector = 'body > div.flex.min-h-screen.bg-black > main > div > main > div.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3.gap-6.mb-4.p-5.rounded-xl.border.border-dashed.bg-gray-900\\/40.border-gray-800 > div:nth-child(2) > div > div';
                await page.waitForSelector(zoneSelector, { visible: true, timeout: 5000 });
                await page.click(zoneSelector);

                // รอให้ dropdown กางออกและ render input ให้เสร็จ 1 วินาที
                await new Promise(r => setTimeout(r, 1000));

                log(`    [Action] Typing domain name (${config.zone_name})...`, colors.gray);
                // พิมพ์ผ่าน keyboard ตรงๆ เพราะ component จะ auto-focus input ให้เวลากาง dropdown
                await page.keyboard.type(config.zone_name, { delay: 50 });

                // เช็คว่าใน dropdown ของ domain มีข้อมูลขึ้นหรือไม่
                log(`    [Action] Waiting for domain option to appear...`, colors.gray);
                try {
                    await page.waitForFunction((searchText) => {
                        const options = document.querySelectorAll('div[class*="absolute z-[100]"] > div');
                        for (let opt of options) {
                            const txt = opt.textContent.toLowerCase().replace(/\s+/g, ' ');
                            const tgt = searchText.toLowerCase().trim().replace(/\s+/g, ' ');
                            if (txt.includes(tgt)) return true;
                        }
                        return false;
                    }, { timeout: 10000 }, config.zone_name);

                    log(`    [Action] Domain option found. Pressing ArrowDown and Enter...`, colors.gray);
                    await page.keyboard.press('ArrowDown');
                    await new Promise(r => setTimeout(r, 200));
                    await page.keyboard.press('Enter');
                } catch (e) {
                    log(`    [Action] Domain option not found or timeout. Pressing Enter anyway.`, colors.gray);
                    await page.keyboard.press('Enter');
                }

                log(`✅ Account and Zone selected. Bypassing Subdomain selection and clicking Create Report directly...`, colors.green);

            } catch (e) {
                log(`❌ Error applying user instructions: ${e.message}`, colors.red);
            }

            // Unreachable code due to wait forever above, but kept to avoid breaking the script structure
            // await selectDropdownRobust(1, config.zone_name);

            // Ensure we are actually on the right zone (the Create Report button depends on it)
            await new Promise(r => setTimeout(r, 1000));
            const finalCreateBtn = await page.waitForSelector('xpath///button[contains(text(), "Create Report")]', { visible: true, timeout: 15000 });
            if (finalCreateBtn) {
                await finalCreateBtn.click();
                log(`📋 Batch Report modal opened.`, colors.green);
            } else {
                log(`❌ Could not find Create Report button`, colors.red);
                continue;
            }

            await new Promise(r => setTimeout(r, 1500)); // Wait for modal animation

            // Step 4: Set date range in the Batch Modal
            const batchDateInputs = await page.$$('input[type="date"]');
            const endDateStr = reportDateStr;
            const startDateObj = new Date(task.rawDate);
            startDateObj.setDate(startDateObj.getDate() - (config.interval_days - 1));
            const startDateStr = startDateObj.toISOString().split('T')[0];

            if (batchDateInputs.length >= 2) {
                log(`    [Action] Set date range to ${startDateStr} - ${endDateStr} (${config.interval_days} days)`, colors.gray);
                // Set start date
                await page.evaluate((el, val) => {
                    const cb = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    cb.call(el, val);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }, batchDateInputs[0], startDateStr);

                // Set end date
                await page.evaluate((el, val) => {
                    const cb = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    cb.call(el, val);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }, batchDateInputs[1], endDateStr);
            } else {
                log(`    ⚠️ Found only ${batchDateInputs.length} date inputs. Expected 2.`, colors.yellow);
            }

            // Step 4.5: Select Template in the Batch Modal
            if (config.template_id) {
                log(`📝 Selecting Template: ${config.template_id}`, colors.gray);
                try {
                    await page.waitForFunction((id) => {
                        const sel = document.querySelector('div.fixed.inset-0 select');
                        if (!sel) return false;
                        const opts = Array.from(sel.options);
                        return opts.some(o => o.value === id);
                    }, { timeout: 10000 }, config.template_id);
                    await page.select('div.fixed.inset-0 select', config.template_id);
                } catch (e) {
                    log(`⚠️ Failed to select template ${config.template_id} or it's not yet in the list.`, colors.yellow);
                }
            }

            // Step 5: Select the SPECIFIC host only
            await new Promise(r => setTimeout(r, 1000));

            // Wait until labels are rendered (they might be loading)
            try {
                await page.waitForFunction(() => document.querySelectorAll('div.fixed.inset-0 label.flex.items-center').length > 0, { timeout: 8000 });
            } catch (e) {
                log('⚠️ No labels found in modal after waiting.', colors.yellow);
            }

            log(`    [Action] Selecting Subdomain: ${config.subdomain}`, colors.gray);
            try {
                // First: Deselect All to be sure
                const modalBtns = await page.$$('div.fixed.inset-0 button');
                for (const btn of modalBtns) {
                    const txt = await btn.evaluate(el => el.textContent?.trim() || '');
                    if (txt === 'Deselect All' || txt.includes('Deselect All') || txt === 'Uncheck All' || txt.includes('Uncheck All')) {
                        await page.evaluate(el => el.click(), btn);
                        break;
                    }
                }
                await new Promise(r => setTimeout(r, 800));

                const selectTargetHost = async (target) => {
                    // Try exact match on labels first
                    const labels = await page.$$('div.fixed.inset-0 label');
                    const allHostTexts = [];
                    for (const lbl of labels) {
                        const txt = await lbl.evaluate(el => el.textContent?.trim() || '');
                        allHostTexts.push(txt);
                        if (txt === target || (target === 'No Subdomain' && txt.includes('No Subdomain'))) {
                            await page.evaluate(el => el.click(), lbl);
                            return true;
                        }
                    }

                    // Try targeting the span specifically (more precise)
                    const spans = await page.$$('div.fixed.inset-0 label span');
                    for (const span of spans) {
                        const txt = await span.evaluate(el => el.textContent?.trim() || '');
                        if (txt === target) {
                            const lbl = await span.evaluateHandle(el => el.closest('label'));
                            await page.evaluate(el => el.click(), lbl);
                            return true;
                        }
                    }

                    // If not found, log everything for debugging
                    log(`   (Available hosts in modal: ${allHostTexts.join(', ') || 'NONE'})`, colors.gray);
                    return false;
                };

                if (config.subdomain === 'ALL_SUBDOMAINS') {
                    const success = await selectTargetHost('No Subdomain');
                    if (success) log(`☑️ Selected "No Subdomain" (Zone Overview).`, colors.gray);
                    else log(`⚠️ "No Subdomain" label not found in modal!`, colors.red);
                } else {
                    let found = await selectTargetHost(config.subdomain);
                    if (found) {
                        log(`☑️ Selected target subdomain: ${config.subdomain}`, colors.gray);
                    } else {
                        log(`🔍 Subdomain not found in visible list, trying search box...`, colors.cyan);
                        const searchBox = await page.$('div.fixed.inset-0 input[placeholder*="Filter"]');
                        if (searchBox) {
                            await searchBox.type(config.subdomain);
                            await new Promise(r => setTimeout(r, 1000));
                            found = await selectTargetHost(config.subdomain);
                        }
                    }
                    if (!found) log(`❌ Could not find subdomain "${config.subdomain}" in the list!`, colors.red);
                }

                // Step 6: Click "Generate Report" or similar button inside the modal
            } catch (e) {
                log(`    ⚠️ Error selecting subdomain in modal: ${e.message}`, colors.yellow);
            }

            await new Promise(r => setTimeout(r, 1000));
            const generateBtns = await page.$$('div.fixed.inset-0 button');
            let finalGenBtn = null;
            for (const btn of generateBtns) {
                const txt = await btn.evaluate(el => el.textContent?.trim() || '');
                const isDisabled = await btn.evaluate(el => el.disabled);
                if ((txt.includes('Generate') || txt.includes('Domain Report')) && !isDisabled) {
                    finalGenBtn = btn;
                }
            }

            if (finalGenBtn) {
                const btnText = await finalGenBtn.evaluate(el => el.textContent?.trim());
                log(`🚀 Clicking "${btnText}"...`, colors.blue);
                await page.evaluate(el => el.click(), finalGenBtn);
            } else {
                log(`❌ Could not find an enabled Generate/Confirm button in Batch Report modal.`, colors.red);
                // Check if we can find it even if disabled to log common issues
                const anyGenBtn = (await page.$$('div.fixed.inset-0 button')).find(async b => (await b.evaluate(el => el.textContent)).includes('Generate'));
                if (anyGenBtn) {
                    const isStillDisabledCount = await anyGenBtn.evaluate(el => el.disabled);
                    log(`   (Note: Found a Generate button but disabled: ${isStillDisabledCount})`, colors.yellow);
                }
                continue;
            }

            // Wait for __lastBatchReportReady instead of polling the filesystem
            const start = Date.now();
            let sourceHTML = null;
            let lastDebugAt = 0;
            while (Date.now() - start < 300000) { // 5 min timeout
                sourceHTML = await page.evaluate(() => {
                    if (window.__lastBatchReportReady) {
                        const html = window.__lastBatchReportHTML;
                        window.__lastBatchReportReady = false; // Reset for next iteration
                        return html;
                    }
                    return null;
                });

                if (sourceHTML) break;

                if (Date.now() - lastDebugAt > 10000) {
                    const elapsed = Math.round((Date.now() - start) / 1000);
                    log(`  [${elapsed}s] Waiting for report generation...`, colors.gray);
                    lastDebugAt = Date.now();
                }
                await new Promise(r => setTimeout(r, 2000));
            }

            if (sourceHTML) {
                // We got the HTML! Save it to a temporary file, then upload.
                const filename = `temp_report_${Date.now()}.doc`;
                const filePath = path.join(TMP_DOWNLOAD_DIR, filename);
                fs.writeFileSync(filePath, sourceHTML, 'utf8');
                log(`✅ Generated report HTML extracted successfully. Saved to temporary location.`, colors.green);

                // New naming format: {domain (10 ตัวสุดท้าย)}_{domain}_{start_date}_{interval}_{downloaded_date}
                const domain = config.zone_name;
                const last10 = domain.length > 10 ? domain.slice(-10) : domain;
                const today = new Date().toISOString().split('T')[0];
                const newFileName = `${last10}_${domain}_${reportDateStr}_${config.interval_days}_${today}.doc`;
                log(`   -> Renaming for DB/Store: ${newFileName}`, colors.gray);

                const form = new (require('form-data'))();
                form.append('file', fs.createReadStream(filePath), { filename: newFileName });
                form.append('configId', config.id);
                form.append('reportDate', reportDateStr);

                try {
                    const uploadRes = await axios.post(`${BASE_URL}/api/auto-report/save-file`, form, {
                        headers: form.getHeaders(),
                        maxBodyLength: Infinity
                    });
                    if (uploadRes.data.success) {
                        log(`✅ Successfully generated & saved report for ${reportDateStr}`, colors.green);
                        // cleanup
                        try { fs.unlinkSync(filePath); } catch (e) { }
                    } else {
                        log(`❌ Failed to save file API Error: ${uploadRes.data.message}`, colors.red);
                    }
                } catch (err) {
                    const msg = err.response?.data?.message || err.message;
                    log(`❌ API Error uploading file: ${msg}`, colors.red);
                }

            } else {
                log(`❌ Timeout! No .docx file downloaded within 180s for task.`, colors.red);
            }
        } // End of task loop

        log(`🎉 All Auto Gen Report tasks completed!`, colors.green);

    } catch (error) {
        log(`❌ Runner Failed: ${error.message}`, colors.red);
    } finally {
        if (browser) await browser.close();
    }
})();
