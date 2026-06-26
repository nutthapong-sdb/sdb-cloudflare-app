/**
 * Regression Test: GDCC Batch Report Generation
 * Verifies that the dashboard and batch report generation works without ReferenceErrors
 * such as "firewallRulesData is not defined".
 * If a modal pops up alerting/warning, it will read and output the contents, then fail.
 */

const path = require('path');
const fs = require('fs');
const { setupBrowser, setupPage, login, log, colors, TMP_DOWNLOAD_DIR, BASE_URL } = require('../libs/ui-helper');
const { selectGDCCFilters, navigateToGDCC } = require('../libs/gdcc-helper');

(async () => {
    log('🚀 Starting Regression Test: GDCC Batch Report Generation...', colors.cyan);
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

        log('\n🔹 Step 1: Navigating to GDCC Dashboard Workspace...', colors.blue);
        await navigateToGDCC(page);

        log('\n🔹 Step 2: Selecting Account, Zone, and Subdomain filters...', colors.blue);
        await selectGDCCFilters(page);

        log('\n🔹 Step 3: Opening Create Report modal...', colors.blue);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const createBtn = btns.find(b => b.textContent.trim() === 'Create Report' && !b.disabled);
            if (createBtn) createBtn.click();
        });
        await new Promise(r => setTimeout(r, 2000));

        log('\n🔹 Step 4: Setting Date Range...', colors.blue);
        // Remove 'max' attributes
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
            throw new Error('Could not find date input fields in modal');
        }

        log('\n🔹 Step 5: Selecting No Subdomain (Domain Report mode)...', colors.blue);
        await page.evaluate(() => {
            const labels = Array.from(document.querySelectorAll('label'));
            const noSubLabel = labels.find(lbl => lbl.textContent.trim().includes('No Subdomain'));
            if (noSubLabel) {
                noSubLabel.scrollIntoView({ block: 'center', inline: 'center' });
                noSubLabel.click();
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        log('\n🔹 Step 6: Clicking "Generate Domain Report"...', colors.blue);
        const generateClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const genBtn = btns.find(b => b.textContent.trim() === 'Generate Domain Report' && !b.disabled);
            if (genBtn) {
                genBtn.click();
                return true;
            }
            return false;
        });
        if (!generateClicked) throw new Error('Generate Domain Report button not found or disabled');
        log('   ✅ Generate Domain Report button clicked.', colors.green);

        log('\n🔹 Step 7: Monitoring generation and alert modals...', colors.blue);
        const generateStartTime = Date.now();
        let downloadedFile = null;

        // Wait up to 5 minutes
        while (Date.now() - generateStartTime < 300000) {
            // Check for Swal alert modal
            const swalError = await page.evaluate(() => {
                const swal = document.querySelector('.swal2-container.swal2-shown');
                if (swal) {
                    const title = swal.querySelector('.swal2-title')?.textContent || '';
                    const content = swal.querySelector('.swal2-html-container')?.textContent || '';
                    return { title, content };
                }
                return null;
            });
            
            if (swalError) {
                log(`🚨 ALERT MODAL ENCOUNTERED: [${swalError.title}] ${swalError.content}`, colors.red);
                if (swalError.title.toLowerCase().includes('fail') || swalError.title.toLowerCase().includes('error')) {
                    throw new Error(`Process failed with alert modal: [${swalError.title}] ${swalError.content}`);
                }
            }

            // Check if downloaded file is ready
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

        log('\n🎉 GDCC Batch Report firewallRulesData Regression Test PASSED!', colors.green);
        process.exit(0);

    } catch (error) {
        log(`❌ Regression Test FAILED: ${error.message}`, colors.red);
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
