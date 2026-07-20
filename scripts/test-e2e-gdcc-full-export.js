const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: ['.env.local', '.env'] });

const BASE_URL = process.env.BASE_URL || 'http://localhost:8002';

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
    console.log('Starting E2E GDCC Full Export Verification...');
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
        console.log('Enabling worker mode in localStorage to force client-side generation...');
        await page.evaluate(() => {
            localStorage.setItem('gdcc_worker_mode', 'true');
        });
        await new Promise(r => setTimeout(r, 6000));

        await selectGDCCDropdown(page, 'Select Account', '7 Solutions');
        await selectGDCCDropdown(page, 'Select Zone (Domain)', '');
        console.log('Waiting for charts/widgets to render...');
        await new Promise(r => setTimeout(r, 6000));

        console.log('Opening Batch Report Modal...');
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
            const labels = Array.from(document.querySelectorAll('label'));
            const noSubLabel = labels.find(l => l.textContent.includes('No Subdomain'));
            if (noSubLabel) {
                noSubLabel.click();
                console.log('Clicked label "No Subdomain" successfully');
            } else {
                console.log('Label "No Subdomain" NOT found!');
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        console.log('Selecting "GDCC" template in select dropdown...');
        await page.evaluate(() => {
            const select = document.querySelector('select');
            if (select) {
                // Find option containing GDCC
                const options = Array.from(select.querySelectorAll('option'));
                const gdccOption = options.find(opt => opt.textContent.includes('GDCC'));
                if (gdccOption) {
                    select.value = gdccOption.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log(`Set select dropdown value to "${gdccOption.value}" (GDCC)`);
                } else {
                    console.log('GDCC option NOT found in select!');
                }
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

        console.log('Waiting for GDCC Domain Report completion in worker mode (up to 90 seconds)...');
        await page.waitForFunction(() => window.__lastBatchReportReady === true, { timeout: 90000 });

        const domainContent = await page.evaluate(() => window.__lastBatchReportHTML);
        
        // Define variables to check
        const targetVariables = [
            '@DASHBOARD_TOTAL_REQUESTS_TRAFFIC_VOLUME@',
            '@DASHBOARD_AVG_RESPONSE_TIME@',
            '@DASHBOARD_BLOCKED_EVENTS_FIREWALL_ACTIONS@',
            '@DASHBOARD_TOP_URLS@',
            '@DASHBOARD_TOP_CLIENT_IPS@',
            '@DASHBOARD_TOP_USER_AGENTS@',
            '@DASHBOARD_ATTACK_PREVENTION_HISTORY@',
            '@DASHBOARD_TOP_WAF_RULES@',
            '@DASHBOARD_TOP_5_ATTACKERS@'
        ];

        console.log('Verifying variable replacement...');
        const missingVars = [];
        targetVariables.forEach(v => {
            if (domainContent.includes(v)) {
                missingVars.push(v);
            }
        });

        // Count base64 images in output
        const base64Count = (domainContent.match(/src="data:image\/jpeg;base64,/g) || []).length +
                            (domainContent.match(/src="data:image\/png;base64,/g) || []).length;

        console.log(`- Missing variables found: ${missingVars.length === 0 ? 'None (All successfully replaced!)' : missingVars.join(', ')}`);
        console.log(`- Total embedded base64 images found: ${base64Count}`);

        if (missingVars.length > 0 || base64Count < 9) {
            console.log('Saving failed HTML output to: debug_failed_gdcc_report.html');
            fs.writeFileSync(path.join(__dirname, '../debug_failed_gdcc_report.html'), domainContent);
            throw new Error(`Verification Failed! Missing variables: ${missingVars.length}, Base64 images found: ${base64Count} (expected at least 9)`);
        }

        console.log('✅ VERIFICATION PASSED: All 9 cropped dashboard variables were successfully replaced with base64 images!');

        // Convert the HTML to Word
        console.log('Calling API to export DOCX...');
        const response = await axios.post(`${BASE_URL}/api/export-docx`, {
            html: domainContent,
            filename: 'gdcc_final_domain_report.docx',
            title: 'GDCC Domain Report'
        }, {
            responseType: 'arraybuffer'
        });

        const docxBuffer = Buffer.from(response.data);
        const outPath = path.join(__dirname, '../gdcc_final_domain_report.docx');
        fs.writeFileSync(outPath, docxBuffer);
        console.log(`✅ Word document successfully generated and saved to: ${outPath}`);

    } catch (err) {
        console.error('❌ E2E GDCC Export Failed:', err.message || err);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

run();
