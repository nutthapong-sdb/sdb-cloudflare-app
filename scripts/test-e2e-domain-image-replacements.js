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

        // Wait for trigger text to load (not "Loading...")
        for (let i = 0; i < 100; i++) {
            const txt = (trigger.textContent || '').trim();
            if (txt && !txt.includes('Loading...')) break;
            await new Promise(r => setTimeout(r, 200));
        }

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
    console.log('Starting E2E verification using actual GDCC templates from system...');
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

        console.log('Waiting for subdomains list and metadata to finish loading...');
        await page.waitForFunction(() => {
            const modal = document.querySelector('div[class*="fixed"]');
            return modal && !modal.textContent.includes('Loading subdomains...') && !modal.textContent.includes('Loading...');
        }, { timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        console.log('Selecting "No Subdomain" checkbox with retry verification...');
        for (let attempt = 1; attempt <= 5; attempt++) {
            await page.evaluate(() => {
                const label = Array.from(document.querySelectorAll('label')).find(el => el.textContent.includes('No Subdomain'));
                if (label) {
                    const span = label.querySelector('span');
                    if (span) {
                        console.log('Found No Subdomain label span, clicking...');
                        span.click();
                    } else {
                        console.log('Found No Subdomain label, clicking directly...');
                        label.click();
                    }
                } else {
                    console.log('No Subdomain label NOT found!');
                }
            });
            await new Promise(r => setTimeout(r, 1500));
            const buttonText = await page.evaluate(() => {
                const modal = document.querySelector('div[class*="fixed"]');
                if (!modal) return '';
                const buttons = Array.from(modal.querySelectorAll('button'));
                const btn = buttons.find(b => b.textContent.includes('Generate Domain Report') || b.textContent.includes('Generate Report'));
                return btn ? btn.textContent.trim() : '';
            });
            console.log(`Current modal export button text: "${buttonText}"`);
            if (buttonText === 'Generate Domain Report') {
                console.log('✅ Success: "Generate Domain Report" button detected!');
                break;
            } else {
                console.log(`Attempt ${attempt}: "Generate Domain Report" button not detected yet, retrying click...`);
            }
        }

        console.log('Selecting "GDCC" template in select dropdown...');
        await page.evaluate(() => {
            const select = document.querySelector('select');
            if (select) {
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
        await new Promise(r => setTimeout(r, 2000));

        console.log('Resetting global worker variables...');
        await page.evaluate(() => {
            window.__lastBatchReportReady = false;
            window.__lastBatchReportHTML = null;
        });

        console.log('Clicking "Generate Domain Report" button inside the modal...');
        await page.evaluate(() => {
            const modal = document.querySelector('div[class*="fixed"]');
            if (!modal) {
                console.log('Modal wrapper not found!');
                return;
            }
            const buttons = Array.from(modal.querySelectorAll('button'));
            const exportBtn = buttons.find(b => b.textContent.trim() === 'Generate Domain Report');
            if (exportBtn) {
                console.log('Found Generate Domain Report button in modal, clicking...');
                exportBtn.click();
            } else {
                console.log('Generate Domain Report button NOT found in modal! Available buttons:', buttons.map(b => b.textContent.trim()).join(' | '));
            }
        });

        console.log('Waiting for Domain Report completion in worker mode...');
        await page.waitForFunction(() => window.__lastBatchReportReady === true, { timeout: 120000 });

        const domainContent = await page.evaluate(() => window.__lastBatchReportHTML);
        
        // Verify all 9 cropped dashboard card variables are replaced and not present
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

        const base64Count = (domainContent.match(/src="data:image\/jpeg;base64,/g) || []).length +
                            (domainContent.match(/src="data:image\/png;base64,/g) || []).length;

        console.log(`  Missing variables found: ${missingVars.length === 0 ? 'None (All successfully replaced!)' : missingVars.join(', ')}`);
        console.log(`  Contains Base64 Images? ${base64Count > 0} (${base64Count} images found)`);

        if (missingVars.length > 0 || base64Count < 9) {
            throw new Error(`Test Case 1 Failed: Expected all 9 variables replaced and base64 images present. Variables remaining: ${missingVars.length}, Base64 images found: ${base64Count}`);
        }

        // Save debug HTML
        const htmlPath = path.join(__dirname, '../debug_domain_report.html');
        fs.writeFileSync(htmlPath, domainContent);
        console.log(`Saved generated domain report HTML with base64 images to: ${htmlPath}`);

        // Export to Word docx
        console.log('Calling API to export DOCX for Test Case 1...');
        try {
            const response = await axios.post(`${BASE_URL}/api/export-docx`, {
                html: domainContent,
                filename: 'gdcc_real_domain_report.docx',
                title: 'GDCC Real Domain Report'
            }, {
                responseType: 'arraybuffer'
            });

            const docxBuffer = Buffer.from(response.data);
            const destPath = path.join(__dirname, '../gdcc_real_domain_report.docx');
            fs.writeFileSync(destPath, docxBuffer);
            console.log(`✅ Word document successfully generated and saved to: ${destPath}`);
        } catch (err) {
            console.log('⚠️ Export DOCX API failed:', err.message || err);
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

        console.log('Selecting "GDCC" template in select dropdown...');
        await page.evaluate(() => {
            const select = document.querySelector('select');
            if (select) {
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
        const isSubTemplate = subContent.includes('ภาพรายงานการใช้งานและความปลอดภัย') || subContent.includes('Cloudflare');
        const hasSubImage = subContent.includes('src="data:image/jpeg;base64,') || subContent.includes('src="data:image/png;base64,');
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
    }
}

run();
