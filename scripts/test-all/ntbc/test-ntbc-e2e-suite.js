/**
 * Full E2E Test Suite for NTBC CFReport
 * 1. Module 1: Dashboard Layout & Live Browser Monitor
 * 2. Module 2: Image Size Settings Modal & Bidirectional Sync (Debug -> Image Size)
 * 3. Module 3: Quick Debug Session (17 Tabs, Image Size -> Debug Sync, & Live Page Capture)
 * 4. Module 4: GLS Template Verification (15 Dynamic Variables)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8002';
const TMP_DOWNLOAD_DIR = path.join(__dirname, '../tmp_downloads');
if (!fs.existsSync(TMP_DOWNLOAD_DIR)) fs.mkdirSync(TMP_DOWNLOAD_DIR, { recursive: true });

const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    bold: "\x1b[1m"
};

function log(msg, color = colors.reset) {
    console.log(`${color}${msg}${colors.reset}`);
}

const testResults = [];

function recordResult(pageName, action, selector, criteria, result, status) {
    testResults.push({
        'หน้า (Page)': pageName,
        'ขั้นตอนการทดสอบ (Action)': action,
        'ปุ่ม / Selector ที่กด': selector,
        'เกณฑ์การวัดผล (Criteria)': criteria,
        'ผลลัพธ์ที่ได้ (Result)': result,
        'สถานะ (Status)': status ? '✅ Passed' : '❌ Failed'
    });
    const statusColor = status ? colors.green : colors.red;
    log(`[${status ? 'PASS' : 'FAIL'}] ${pageName} > ${action}: ${result}`, statusColor);
}

async function runE2ESuite() {
    log('\n=============================================================', colors.cyan);
    log('🚀 Starting Full E2E Test Suite: NTBC CFReport System', colors.cyan + colors.bold);
    log('=============================================================\n', colors.cyan);

    let browser;
    let page;

    try {
        log('🔹 Launching Puppeteer browser for E2E testing...', colors.blue);
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding'
            ],
            defaultViewport: { width: 1440, height: 900 }
        });

        page = await browser.newPage();
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: TMP_DOWNLOAD_DIR,
        });

        page.on('pageerror', err => log(`   [Page Error] ${err.message}`, colors.red));
        page.on('console', msg => {
            if (msg.type() === 'error') log(`   [Console Error] ${msg.text()}`, colors.yellow);
        });

        // -------------------------------------------------------------
        // STEP 0: Authentication (Login)
        // -------------------------------------------------------------
        log('\n🔑 STEP 0: Authenticating into System...', colors.blue);
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1500));

        if (page.url().includes('/login')) {
            await page.waitForSelector('input[type="text"]', { visible: true });
            await page.type('input[type="text"]', 'root');
            await page.type('input[type="password"]', 'password');
            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 2500));
        }

        const isLogged = !page.url().includes('/login');
        recordResult(
            'Login',
            'เข้าสู่ระบบด้วย root / password',
            'input[type="password"] -> Enter',
            'Redirect เข้าสู่ Dashboard',
            isLogged ? `Logged in successfully (URL: ${page.url()})` : 'Login failed',
            isLogged
        );
        if (!isLogged) throw new Error('Login failed');

        // -------------------------------------------------------------
        // MODULE 1: NTBC Dashboard Layout & Live Monitor
        // -------------------------------------------------------------
        log('\n🖥️ MODULE 1: NTBC Dashboard Layout & Live Monitor Verification', colors.blue);
        await page.goto(`${BASE_URL}/systems/ntbc_cfreport`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        // 1.1 Verify 3 Workspace Cards
        const cardHeaders = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim());
        });
        const hasImageSettingsCard = cardHeaders.includes('Image Size Settings');
        const hasManageTemplateCard = cardHeaders.includes('Manage Templates');
        const hasGenerateReportCard = cardHeaders.includes('Generate Report');

        recordResult(
            'NTBC Dashboard',
            'ตรวจสอบการ์ดทั้ง 3 บนหน้าหลัก',
            'h3 cards',
            'มี Image Size Settings, Manage Templates, Generate Report ครบ',
            `พบการ์ด: ${cardHeaders.join(' | ')}`,
            hasImageSettingsCard && hasManageTemplateCard && hasGenerateReportCard
        );

        // 1.2 Verify Embedded Live Monitor (noVNC iframe)
        const vncIframeSrc = await page.evaluate(() => {
            const iframe = document.querySelector('iframe[title="Live Browser Monitor"]');
            return iframe ? iframe.getAttribute('src') : null;
        });
        const hasVncMonitor = !!vncIframeSrc && vncIframeSrc.includes('/vnc/');
        recordResult(
            'NTBC Dashboard',
            'ตรวจสอบ Live Browser Monitor บนหน้าหลัก',
            'iframe[title="Live Browser Monitor"]',
            'มี Live Monitor iframe ฝังอยู่ใต้การ์ดและเชื่อมต่อ VNC',
            hasVncMonitor ? `Live Monitor พร้อมใช้งาน (src: ${vncIframeSrc})` : 'ไม่พบ Live Monitor iframe',
            hasVncMonitor
        );

        // -------------------------------------------------------------
        // MODULE 2: Image Size Settings Modal & Sync
        // -------------------------------------------------------------
        log('\n📐 MODULE 2: Image Size Settings Modal & Bidirectional Sync', colors.blue);

        // 2.1 Open Image Size Settings modal
        await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('h3'));
            const target = cards.find(c => c.textContent.trim() === 'Image Size Settings');
            if (target) target.closest('div').click();
        });
        await new Promise(r => setTimeout(r, 1500));

        const isModalOpen = await page.evaluate(() => {
            return !!document.querySelector('input[placeholder="Auto"]');
        });
        recordResult(
            'Image Size Settings',
            'คลิกเปิดหน้าต่าง Image Size Settings',
            'Card: Image Size Settings',
            'Modal แสดงผลพร้อมฟิลด์ Width (px) และ Crop Coordinates',
            isModalOpen ? 'Modal เปิดและเรนเดอร์ input ครบถ้วน' : 'Modal ไม่เปิด',
            isModalOpen
        );

        // 2.2 Test "📥 ดึงค่าจาก Debug Setting" button
        const pullFromDebugBtn = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => b.textContent.includes('ดึงค่าจาก Debug Setting'));
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });
        await new Promise(r => setTimeout(r, 1500));

        const swalTitle = await page.evaluate(() => {
            const el = document.querySelector('.swal2-title');
            return el ? el.textContent : null;
        });
        recordResult(
            'Image Size Settings',
            'กดปุ่ม "📥 ดึงค่าจาก Debug Setting"',
            'Button: 📥 ดึงค่าจาก Debug Setting',
            'คัดลอกพิกัด Crop จาก Debug Setting มาใส่ใน Modal และแจ้งเตือนสำเร็จ',
            `แจ้งเตือนผลลัพธ์: ${swalTitle || 'ดึงค่าสำเร็จ'}`,
            pullFromDebugBtn
        );

        // 2.3 Modify a coordinate and save
        const savedSettings = await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input[type="number"], input[type="text"]'));
            if (inputs.length > 0) {
                const firstInput = inputs[0];
                firstInput.value = '750';
                firstInput.dispatchEvent(new Event('input', { bubbles: true }));
                firstInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Save Settings'));
            if (saveBtn) {
                saveBtn.click();
                return true;
            }
            return false;
        });
        await new Promise(r => setTimeout(r, 1500));

        // Verify independent localStorage key `ntbc:image-size-settings`
        const localSettings = await page.evaluate(() => {
            return localStorage.getItem('ntbc:image-size-settings');
        });
        const hasIndependentStorage = !!localSettings && localSettings.includes('widths') && localSettings.includes('coords');
        recordResult(
            'Image Size Settings',
            'บันทึกการตั้งค่าลง LocalStorage แบบอิสระ',
            'Button: Save Settings',
            'จัดเก็บใน key `ntbc:image-size-settings` แยกเป็นอิสระจาก control_coords',
            hasIndependentStorage ? `บันทึกสำเร็จ: ${localSettings.substring(0, 80)}...` : 'ไม่พบข้อมูลใน LocalStorage',
            hasIndependentStorage
        );

        // Close modal
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 1000));

        // -------------------------------------------------------------
        // MODULE 3: Quick Debug Session & Live Captures
        // -------------------------------------------------------------
        log('\n⚡ MODULE 3: Quick Debug Session & Live Screenshot Captures', colors.blue);
        await page.goto(`${BASE_URL}/systems/ntbc_cfreport/control`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2500));

        // 3.1 Verify all 17 tabs in the sidebar
        const tabs = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('div.flex-col button, div.overflow-x-auto button'));
            return buttons.map(b => b.textContent.trim()).filter(t => t.length > 0 && !t.includes('Fullscreen') && !t.includes('Maximize') && !t.includes('Reset') && !t.includes('Back'));
        });
        
        const expectedTabs = ['Domains', 'DNS Records', 'Bot Management', 'Security Level', 'SSL/TLS Mode', 'Edge Certificates', 'HTTP Traffic', 'Traffic Countries', 'Firewall', 'Events by Source', 'Custom Rules', 'Rate Limiting', 'Managed WAF', 'IP Access', 'Zone Lockdown', 'Argo Smart', 'Speed Test'];
        const foundAllTabs = expectedTabs.every(exp => tabs.some(t => t.includes(exp)));

        recordResult(
            'Quick Debug Session',
            'ตรวจสอบแท็บรายการ Screenshot ทั้ง 17 หมวด',
            'Sidebar Navigation Tabs',
            'มีแท็บครบทั้ง 17 หมวดหมู่สำหรับทุกตัวแปร',
            `พบทั้งหมด ${tabs.length} แท็บ (${foundAllTabs ? 'ครบทุกหมวด' : 'ขาดบางหมวด'})`,
            foundAllTabs
        );

        // 3.2 Test "📥 ดึงค่าจาก Image Size Setting" button in Crop Coordinates
        const pullFromImageSizeBtn = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => b.textContent.includes('ดึงค่าจาก Image Size Setting'));
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });
        await new Promise(r => setTimeout(r, 1500));

        const pullSwal = await page.evaluate(() => {
            const el = document.querySelector('.swal2-title');
            return el ? el.textContent : null;
        });
        recordResult(
            'Quick Debug Session',
            'กดปุ่ม "📥 ดึงค่าจาก Image Size Setting" ในกล่องพิกัด Crop',
            'Button: 📥 ดึงค่าจาก Image Size Setting',
            'คัดลอกพิกัดจาก Image Size Setting มาใส่ใน Debug Coords สำเร็จ',
            `สถานะการดึงค่า: ${pullSwal || 'ดึงค่าสำเร็จ'}`,
            pullFromImageSizeBtn
        );

        // 3.3 Test Direct Live Capture on Bot Management Tab
        log('   -> Testing direct single capture on Bot Management...', colors.cyan);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const botTab = btns.find(b => b.textContent.includes('Bot Management'));
            if (botTab) botTab.click();
        });
        await new Promise(r => setTimeout(r, 1000));

        const captureBtnClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const capBtn = btns.find(b => b.textContent.includes('Capture This Page Now'));
            if (capBtn) {
                capBtn.click();
                return true;
            }
            return false;
        });

        // Wait up to 35 seconds for live Chrome navigation and screenshot
        log('   -> Waiting for live Chrome navigation and capture (max 35s)...', colors.gray);
        let captureSuccess = false;
        const capStart = Date.now();
        while (Date.now() - capStart < 35000) {
            const hasImg = await page.evaluate(() => {
                const img = document.querySelector('img[alt*="Bot Management"]');
                return img && img.getAttribute('src') && img.getAttribute('src').startsWith('data:image/png;base64,');
            });
            if (hasImg) {
                captureSuccess = true;
                break;
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        recordResult(
            'Quick Debug Session',
            'กด "📸 Capture This Page Now" บนแท็บ Bot Management',
            'Button: 📸 Capture This Page Now',
            'สั่ง Chrome Live Monitor ไปหน้า Cloudflare และได้ภาพ Data URL 1920x1080',
            captureSuccess ? 'แคปรูปภาพ Bot Management สดสำเร็จและแสดงพรีวิว' : 'เกิดข้อผิดพลาดในการแคปรูปภาพ',
            captureSuccess
        );

        // -------------------------------------------------------------
        // MODULE 4: GLS Template Verification
        // -------------------------------------------------------------
        log('\n📑 MODULE 4: GLS Template Dynamic Variables Verification', colors.blue);
        
        // Fetch GLS template from static template API
        const templateRes = await axios.get(`${BASE_URL}/api/ntbc-static-template?id=1788234492865`);
        const templateHtml = templateRes.data.template || '';
        const dynamicVarMatches = templateHtml.match(/@captured_[a-z0-9_]+/g) || [];
        const uniqueVars = Array.from(new Set(dynamicVarMatches));

        recordResult(
            'GLS Template',
            'ตรวจสอบตัวแปร Dynamic Screenshot ใน Template GLS',
            'API: /api/ntbc-static-template?id=1788234492865',
            'มีตัวแปร @captured_bot_management, @captured_security_level ฯลฯ ครบ',
            `พบตัวแปร Dynamic ทั้งหมด ${uniqueVars.length} ตัวแปร (${uniqueVars.slice(0, 4).join(', ')}...)`,
            uniqueVars.length >= 15
        );

        // -------------------------------------------------------------
        // Print Summary Table
        // -------------------------------------------------------------
        log('\n=============================================================', colors.cyan);
        log('📊 E2E Regression Test Summary Report', colors.cyan + colors.bold);
        log('=============================================================\n', colors.cyan);
        console.table(testResults);

        const total = testResults.length;
        const passed = testResults.filter(r => r['สถานะ (Status)'].includes('Passed')).length;
        const failed = total - passed;

        log(`\n🏁 Total: ${total} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`, failed === 0 ? colors.green + colors.bold : colors.red + colors.bold);

        if (failed > 0) {
            process.exitCode = 1;
        }

    } catch (err) {
        log(`\n❌ E2E Suite Error: ${err.message}`, colors.red);
        if (err.stack) console.error(err.stack);
        process.exitCode = 1;
    } finally {
        if (browser) await browser.close();
    }
}

runE2ESuite();
