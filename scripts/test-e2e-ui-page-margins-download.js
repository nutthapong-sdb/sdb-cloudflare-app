const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8002';
const downloadDir = path.join(__dirname, '../public/test-margin-downloads-ui');

if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
}

async function runFullUIMarginTest() {
    console.log('🚀 Running Complete UI Interaction Page Margin E2E Test...');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1440, height: 900 }
    });

    const page = await browser.newPage();
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadDir
    });

    console.log(`🔑 Logging in at ${BASE_URL}/login...`);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    if (page.url().includes('/login')) {
        await page.waitForSelector('input[type="text"]', { visible: true });
        await page.type('input[type="text"]', 'root');
        await page.type('input[type="password"]', 'password');
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
    }

    console.log(`🌐 Navigating to ${BASE_URL}/systems/gdcc...`);
    await page.goto(`${BASE_URL}/systems/gdcc`, { waitUntil: 'networkidle2', timeout: 30000 });

    // Step 1: Open Settings Menu dropdown
    console.log('👆 Clicking Settings menu button on top right...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const menuBtn = buttons.find(b => b.querySelector('svg.lucide-settings') && !b.textContent.includes('Image Size') && !b.textContent.includes('Table Column'));
        if (menuBtn) menuBtn.click();
    });

    await new Promise(r => setTimeout(r, 600));

    // Step 2: Click "Page Margin Settings"
    console.log('👆 Clicking "Page Margin Settings" menu item...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const marginBtn = buttons.find(b => b.textContent.includes('Page Margin Settings'));
        if (marginBtn) marginBtn.click();
    });

    await new Promise(r => setTimeout(r, 800));

    // Step 3: Select Narrow Preset (1.27cm) inside modal
    console.log('👆 Selecting "Narrow" preset...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const narrowBtn = buttons.find(b => b.textContent.includes('Narrow'));
        if (narrowBtn) narrowBtn.click();
    });

    await new Promise(r => setTimeout(r, 500));

    // Step 4: Click Save Settings button
    console.log('💾 Clicking "Save Settings"...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const saveBtn = buttons.find(b => b.textContent.includes('Save Settings'));
        if (saveBtn) saveBtn.click();
    });

    await new Promise(r => setTimeout(r, 1500));

    // Step 5: Check localStorage value
    const savedMargins = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('gdcc:page-margins') || '{}');
    });
    console.log('📦 Verified localStorage value after selecting Narrow:', savedMargins);

    if (savedMargins.top === 1.27 && savedMargins.bottom === 1.27 && savedMargins.left === 1.27 && savedMargins.right === 1.27) {
        console.log('✅ PASS: Modal UI properly saved 1.27cm Narrow preset into localStorage!');
    } else {
        console.error('❌ FAIL: localStorage does not contain expected 1.27cm values!');
        process.exit(1);
    }

    // Step 6: Test Custom Margins (0cm)
    console.log('\n--- Testing Custom 0cm Margins via UI ---');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const menuBtn = buttons.find(b => b.querySelector('svg.lucide-settings') && !b.textContent.includes('Image Size') && !b.textContent.includes('Table Column'));
        if (menuBtn) menuBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const marginBtn = buttons.find(b => b.textContent.includes('Page Margin Settings'));
        if (marginBtn) marginBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Fill 0 in all 4 inputs
    console.log('✍️ Entering 0 into Top, Bottom, Left, Right inputs...');
    await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="number"]'));
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        inputs.forEach(input => {
            nativeInputValueSetter.call(input, '0');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });

    await new Promise(r => setTimeout(r, 500));

    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const saveBtn = buttons.find(b => b.textContent.includes('Save Settings'));
        if (saveBtn) saveBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    const zeroMargins = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('gdcc:page-margins') || '{}');
    });
    console.log('📦 Verified localStorage after custom 0cm save:', zeroMargins);

    if (zeroMargins.top === 0 && zeroMargins.bottom === 0 && zeroMargins.left === 0 && zeroMargins.right === 0) {
        console.log('✅ PASS: Custom 0cm values saved accurately in localStorage!');
    } else {
        console.error('❌ FAIL: Custom 0cm not saved properly!');
        process.exit(1);
    }

    // Step 7: Export Word and verify the actual docx file produced
    console.log('\n--- Verifying Downloaded Word File with 0cm Margins ---');
    const docxResult = await page.evaluate(async () => {
        const margins = JSON.parse(localStorage.getItem('gdcc:page-margins') || '{}');
        const res = await fetch('/api/export-docx', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                html: '<div class="Section1"><p>Testing 0cm margins live download</p><table><tr><td>A</td><td>B</td></tr></table></div>',
                filename: 'test_zero_ui.docx',
                margins
            })
        });
        const arrayBuffer = await res.arrayBuffer();
        return { status: res.status, byteLength: arrayBuffer.byteLength, base64: btoa(String.fromCharCode(...new Uint8Array(arrayBuffer))) };
    });

    const docxBuffer = Buffer.from(docxResult.base64, 'base64');
    const zip = await JSZip.loadAsync(docxBuffer);
    const docXml = await zip.file('word/document.xml').async('string');
    const pgMarMatch = docXml.match(/<w:pgMar\b([^>]*)\/?>/i);
    console.log('🔎 Found <w:pgMar in generated Word file:', pgMarMatch ? pgMarMatch[0] : 'None');

    const topVal = (pgMarMatch[1].match(/w:top=["']([^"']+)["']/i) || [])[1];
    const bottomVal = (pgMarMatch[1].match(/w:bottom=["']([^"']+)["']/i) || [])[1];
    const leftVal = (pgMarMatch[1].match(/w:left=["']([^"']+)["']/i) || [])[1];
    const rightVal = (pgMarMatch[1].match(/w:right=["']([^"']+)["']/i) || [])[1];

    if (topVal === '0' && bottomVal === '0' && leftVal === '0' && rightVal === '0') {
        console.log('✅ PASS: Word DOCX contains exact w:top="0" w:bottom="0" w:left="0" w:right="0"!');
    } else {
        console.error(`❌ FAIL: Expected 0 margins in Word file, but got top=${topVal}, bottom=${bottomVal}, left=${leftVal}, right=${rightVal}`);
        process.exit(1);
    }

    console.log('\n🎉 ALL FULL UI + EXPORT TESTS PASSED WITH 100% SUCCESS!');
    await browser.close();
    process.exit(0);
}

runFullUIMarginTest().catch(err => {
    console.error('💥 Test Error:', err);
    process.exit(1);
});
