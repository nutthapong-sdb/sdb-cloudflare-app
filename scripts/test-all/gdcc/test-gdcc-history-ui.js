const { setupBrowser, setupPage, login, log, colors, BASE_URL } = require('../libs/ui-helper.js');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function verifyElement(page, selector, successMsg, errorMsg) {
    try {
        await page.waitForSelector(selector, { timeout: 10000 });
        if (successMsg) log(successMsg, colors.green);
    } catch (e) {
        if (errorMsg) log(errorMsg, colors.red);
        throw e;
    }
}

async function takeScreenshot(page, filename) {
    const dirPath = path.join(__dirname, '../../tmp_downloads');
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

    const filePath = path.join(dirPath, filename);
    await page.screenshot({ path: filePath });
    log(`📸 Screenshot saved: ${filename}`, colors.cyan);
}

async function testGDCCHistoryUI() {
    log('🧪 Starting GDCC History UI Test (Puppeteer)...', colors.cyan);

    let browser, page;
    try {
        browser = await setupBrowser();
        page = await setupPage(browser);
        await login(page);

        log('Navigate to GDCC Dashboard...', colors.blue);
        await page.goto(`${BASE_URL}/systems/gdcc`, { waitUntil: 'networkidle0' });

        await takeScreenshot(page, 'gdcc-dashboard-loaded.png');

        log('Check for Date Picker inputs...', colors.blue);
        await verifyElement(page, 'input[type="date"]', '✅ Date picker input found.', '❌ Date picker missing!');

        log('Check for Sync History menu item (via Settings dropdown)...', colors.blue);

        // Sync History is inside the Settings dropdown menu.
        const settingsClicked = await page.evaluate(() => {
            const svg =
                document.querySelector('svg[data-lucide="settings"]') ||
                document.querySelector('svg.lucide-settings') ||
                document.querySelector('svg[class*="lucide-settings"]');
            const btn = svg ? svg.closest('button') : null;
            if (!btn) return false;
            btn.click();
            return true;
        });

        if (!settingsClicked) {
            throw new Error('Could not open Settings dropdown (settings button not found)');
        }

        // Wait for menu item to appear
        await page.waitForFunction(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            return btns.some((b) => {
                const t = (b.innerText || '').trim();
                if (!t) return false;
                if (!t.includes('Sync')) return false;
                // menu item is visible when dropdown is open
                const visible = !!(b.offsetParent);
                return visible && (t.includes('Sync History') || t.includes('Sync Historical'));
            });
        }, { timeout: 10000 });

        log('✅ Sync History menu item found.', colors.green);

        log('\n🎉 All GDCC History UI Tests Passed!', colors.green);
        process.exit(0);
    } catch (e) {
        log(`🔥 UI Test Failed: ${e.message}`, colors.red);
        if (page) {
            await takeScreenshot(page, 'gdcc-history-ui-failure.png');
        }
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

testGDCCHistoryUI();
