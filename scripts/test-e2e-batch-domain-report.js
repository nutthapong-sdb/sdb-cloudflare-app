const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');
require('dotenv').config({ path: ['.env.local', '.env'] });

const BASE_URL = process.env.BASE_URL || 'http://localhost:8002';
const publicDir = path.join(__dirname, '../public');
const testExtractDir = path.join(publicDir, 'test-batch-extract');

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
    const browser = await setupBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

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
        await new Promise(r => setTimeout(r, 2000));

        // Let's modify the Domain Template (staticReportTemplate) in DB/State directly using the UI or evaluate.
        // Or we can just insert the placeholder in the React state of staticReportTemplate!
        console.log('Modifying the Domain Report Template content in React state to include placeholders...');
        await page.evaluate(() => {
            const rootEl = document.querySelector('div[class*="min-h-screen"]');
            const fiberKey = Object.keys(rootEl || {}).find(k => k.startsWith('__reactFiber$'));
            if (!fiberKey) return;
            
            let current = rootEl[fiberKey];
            let setStaticReportTemplate = null;
            while (current) {
                if (current.memoizedState && typeof current.memoizedState === 'object') {
                    let s = current.memoizedState;
                    while (s) {
                        if (typeof s.memoizedState === 'function' && s.queue && s.queue.dispatch && s.queue.dispatch.name.includes('setStaticReportTemplate')) {
                            setStaticReportTemplate = s.queue.dispatch;
                            break;
                        }
                        s = s.next;
                    }
                }
                if (setStaticReportTemplate) break;
                current = current.return;
            }

            if (setStaticReportTemplate) {
                console.log('Found setStaticReportTemplate hook, inserting test content...');
                const testTemplateHtml = `
                    <html>
                    <head><title>Domain Report Template Test</title></head>
                    <body>
                        <h1>Domain Report (Static)</h1>
                        <p>Total requests: @ZONE_TOTAL_REQ</p>
                        
                        <h2>Total Requests + Traffic Volume Card:</h2>
                        <div>@DASHBOARD_TOTAL_REQUESTS_TRAFFIC_VOLUME@</div>
                        
                        <h2>Avg Response Time Card:</h2>
                        <div>@DASHBOARD_AVG_RESPONSE_TIME@</div>
                    </body>
                    </html>
                `;
                setStaticReportTemplate(testTemplateHtml);
            }
        });

        // Let's select the dropdown values to load the subdomains list
        await selectGDCCDropdown(page, 'Select Account', '7 Solutions');
        await selectGDCCDropdown(page, 'Select Zone (Domain)', '');
        
        console.log('Opening Batch Report Modal...');
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const batchBtn = buttons.find(b => b.textContent.includes('Batch Export Reports'));
            if (batchBtn) batchBtn.click();
        });
        console.log('Waiting 5 seconds for subdomains list to load...');
        await new Promise(r => setTimeout(r, 5000));

        console.log('Configuring batch options: selecting subdomain, promoting to Domain template...');
        await page.evaluate(async () => {
            const items = Array.from(document.querySelectorAll('div[class*="flex"][class*="justify-between"]'));
            const subItems = items.filter(item => {
                const text = item.textContent || '';
                return text.includes('.') && !text.includes('Choose') && !text.includes('Select') && !text.includes('Filter');
            });

            if (subItems.length > 0) {
                const targetItem = subItems[0];
                console.log('First host item found:', targetItem.textContent);
                
                // Click the label to select the checkbox
                const label = targetItem.querySelector('label');
                if (label) {
                    label.click();
                    // Wait a short bit for UI update
                    await new Promise(r => setTimeout(r, 500));
                }
                
                // Now find the "Use Domain Template" toggle input and click it
                const toggles = Array.from(targetItem.querySelectorAll('input'));
                // The first input is the hidden selection checkbox, the second input (if exists) is the peer toggle checkbox
                if (toggles.length > 1) {
                    toggles[1].click();
                } else {
                    const peerInput = targetItem.querySelector('input[class*="peer"]');
                    if (peerInput) peerInput.click();
                }
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        // Configure download path interception
        console.log('Setting up CDPSession to intercept downloads...');
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: publicDir
        });

        console.log('Clicking Export Batch Reports button...');
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const exportBtn = buttons.find(b => b.textContent.includes('Export Batch Reports'));
            if (exportBtn) exportBtn.click();
        });

        console.log('Waiting for batch report completion and ZIP file download (up to 40s)...');
        let zipFile = null;
        for (let i = 0; i < 40; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const files = fs.readdirSync(publicDir);
            zipFile = files.find(f => f.startsWith('batch_report_') && f.endsWith('.zip'));
            if (zipFile) break;
        }

        if (!zipFile) {
            throw new Error('Batch report download timed out or failed.');
        }

        const zipPath = path.join(publicDir, zipFile);
        console.log(`✅ Downloaded ZIP file: ${zipPath} (Size: ${(fs.statSync(zipPath).size / 1024).toFixed(2)} KB)`);

        // Extract ZIP
        if (fs.existsSync(testExtractDir)) {
            fs.rmSync(testExtractDir, { recursive: true });
        }
        fs.mkdirSync(testExtractDir, { recursive: true });

        console.log('Extracting ZIP file...');
        execSync(`unzip -o "${zipPath}" -d "${testExtractDir}"`);

        // Scan extracted files
        const extractedFiles = fs.readdirSync(testExtractDir);
        console.log('Extracted files list:', extractedFiles);

        for (const file of extractedFiles) {
            if (file.endsWith('.doc')) {
                const filePath = path.join(testExtractDir, file);
                const content = fs.readFileSync(filePath, 'utf-8');
                console.log(`Checking file: ${file}`);
                console.log(`  Contains @DASHBOARD_TOTAL_REQUESTS_TRAFFIC_VOLUME@?`, content.includes('@DASHBOARD_TOTAL_REQUESTS_TRAFFIC_VOLUME@'));
                console.log(`  Contains src="data:image/jpeg;base64,"?`, content.includes('src="data:image/jpeg;base64,'));
                
                // Let's print out the exact occurrence of any @DASHBOARD_ placeholder in the file
                const placeholders = content.match(/@DASHBOARD_[A-Z_]+@/g);
                if (placeholders) {
                    console.log(`  Found unresolved placeholders:`, placeholders);
                } else {
                    console.log(`  ✅ All dashboard placeholders resolved successfully!`);
                }
            }
        }

    } catch (err) {
        console.error('Batch E2E Test Failed:', err);
    } finally {
        await browser.close();
    }
}

run();
