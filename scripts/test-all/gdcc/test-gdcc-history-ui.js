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

        log('Check for Sync History button...', colors.blue);
        // We look for a button that contains the text "Sync History"
        const btnExists = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            return btns.some(btn => btn.innerText.includes('Sync History'));
        });

        if (btnExists) {
            log('✅ Sync History button found.', colors.green);
        } else {
            log('❌ Sync History button missing!', colors.red);
            throw new Error('Sync button missing');
        }

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
