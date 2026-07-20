const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: ['.env.local', '.env'] });

const BASE_URL = process.env.BASE_URL || 'http://localhost:8002';

// Template file paths
const dataDir = path.join(__dirname, '../app/data');
const downloadsDir = path.join(__dirname, '../downloads');

const subTemplatePath1 = path.join(dataDir, 'gdcc_reportTemplate.json');
const staticTemplatePath1 = path.join(dataDir, 'gdcc_staticReportTemplate.json');

const subTemplatePath2 = path.join(downloadsDir, 'gdcc_reportTemplate.json');
const staticTemplatePath2 = path.join(downloadsDir, 'gdcc_staticReportTemplate.json');

async function setupBrowser() {
    try {
        const dns = require('dns');
        let host = 'chrome-browser';
        host = await new Promise((resolve, reject) => {
            dns.lookup(host, (err, address) => err ? reject(err) : resolve(address));
        });
        const res = await axios.get(`http://${host}:9222/json/version`, { headers: { 'Host': 'localhost' } });
        const wsUrlObj = new URL(res.data.webSocketDebuggerUrl);
        const wsUrl = `ws://${host}:9222${wsUrlObj.pathname}${wsUrlObj.search}`;
        console.log(`Connected to remote Chrome (${host}:9222)`);
        return await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
    } catch (e) {
        console.log(`Remote Chrome connection failed, launching local browser...`);
        return await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: null
        });
    }
}

async function selectGDCCDropdown(page, labelText, searchText) {
    console.log(`Selecting Dropdown [${labelText}] -> "${searchText}"...`);
    const clicked = await page.evaluate(async (label, searchStr) => {
        const labels = Array.from(document.querySelectorAll('label'));
        const targetLabel = labels.find(l => (l.textContent || '').toLowerCase().includes(label.toLowerCase()));
        if (!targetLabel) return false;
        
        let parent = targetLabel.parentElement;
        let root = null;
        while (parent) {
            if (parent.querySelector('div[tabindex="0"]')) {
                root = parent;
                break;
            }
            parent = parent.parentElement;
        }
        if (!root) return false;

        const trigger = root.querySelector('div[tabindex="0"]');
        if (!trigger) return false;

        // Repeatedly click trigger every 300ms until options list is opened
        let container = null;
        for (let i = 0; i < 30; i++) {
            trigger.click();
            await new Promise(r => setTimeout(r, 300));
            container = root.querySelector('div[class*="absolute"]');
            if (container) break;
        }
        if (!container) return false;

        for (let i = 0; i < 50; i++) {
            const txt = (container.textContent || '');
            if (!txt.includes('Loading...')) break;
            await new Promise(r => setTimeout(r, 100));
        }

        const options = Array.from(container.querySelectorAll('div'));
        const lowerSearch = searchStr.toLowerCase();
        
        let targetOption = null;
        if (!searchStr) {
            targetOption = options.find(opt => {
                const txt = (opt.textContent || '').trim();
                return txt && !txt.includes('Loading...') && !txt.includes('No results');
            });
        } else {
            targetOption = options.find(opt => {
                const txt = (opt.textContent || '').trim().toLowerCase();
                return txt && !txt.includes('loading') && !txt.includes('no results') && txt.includes(lowerSearch);
            });
        }

        if (targetOption) {
            targetOption.dispatchEvent(new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true }));
            targetOption.click();
            return true;
        }
        return false;
    }, labelText, searchText);

    if (!clicked) {
        throw new Error(`Could not click option containing "${searchText}" in dropdown "${labelText}"`);
    }
    await new Promise(r => setTimeout(r, 2000));
}

async function run() {
    // 0. Backup original templates
    console.log('Backing up original template files...');
    const originalSubTemplate1 = fs.existsSync(subTemplatePath1) ? fs.readFileSync(subTemplatePath1, 'utf8') : null;
    const originalStaticTemplate1 = fs.existsSync(staticTemplatePath1) ? fs.readFileSync(staticTemplatePath1, 'utf8') : null;
    const originalSubTemplate2 = fs.existsSync(subTemplatePath2) ? fs.readFileSync(subTemplatePath2, 'utf8') : null;
    const originalStaticTemplate2 = fs.existsSync(staticTemplatePath2) ? fs.readFileSync(staticTemplatePath2, 'utf8') : null;

    // Write E2E test templates containing the target placeholder
    console.log('Writing test templates to filesystem (both host and container mounted paths)...');
    const subJson = JSON.stringify({
        template: `
            <html>
            <body>
                <h1>Subdomain Report</h1>
                <p>Total Requests + Traffic Volume:</p>
                <div>@DASHBOARD_TOTAL_REQUESTS_TRAFFIC_VOLUME@</div>
            </body>
            </html>
        `
    }, null, 2);

    const staticJson = JSON.stringify({
        template: `
            <html>
            <body>
                <h1>Domain Report (Static)</h1>
                <p>Total Requests + Traffic Volume:</p>
                <div>@DASHBOARD_TOTAL_REQUESTS_TRAFFIC_VOLUME@</div>
            </body>
            </html>
        `
    }, null, 2);

    fs.writeFileSync(subTemplatePath1, subJson);
    fs.writeFileSync(staticTemplatePath1, staticJson);
    
    fs.writeFileSync(subTemplatePath2, subJson);
    fs.writeFileSync(staticTemplatePath2, staticJson);

    const browser = await setupBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Log console and errors
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER PAGE ERROR:', err.message, err.stack));

    // Set up client-side request interception to mock DNS records (subdomains list)
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.url().endsWith('/api/scrape') && request.method() === 'POST') {
            try {
                const postData = JSON.parse(request.postData() || '{}');
                if (postData.action === 'get-dns-records') {
                    console.log('Intercepted get-dns-records client fetch. Mocking subdomains...');
                    request.respond({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            success: true,
                            data: [
                                { name: 'app.7connect.co.th', type: 'A', content: '1.1.1.1' }
                            ]
                        })
                    });
                    return;
                }
            } catch (e) {
                console.error('Request interception parsing error:', e);
            }
        }
        request.continue();
    });

    try {
        console.log('Logging in...');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
        if (page.url().includes('/login')) {
            await page.waitForSelector('input[type="text"]', { visible: true });
            await page.type('input[type="text"]', 'root');
            await page.type('input[type="password"]', 'password');
            await page.keyboard.press('Enter');
            await page.waitForNavigation({ waitUntil: 'networkidle2' });
        }

        console.log('Navigating to GDCC page...');
        await page.goto(`${BASE_URL}/systems/gdcc`, { waitUntil: 'networkidle2' });
        console.log('Waiting for dropdown labels to appear...');
        await page.waitForSelector('label', { visible: true, timeout: 15000 });
        console.log('Waiting 6 seconds for initial API load...');
        await new Promise(r => setTimeout(r, 6000));

        console.log('Enabling worker mode in localStorage to force client-side generation...');
        await page.evaluate(() => {
            localStorage.setItem('gdcc_worker_mode', 'true');
        });

        // Select Account and Zone
        await selectGDCCDropdown(page, 'Select Account', '7 Solutions');
        await selectGDCCDropdown(page, 'Select Zone (Domain)', '');

        // --- TEST CASE 1: Domain Template / Full Domain Report ("No Subdomain") ---
        console.log('\n--- STARTING TEST CASE 1: Domain Template / Full Domain Report ---');
        console.log('Opening Batch Report Modal (clicking "Create Report")...');
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const batchBtn = buttons.find(b => b.textContent.includes('Create Report'));
            if (batchBtn) batchBtn.click();
        });
        
        console.log('Waiting for "app.7connect.co.th" subdomain list to load inside modal...');
        await page.waitForFunction(() => {
            return Array.from(document.querySelectorAll('label, span')).some(el => el.textContent.includes('app.7connect.co.th'));
        }, { timeout: 20000 });

        console.log('Waiting 5 additional seconds to ensure all metadata (Zone settings etc.) have finished loading...');
        await new Promise(r => setTimeout(r, 5000));

        console.log('Selecting "No Subdomain" checkbox...');
        await page.evaluate(() => {
            const label = Array.from(document.querySelectorAll('label')).find(el => el.textContent.includes('No Subdomain'));
            if (label) {
                console.log('Found No Subdomain label, clicking it directly...');
                label.click();
            } else {
                console.log('No Subdomain label NOT found!');
            }
        });
        await new Promise(r => setTimeout(r, 2000));

        console.log('Explicitly choosing "Default Template" in modal select dropdown...');
        await page.evaluate(() => {
            const select = document.querySelector('select');
            if (select) {
                select.value = 'default';
                select.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('Set select dropdown value to "default"');
            } else {
                console.log('Select dropdown NOT found in modal!');
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        console.log('Resetting global worker variables...');
        await page.evaluate(() => {
            window.__lastBatchReportReady = false;
            window.__lastBatchReportHTML = null;
        });

        console.log('Clicking "Generate Domain Report" button...');
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const exportBtn = buttons.find(b => b.textContent.includes('Generate Domain Report'));
            if (exportBtn) {
                console.log('Found Generate Domain Report button, clicking...');
                exportBtn.click();
            } else {
                console.log('Generate Domain Report button NOT found! Available buttons:', buttons.map(b => b.textContent.trim()).join(' | '));
            }
        });

        console.log('Waiting for Domain Report completion in worker mode...');
        await page.waitForFunction(() => window.__lastBatchReportReady === true, { timeout: 60000 });

        const domainContent = await page.evaluate(() => window.__lastBatchReportHTML);
        const isStaticTemplate = domainContent.includes('Domain Report (Static)');
        const hasDomainImage = domainContent.includes('src="data:image/jpeg;base64,');
        console.log(`  Is Domain Template used? ${isStaticTemplate}`);
        console.log(`  Contains Base64 Image? ${hasDomainImage}`);
        
        // Always save the generated domain report HTML for inspection
        fs.writeFileSync(path.join(__dirname, '../debug_domain_report.html'), domainContent);
        console.log(`Saved generated domain report HTML with base64 images to: debug_domain_report.html`);

        if (!isStaticTemplate || !hasDomainImage) {
            console.log('Domain Report content preview:');
            console.log(domainContent.substring(0, 2000));
            throw new Error('Test Case 1 Failed: Image or Template incorrect.');
        }
        console.log('✅ TEST CASE 1 PASSED!');

        // --- TEST CASE 2: Subdomain Template ("app.7connect.co.th") ---
        console.log('\n--- STARTING TEST CASE 2: Subdomain Template ---');
        console.log('Opening Batch Report Modal again...');
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const batchBtn = buttons.find(b => b.textContent.includes('Create Report'));
            if (batchBtn) batchBtn.click();
        });

        console.log('Waiting for "app.7connect.co.th" subdomain list to load inside modal...');
        await page.waitForFunction(() => {
            return Array.from(document.querySelectorAll('label, span')).some(el => el.textContent.includes('app.7connect.co.th'));
        }, { timeout: 20000 });

        console.log('Waiting 5 additional seconds to ensure all metadata (Zone settings etc.) have finished loading...');
        await new Promise(r => setTimeout(r, 5000));

        console.log('Selecting "app.7connect.co.th" checkbox...');
        await page.evaluate(() => {
            const label = Array.from(document.querySelectorAll('label')).find(el => el.textContent.includes('app.7connect.co.th'));
            if (label) {
                console.log('Found subdomain label, clicking it directly...');
                label.click();
            } else {
                console.log('Subdomain label NOT found!');
            }
        });
        await new Promise(r => setTimeout(r, 2000));

        console.log('Explicitly choosing "Default Template" in modal select dropdown...');
        await page.evaluate(() => {
            const select = document.querySelector('select');
            if (select) {
                select.value = 'default';
                select.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('Set select dropdown value to "default"');
            } else {
                console.log('Select dropdown NOT found in modal!');
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        console.log('Resetting global worker variables...');
        await page.evaluate(() => {
            window.__lastBatchReportReady = false;
            window.__lastBatchReportHTML = null;
        });

        console.log('Clicking "Generate Report" button...');
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const exportBtn = buttons.find(b => b.textContent.includes('Generate Report') || b.textContent.includes('Generate 1 Report'));
            if (exportBtn) {
                console.log('Found Generate Report button, clicking...');
                exportBtn.click();
            } else {
                console.log('Generate Report button NOT found! Available buttons:', buttons.map(b => b.textContent.trim()).join(' | '));
            }
        });

        console.log('Waiting for Subdomain Report completion in worker mode...');
        await page.waitForFunction(() => window.__lastBatchReportReady === true, { timeout: 60000 });

        const subContent = await page.evaluate(() => window.__lastBatchReportHTML);
        const isSubTemplate = subContent.includes('Subdomain Report');
        const hasSubImage = subContent.includes('src="data:image/jpeg;base64,');
        console.log(`  Is Subdomain Template used? ${isSubTemplate}`);
        console.log(`  Contains Base64 Image? ${hasSubImage}`);

        if (!isSubTemplate || !hasSubImage) {
            throw new Error('Test Case 2 Failed: Image or Template incorrect.');
        }
        console.log('✅ TEST CASE 2 PASSED!');
        console.log('\n🎉 ALL E2E TESTS COMPLETED SUCCESSFULLY!');

    } catch (err) {
        console.error('E2E Test Failed:', err);
        process.exit(1);
    } finally {
        await browser.close();
        
        // Restore original templates
        console.log('Restoring original templates...');
        if (originalSubTemplate1) fs.writeFileSync(subTemplatePath1, originalSubTemplate1);
        if (originalStaticTemplate1) fs.writeFileSync(staticTemplatePath1, originalStaticTemplate1);
        if (originalSubTemplate2) fs.writeFileSync(subTemplatePath2, originalSubTemplate2);
        if (originalStaticTemplate2) fs.writeFileSync(staticTemplatePath2, originalStaticTemplate2);
        console.log('Restored original templates successfully.');
    }
}

run();
