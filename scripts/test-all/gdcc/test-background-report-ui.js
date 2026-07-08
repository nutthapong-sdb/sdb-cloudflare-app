/**
 * E2E UI Test: GDCC Background Report Generation using custom 'GDCC' template.
 * Runs in NON-HEADLESS mode so the user can watch the browser automation.
 * Steps:
 * 1. Login.
 * 2. Navigate to GDCC.
 * 3. Do NOT select filters on dashboard, click 'Create Report' immediately.
 * 4. Inside the modal:
 *    - Select Account: 'Government Data Center and Cloud service (GDCC)'
 *    - Select Zone: 'sesalpglpn.go.th'
 *    - Select Template: 'GDCC'
 *    - Set date range: 2026-06-18 to 2026-06-24
 *    - Select Subdomain 'service.sesalpglpn.go.th'
 * 5. Click "Generate 1 Report".
 * 6. Click "View Progress" in SweetAlert to open Jobs Modal.
 * 7. Poll until status is "Completed", click Download, then delete job.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { login, log, colors, BASE_URL } = require('../libs/ui-helper');
const { navigateToGDCC } = require('../libs/gdcc-helper');

async function selectDropdownOption(page, dropdownLabel, optionText) {
    log(`   Selecting "${optionText}" in dropdown "${dropdownLabel}"...`, colors.cyan);
    
    // Check if it's a standard HTML select element
    const isStandardSelect = await page.evaluate((labelName) => {
        const modalContainer = document.querySelector('.fixed.inset-0');
        const searchRoot = modalContainer || document;
        const labels = Array.from(searchRoot.querySelectorAll('label'));
        const targetLabel = labels.find(lbl => lbl.textContent.trim().includes(labelName));
        if (!targetLabel) return false;
        
        // Find select element in the same container
        const container = targetLabel.closest('div');
        return !!(container && container.querySelector('select'));
    }, dropdownLabel);
    
    if (isStandardSelect) {
        log(`      Standard HTML select detected. Selecting natively...`, colors.cyan);
        await page.evaluate((labelName, optText) => {
            const modalContainer = document.querySelector('.fixed.inset-0');
            const searchRoot = modalContainer || document;
            const labels = Array.from(searchRoot.querySelectorAll('label'));
            const targetLabel = labels.find(lbl => lbl.textContent.trim().includes(labelName));
            const select = targetLabel.closest('div').querySelector('select');
            
            const option = Array.from(select.options).find(opt => opt.text.trim().includes(optText));
            if (!option) throw new Error(`Option "${optText}" not found in select "${labelName}"`);
            
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            select.dispatchEvent(new Event('input', { bubbles: true }));
        }, dropdownLabel, optionText);
        await new Promise(r => setTimeout(r, 1000));
        return;
    }

    // 1. Get coordinates of the trigger element inside the modal
    const triggerRect = await page.evaluate((labelName) => {
        const modalContainer = document.querySelector('.fixed.inset-0');
        const searchRoot = modalContainer || document;
        const labels = Array.from(searchRoot.querySelectorAll('label'));
        const targetLabel = labels.find(lbl => lbl.textContent.trim().includes(labelName));
        if (!targetLabel) return null;
        
        const container = targetLabel.closest('.relative').querySelector('div[tabindex="0"]');
        if (!container) return null;
        
        const r = container.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, dropdownLabel);
    
    if (!triggerRect) {
        throw new Error(`Dropdown label "${dropdownLabel}" not found in modal`);
    }
    
    // Click the trigger to open dropdown and focus search input
    await page.mouse.click(triggerRect.x, triggerRect.y);
    await new Promise(r => setTimeout(r, 600));
    
    // Wait for dropdown loading state to complete (in case of async data fetch)
    await page.waitForFunction(() => {
        const listContainer = document.querySelector('.absolute.z-\\[120\\]');
        if (!listContainer) return false;
        return !listContainer.textContent.includes('Loading...');
    }, { timeout: 15000 }).catch(() => {});
    
    // Explicitly find the search input inside the active dropdown in the modal
    const inputSelector = '.fixed.inset-0 input[placeholder="Search..."]';
    await page.waitForSelector(inputSelector, { visible: true, timeout: 5000 });
    
    // Clear any default text natively
    await page.$eval(inputSelector, el => el.value = '');
    // Type target text to filter option list
    await page.type(inputSelector, optionText);
    await new Promise(r => setTimeout(r, 800));
    
    // 3. Click the filtered option coordinates
    const optionRect = await page.evaluate((optText) => {
        const listContainer = document.querySelector('.absolute.z-\\[120\\]');
        if (!listContainer) return { error: true, msg: 'Options container .absolute.z-[120] not found' };
        
        const optionHeaders = Array.from(listContainer.querySelectorAll('.font-medium'));
        const targetOption = optionHeaders.find(el => el.textContent.trim() === optText)?.closest('.cursor-pointer');
        if (!targetOption) {
            return {
                error: true,
                options: optionHeaders.map(el => el.textContent.trim())
            };
        }
        
        const r = targetOption.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, optionText);
    
    if (!optionRect || optionRect.error) {
        if (optionRect && optionRect.options) {
            log(`      [DEBUG] Available options in list: ${JSON.stringify(optionRect.options)}`, colors.yellow);
        } else if (optionRect && optionRect.msg) {
            log(`      [DEBUG] Error: ${optionRect.msg}`, colors.yellow);
        }
        throw new Error(`Option "${optionText}" not found in filtered dropdown list`);
    }
    
    // Click the option coordinates
    await page.mouse.click(optionRect.x, optionRect.y);
    await new Promise(r => setTimeout(r, 1200));
}

(async () => {
    log('========================================================', colors.blue);
    log('🧪 GDCC Background Report UI Test - Visible Browser Mode', colors.blue);
    log('========================================================', colors.blue);
    
    const downloadPath = path.resolve(__dirname, 'downloads_tmp');
    if (fs.existsSync(downloadPath)) {
        fs.rmSync(downloadPath, { recursive: true, force: true });
    }
    fs.mkdirSync(downloadPath, { recursive: true });

    // Launch visible browser (headless: false)
    log('🚀 Launching visible Chromium browser...', colors.cyan);
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,800'
        ]
    });
    
    let page;
    try {
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath
        });

        // 1. Perform Login
        await login(page);

        // 2. Navigate to GDCC Dashboard
        log('\n🔹 Step 1: Navigating to GDCC Dashboard...', colors.blue);
        await navigateToGDCC(page);
        await new Promise(r => setTimeout(r, 2000));

        // Wait for parent page accounts list to load
        log('   Waiting for dashboard accounts to load...', colors.cyan);
        await page.waitForFunction(() => {
            const labels = Array.from(document.querySelectorAll('label'));
            const accLabel = labels.find(lbl => lbl.textContent.trim().includes('Select Account'));
            if (!accLabel) return false;
            const container = accLabel.closest('.relative')?.querySelector('div[tabindex="0"]');
            if (!container) return false;
            const text = container.textContent.trim();
            return text !== 'Loading...' && text !== '';
        }, { timeout: 30000 });

        // 3. Open Create Report Modal immediately (without selecting dashboard filters)
        log('\n🔹 Step 2: Clicking "Create Report" immediately...', colors.blue);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const createBtn = btns.find(b => b.textContent.trim() === 'Create Report' && !b.disabled);
            if (createBtn) createBtn.click();
        });
        await page.waitForSelector('.fixed.inset-0', { visible: true, timeout: 5000 });
        await new Promise(r => setTimeout(r, 1000));

        // 4. Select Account in Modal
        log('\n🔹 Step 3: Selecting Account in Modal...', colors.blue);
        await selectDropdownOption(page, 'Cloudflare Account', 'Government Data Center and Cloud service (GDCC)');

        // Wait for Zones to load in the modal
        log('   Waiting for Zones to load...', colors.cyan);
        await new Promise(r => setTimeout(r, 2000)); // Allow React render tick to start loading
        await page.waitForFunction(() => {
            const labels = Array.from(document.querySelectorAll('label'));
            const zoneLabel = labels.find(lbl => lbl.textContent.trim().includes('Zone (Domain)'));
            if (!zoneLabel) return false;
            
            const container = zoneLabel.closest('.relative').querySelector('div[tabindex="0"]');
            if (!container) return false;
            
            const text = container.textContent.trim();
            // Ready when it is NOT loading and does NOT say "Select Account first"
            return !text.includes('Loading...') && !text.includes('Select Account first');
        }, { timeout: 20000 });

        // 5. Select Zone in Modal
        log('\n🔹 Step 4: Selecting Zone in Modal...', colors.blue);
        await selectDropdownOption(page, 'Zone (Domain)', 'sesalpglpn.go.th');

        // 6. Select Template in Modal
        log('\n🔹 Step 5: Selecting "GDCC" Template in Modal...', colors.blue);
        await selectDropdownOption(page, 'Report Template', 'GDCC');

        // 7. Set Date Range in Modal
        log('\n🔹 Step 6: Setting Date Range in Modal...', colors.blue);
        await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input[type="date"]'));
            inputs.forEach(input => input.removeAttribute('max'));
        });
        await new Promise(r => setTimeout(r, 500));

        const batchDateInputs = await page.$$('input[type="date"]');
        if (batchDateInputs.length >= 2) {
            await page.evaluate((el, val) => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, batchDateInputs[0], '2026-06-18');

            await page.evaluate((el, val) => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, batchDateInputs[1], '2026-06-24');
            log('   ✅ Dates set: 2026-06-18 to 2026-06-24', colors.green);
        } else {
            throw new Error('Date inputs not found in modal');
        }
        await new Promise(r => setTimeout(r, 500));

        // Wait for Subdomains to load in the modal
        log('   Waiting for Subdomains to load...', colors.cyan);
        await new Promise(r => setTimeout(r, 600)); // Allow React render tick to start loading
        await page.waitForFunction(() => {
            const modalBody = document.querySelector('.fixed.inset-0');
            if (!modalBody) return false;
            
            const text = modalBody.textContent.trim();
            // Ready when it is NOT loading and does NOT say "Select Zone first"
            return !text.includes('Loading subdomain list...') && !text.includes('Select Zone first');
        }, { timeout: 20000 });

        // 8. Select Subdomain 'service.sesalpglpn.go.th'
        log('\n🔹 Step 7: Selecting subdomain "service.sesalpglpn.go.th"...', colors.blue);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('div.fixed.inset-0 button'));
            const deselectBtn = btns.find(b => b.textContent.trim() === 'Deselect All' || b.textContent.trim().includes('Deselect All'));
            if (deselectBtn) deselectBtn.click();
        });
        await new Promise(r => setTimeout(r, 500));

        await page.evaluate(() => {
            const labels = Array.from(document.querySelectorAll('label'));
            const portalLabel = labels.find(lbl => lbl.textContent.trim() === 'service.sesalpglpn.go.th');
            if (portalLabel) {
                portalLabel.scrollIntoView({ block: 'center', inline: 'center' });
                portalLabel.click();
            } else {
                throw new Error('service.sesalpglpn.go.th label not found');
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        // 9. Click Generate
        log('\n🔹 Step 8: Clicking "Generate 1 Report"...', colors.blue);
        const generateClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const genBtn = btns.find(b => b.textContent.trim().startsWith('Generate 1 Report') && !b.disabled);
            if (genBtn) {
                genBtn.click();
                return true;
            }
            return false;
        });
        if (!generateClicked) throw new Error('Generate button not found/disabled');

        // 10. Wait for SweetAlert and click "View Progress"
        log('\n🔹 Step 9: Waiting for SweetAlert queue confirmation...', colors.blue);
        await page.waitForFunction(() => {
            const titleEl = document.querySelector('.swal2-title');
            return titleEl && titleEl.textContent.trim().includes('Job Queued');
        }, { timeout: 15000 });
        log('   ✅ Job queued successfully.', colors.green);

        log('\n🔹 Step 10: Clicking "View Progress" to open Jobs Modal...', colors.blue);
        await page.evaluate(() => {
            const btn = document.querySelector('.swal2-confirm');
            if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 1500));

        // 11. Monitor Progress until Completed
        log('\n🔹 Step 11: Monitoring Background Jobs Modal...', colors.blue);
        const start = Date.now();
        let success = false;

        while (Date.now() - start < 180000) { // 3 minutes timeout
            const jobStatusText = await page.evaluate(() => {
                const statusBadge = document.querySelector('span[class*="bg-green-500/10"], span[class*="bg-blue-500/10"], span[class*="bg-yellow-500/10"]');
                return statusBadge ? statusBadge.textContent.trim() : 'Not Found';
            });

            log(`   [UI Poller] Current UI status: ${jobStatusText}`, colors.yellow);

            if (jobStatusText.includes('Completed')) {
                success = true;
                break;
            } else if (jobStatusText.includes('Failed')) {
                throw new Error('Job failed in UI');
            }

            await new Promise(r => setTimeout(r, 4000));
        }

        if (!success) {
            throw new Error('E2E Timeout: Job status did not change to Completed.');
        }

        // 12. Click Download
        log('\n🔹 Step 12: Clicking Download button on the UI...', colors.blue);
        await page.evaluate(() => {
            const dlBtn = Array.from(document.querySelectorAll('a')).find(a => a.textContent.trim().includes('Download'));
            if (dlBtn) dlBtn.click();
        });
        
        // Wait for file download to complete in downloads_tmp
        log('   Waiting for file download to complete...', colors.cyan);
        let downloadedFile = null;
        const dlStart = Date.now();
        while (Date.now() - dlStart < 30000) { // 30 seconds timeout
            const files = fs.readdirSync(downloadPath);
            // Look for a finished file (ends with .docx or .zip, and does not have .crdownload)
            const finished = files.find(f => (f.endsWith('.docx') || f.endsWith('.zip')) && !f.endsWith('.crdownload'));
            const isDownloading = files.some(f => f.includes('.crdownload'));
            if (finished && !isDownloading) {
                downloadedFile = finished;
                break;
            }
            await new Promise(r => setTimeout(r, 500));
        }
        
        if (!downloadedFile) {
            throw new Error('Download timed out or failed.');
        }
        log(`   ✅ Download completed: ${downloadedFile}`, colors.green);
        
        // Move file to user's system Downloads folder
        const sourcePath = path.join(downloadPath, downloadedFile);
        const userDownloadsFolder = path.join(os.homedir(), 'Downloads');
        const destPath = path.join(userDownloadsFolder, downloadedFile);
        fs.copyFileSync(sourcePath, destPath);
        log(`   ✅ Copied downloaded report file to: ${destPath}`, colors.green);
        
        // Clean up temporary download folder
        fs.rmSync(downloadPath, { recursive: true, force: true });

        // 13. Delete job log
        log('\n🔹 Step 13: Cleaning up job log via Trash button...', colors.blue);
        await page.evaluate(() => {
            const deleteBtn = document.querySelector('button[title="Delete Job Log"]');
            if (deleteBtn) deleteBtn.click();
        });
        await new Promise(r => setTimeout(r, 1000));
        await page.evaluate(() => {
            const confirmBtn = document.querySelector('.swal2-confirm');
            if (confirmBtn) confirmBtn.click();
        });
        await new Promise(r => setTimeout(r, 1500));
        log('✅ E2E UI Test completed successfully.', colors.green);

    } catch (e) {
        log(`❌ Test Failed: ${e.message}`, colors.red);
        // Clean up temp folder on failure
        try {
            if (fs.existsSync(downloadPath)) {
                fs.rmSync(downloadPath, { recursive: true, force: true });
            }
        } catch (_) {}
    } finally {
        // Keep browser open for 5 seconds so the user can inspect before it closes
        log('🔹 Closing browser in 5 seconds...', colors.cyan);
        await new Promise(r => setTimeout(r, 5000));
        if (browser) await browser.close();
    }
})();
