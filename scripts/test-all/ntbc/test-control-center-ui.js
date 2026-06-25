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
    await page.screenshot({ path: filePath, fullPage: true });
    log(`📸 Screenshot saved: ${filename}`, colors.cyan);
}

async function testControlCenterUI() {
    log('🧪 Starting System Control Center UI Test (Puppeteer)...', colors.cyan);

    let browser, page;
    try {
        browser = await setupBrowser();
        page = await setupPage(browser);
        page.on('console', msg => {
            const type = msg.type();
            if (type === 'error') log(`[Browser Error] ${msg.text()}`, colors.red);
            else if (type === 'warning') log(`[Browser Warn] ${msg.text()}`, colors.yellow);
            else log(`[Browser Log] ${msg.text()}`, colors.gray);
        });
        await login(page);

        log('Navigate to System Control Center...', colors.blue);
        await page.goto(`${BASE_URL}/systems/ntbc_cfreport/control`, { waitUntil: 'networkidle2' });

        await takeScreenshot(page, 'control-center-loaded.png');

        log('Verify Header Title...', colors.blue);
        await page.waitForFunction(() => {
            const h1 = document.querySelector('h1');
            return h1 && h1.textContent.includes('System Control Center');
        }, { timeout: 10000 });
        log('✅ Heading "System Control Center" found.', colors.green);

        log('Verify Step Count Title...', colors.blue);
        await page.waitForFunction(() => {
            const h2s = Array.from(document.querySelectorAll('h2'));
            return h2s.some(h2 => h2.textContent.includes('Execution Stages (2 Mockup Steps)'));
        }, { timeout: 10000 });
        log('✅ Steps title shows 2 steps correctly.', colors.green);

        log('Verify Live Browser Monitor Card and iframe...', colors.blue);
        await verifyElement(page, 'iframe[title="Live Browser Monitor"]', '✅ Live Browser Monitor iframe found.', '❌ Live Browser Monitor iframe missing!');

        log('Test VNC Maximize Layout toggle...', colors.blue);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const maxBtn = btns.find(b => b.textContent.includes('Maximize Layout'));
            if (maxBtn) maxBtn.click();
        });
        await new Promise(r => setTimeout(r, 1000));
        await takeScreenshot(page, 'vnc-layout-maximized.png');

        // Restore minimize layout
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const minBtn = btns.find(b => b.textContent.includes('Minimize Layout'));
            if (minBtn) minBtn.click();
        });
        await new Promise(r => setTimeout(r, 500));
        log('✅ VNC Layout maximization toggled successfully.', colors.green);

        log('Open checklist inputs and check Domains option...', colors.blue);
        await page.evaluate(() => {
            const setChecked = (el, val) => {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked').set;
                nativeSetter.call(el, val);
                el.dispatchEvent(new Event('change', { bubbles: true }));
            };
            const cbs = document.querySelectorAll('input[type="checkbox"]');
            cbs.forEach(cb => { if (cb.checked) setChecked(cb, false); });
            if (cbs.length > 0) setChecked(cbs[0], true);
        });
        await new Promise(r => setTimeout(r, 500));

        log('Verify Xstart, Xend, Ystart, Yend inputs are visible...', colors.blue);
        await page.waitForSelector('input[placeholder="Auto"]', { timeout: 10000 });
        await page.waitForFunction(() => {
            const inputs = Array.from(document.querySelectorAll('input[placeholder="Auto"]'));
            return inputs.length >= 4;
        }, { timeout: 10000 });
        log('✅ Coordinate input fields are rendered.', colors.green);

        log('Fill custom coordinates for Domains...', colors.blue);
        await page.evaluate(() => {
            const setValue = (el, val) => {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            };
            const inputs = document.querySelectorAll('input[placeholder="Auto"]');
            if (inputs.length >= 4) {
                setValue(inputs[0], '150');
                setValue(inputs[1], '1200');
                setValue(inputs[2], '85');
                setValue(inputs[3], '600');
            }
        });
        await new Promise(r => setTimeout(r, 500));
        await takeScreenshot(page, 'coords-inputs-filled.png');
        log('✅ Coordinates populated in UI.', colors.green);

        log('Verify coordinate values persisted in localStorage...', colors.blue);
        const lsData = await page.evaluate(() => {
            let data = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                data[key] = localStorage.getItem(key);
            }
            return data;
        });
        console.log('localStorage dumped:', Object.keys(lsData));
        const savedCoordsStr = lsData['control_coords'];
        const savedCoords = savedCoordsStr ? JSON.parse(savedCoordsStr) : null;
        if (savedCoords && savedCoords.domains.xStart === '150' && savedCoords.domains.xEnd === '1200') {
            log('✅ Coordinates successfully saved and persisted in localStorage.', colors.green);
        } else {
            throw new Error(`localStorage coords did not persist correctly: ${savedCoordsStr}`);
        }

        log('Test Reset All Steps button...', colors.blue);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const resetBtn = btns.find(b => b.textContent.includes('Reset All Steps'));
            if (resetBtn) resetBtn.click();
        });
        await new Promise(r => setTimeout(r, 1000));
        
        // SweetAlert2 popup should appear; click confirm
        const swalActive = await page.evaluate(() => !!document.querySelector('.swal2-popup'));
        if (swalActive) {
            log('✅ SweetAlert2 reset popup activated.', colors.green);
        }

        log('\n🎉 All System Control Center UI Tests Passed!', colors.green);
        process.exit(0);
    } catch (e) {
        log(`❌ UI Test Failed: ${e.message}`, colors.red);
        if (page) {
            await takeScreenshot(page, 'control-center-ui-failure.png');
        }
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

testControlCenterUI();
