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
const { selectDropdown } = require('../libs/gdcc-helper');

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
        log('   -> Selecting Account: Softdebut POC', colors.gray);


        const acctOk = await selectDropdown(page, 0, 'Softdebut POC');
        if (!acctOk) throw new Error('Failed to select Account: Softdebut POC');

        // Select Zone: log.softdebut.online
        log('   -> Selecting Zone: log.softdebut.online', colors.gray);
        const zoneOk = await selectDropdown(page, 1, 'log.softdebut.online');
        if (!zoneOk) throw new Error('Failed to select Zone: log.softdebut.online');

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
            // Start Date: 2026-07-10
            await page.evaluate((el, val) => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, batchDateInputs[0], '2026-07-10');

            // End Date: 2026-07-12
            await page.evaluate((el, val) => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, batchDateInputs[1], '2026-07-12');
            log('   ✅ Dates set: 2026-07-10 to 2026-07-12', colors.green);
        } else {
            throw new Error('Could not find date input fields in modal');
        }

        log('\n🔹 Step 5: Skipping subdomain selection (selection UI was removed)...', colors.blue);
        await new Promise(r => setTimeout(r, 500));

        log('\n🔹 Step 6: Clicking "Generate Domain Report" button...', colors.blue);
        const clickedGenerate = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const genBtn = btns.find(b => (b.textContent || '').trim() === 'Generate Domain Report' && !b.disabled);
            if (genBtn) {
                genBtn.click();
                return true;
            }
            return false;
        });
        if (!clickedGenerate) throw new Error('"Generate Domain Report" button not found or is disabled');
        log('   ✅ Clicked Generate Domain Report', colors.green);

        log('\n🔹 Step 7: Waiting for report file download (max 5 min)...', colors.blue);
        const generateStartTime = Date.now();
        const start = Date.now();
        let downloadedFile = null;

        // 5 minutes timeout (300000ms)
        while (Date.now() - start < 300000) {
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
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
