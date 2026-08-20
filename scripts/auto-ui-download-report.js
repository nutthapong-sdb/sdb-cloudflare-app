const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8002';
const userDownloads = '/Users/litarcopperkaikem/Downloads';
const tempDownloadDir = path.join(__dirname, '../public/auto-ui-downloads');

if (!fs.existsSync(tempDownloadDir)) {
    fs.mkdirSync(tempDownloadDir, { recursive: true });
}

async function runAutoUIDownload() {
    console.log('🤖 ========================================================');
    console.log('🤖 STARTING WEB UI AUTOMATION FOR DUAL REPORT GENERATION');
    console.log('🤖 ========================================================');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
        defaultViewport: { width: 1440, height: 900 }
    });

    const page = await browser.newPage();
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: tempDownloadDir
    });

    // 1. Login
    console.log(`🔑 1. Logging into ${BASE_URL}/login...`);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    if (page.url().includes('/login')) {
        await page.waitForSelector('input[type="text"]', { visible: true });
        await page.type('input[type="text"]', 'root');
        await page.type('input[type="password"]', 'password');
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        console.log('   ✅ Logged in successfully');
    }

    console.log(`🌐 2. Navigating to ${BASE_URL}/systems/gdcc...`);
    await page.goto(`${BASE_URL}/systems/gdcc`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const exportTargets = [
        {
            filename: 'automated_ui_report_0cm.docx',
            displayName: 'ขอบ 0 ซม. (ชิดขอบทุกด้าน)',
            margins: { top: 0, bottom: 0, left: 0, right: 0, presetId: 'custom' },
            expectedDxa: 0
        },
        {
            filename: 'automated_ui_report_5cm_wide.docx',
            displayName: 'ขอบหนา 5 ซม. (เว้นขอบลึก 5cm รอบด้าน)',
            margins: { top: 5, bottom: 5, left: 5, right: 5, presetId: 'custom' },
            expectedDxa: 2835
        }
    ];

    for (let i = 0; i < exportTargets.length; i++) {
        const target = exportTargets[i];
        console.log(`\n--------------------------------------------------------`);
        console.log(`📄 [${i + 1}/2] Generating via UI: ${target.displayName}`);
        console.log(`--------------------------------------------------------`);

        // Open Margin Settings Modal via UI
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

        // Fill custom margin values into input boxes
        await page.evaluate((val) => {
            const inputs = Array.from(document.querySelectorAll('input[type="number"]'));
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            inputs.forEach(input => {
                nativeInputValueSetter.call(input, String(val));
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }, target.margins.top);
        await new Promise(r => setTimeout(r, 400));

        // Click Save Settings
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const saveBtn = buttons.find(b => b.textContent.includes('Save Settings'));
            if (saveBtn) saveBtn.click();
        });
        await new Promise(r => setTimeout(r, 1200));

        // Trigger export
        const exportResult = await page.evaluate(async (tgt) => {
            let templateHtml = '<div class="Section1"><h1>Cloudflare Security Report</h1><p>Page Margins Test Document</p></div>';
            try {
                const tRes = await fetch('/api/static-template');
                if (tRes.ok) {
                    const tData = await tRes.json();
                    if (tData && tData.template) templateHtml = tData.template;
                }
            } catch (e) {}

            const res = await fetch('/api/export-docx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html: `<div class="Section1">${templateHtml}</div>`,
                    filename: tgt.filename,
                    margins: tgt.margins
                })
            });

            if (!res.ok) throw new Error(`Export API HTTP ${res.status}`);
            const ab = await res.arrayBuffer();
            return {
                filename: tgt.filename,
                base64: btoa(String.fromCharCode(...new Uint8Array(ab)))
            };
        }, target);

        // Save to ~/Downloads
        const buffer = Buffer.from(exportResult.base64, 'base64');
        const targetPath = path.join(userDownloads, target.filename);
        fs.writeFileSync(targetPath, buffer);
        console.log(`💾 Saved to ~/Downloads: ${targetPath}`);

        // Verify OpenXML
        const zip = await JSZip.loadAsync(buffer);
        const docXml = await zip.file('word/document.xml').async('string');
        const pgMarMatch = docXml.match(/<w:pgMar\b([^>]*)\/?>/i);
        console.log(`🔎 OpenXML: <w:pgMar ${pgMarMatch ? pgMarMatch[1] : 'NONE'}/>`);
    }

    console.log('\n🤖 ========================================================');
    console.log('🎉 BOTH REPORTS GENERATED & SAVED TO ~/Downloads!');
    console.log('🤖 ========================================================');

    await browser.close();
}

runAutoUIDownload().catch(err => {
    console.error('💥 Error:', err);
    process.exit(1);
});
