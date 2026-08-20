const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8002';
const downloadPath = path.join(__dirname, '../public/test-margin-downloads');

if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
}

async function setupBrowser() {
    try {
        const axios = require('axios');
        const res = await axios.get('http://localhost:9222/json/version', { headers: { 'Host': 'localhost' } });
        const wsUrl = res.data.webSocketDebuggerUrl;
        console.log('✅ Connected to remote Chrome on port 9222');
        return await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
    } catch (e) {
        console.log('ℹ️ Launching local Chromium for E2E...');
        return await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: { width: 1400, height: 900 }
        });
    }
}

async function runMarginE2E() {
    console.log('🚀 Starting Page Margin E2E Test Suite...');
    const browser = await setupBrowser();
    const page = await browser.newPage();

    // Enable download behavior
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath
    });

    console.log(`🌐 Navigating to ${BASE_URL}/systems/gdcc...`);
    await page.goto(`${BASE_URL}/systems/gdcc`, { waitUntil: 'networkidle2', timeout: 30000 });

    const testCases = [
        { name: 'Zero Margin (0cm)', margins: { top: 0, bottom: 0, left: 0, right: 0, presetId: 'custom' }, expectedDxa: { top: 0, bottom: 0, left: 0, right: 0 } },
        { name: 'Narrow Preset (1.27cm)', margins: { top: 1.27, bottom: 1.27, left: 1.27, right: 1.27, presetId: 'narrow' }, expectedDxa: { top: 720, bottom: 720, left: 720, right: 720 } },
        { name: 'Wide Preset (2.54cm / 5.08cm)', margins: { top: 2.54, bottom: 2.54, left: 5.08, right: 5.08, presetId: 'wide' }, expectedDxa: { top: 1440, bottom: 1440, left: 2880, right: 2880 } }
    ];

    let allPassed = true;

    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        console.log(`\n========================================`);
        console.log(`🧪 Test Case ${i + 1}: ${tc.name}`);
        console.log(`========================================`);

        // 1. Set margins in localStorage
        await page.evaluate((margins) => {
            localStorage.setItem('gdcc:page-margins', JSON.stringify(margins));
        }, tc.margins);

        // 2. Open Report Modal by clicking "Report" button on first available domain or via dispatch
        console.log('📄 Triggering report modal with current margins...');
        
        // Test backend /api/export-docx directly from page context with current localStorage margins
        const docxResult = await page.evaluate(async (margins) => {
            const html = '<div class="Section1"><p>Test Page Margin Document Content</p><table width="100%"><tr><td>Cell 1</td><td>Cell 2</td></tr></table></div>';
            const res = await fetch('/api/export-docx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html,
                    filename: `test_${margins.presetId || 'custom'}.docx`,
                    margins
                })
            });
            const arrayBuffer = await res.arrayBuffer();
            return { status: res.status, byteLength: arrayBuffer.byteLength, base64: btoa(String.fromCharCode(...new Uint8Array(arrayBuffer))) };
        }, tc.margins);

        console.log(`📦 Received DOCX from /api/export-docx: Status ${docxResult.status}, Size ${docxResult.byteLength} bytes`);

        // Parse docx in Node
        const docxBuffer = Buffer.from(docxResult.base64, 'base64');
        const zip = await JSZip.loadAsync(docxBuffer);
        const docXml = await zip.file('word/document.xml').async('string');

        // Extract pgMar
        const pgMarMatch = docXml.match(/<w:pgMar\b([^>]*)\/?>/i);
        if (!pgMarMatch) {
            console.error(`❌ FAIL: <w:pgMar> tag not found in word/document.xml!`);
            allPassed = false;
            continue;
        }

        const pgMarAttrs = pgMarMatch[1];
        console.log(`🔎 Found <w:pgMar ${pgMarAttrs}/>`);

        const getAttr = (attr) => {
            const m = pgMarAttrs.match(new RegExp(`w:${attr}=["']([^"']+)["']`, 'i'));
            return m ? parseInt(m[1], 10) : null;
        };

        const actualTop = getAttr('top');
        const actualBottom = getAttr('bottom');
        const actualLeft = getAttr('left');
        const actualRight = getAttr('right');

        console.log(`   Expected dxa: Top=${tc.expectedDxa.top}, Bottom=${tc.expectedDxa.bottom}, Left=${tc.expectedDxa.left}, Right=${tc.expectedDxa.right}`);
        console.log(`   Actual dxa:   Top=${actualTop}, Bottom=${actualBottom}, Left=${actualLeft}, Right=${actualRight}`);

        const topDiff = Math.abs(actualTop - tc.expectedDxa.top);
        const bottomDiff = Math.abs(actualBottom - tc.expectedDxa.bottom);
        const leftDiff = Math.abs(actualLeft - tc.expectedDxa.left);
        const rightDiff = Math.abs(actualRight - tc.expectedDxa.right);

        // Allow 1-2 dxa rounding tolerance
        if (topDiff <= 2 && bottomDiff <= 2 && leftDiff <= 2 && rightDiff <= 2) {
            console.log(`✅ PASS: ${tc.name} produces exact OpenXML margins!`);
        } else {
            console.error(`❌ FAIL: Margin mismatch in ${tc.name}`);
            allPassed = false;
        }
    }

    console.log(`\n========================================`);
    if (allPassed) {
        console.log(`🎉 ALL PAGE MARGIN E2E TESTS PASSED SUCCESSFULLY!`);
    } else {
        console.error(`❌ SOME E2E TESTS FAILED.`);
    }
    console.log(`========================================\n`);

    await page.close();
    if (!process.env.REMOTE_CHROME) {
        await browser.close();
    }
    process.exit(allPassed ? 0 : 1);
}

runMarginE2E().catch(err => {
    console.error('💥 E2E Test Execution Error:', err);
    process.exit(1);
});
