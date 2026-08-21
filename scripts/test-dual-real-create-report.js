const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8002';
const userDownloads = '/Users/litarcopperkaikem/Downloads';

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

async function generateRealJobReport(page, marginValue, outputFileName) {
    console.log(`\n========================================================`);
    console.log(`🚀 Generating Real Report via "Create Report" (Margin: ${marginValue}cm)`);
    console.log(`========================================================`);

    // Ensure any open modals / alerts are closed
    await page.evaluate(() => {
        const swalClose = document.querySelector('.swal2-confirm') || document.querySelector('.swal2-close');
        if (swalClose) swalClose.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // 1. Set Margin via Modal UI
    console.log(`⚙️ 1. Setting Page Margins to ${marginValue}cm via Settings Modal...`);
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

    await page.evaluate((val) => {
        const inputs = Array.from(document.querySelectorAll('input[type="number"]'));
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        inputs.forEach(input => {
            nativeInputValueSetter.call(input, String(val));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }, marginValue);
    await new Promise(r => setTimeout(r, 400));

    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const saveBtn = buttons.find(b => b.textContent.includes('Save Settings'));
        if (saveBtn) saveBtn.click();
    });
    await new Promise(r => setTimeout(r, 1200));
    console.log(`   ✅ Saved Margins = ${marginValue}cm`);

    // Get current max job ID
    const initialJobs = await page.evaluate(async () => {
        try {
            const res = await fetch('/api/gdcc/report-jobs');
            const data = await res.json();
            return data.data || [];
        } catch (e) { return []; }
    });
    const maxInitialId = initialJobs.reduce((max, j) => Math.max(max, j.id), 0);

    // 2. Open Create Report Modal
    console.log('📄 2. Clicking "Create Report" button...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const createBtn = buttons.find(b => b.textContent.includes('Create Report'));
        if (createBtn) createBtn.click();
    });
    console.log('⏳ Waiting 4 seconds for subdomains list to load...');
    await new Promise(r => setTimeout(r, 4000));

    // 3. Select Host
    console.log('📋 3. Selecting domain in Batch Modal container...');
    await page.evaluate(async () => {
        const modal = document.querySelector('div.fixed.z-\\[100\\]') || document.querySelector('div.fixed.inset-0');
        if (!modal) return;
        const labels = Array.from(modal.querySelectorAll('label'));
        const hostLabel = labels.find(l => l.textContent.includes('.') || l.textContent.includes('No Subdomain'));
        if (hostLabel) hostLabel.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    // 4. Click Generate Report button
    console.log('👆 4. Clicking the "Generate Report" button inside Batch Modal...');
    const clickedBtn = await page.evaluate(() => {
        const modal = document.querySelector('div.fixed.z-\\[100\\]') || document.querySelector('div.fixed.inset-0');
        if (!modal) return null;
        const buttons = Array.from(modal.querySelectorAll('button'));
        const genBtn = buttons.find(b => !b.disabled && (b.textContent.includes('Generate') || b.textContent.includes('Report')));
        if (genBtn) {
            genBtn.click();
            return genBtn.textContent.trim();
        }
        return null;
    });
    console.log(`   ✅ Clicked Modal Button: "${clickedBtn}"`);

    // Dismiss SweetAlert if it opens
    await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(() => {
        const swalCancel = document.querySelector('.swal2-cancel') || document.querySelector('.swal2-confirm');
        if (swalCancel) swalCancel.click();
    });

    // 5. Monitor Job Completion
    console.log('⏳ 5. Monitoring Background Report Job execution on server...');
    let completedJob = null;
    for (let i = 0; i < 90; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const jobs = await page.evaluate(async () => {
            try {
                const res = await fetch('/api/gdcc/report-jobs');
                const data = await res.json();
                return data.data || [];
            } catch (e) {
                return [];
            }
        });

        const newJob = jobs.find(j => j.id > maxInitialId);
        if (newJob) {
            console.log(`   📊 Job #${newJob.id} Status: [${newJob.status}] ${newJob.progress}% - ${newJob.status_message || ''}`);
            if (newJob.status === 'completed' && newJob.file_name) {
                completedJob = newJob;
                break;
            }
            if (newJob.status === 'failed') {
                throw new Error(`Background job failed: ${newJob.error_message || newJob.status_message}`);
            }
        }
    }

    if (!completedJob) {
        throw new Error('Background job timed out');
    }

    console.log(`🎉 6. Background Job #${completedJob.id} Finished! File: ${completedJob.file_name}`);

    // 6. Download file directly via Node HTTP fetch
    console.log('📥 7. Downloading generated Word report (.docx)...');
    const downloadUrl = `${BASE_URL}/api/gdcc/report-jobs?action=download&fileName=${encodeURIComponent(completedJob.file_name)}`;
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`Download failed with status ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Save to ~/Downloads
    const targetFile = path.join(userDownloads, outputFileName);
    fs.writeFileSync(targetFile, fileBuffer);
    console.log(`💾 8. Successfully saved to ~/Downloads: ${targetFile} (${(fileBuffer.length / 1024).toFixed(1)} KB)`);

    // Verify OpenXML
    const zip = await JSZip.loadAsync(fileBuffer);
    const docXml = await zip.file('word/document.xml').async('string');
    const pgMarMatch = docXml.match(/<w:pgMar\b([^>]*)\/?>/i);
    console.log(`🔎 9. Verified OpenXML in Downloaded File: <w:pgMar ${pgMarMatch ? pgMarMatch[1] : 'NOT FOUND'}/>`);
}

async function runDualTest() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1440, height: 900 }
    });

    const page = await browser.newPage();
    page.on('console', msg => {
        const txt = msg.text();
        if (txt.includes('Job') || txt.includes('Report') || txt.includes('Worker')) {
            console.log('BROWSER:', txt);
        }
    });

    // Login
    console.log('🔑 Logging into system...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.type('input[type="text"]', 'root');
    await page.type('input[type="password"]', 'password');
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Navigate to GDCC
    console.log('🌐 Navigating to GDCC Page...');
    await page.goto(`${BASE_URL}/systems/gdcc`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Select Account and Zone
    await selectGDCCDropdown(page, 'Select Account', '');
    await selectGDCCDropdown(page, 'Select Zone', '');

    // Test 1: Margin 0 cm
    await generateRealJobReport(page, 0, 'real_report_0cm_job.docx');

    // Test 2: Margin 5 cm
    await generateRealJobReport(page, 5, 'real_report_5cm_job.docx');

    console.log('\n========================================================');
    console.log('🎉 BOTH REAL REPORTS GENERATED AND DOWNLOADED SUCCESSFULLY!');
    console.log('========================================================');

    await browser.close();
}

runDualTest().catch(err => {
    console.error('💥 Dual Test Failed:', err);
    process.exit(1);
});
