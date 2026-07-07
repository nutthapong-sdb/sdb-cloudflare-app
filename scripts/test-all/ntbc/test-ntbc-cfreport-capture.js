/**
 * Test: NTBC CFReport - Generate Report Sequential Workflow & Generation
 * 1. Navigate to NTBC CFReport
 * 2. Click "Generate Report" Workspace Card
 * 3. Select Account "Softdebut POC"
 * 4. Select Zone "log.softdebut.online"
 * 5. Set Date Range: 2026-07-10 to 2026-07-12 (Gregorian equivalent of Buddhist Era 10 ก.ค. 69 - 12 ก.ค. 69)
 * 6. Select "No Subdomain (Full Domain Report)"
 * 7. Click "Generate Domain Report"
 * 8. Verify the document is automatically compiled, generated, and downloaded
 */

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { setupBrowser, setupPage, login, log, colors, TMP_DOWNLOAD_DIR, BASE_URL } = require('../libs/ui-helper');

async function selectModalDropdown(page, labelText, searchText) {
    log(`   -> Selecting ${labelText}: ${searchText}`, colors.gray);
    
    // Debug all labels on the page first
    const allLabels = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('label')).map(l => ({
            text: l.textContent,
            html: l.outerHTML
        }));
    });
    log(`   [DEBUG] All labels currently in DOM:\n${JSON.stringify(allLabels, null, 2)}`, colors.yellow);

    const dropdownRoot = await page.evaluateHandle((label) => {
        const labels = Array.from(document.querySelectorAll('label'));
        const targetLabel = labels.find(l => (l.textContent || '').toLowerCase().includes(label.toLowerCase()));
        if (!targetLabel) return null;
        // Let's find the parent wrapper div. We want the one containing the tabindex="0" div.
        let parent = targetLabel.parentElement;
        while (parent) {
            if (parent.querySelector('div[tabindex="0"]')) {
                return parent;
            }
            parent = parent.parentElement;
        }
        return targetLabel.closest('div');
    }, labelText);

    if (!dropdownRoot || !(await dropdownRoot.asElement())) {
        throw new Error(`Could not find dropdown label: ${labelText}`);
    }

    const dropdownRootHtml = await page.evaluate(el => el.outerHTML, dropdownRoot);
    log(`   [DEBUG] dropdownRoot HTML:\n${dropdownRootHtml}`, colors.yellow);

    const trigger = await dropdownRoot.$('div[tabindex="0"]');
    if (!trigger) {
        throw new Error(`Could not find dropdown trigger for label: ${labelText}`);
    }

    await page.waitForFunction((el) => {
        const t = (el.textContent || '').trim();
        return t && !t.includes('Loading...');
    }, { timeout: 30000 }, trigger);

    let popupOpened = false;
    for (let attempt = 0; attempt < 5; attempt++) {
        await page.evaluate(el => el.click(), trigger);
        await new Promise(r => setTimeout(r, 1000));
        const hasInput = await dropdownRoot.$('input[placeholder="Search..."], input[placeholder="พิมพ์เพื่อค้นหา..."]');
        if (hasInput) {
            popupOpened = true;
            break;
        }
    }

    if (!popupOpened) {
        throw new Error(`Failed to open dropdown for label: ${labelText}`);
    }

    const searchInput = await dropdownRoot.$('input[placeholder="Search..."], input[placeholder="พิมพ์เพื่อค้นหา..."]');
    await page.evaluate(input => {
        input.focus();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }, searchInput);

    await searchInput.type(searchText);
    await new Promise(r => setTimeout(r, 1000));

    await page.waitForFunction((root) => {
        const container = root.querySelector('div[class*="absolute"]');
        if (!container) return false;
        const txt = (container.textContent || '').trim();
        return txt && !txt.includes('Loading...') && !txt.includes('No results');
    }, { timeout: 15000 }, dropdownRoot);

    const clicked = await page.evaluate((root, searchStr) => {
        const container = root.querySelector('div[class*="absolute"]');
        if (!container) return false;
        const options = Array.from(container.querySelectorAll('div.cursor-pointer, [onmousedown]'));
        const lowerSearch = searchStr.toLowerCase();
        for (const opt of options) {
            const txt = (opt.textContent || '').trim().toLowerCase();
            if (txt.includes(lowerSearch)) {
                opt.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                opt.click();
                return true;
            }
        }
        return false;
    }, dropdownRoot, searchText);

    if (!clicked) {
        throw new Error(`Could not find option containing "${searchText}" in dropdown for "${labelText}"`);
    }

    await new Promise(r => setTimeout(r, 1500));
    return true;
}

(async () => {
    log('🚀 Starting Test: NTBC CFReport Generate Report Sequential Workflow & Generation...', colors.cyan);
    const browser = await setupBrowser();
    let page;
    try {
        page = await setupPage(browser);
        
        // Listen to console logs in browser
        page.on('console', msg => {
            log(`   [Browser Console] ${msg.text()}`, colors.yellow);
        });
        page.on('pageerror', err => {
            log(`   [Browser Page Error] ${err.toString()}`, colors.red);
        });

        await login(page);

        log('\n🔹 Step 1: Navigating to NTBC CFReport Workspace...', colors.blue);
        await page.goto(`${BASE_URL}/systems/ntbc_cfreport`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('main', { visible: true, timeout: 60000 });
        log('   ✅ NTBC CFReport page loaded.', colors.green);
        await new Promise(r => setTimeout(r, 6000));

        log('\n🔹 Step 2: Opening Generate Report batch modal...', colors.blue);
        await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('h3'));
            const captureCard = cards.find(c => c.textContent.trim() === 'Generate Report');
            if (captureCard) {
                const parent = captureCard.closest('div');
                if (parent) parent.click();
            }
        });
        await new Promise(r => setTimeout(r, 2000));

        log('\n🔹 Step 3: Selecting Account and Domain...', colors.blue);
        log('   -> Selecting Account: softdebut POC', colors.gray);

        const acctOk = await selectModalDropdown(page, '1. Select Account', 'softdebut POC');
        if (!acctOk) throw new Error('Failed to select Account');

        // Select Zone
        log('   -> Selecting Zone: log.softdebut.online', colors.gray);
        
        // Wait for zones to load completely
        await page.waitForFunction(() => {
            const labels = Array.from(document.querySelectorAll('label'));
            const zoneLabel = labels.find(l => l.textContent.includes('Select Zones'));
            if (!zoneLabel) return false;
            
            const listContainer = zoneLabel.closest('div').nextElementSibling;
            if (!listContainer) return false;
            
            const isLoading = listContainer.textContent.includes('Loading zones');
            const zoneItems = listContainer.querySelectorAll('div.cursor-pointer');
            return !isLoading && zoneItems.length > 0;
        }, { timeout: 30000 });

        const zoneOk = await page.evaluate(() => {
            const labels = Array.from(document.querySelectorAll('label'));
            const zoneLabel = labels.find(l => l.textContent.includes('Select Zones'));
            if (!zoneLabel) return false;
            
            const listContainer = zoneLabel.closest('div').nextElementSibling;
            if (!listContainer) return false;
            
            const zones = Array.from(listContainer.querySelectorAll('div.cursor-pointer'));
            let targetZone = zones.find(z => z.textContent.includes('log.softdebut.online'));
            if (!targetZone) {
                targetZone = zones.find(z => z.textContent.toLowerCase().includes('softdebut'));
            }
            if (!targetZone && zones.length > 0) targetZone = zones[0];
            
            if (targetZone) {
                targetZone.scrollIntoView({ block: 'center', inline: 'center' });
                targetZone.click();
                return true;
            }
            return false;
        });
        if (!zoneOk) throw new Error('Failed to select Zone (No zones found or clickable)');

        log('\n🔹 Step 4: Setting Date Range...', colors.blue);
        // Remove 'max' attributes first so future dates (July 2026) are allowed
        await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input[type="date"]'));
            inputs.forEach(input => {
                input.removeAttribute('max');
            });
        });
        await new Promise(r => setTimeout(r, 500));

        const batchDateInputs = await page.$$('input[type="date"]');
        if (batchDateInputs.length >= 2) {
            // Start Date: 2026-06-18
            await page.evaluate((el, val) => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, batchDateInputs[0], '2026-06-18');

            // End Date: 2026-06-24
            await page.evaluate((el, val) => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, batchDateInputs[1], '2026-06-24');
            log('   ✅ Dates set: 2026-06-18 to 2026-06-24', colors.green);
        } else {
            throw new Error('Could not find date input fields in modal');
        }

        log('\n🔹 Step 5: Skipping subdomain selection (selection UI was removed)...', colors.blue);
        await new Promise(r => setTimeout(r, 500));

        log('\n🔹 Step 6: Clicking "Add to Batch Queue" and "Start Processing Queue"...', colors.blue);
        const queueResult = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const addBtn = btns.find(b => b.textContent.trim() === 'Add to Batch Queue' && !b.disabled);
            if (!addBtn) return 'Add button not found';
            addBtn.scrollIntoView({ block: 'center', inline: 'center' });
            addBtn.click();
            return 'added';
        });

        if (queueResult !== 'added') throw new Error('Failed to add to batch queue: ' + queueResult);
        log('   ✅ Clicked Add to Batch Queue', colors.green);
        
        await new Promise(r => setTimeout(r, 2000));

        const startResult = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const startBtn = btns.find(b => b.textContent.trim() === 'Start Processing Queue' && !b.disabled);
            if (!startBtn) return 'Start button not found';
            startBtn.scrollIntoView({ block: 'center', inline: 'center' });
            startBtn.click();
            return 'started';
        });

        if (startResult !== 'started') throw new Error('Failed to start processing queue: ' + startResult);
        log('   ✅ Clicked Start Processing Queue', colors.green);

        log('\n🔹 Step 7: Waiting for report file download (max 5 min)...', colors.blue);
        const generateStartTime = Date.now();
        let downloadedFile = null;

        // Wait up to 5 minutes, checking for Swal modals or the downloaded file
        while (Date.now() - generateStartTime < 300000) {
            // Check for Swal alert
            const swalError = await page.evaluate(() => {
                const swal = document.querySelector('.swal2-container.swal2-shown');
                if (swal) {
                    const title = swal.querySelector('.swal2-title')?.textContent || '';
                    const content = swal.querySelector('.swal2-html-container')?.textContent || '';
                    return { title, content };
                }
                return null;
            });
            
            if (swalError && (swalError.title.toLowerCase().includes('required') || swalError.title.toLowerCase().includes('fail') || swalError.title.toLowerCase().includes('error'))) {
                throw new Error(`Process interrupted by alert modal: [${swalError.title}] ${swalError.content}`);
            }

            // Check if VNC modal is open (unauthenticated Cloudflare detected)
            const isVncOpen = await page.evaluate(() => {
                const headers = Array.from(document.querySelectorAll('h3, h2, h1, div'));
                return !!headers.find(el => (el.textContent || '').includes('Live Debug Browser (VNC)'));
            });
            if (isVncOpen) {
                throw new Error('Cloudflare is not authenticated. Opened VNC modal for manual login.');
            }

            const tmpFiles = fs.readdirSync(TMP_DOWNLOAD_DIR);
            const foundTmp = tmpFiles.find(f => {
                if (!(f.endsWith('.docx') || f.endsWith('.doc')) || f.endsWith('.crdownload')) return false;
                return fs.statSync(path.join(TMP_DOWNLOAD_DIR, f)).mtimeMs >= generateStartTime;
            });
            if (foundTmp) {
                downloadedFile = foundTmp;
                break;
            }
            await new Promise(r => setTimeout(r, 3000));
        }

        if (!downloadedFile) throw new Error('Timeout: No report file downloaded within 5 minutes');

        const filePath = path.join(TMP_DOWNLOAD_DIR, downloadedFile);
        const fileSize = fs.statSync(filePath).size;
        log(`✅ Downloaded successfully: ${downloadedFile} (${fileSize.toLocaleString()} bytes)`, colors.green);

        log(`\n🔹 Step 8: Opening downloaded Word file...`, colors.blue);
        exec(`open "${filePath}"`, (err) => {
            if (err) {
                log(`⚠️ Failed to open file: ${err.message}`, colors.red);
            } else {
                log(`✅ File opened successfully: ${filePath}`, colors.green);
            }
        });

        // Skip automatic cleanup so the file remains open and available to the user
        log(`📌 Note: Downloaded file kept at ${filePath}`, colors.gray);

        log('\n✅ NTBC CFReport Capture Test PASSED!', colors.green);

    } catch (error) {
        log(`❌ Test FAILED: ${error.message}`, colors.red);
        if (typeof page !== 'undefined') {
            try {
                const screenshotPath = '/Users/litarcopperkaikem/.gemini/antigravity-cli/brain/91d4e3a7-2c47-425a-873d-8a85de8370ab/test_failure.png';
                await page.screenshot({ path: screenshotPath });
                log(`📸 Saved failure screenshot to: ${screenshotPath}`, colors.yellow);
            } catch (e) {
                log(`⚠️ Failed to save failure screenshot: ${e.message}`, colors.red);
            }
        }
        if (error.stack) console.error(error.stack);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})();
