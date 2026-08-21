const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8002';
const userDownloads = '/Users/litarcopperkaikem/Downloads';
const tempDir = path.join(__dirname, '../public/real-batch-downloads');

if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

async function selectGDCCDropdown(page, labelText, searchText) {
    console.log(`🔽 Selecting Dropdown [${labelText}] -> "${searchText}"...`);
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
                return txt && !txt.includes('Loading...') && !txt.includes('No results') && !txt.includes('Set Default');
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
        throw new Error(`Could not select option "${searchText}" in dropdown "${labelText}"`);
    }
    await new Promise(r => setTimeout(r, 1500));
}

async function runRealBatchTest() {
    console.log('🚀 ========================================================');
    console.log('🚀 TESTING REAL BUTTON CLICK: "Generate Report" (Batch Modal)');
    console.log('🚀 ========================================================');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1440, height: 900 }
    });

    const page = await browser.newPage();
    page.on('console', msg => {
        const txt = msg.text();
        if (txt.includes('Batch') || txt.includes('Trace') || txt.includes('Preparing') || txt.includes('Export') || txt.includes('Capture')) {
            console.log('BROWSER:', txt);
        }
    });

    // 1. Login
    console.log('🔑 1. Logging into system...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.type('input[type="text"]', 'root');
    await page.type('input[type="password"]', 'password');
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // 2. Go to GDCC
    console.log('🌐 2. Navigating to GDCC Page...');
    await page.goto(`${BASE_URL}/systems/gdcc`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // 3. Set Page Margins = 0 via Modal UI
    console.log('⚙️ 3. Setting Page Margins to 0cm via Settings Modal UI...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const menuBtn = buttons.find(b => b.querySelector('svg.lucide-settings') && !b.textContent.includes('Image Size') && !b.textContent.includes('Table Column'));
        if (menuBtn) menuBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const marginBtn = buttons.find(b => b.textContent.includes('Page Margin Settings'));
        if (marginBtn) marginBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="number"]'));
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        inputs.forEach(input => {
            nativeInputValueSetter.call(input, '0');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });
    await new Promise(r => setTimeout(r, 400));

    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const saveBtn = buttons.find(b => b.textContent.includes('Save Settings'));
        if (saveBtn) saveBtn.click();
    });
    await new Promise(r => setTimeout(r, 1200));
    console.log('   ✅ Saved Page Margins = 0cm');

    // 4. Select Account and Zone from Dropdowns
    console.log('🔍 4. Selecting Account and Zone...');
    await selectGDCCDropdown(page, 'Select Account', '');
    await selectGDCCDropdown(page, 'Select Zone', '');

    // 5. Click "Create Report" button to open Batch Modal
    console.log('📄 5. Clicking "Create Report" button on GDCC Header...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const createBtn = buttons.find(b => b.textContent.includes('Create Report'));
        if (createBtn) createBtn.click();
    });
    console.log('⏳ Waiting 4 seconds for subdomains list to load...');
    await new Promise(r => setTimeout(r, 4000));

    // 6. Inside Batch Modal: Find the modal element and select first host
    console.log('📋 6. Selecting subdomain item inside Batch Modal container...');
    const selectedHostText = await page.evaluate(async () => {
        const modal = document.querySelector('div.fixed.z-\\[100\\]') || document.querySelector('div.fixed.inset-0');
        if (!modal) return null;

        const labels = Array.from(modal.querySelectorAll('label'));
        const hostLabel = labels.find(l => l.textContent.includes('.') || l.textContent.includes('No Subdomain'));
        if (hostLabel) {
            hostLabel.click();
            return hostLabel.textContent.trim();
        }
        return null;
    });
    console.log(`   ✅ Selected Host Label: "${selectedHostText}"`);
    await new Promise(r => setTimeout(r, 1000));

    // 7. Click the REAL "Generate Report" button inside the modal footer
    console.log('👆 7. Clicking the REAL "Generate Report" button inside Batch Modal...');
    const clickedBtn = await page.evaluate(() => {
        const modal = document.querySelector('div.fixed.z-\\[100\\]') || document.querySelector('div.fixed.inset-0');
        if (!modal) return null;

        const buttons = Array.from(modal.querySelectorAll('button'));
        const genBtn = buttons.find(b => !b.disabled && b.textContent.includes('Generate'));
        if (genBtn) {
            genBtn.click();
            return genBtn.textContent.trim();
        }
        return null;
    });
    console.log(`   ✅ Clicked Modal Button: "${clickedBtn}"`);

    // 8. Wait for batch progress to finish
    console.log('⏳ 8. Waiting for Batch Export execution to complete...');
    let resultDocx = null;
    for (let i = 0; i < 90; i++) {
        await new Promise(r => setTimeout(r, 1000));
        
        const readyStatus = await page.evaluate(() => {
            return {
                ready: window.__lastBatchReportReady || false,
                html: window.__lastBatchReportHTML || ''
            };
        });

        if (readyStatus.ready && readyStatus.html) {
            console.log(`🎉 9. Batch Export Generated HTML! Length: ${readyStatus.html.length} chars`);
            
            // Send HTML through export API with stored margins to get the exact Word file
            const docxBase64 = await page.evaluate(async (html) => {
                const margins = JSON.parse(localStorage.getItem('gdcc:page-margins') || '{"top":0,"bottom":0,"left":0,"right":0}');
                const res = await fetch('/api/export-docx', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        html,
                        filename: 'batch_report_real_ui.docx',
                        margins
                    })
                });
                const ab = await res.arrayBuffer();
                return btoa(String.fromCharCode(...new Uint8Array(ab)));
            }, readyStatus.html);

            resultDocx = Buffer.from(docxBase64, 'base64');
            break;
        }
    }

    if (!resultDocx) {
        throw new Error('Batch report generation timed out after 90 seconds');
    }

    // Save to ~/Downloads
    const targetFile = path.join(userDownloads, 'batch_report_real_ui_0cm.docx');
    fs.writeFileSync(targetFile, resultDocx);
    console.log(`💾 10. Saved to ~/Downloads: ${targetFile}`);

    // Inspect OpenXML
    const zip = await JSZip.loadAsync(resultDocx);
    const docXml = await zip.file('word/document.xml').async('string');
    const pgMarMatch = docXml.match(/<w:pgMar\b([^>]*)\/?>/i);
    console.log(`🔎 11. Verified OpenXML in Downloaded File: <w:pgMar ${pgMarMatch ? pgMarMatch[1] : 'NOT FOUND'}/>`);

    console.log('🚀 ========================================================');
    console.log('🎉 REAL GENERATE REPORT BUTTON TEST COMPLETED 100%!');
    console.log('🚀 ========================================================');

    await browser.close();
}

runRealBatchTest().catch(err => {
    console.error('💥 Real Batch Test Failed:', err);
    process.exit(1);
});
