/**
 * Live Inspection Test: GDCC Batch Report Zone Name Resolution
 * Runs Puppeteer in headful mode (HEADLESS=0) so the user can inspect the live browser.
 * It will select the GDCC filters, generate the dashboard, open the Create Report modal,
 * select "No Subdomain" (Domain Report mode), generate the report, and verify that the
 * @ZONE_NAME variable resolves correctly in the downloaded document.
 * 
 * At the end, it will wait for the user to press Enter in the console before closing the browser.
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { setupBrowser, setupPage, login, log, colors, TMP_DOWNLOAD_DIR, BASE_URL } = require('../libs/ui-helper');
const { selectGDCCFilters, navigateToGDCC, clickGenerateDashboard } = require('../libs/gdcc-helper');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

(async () => {
    log('🚀 Starting GDCC Zone Name Live Inspection Test...', colors.cyan);
    log('💡 HEADLESS=0 is forced so a browser window will open on your screen.', colors.yellow);
    
    // Force HEADLESS=0 for visual inspection
    process.env.HEADLESS = '0';
    
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

        log('\n🔹 Step 3: Clicking "Generate Dashboard" button to load data...', colors.blue);
        await clickGenerateDashboard(page);
        await new Promise(r => setTimeout(r, 2000));

        log('\n🔹 Step 4: Opening Create Report modal...', colors.blue);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const createBtn = btns.find(b => b.textContent.trim() === 'Create Report' && !b.disabled);
            if (createBtn) createBtn.click();
        });
        await new Promise(r => setTimeout(r, 2000));

        log('\n🔹 Step 5: Setting Date Range in Modal...', colors.blue);
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

        log('\n🔹 Step 6: Selecting No Subdomain (Domain Report mode)...', colors.blue);
        await page.evaluate(() => {
            const labels = Array.from(document.querySelectorAll('label'));
            const noSubLabel = labels.find(lbl => lbl.textContent.trim().includes('No Subdomain'));
            if (noSubLabel) {
                noSubLabel.scrollIntoView({ block: 'center', inline: 'center' });
                noSubLabel.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
                noSubLabel.click();
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        log('\n🔹 Step 7: Clicking "Generate Domain Report"...', colors.blue);
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

        log('\n🔹 Step 8: Monitoring generation and waiting for download...', colors.blue);
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
            await new Promise(r => setTimeout(r, 2000));
        }

        if (!downloadedFile) throw new Error('Timeout: No report file downloaded within 5 minutes');

        const filePath = path.join(TMP_DOWNLOAD_DIR, downloadedFile);
        const fileSize = fs.statSync(filePath).size;
        log(`\n✅ Downloaded successfully: ${downloadedFile} (${fileSize.toLocaleString()} bytes)`, colors.green);

        // Read and parse downloaded document
        log('🔹 Step 9: Verifying @ZONE_NAME resolution in downloaded document...', colors.blue);
        const docContent = fs.readFileSync(filePath, 'utf8');
        
        // Search for resolved domain name or unresolved @ZONE_NAME
        const hasUnresolvedZoneName = docContent.includes('@ZONE_NAME');
        const hasResolvedZoneName = docContent.includes('alro.go.th');
        
        if (hasResolvedZoneName) {
            log('🎉 SUCCESS: "@ZONE_NAME" was successfully replaced with "alro.go.th"!', colors.green);
        } else if (hasUnresolvedZoneName) {
            log('❌ FAILURE: "@ZONE_NAME" placeholder is still present in the document!', colors.red);
        } else {
            log('⚠️ WARNING: Neither "@ZONE_NAME" nor "alro.go.th" was found in the text. Let\'s check occurrences:', colors.yellow);
            // Print a snippet of where the domain name usually appears
            const snippet = docContent.substring(0, 2000);
            console.log(snippet);
        }

        log('\n🖥️  The browser is kept open for you to inspect everything.', colors.cyan);
        await question('👉 Press [Enter] in the terminal when you are ready to close the browser and exit the test... ');

    } catch (error) {
        log(`❌ Test FAILED: ${error.message}`, colors.red);
        if (error.stack) console.error(error.stack);
        await question('👉 Press [Enter] in the terminal to close the browser and exit... ');
    } finally {
        rl.close();
        await browser.close();
        log('👋 Browser closed. Test finished.', colors.cyan);
    }
})();
