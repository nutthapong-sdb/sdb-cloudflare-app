const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: ['.env.local', '.env'] });

const BASE_URL = 'http://localhost:8002';
const TMP_DOWNLOAD_DIR = path.join(__dirname, '../tmp_downloads');

if (!fs.existsSync(TMP_DOWNLOAD_DIR)) fs.mkdirSync(TMP_DOWNLOAD_DIR);

const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    red: "\x1b[31m",
    cyan: "\x1b[36m"
};

function log(msg, color = colors.reset) {
    console.log(`${color}${msg}${colors.reset}`);
}

async function setupBrowser() {
    log('🚀 Setting up Browser...', colors.cyan);
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 800 }
    });
    return browser;
}

async function setupPage(browser) {
    const page = await browser.newPage();
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: TMP_DOWNLOAD_DIR,
    });
    return page;
}

async function login(page) {
    log('🔹 Performing Login...', colors.blue);
    try {
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (e) {
        log(`    ⚠️ Navigation timeout (HMR likely), proceeding...`, colors.yellow);
    }

    // Check if already logged in (redirected)
    if (page.url().includes('/login')) {
        await page.waitForSelector('input[type="text"]', { visible: true }); // Ensure input visible
        await page.type('input[type="text"]', 'root');
        await page.type('input[type="password"]', 'password');

        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(e => log(`    ⚠️ Login nav timeout, checking URL...`, colors.yellow)),
        ]);
    }

    // Check if redirected to dashboard or systems
    const url = page.url();
    if (url.includes('/login')) {
        throw new Error('Login Failed: Still on login page');
    }
    log('✅ Login Successful', colors.green);
}

async function checkAnyDownload(timeout = 10000) {
    log(`    Waiting for ANY file download...`, colors.reset);
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const files = fs.readdirSync(TMP_DOWNLOAD_DIR);
        if (files.length > 0 && !files[0].endsWith('.crdownload')) {
            const fileName = files[0];
            const filePath = path.join(TMP_DOWNLOAD_DIR, fileName);
            const stats = fs.statSync(filePath);

            // Delete file after check to keep clean for next test
            fs.unlinkSync(filePath);

            log(`    ✅ File downloaded: ${fileName} (${stats.size} bytes)`, colors.green);
            return true;
        }
        await new Promise(r => setTimeout(r, 500));
    }
    log(`    ❌ Download Verification Failed: No file found`, colors.red);
    return false;
}

// Export functions
module.exports = {
    setupBrowser,
    setupPage,
    login,
    checkAnyDownload,
    log,
    colors,
    BASE_URL,
    TMP_DOWNLOAD_DIR
};
