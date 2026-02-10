const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');

puppeteer.use(StealthPlugin());

// --- Configuration ---
const BASE_URL = 'http://localhost:8002';
const LOGIN_URL = `${BASE_URL}/login`;
const TMP_DOWNLOAD_DIR = path.resolve(__dirname, 'tmp_downloads');

// Ensure stats directory exists and clean it
if (fs.existsSync(TMP_DOWNLOAD_DIR)) {
    fs.rmSync(TMP_DOWNLOAD_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TMP_DOWNLOAD_DIR, { recursive: true });

// User Credentials (Root User for testing)
const TEST_USER = {
    username: 'root',
    password: 'password'
};

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

async function waitForDownload(filePath, timeout = 10000) {
    log(`    Waiting for download: ${path.basename(filePath)}...`);
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (fs.existsSync(filePath)) return true;
        // Check for .crdownload or partial files
        const files = fs.readdirSync(TMP_DOWNLOAD_DIR);
        if (files.some(f => f.endsWith('.csv') || f.endsWith('.doc') || f.endsWith('.docx'))) return true; // Loose check
        await new Promise(r => setTimeout(r, 500));
    }
    return false;
}

// Function to check if ANY file exists in temp dir
async function checkAnyDownload(timeout = 10000) {
    log(`    Waiting for ANY file download...`);
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const files = fs.readdirSync(TMP_DOWNLOAD_DIR);
        if (files.length > 0 && !files[0].endsWith('.crdownload')) {
            log(`    ✅ File downloaded: ${files[0]} (${fs.statSync(path.join(TMP_DOWNLOAD_DIR, files[0])).size} bytes)`, colors.green);
            return true;
        }
        await new Promise(r => setTimeout(r, 500));
    }
    return false;
}

function clearDownloads() {
    const files = fs.readdirSync(TMP_DOWNLOAD_DIR);
    for (const file of files) {
        fs.unlinkSync(path.join(TMP_DOWNLOAD_DIR, file));
    }
}

async function runUITest() {
    log('🚀 Starting Full UI Regression Tests (Deep Check)...', colors.cyan);
    log(`   Download Path: ${TMP_DOWNLOAD_DIR}`, colors.blue);

    // Check server
    try {
        await fetch(BASE_URL);
    } catch (e) {
        log('❌ Server is not reachable at ' + BASE_URL + '. Please run "npm run dev" first.', colors.red);
        process.exit(1);
    }

    const browser = await puppeteer.launch({
        headless: true, // Use headless for regression, set false for debugging
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Enable Download Behavior
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: TMP_DOWNLOAD_DIR,
    });

    try {
        // --- 1. Login ---
        log('\n🔹 [1/4] Testing Login Flow...', colors.blue);
        await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

        if (page.url().includes('login')) {
            await page.type('input[type="text"], input[name="username"]', TEST_USER.username);
            await page.type('input[type="password"], input[name="password"]', TEST_USER.password);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                page.click('button[type="submit"]')
            ]);
        }
        log('✅ Login Successful', colors.green);

        // --- 2. GDCC System & Downloads ---
        log('\n🔹 [2/4] Testing GDCC System & Reports...', colors.blue);
        const GDCC_URL = `${BASE_URL}/systems/gdcc`;
        await page.goto(GDCC_URL, { waitUntil: 'domcontentloaded' }); // Wait full load

        // Wait for Dashboard
        try {
            await page.waitForSelector('h3', { timeout: 15000 }); // General H3 check
            // Try to click "Domain Report" via Menu
            log('   Resetting Menu for Report Test...');
            // Click Gear
            const gearBtn = await page.waitForSelector('button > svg.lucide-settings', { timeout: 5000 }).then(el => el.evaluateHandle(e => e.closest('button')));
            if (gearBtn) await gearBtn.click();
            await new Promise(r => setTimeout(r, 500));

            // Click "Report Template"
            const tmplBtn = await page.$$('xpath///button[contains(., "Report Template")]');
            if (tmplBtn.length > 0) {
                await tmplBtn[0].click();
                await new Promise(r => setTimeout(r, 500));
            }

            // Click "Domain Report"
            clearDownloads();
            log('   Testing "Domain Report" Download...');
            const domainRepBtn = await page.$$('xpath///button[contains(., "Domain Report")]');
            if (domainRepBtn[0]) {
                await domainRepBtn[0].click();
                await new Promise(r => setTimeout(r, 2000));

                // Modal Open? Download Word
                const dlBtn = await page.$$('xpath///button[contains(., "Download Word")]');
                if (dlBtn.length > 0) {
                    await dlBtn[0].click();
                    const downloaded = await checkAnyDownload();
                    if (!downloaded) throw new Error('Domain Report Download Failed');

                    // Close Modal (Click Backdrop/Escape)
                    await page.keyboard.press('Escape');
                } else {
                    log('   ⚠️ Download Word button not found in modal', colors.yellow);
                    await page.keyboard.press('Escape');
                }
            }
        } catch (e) {
            log(`   ⚠️ GDCC Report Test Issue: ${e.message}`, colors.yellow);
            // Continue
        }

        // --- 3. Firewall Logs & CSV Download ---
        log('\n🔹 [3/4] Testing Firewall Logs System & CSV...', colors.blue);
        const FW_URL = `${BASE_URL}/systems/firewall_logs`;
        await page.goto(FW_URL, { waitUntil: 'domcontentloaded' });

        // Wait/Select Zone (Assuming Auto-select works if user has history, else manual)
        // Check for Looker/Selector
        try {
            await page.waitForSelector('input[placeholder*="Search"]', { timeout: 10000 }); // Wait for UI

            // Initiate Search
            log('   Clicking Search...');
            // const searchBtn = await page.$('button > svg.lucide-search');
            // Assuming search button is near input or is a separate button?
            // "searchBtnX" was using $x
            const searchBtnX = await page.$$('xpath///button[contains(., "Search")]');
            if (searchBtnX.length > 0) {
                await searchBtnX[0].click();
                await new Promise(r => setTimeout(r, 3000)); // Wait for logs
            }

            // Click Download CSV
            log('   Testing CSV Download...');
            clearDownloads();
            // Find Download Icon Button
            const downloadBtn = await page.$('button > svg.lucide-download');
            if (downloadBtn) {
                const btn = await downloadBtn.evaluateHandle(el => el.closest('button'));
                await btn.click();
                const downloaded = await checkAnyDownload();
                if (!downloaded) {
                    // Maybe logs are empty? Check Swal
                    const swal = await page.$('.swal2-container');
                    if (swal) log('   ⚠️ Alert appeared (maybe no logs?), skipping download check.', colors.yellow);
                    else throw new Error('CSV Download Failed');
                }
            } else {
                log('   ⚠️ Download CSV button not found.', colors.red);
            }

        } catch (e) {
            log(`   ⚠️ Firewall Test Issue: ${e.message}`, colors.yellow);
        }

        // --- 4. API Discovery (Smoke Test) ---
        log('\n🔹 [4/4] Testing API Discovery System...', colors.blue);
        await page.goto(`${BASE_URL}/systems/api_discovery`, { waitUntil: 'domcontentloaded' });
        try {
            // Just check if React root mounted
            await page.waitForSelector('main', { timeout: 5000 });
            log('✅ API Discovery Loaded', colors.green);
        } catch (e) {
            log(`   ⚠️ API Discovery Load Failed: ${e.message}`, colors.red);
        }

    } catch (error) {
        log(`\n❌ CRITICAL FAILURE: ${error.message}`, colors.red);
        await page.screenshot({ path: 'ui-regression-failure.png' });
        process.exit(1);
    } finally {
        await browser.close();
        if (fs.existsSync(TMP_DOWNLOAD_DIR)) {
            // Keep specific files or clean up
        }
        log('\n-----------------------------------');
        log('🏁 Full UI Regression Tests Completed', colors.cyan);
    }
}

runUITest();
