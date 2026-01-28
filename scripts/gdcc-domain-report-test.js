const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

puppeteer.use(StealthPlugin());

// --- Configuration ---
const BASE_URL = 'http://localhost:8002';
const GDCC_URL = `${BASE_URL}/systems/gdcc`;
const LOGIN_URL = `${BASE_URL}/login`;

// User Credentials (Root User for testing)
const TEST_USER = {
    username: 'root',
    password: 'password'
};

// Download directory (Puppeteer default is ~/Downloads)
const DOWNLOADS_DIR = path.join(require('os').homedir(), 'Downloads');

// Colors for console
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(msg, color = colors.reset) {
    console.log(`${color}${msg}${colors.reset}`);
}

function getLatestDownloadedFile(directory) {
    const files = fs.readdirSync(directory)
        .filter(file => {
            // Exclude Word temp files (start with ~$)
            if (file.startsWith('~$')) return false;
            // Only .doc and .docx files
            return file.endsWith('.doc') || file.endsWith('.docx');
        })
        .map(file => ({
            name: file,
            time: fs.statSync(path.join(directory, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

    return files.length > 0 ? path.join(directory, files[0].name) : null;
}

function openFile(filePath) {
    return new Promise((resolve, reject) => {
        const command = process.platform === 'darwin'
            ? `open "${filePath}"`
            : process.platform === 'win32'
                ? `start "" "${filePath}"`
                : `xdg-open "${filePath}"`;

        exec(command, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

async function runGDCCDomainReportTest() {
    log('🚀 Starting GDCC Domain Report Test...', colors.cyan);
    log('-----------------------------------');

    // Check if server is running
    try {
        await fetch(BASE_URL);
    } catch (e) {
        log('❌ Server is not reachable at ' + BASE_URL + '. Please run "npm run dev" first.', colors.red);
        process.exit(1);
    }

    const browser = await puppeteer.launch({
        headless: true, // Run in headless mode (invisible)
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,800'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        // ===== STEP 1: Login =====
        log('\n1️⃣  Testing Login Flow...', colors.blue);
        await page.goto(LOGIN_URL, { waitUntil: 'networkidle0' });

        if (page.url() !== LOGIN_URL) {
            log('  Already logged in or redirected.', colors.yellow);
        } else {
            log('  Entering credentials...');
            await page.type('input[type="text"], input[name="username"]', TEST_USER.username);
            await page.type('input[type="password"], input[name="password"]', TEST_USER.password);

            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }),
                page.click('button[type="submit"]')
            ]);
            log('  Login submitted.');
        }

        if (page.url().includes('login')) {
            throw new Error('Login failed. Still on login page.');
        }
        log('✅ Login Successful', colors.green);

        // ===== STEP 2: Navigate to GDCC =====
        log('\n2️⃣  Navigating to GDCC System...', colors.blue);
        await page.goto(GDCC_URL, { waitUntil: 'networkidle0' });
        log('  Navigated to GDCC page.');

        // ===== STEP 3: Wait for automatic domain selection and click Report =====
        log('\n3️⃣  Waiting for automatic domain selection...', colors.blue);

        // Poll every 1 second to check if Report button is ready (max 30 seconds)
        // When ready, click it immediately
        const reportMenuBtn = `xpath///button[contains(., "Report")]`;
        let reportButtonClicked = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds max

        while (!reportButtonClicked && attempts < maxAttempts) {
            attempts++;

            try {
                // Check if Report button exists and is enabled
                const buttons = await page.$$(reportMenuBtn);
                if (buttons.length > 0) {
                    const isDisabled = await page.evaluate(el => {
                        return el.disabled || el.getAttribute('disabled') !== null;
                    }, buttons[0]);

                    if (!isDisabled) {
                        log(`  ✅ Report button ready after ${attempts} second(s)`, colors.green);

                        // CLICK IMMEDIATELY - don't wait for next step
                        log('\n4️⃣  Opening Domain Report...', colors.blue);
                        await buttons[0].click();
                        log('  Clicked "Report" menu button.');
                        reportButtonClicked = true;
                        break;
                    }
                }
            } catch (e) {
                // Button not found yet, continue waiting
            }

            // Wait 1 second before next check
            await new Promise(r => setTimeout(r, 1000));

            if (attempts % 5 === 0) {
                log(`  Still waiting... (${attempts}s elapsed)`, colors.yellow);
            }
        }

        if (!reportButtonClicked) {
            throw new Error('Report button did not become ready within 30 seconds');
        }

        log('✅ Domain auto-selection completed', colors.green);

        // Wait for menu to open
        await new Promise(r => setTimeout(r, 500));

        // Click Domain Report
        const domainReportBtn = `xpath///button[contains(., "Domain Report")]`;
        await page.waitForSelector(domainReportBtn, { timeout: 5000 });
        const [reportBtn] = await page.$$(domainReportBtn);

        if (!reportBtn) {
            throw new Error('Domain Report button not found');
        }

        await reportBtn.click();
        log('  Clicked "Domain Report".');
        await new Promise(r => setTimeout(r, 2000));

        // Verify modal opened
        const modalTitle = await page.$eval('h3.text-lg.font-bold', el => el.textContent).catch(() => null);
        if (modalTitle) {
            log(`  ✅ Domain Report Modal opened: "${modalTitle}"`, colors.green);
        } else {
            throw new Error('Domain Report modal did not open');
        }

        // ===== STEP 5: Click Download Doc Button =====
        log('\n5️⃣  Downloading Document...', colors.blue);

        // Record time before download
        const beforeDownload = Date.now();

        // Look for Download Doc button (adjust selector based on actual HTML)
        const downloadBtnSelector = `xpath///button[contains(., "Download Doc") or contains(., "Download")]`;
        await page.waitForSelector(downloadBtnSelector, { timeout: 5000 });
        const [downloadBtn] = await page.$$(downloadBtnSelector);

        if (!downloadBtn) {
            throw new Error('Download Doc button not found');
        }

        log('  Clicking "Download Doc" button...');
        await downloadBtn.click();

        // Wait for download to complete (wait for file to appear)
        log('  Waiting for download to complete...');
        await new Promise(r => setTimeout(r, 3000));

        log('✅ Download initiated', colors.green);

        // ===== STEP 6: Open Downloaded File =====
        log('\n6️⃣  Opening downloaded file...', colors.blue);

        // Find the latest downloaded .doc/.docx file
        const latestFile = getLatestDownloadedFile(DOWNLOADS_DIR);

        if (!latestFile) {
            throw new Error('No .doc/.docx file found in Downloads directory');
        }

        // Verify it was downloaded recently (within last 10 seconds)
        const fileStats = fs.statSync(latestFile);
        const fileAge = Date.now() - fileStats.mtime.getTime();

        if (fileAge > 10000) {
            log(`  ⚠️ Latest file is older than 10 seconds: ${path.basename(latestFile)}`, colors.yellow);
        }

        log(`  Latest downloaded file: ${path.basename(latestFile)}`);
        log(`  Full path: ${latestFile}`);

        // Open the file
        try {
            await openFile(latestFile);
            log('✅ File opened successfully', colors.green);
        } catch (error) {
            log(`⚠️ Could not open file automatically: ${error.message}`, colors.yellow);
            log(`  Please open manually: ${latestFile}`, colors.yellow);
        }

        // Keep browser open for a bit to see the result
        log('\n⏱️  Keeping browser open for 5 seconds...');
        await new Promise(r => setTimeout(r, 5000));

    } catch (error) {
        log(`\n❌ Test Failed: ${error.message}`, colors.red);
        await page.screenshot({ path: 'gdcc-domain-report-failure.png' });
        log('  Screenshot saved to gdcc-domain-report-failure.png', colors.yellow);
        process.exit(1);
    } finally {
        await browser.close();
        log('\n-----------------------------------');
        log('🏁 GDCC Domain Report Test Completed', colors.cyan);
    }
}

runGDCCDomainReportTest();
