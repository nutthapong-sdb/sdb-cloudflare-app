const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');

puppeteer.use(StealthPlugin());

// --- Configuration ---
const BASE_URL = 'http://localhost:8002';
const LOGIN_URL = `${BASE_URL}/login`;
const GDCC_URL = `${BASE_URL}/systems/gdcc`;
const DOWNLOAD_PATH = path.join(process.env.HOME, 'Downloads');

const TEST_USER = {
    username: 'root',
    password: 'password'
};

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m'
};

function log(msg, color = colors.reset) {
    console.log(`${color}${msg}${colors.reset}`);
}

async function runBatchReportTest() {
    log('🚀 Starting Batch Report Regression Test...', colors.cyan);

    // Note: Verify file existence in Downloads folder instead of cleaning it
    // because we don't want to delete user's files.

    const browser = await puppeteer.launch({
        headless: true, // Run headless as requested
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: DOWNLOAD_PATH,
        });

        // 1. Login
        log('1️⃣  Logging in...', colors.blue);
        await page.goto(LOGIN_URL, { waitUntil: 'networkidle0' });
        await page.type('input[type="text"], input[name="username"]', TEST_USER.username);
        await page.type('input[type="password"], input[name="password"]', TEST_USER.password);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);
        log('   Login successful.');

        // 2. Navigation to GDCC
        log('2️⃣  Navigating to GDCC...', colors.blue);
        await page.goto(GDCC_URL, { waitUntil: 'networkidle0' });

        // 3. Wait for Report Button (Dynamic Polling)
        log('3️⃣  Waiting for Report button to be ready...', colors.blue);
        const reportMenuBtnSelector = `xpath///button[contains(., "Report")]`;

        try {
            // Wait for button to appear in DOM
            await page.waitForSelector(reportMenuBtnSelector, { timeout: 30000 });
            const [menuBtn] = await page.$$(reportMenuBtnSelector);
            if (!menuBtn) throw new Error("Report menu button not found");

            // Poll until enabled (Check every 500ms)
            log('   Polling for button enabled state...');
            await page.waitForFunction(btn => !btn.disabled, { timeout: 30000, polling: 500 }, menuBtn);
            log('   ✅ "Report" button is enabled and ready.');

            await menuBtn.click();
            // Wait for menu animation
            await new Promise(r => setTimeout(r, 1000));

        } catch (e) {
            throw new Error(`Failed to interact with Report menu: ${e.message}`);
        }

        // 4. Click Batch Report Item
        const batchBtnSelector = `xpath///button[contains(., "Batch Report")]`;
        try {
            await page.waitForSelector(batchBtnSelector, { timeout: 5000 });
            const [batchBtn] = await page.$$(batchBtnSelector);
            if (!batchBtn) throw new Error("Batch Report button not found (menu might not be open)");

            await batchBtn.click();
            log('   Batch Report modal opened.');
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            throw new Error(`Failed to select Batch Report: ${e.message}`);
        }

        // 5. Select items and Generate
        log('4️⃣  Selecting Hosts and Generating...', colors.blue);
        const firstItemSelector = `xpath///div[contains(@class, "fixed")]//label[1]`;
        const hasItems = await page.$(firstItemSelector).catch(() => null);

        if (hasItems) {
            await hasItems.click();
            log('   Selected first host.');

            const generateBtnSelector = `xpath///button[contains(., "Generate")]`;
            const [genBtn] = await page.$$(generateBtnSelector);
            if (!genBtn) throw new Error("Generate button not found");

            log('   Clicking Generate...');
            await genBtn.click();

            // Wait for Success Alert
            log('   Waiting for generation to complete...');
            const okBtnSelector = `xpath///button[contains(@class, "swal2-confirm")]`;
            await page.waitForSelector(okBtnSelector, { timeout: 60000 });
            const [okBtn] = await page.$$(okBtnSelector);
            log('   ✅ Success Alert appeared!');

            // NEW REQUIREMENT: Wait 20 seconds before closing
            log('   ⏳ Waiting 20 seconds for download to finish (User requirement)...');
            await new Promise(r => setTimeout(r, 20000));

            // Close alert
            if (okBtn) await page.evaluate(el => el.click(), okBtn);

            // Verify Download
            log('   Checking for downloaded file...');
            let found = false;
            for (let i = 0; i < 5; i++) { // Check a few times
                const files = fs.readdirSync(DOWNLOAD_PATH);
                const file = files.find(f => f.endsWith('.doc'));
                if (file) {
                    log(`   ✅ File downloaded: ${file}`, colors.green);
                    found = true;
                    break;
                }
                await new Promise(r => setTimeout(r, 1000));
            }
            if (!found) log('   ⚠️ No file found in download folder yet.', colors.yellow);

        } else {
            log('   ⚠️ No sub-domain items found. Skipping generation.', colors.yellow);
        }

    } catch (error) {
        log(`❌ Test Failed: ${error.message}`, colors.red);
        process.exit(1);
    } finally {
        await browser.close();
        log('-----------------------------------');
        log('🏁 Batch Report Regression Test Completed', colors.cyan);
    }
}

runBatchReportTest();
