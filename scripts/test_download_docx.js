const { setupBrowser, setupPage, login, log, colors, BASE_URL, TMP_DOWNLOAD_DIR } = require('./test-all/libs/ui-helper');
const fs = require('fs');
const path = require('path');

(async () => {
    // 1. Setup Browser & Page
    const browser = await setupBrowser();
    try {
        const page = await setupPage(browser);

        // 2. Login
        // User requested to use credentials from .env.local
        // ui-helper already loads .env.local
        // We will try to use TEST_USER/TEST_PASSWORD if available, otherwise fallback to admin/password
        const username = process.env.TEST_USER || 'root';
        const password = process.env.TEST_PASSWORD || 'password';

        log(`🔹 Using Credentials: ${username} / ${password ? '******' : '(empty)'}`, colors.blue);

        // Override login function behavior to specific creds if needed, or just use the helper's login 
        // which defaults to typing 'admin'/'password' ONLY if it finds the input.
        // Let's manually login here to be sure we use the intended credentials.

        log('🔹 Performing Login...', colors.blue);
        try {
            await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
        } catch (e) {
            log(`    ⚠️ Navigation timeout (HMR likely), proceeding...`, colors.yellow);
        }

        if (page.url().includes('/login')) {
            await page.waitForSelector('input[type="text"]', { visible: true });
            await page.type('input[type="text"]', username);
            await page.type('input[type="password"]', password);

            await Promise.all([
                page.click('button[type="submit"]'),
                page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(e => log(`    ⚠️ Login nav timeout, checking URL...`, colors.yellow)),
            ]);
        }

        const url = page.url();
        if (url.includes('/login')) {
            throw new Error('Login Failed: Still on login page. Please check credentials in .env.local');
        }
        log('✅ Login Successful', colors.green);

        // 3. Navigate to GDCC System
        log('🔹 Navigating to GDCC System...');

        // Capture console logs to detect auto-selection


        await page.goto(`${BASE_URL}/systems/gdcc`, { waitUntil: 'domcontentloaded' });

        log('🔹 Waiting for "Create Report" button to be enabled (Data Loaded)...');
        try {
            await page.waitForFunction(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const btn = btns.find(b => b.textContent && b.textContent.includes('Create Report'));
                return btn && !btn.disabled;
            }, { timeout: 30000 });
            log('✅ "Create Report" button is ready.', colors.green);
        } catch (e) {
            log('⚠️ Timeout waiting for Create Report button. Data might not be loaded.', colors.yellow);
        }

        await new Promise(r => setTimeout(r, 1000)); // Stability wait


        // 4. Create Report -> Select Host -> Generate
        log('🔹 Opening Create Report Modal...');
        // Puppeteer > 22 removed waitForXPath. Use waitForSelector with specific selector or text match.
        // Or wait for the element to be present.
        // Let's use handle and waitForFunction if specific text is needed, or xpath selector.
        // Puppeteer v24 supports 'xpath/...'
        const createBtn = await page.waitForSelector('xpath///button[contains(text(), "Create Report")]', { visible: true, timeout: 15000 });
        if (createBtn) await createBtn.click();
        else throw new Error("Create Report button not found");

        await new Promise(r => setTimeout(r, 1000)); // Wait for modal animation

        // Select 30 Days
        log('🔹 Selecting Time Range: 30 Days...');
        const rangeBtn = await page.waitForSelector('xpath///button[contains(text(), "30 Days")]', { visible: true });
        if (rangeBtn) await rangeBtn.click();

        // Check for "No sub-domains available"
        // $x is still valid on page object? No, likely deprecated too? No, $x is usually an alias for mainFrame.$x
        // But page.$x is deprecated. Use page.$$('xpath/...')
        try {
            const noData = await page.$$('xpath///div[contains(text(), "No sub-domains available")]');
            if (noData.length > 0) {
                log('⚠️ No subdomains available. Creating a report might fail if no host selected.', colors.yellow);
            } else {
                // Deselect All
                const toggleAllBtn = await page.$$('xpath///button[contains(text(), "Deselect All")]');
                if (toggleAllBtn.length > 0) {
                    await toggleAllBtn[0].click();
                    await new Promise(r => setTimeout(r, 200));
                }
                // Select First Host
                const labels = await page.$$('label.cursor-pointer');
                if (labels.length > 0) {
                    await labels[0].click();
                    log('✅ Selected 1st host for testing.');
                } else {
                    log('⚠️ No host checkboxes found.', colors.yellow);
                }
            }
        } catch (e) {
            log(`⚠️ Error checking subdomains: ${e.message}`, colors.yellow);
        }

        // 5. Click Generate and Wait for Download
        log('🔹 Clicking Generate Reports...');

        // Clean up tmp dir before start
        try {
            const files = fs.readdirSync(TMP_DOWNLOAD_DIR);
            for (const file of files) {
                // Ignore if file is busy, but try to clean
                try { fs.unlinkSync(path.join(TMP_DOWNLOAD_DIR, file)); } catch (e) { }
            }
        } catch (e) { }

        // Find the Generate button in the modal.
        // We know "Generate Dashboard" is always present. We want the OTHER one.
        const generateBtn = await page.waitForFunction(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const targets = btns.filter(b => b.textContent && b.textContent.includes('Generate') && !b.textContent.includes('Dashboard'));
            // Assume the modal button is the last one rendered (z-index/portal usually appends to end)
            return targets.length > 0 ? targets[targets.length - 1] : null;
        }, { timeout: 10000 });

        if (generateBtn) {
            await generateBtn.click();
        } else {
            throw new Error("Generate report button not found (filtered out 'Generate Dashboard')");
        }


        // Wait for Swal loading
        try {
            await page.waitForSelector('.swal2-container', { visible: true, timeout: 5000 });
            log('🔹 Loading modal appeared.', colors.blue);
        } catch (e) {
            log('⚠️ Loading modal did not appear within 5s', colors.yellow);
        }

        log('⏳ Waiting for .docx download (Timeout 60s)...');

        const start = Date.now();
        let downloadedFile = null;

        while (Date.now() - start < 120000) {
            const currentFiles = fs.readdirSync(TMP_DOWNLOAD_DIR);
            // Log every 5 seconds
            if ((Date.now() - start) % 5000 < 100) {
                // console.log('Current files in tmp:', currentFiles);
            }

            const found = currentFiles.find(f => (f.endsWith('.doc')) && !f.endsWith('.crdownload'));
            if (found) {
                downloadedFile = found;
                break;
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        if (downloadedFile) {
            const filePath = path.join(TMP_DOWNLOAD_DIR, downloadedFile);
            const stats = fs.statSync(filePath);
            log(`✅ Success! Downloaded: ${downloadedFile}`, colors.green);
            log(`📦 File Size: ${stats.size} bytes`, colors.green);

            if (stats.size < 2000) {
                log(`⚠️ Warning: File size is curiously small (${stats.size} bytes). Possible corruption?`, colors.yellow);
            }

        } else {
            const allFiles = fs.readdirSync(TMP_DOWNLOAD_DIR);
            log(`❌ Timeout! Files found in directory: ${JSON.stringify(allFiles)}`, colors.red);
            throw new Error('Timeout: No .docx file downloaded within 120s');
        }


    } catch (error) {
        log(`❌ Test Failed: ${error.message}`, colors.red);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
