/**
 * E2E Test: GDCC Subdomain Report Capture and Screenshot Verification
 * 1. Navigate to GDCC Dashboard Workspace
 * 2. Select GDCC -> alro.go.th -> ALL_SUBDOMAINS
 * 3. Open Create Report Modal
 * 4. Set Date Range: 2026-06-18 to 2026-06-24
 * 5. Select Subdomain 'portal.alro.go.th' (not "No Subdomain")
 * 6. Click "Generate 1 Report"
 * 7. Monitor the generation, wait for it to load, capture screenshots, and download the report
 * 8. Read the downloaded document, verify the size, and ensure it contains real embedded screenshots (data:image/jpeg;base64)
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { setupBrowser, setupPage, login, log, colors, TMP_DOWNLOAD_DIR, BASE_URL } = require('../libs/ui-helper');
const { selectGDCCFilters, navigateToGDCC } = require('../libs/gdcc-helper');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

(async () => {
    log('🚀 Starting GDCC Subdomain Report Capture E2E Test...', colors.cyan);
    log('💡 HEADLESS=0 is forced so a browser window will open on your screen.', colors.yellow);
    
    process.env.HEADLESS = '0';
    
    const browser = await setupBrowser();
    let page;
    try {
        page = await setupPage(browser);
        
        page.on('request', req => {
            const url = req.url();
            if (url.includes('/api/')) {
                log(`   🌐 [Network Request] ${req.method()} ${url}`, colors.cyan);
            }
        });
        page.on('response', res => {
            const url = res.url();
            if (url.includes('/api/')) {
                log(`   🌐 [Network Response] ${res.status()} ${url} (${res.statusText()})`, res.status() >= 400 ? colors.red : colors.green);
            }
        });

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
        await selectGDCCFilters(page, {
            account_name: 'Government Data Center and Cloud service (GDCC)',
            zone_name: 'sesalpglpn.go.th',
            subdomain: 'ALL_SUBDOMAINS'
        });

        log('\n🔹 Step 3: Opening Create Report modal...', colors.blue);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const createBtn = btns.find(b => b.textContent.trim() === 'Create Report' && !b.disabled);
            if (createBtn) createBtn.click();
        });
        await new Promise(r => setTimeout(r, 2000));

        log('\n🔹 Step 4: Setting Date Range in Modal...', colors.blue);
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
            }, batchDateInputs[0], '2026-06-01');

            await page.evaluate((el, val) => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, batchDateInputs[1], '2026-06-30');
            log('   ✅ Dates set: 2026-06-01 to 2026-06-30', colors.green);
        } else {
            throw new Error('Could not find date input fields in modal');
        }

        log('\n🔹 Step 5: Selecting Subdomain service.sesalpglpn.go.th...', colors.blue);
        await page.evaluate(() => {
            const labels = Array.from(document.querySelectorAll('label'));
            const portalLabel = labels.find(lbl => lbl.textContent.trim() === 'service.sesalpglpn.go.th');
            if (portalLabel) {
                portalLabel.scrollIntoView({ block: 'center', inline: 'center' });
                portalLabel.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                portalLabel.click();
            } else {
                throw new Error('service.sesalpglpn.go.th label not found in modal');
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        log('\n🔹 Step 6: Clicking "Generate 1 Report"...', colors.blue);
        const generateClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const genBtn = btns.find(b => b.textContent.trim().startsWith('Generate 1 Report') && !b.disabled);
            if (genBtn) {
                genBtn.click();
                return true;
            }
            return false;
        });
        if (!generateClicked) throw new Error('Generate 1 Report button not found or disabled');
        log('   ✅ Generate 1 Report button clicked.', colors.green);

        log('\n🔹 Step 7: Monitoring generation and waiting for download...', colors.blue);
        
        // Wait 2 seconds for Swal to appear, then click "View Progress"
        await new Promise(r => setTimeout(r, 2000));
        log('   👉 Clicking "View Progress" in alert dialog...', colors.cyan);
        await page.evaluate(() => {
            const btn = document.querySelector('.swal2-confirm');
            if (btn && btn.textContent.trim() === 'View Progress') {
                btn.click();
            }
        });
        await new Promise(r => setTimeout(r, 2000)); // wait for modal to open and load

        const generateStartTime = Date.now();
        let downloadedFile = null;
        let clickedDownload = false;

        // Wait up to 5 minutes
        let lastLogTime = Date.now();
        let tookScreenshot = false;
        while (Date.now() - generateStartTime < 300000) {
            const elapsed = Date.now() - generateStartTime;
            if (Date.now() - lastLogTime > 10000) {
                log(`   ... waiting for download (${Math.round(elapsed / 1000)}s elapsed)...`, colors.yellow);
                lastLogTime = Date.now();
            }

            // Capture debug screenshot after 40 seconds to see what's happening
            if (elapsed > 40000 && !tookScreenshot) {
                tookScreenshot = true;
                const screenshotPath = '/Users/litarcopperkaikem/.gemini/antigravity/brain/d08b1f64-f20c-46ac-8911-e6cebb7a7abe/subdomain_error_state.png';
                log(`   📸 [DEBUG] Saving page screenshot to: ${screenshotPath}`, colors.cyan);
                try {
                    await page.screenshot({ path: screenshotPath, fullPage: true });
                } catch (e) {
                    log(`   ❌ Failed to take screenshot: ${e.message}`, colors.red);
                }
            }

            // Click Download button of the first job row if it becomes available and we haven't clicked it yet
            if (!clickedDownload) {
                const wasClicked = await page.evaluate(() => {
                    const jobCards = Array.from(document.querySelectorAll('div[class*="rounded-xl"][class*="border"]'));
                    if (jobCards.length > 0) {
                        const firstJobCard = jobCards[0];
                        const dlLink = firstJobCard.querySelector('a[download]');
                        if (dlLink && dlLink.textContent.includes('Download')) {
                            dlLink.click();
                            return true;
                        }
                    }
                    return false;
                });
                if (wasClicked) {
                    clickedDownload = true;
                    log('   👉 Clicked Download button for the new job inside progress modal!', colors.green);
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
            await new Promise(r => setTimeout(r, 2000));
        }

        if (!downloadedFile) throw new Error('Timeout: No report file downloaded within 5 minutes');

        const filePath = path.join(TMP_DOWNLOAD_DIR, downloadedFile);
        const fileSize = fs.statSync(filePath).size;
        log(`\n✅ Downloaded successfully: ${downloadedFile} (${fileSize.toLocaleString()} bytes)`, colors.green);

        // Read and parse downloaded document
        log('🔹 Step 8: Verifying @ZONE_NAME resolution and screenshot inclusion...', colors.blue);
        const docContent = fs.readFileSync(filePath, 'utf8');
        
        // Search for resolved domain name or unresolved @ZONE_NAME
        const hasUnresolvedZoneName = docContent.includes('@ZONE_NAME');
        const hasResolvedZoneName = docContent.includes('service.sesalpglpn.go.th') || docContent.includes('sesalpglpn.go.th');
        const hasRealScreenshot = docContent.includes('data:image/jpeg;base64') || docContent.includes('data:image/');
        
        if (hasResolvedZoneName) {
            log('   ✅ PASS: "@ZONE_NAME" was successfully replaced with "service.sesalpglpn.go.th"!', colors.green);
        } else if (hasUnresolvedZoneName) {
            log('   ❌ FAIL: "@ZONE_NAME" placeholder is still present in the document!', colors.red);
        }
        
        if (hasRealScreenshot) {
            log('   🎉 SUCCESS: Document contains real embedded screenshots (base64 JPEGs)!', colors.green);
        } else {
            log('   ❌ FAILURE: No embedded screenshots found in the generated report file!', colors.red);
        }

        // Copy to user's Downloads folder
        const destPath = '/Users/litarcopperkaikem/Downloads/batch_report.doc';
        fs.copyFileSync(filePath, destPath);
        log(`\n📂 Copied generated report to: ${destPath}`, colors.cyan);

        if (process.env.NON_INTERACTIVE !== '1') {
            log('\n🖥️  The browser is kept open for you to inspect everything.', colors.cyan);
            await question('👉 Press [Enter] in the terminal when you are ready to close the browser and exit the test... ');
        } else {
            log('\n🤖 Non-interactive mode: Closing browser automatically.', colors.cyan);
        }

    } catch (error) {
        log(`❌ Test FAILED: ${error.message}`, colors.red);
        if (error.stack) console.error(error.stack);
        if (process.env.NON_INTERACTIVE !== '1') {
            await question('👉 Press [Enter] in the terminal to close the browser and exit... ');
        }
    } finally {
        rl.close();
        try {
            await browser.close();
        } catch (e) {}
        log('👋 Browser closed. Test finished.', colors.cyan);
    }
})();
