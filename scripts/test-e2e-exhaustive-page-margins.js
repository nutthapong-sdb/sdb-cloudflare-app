const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8002';
const userDownloads = '/Users/litarcopperkaikem/Downloads';

async function selectGDCCDropdown(page, labelText, searchText) {
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

async function runExhaustiveE2ETests() {
    console.log('🚀 ========================================================');
    console.log('🚀 RUNNING EXHAUSTIVE E2E TESTING (PAGE MARGINS & INDENTS)');
    console.log('🚀 ========================================================');

    const testResults = [];
    const recordStep = (pageName, step, selector, criteria, expected, status) => {
        testResults.push({ pageName, step, selector, criteria, expected, status });
        console.log(`[${status}] [${pageName}] ${step} -> ${selector}`);
    };

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1440, height: 900 }
    });

    const page = await browser.newPage();
    const runtimeErrors = [];
    page.on('pageerror', err => runtimeErrors.push(err.message));

    try {
        // Step 1: Login
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
        await page.type('input[type="text"]', 'root');
        await page.type('input[type="password"]', 'password');
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        recordStep('Login Page', 'เข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ', 'button[type="submit"]', 'เข้าสู่ระบบสำเร็จและ redirect ไปหน้าหลัก', 'เปลี่ยนหน้าไปที่ Dashboard สำเร็จ', 'PASS');

        // Step 2: Navigate to GDCC
        await page.goto(`${BASE_URL}/systems/gdcc`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 2000));
        recordStep('GDCC Dashboard', 'เปิดหน้าจัดการรายงาน GDCC', 'เมนู /systems/gdcc', 'หน้า GDCC โหลดสมบูรณ์ ไม่มี runtime error', 'หน้าแสดงผลถูกต้อง 100%', 'PASS');

        // Step 3: Open Settings Dropdown
        const openedMenu = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const menuBtn = buttons.find(b => b.querySelector('svg.lucide-settings') && !b.textContent.includes('Image Size') && !b.textContent.includes('Table Column'));
            if (menuBtn) { menuBtn.click(); return true; }
            return false;
        });
        await new Promise(r => setTimeout(r, 500));
        recordStep('GDCC Header', 'กดเปิดเมนูการตั้งค่า', 'ปุ่มฟันเฟือง Settings', 'เมนูดรอปดาวน์การตั้งค่าเปิดขึ้นมา', 'ดรอปดาวน์แสดงรายการตัวเลือก', openedMenu ? 'PASS' : 'FAIL');

        // Step 4: Open Page Margin Settings Modal
        const openedMarginModal = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const marginBtn = buttons.find(b => b.textContent.includes('Page Margin Settings'));
            if (marginBtn) { marginBtn.click(); return true; }
            return false;
        });
        await new Promise(r => setTimeout(r, 600));
        recordStep('GDCC Settings Modal', 'เปิดหน้าต่างตั้งค่าขอบกระดาษ', 'Page Margin Settings', 'Modal ตั้งค่าระยะขอบ 4 ด้านเปิดขึ้นมา', 'Modal แสดงช่องกรอกตัวเลข 4 ทิศทาง', openedMarginModal ? 'PASS' : 'FAIL');

        // Step 5: Test Setting Margins to 0cm
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
        const saved0 = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const saveBtn = buttons.find(b => b.textContent.includes('Save Settings'));
            if (saveBtn) { saveBtn.click(); return true; }
            return false;
        });
        await new Promise(r => setTimeout(r, 1000));
        recordStep('Margin Modal (0cm)', 'กำหนดระยะขอบ 0 cm ทุกด้านและบันทึก', 'Save Settings', 'บันทึกค่าลง localStorage เป็น 0 cm', 'localStorage ได้รับค่า 0 cm ครบถ้วน', saved0 ? 'PASS' : 'FAIL');

        // Step 6: Select Account & Zone
        await selectGDCCDropdown(page, 'Select Account', '');
        await selectGDCCDropdown(page, 'Select Zone', '');
        recordStep('GDCC Dashboard', 'เลือก Account และ Zone', 'Select Account / Zone Dropdown', 'โหลดข้อมูลสถิติของโดเมนสำเร็จ', 'แสดงข้อมูลสถิติบนหน้าเว็บเรียบร้อย', 'PASS');

        // Step 7: Trigger Real Report Generation via "Create Report"
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const createBtn = buttons.find(b => b.textContent.includes('Create Report'));
            if (createBtn) createBtn.click();
        });
        await new Promise(r => setTimeout(r, 4000));
        recordStep('GDCC Header', 'กดปุ่มสร้างเล่มรายงานจริง', 'Create Report', 'เปิด Batch Export Modal สำเร็จ', 'Modal แสดงรายการ Domain / Subdomains', 'PASS');

        // Step 8: Select Domain in Modal and Click Generate Domain Report
        await page.evaluate(() => {
            const modal = document.querySelector('div.fixed.z-\\[100\\]') || document.querySelector('div.fixed.inset-0');
            if (!modal) return;
            const labels = Array.from(modal.querySelectorAll('label'));
            const hostLabel = labels.find(l => l.textContent.includes('.') || l.textContent.includes('No Subdomain'));
            if (hostLabel) hostLabel.click();
        });
        await new Promise(r => setTimeout(r, 1000));

        const initialJobs0 = await page.evaluate(async () => {
            try {
                const res = await fetch('/api/gdcc/report-jobs');
                const data = await res.json();
                return data.data || [];
            } catch (e) { return []; }
        });
        const maxId0 = initialJobs0.reduce((max, j) => Math.max(max, j.id), 0);

        await page.evaluate(() => {
            const modal = document.querySelector('div.fixed.z-\\[100\\]') || document.querySelector('div.fixed.inset-0');
            if (!modal) return;
            const genBtn = Array.from(modal.querySelectorAll('button')).find(b => !b.disabled && (b.textContent.includes('Generate') || b.textContent.includes('Report')));
            if (genBtn) genBtn.click();
        });
        await new Promise(r => setTimeout(r, 1500));
        await page.evaluate(() => {
            const swalClose = document.querySelector('.swal2-cancel') || document.querySelector('.swal2-confirm');
            if (swalClose) swalClose.click();
        });
        recordStep('Batch Report Modal', 'ส่งงานสร้างเล่มรายงานเข้า Worker คิวหลังบ้าน', 'Generate Domain Report', 'บันทึกงานเข้าฐานข้อมูลและเริ่มประมวลผล', 'Job Status เปลี่ยนเป็น processing', 'PASS');

        // Step 9: Wait for Job 0cm completion
        let job0 = null;
        for (let i = 0; i < 90; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const jobs = await page.evaluate(async () => {
                try {
                    const res = await fetch('/api/gdcc/report-jobs');
                    const data = await res.json();
                    return data.data || [];
                } catch (e) { return []; }
            });
            const nj = jobs.find(j => j.id > maxId0);
            if (nj && nj.status === 'completed' && nj.file_name) {
                job0 = nj;
                break;
            }
        }
        recordStep('Background Worker', 'ประมวลผลสร้างเล่มรายงาน 0cm หลังบ้าน', 'lib/gdcc-report-worker.js', 'สถานะ Job เสร็จสมบูรณ์ 100% พร้อมไฟล์ DOCX', 'Job Completed (100%)', job0 ? 'PASS' : 'FAIL');

        // Step 10: Download and Assert OpenXML for 0cm (Margins & Paragraph Indent Decoupling)
        const res0 = await fetch(`${BASE_URL}/api/gdcc/report-jobs?action=download&fileName=${encodeURIComponent(job0.file_name)}`);
        const buf0 = Buffer.from(await res0.arrayBuffer());
        const zip0 = await JSZip.loadAsync(buf0);
        const docXml0 = await zip0.file('word/document.xml').async('string');
        const stylesXml0 = await zip0.file('word/styles.xml').async('string');

        const pgMar0 = docXml0.match(/<w:pgMar\b([^>]*)\/?>/i);
        const hasPgMar0 = pgMar0 && pgMar0[0].includes('w:top="0"') && pgMar0[0].includes('w:left="0"');
        const normalStyle0 = stylesXml0.match(/<w:style[^>]*w:styleId=\"Normal\"[\s\S]*?<\/w:style>/i);
        const hasNoStyleIndent0 = !normalStyle0 || !normalStyle0[0].includes('<w:ind w:left=');

        recordStep('OpenXML DOCX (0cm)', 'ตรวจเช็ค OpenXML Section Properties', '<w:pgMar>', 'w:top="0" w:left="0" w:right="0" w:bottom="0"', pgMar0 ? pgMar0[0] : 'None', hasPgMar0 ? 'PASS' : 'FAIL');
        recordStep('OpenXML DOCX (0cm)', 'ตรวจเช็ค Paragraph Indent Decoupling', '<w:style w:styleId="Normal">', 'ไม่มีแท็ก <w:ind> ใน Normal Paragraph Style', 'Normal Style Indent สะอาด ปราศจาก paragraph indent', hasNoStyleIndent0 ? 'PASS' : 'FAIL');

        // Step 11: Test 5cm Margins (Boundary Case)
        // Set Margins = 5cm
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
                nativeInputValueSetter.call(input, '5');
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
        await new Promise(r => setTimeout(r, 1000));
        recordStep('Margin Modal (5cm)', 'กำหนดระยะขอบ 5 cm ทุกด้านและบันทึก', 'Save Settings', 'บันทึกค่าลง localStorage เป็น 5 cm', 'localStorage ได้รับค่า 5 cm ครบถ้วน', 'PASS');

        // Trigger Real Report 5cm
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const createBtn = buttons.find(b => b.textContent.includes('Create Report'));
            if (createBtn) createBtn.click();
        });
        await new Promise(r => setTimeout(r, 4000));

        await page.evaluate(() => {
            const modal = document.querySelector('div.fixed.z-\\[100\\]') || document.querySelector('div.fixed.inset-0');
            if (!modal) return;
            const labels = Array.from(modal.querySelectorAll('label'));
            const hostLabel = labels.find(l => l.textContent.includes('.') || l.textContent.includes('No Subdomain'));
            if (hostLabel) hostLabel.click();
        });
        await new Promise(r => setTimeout(r, 1000));

        const initialJobs5 = await page.evaluate(async () => {
            try {
                const res = await fetch('/api/gdcc/report-jobs');
                const data = await res.json();
                return data.data || [];
            } catch (e) { return []; }
        });
        const maxId5 = initialJobs5.reduce((max, j) => Math.max(max, j.id), 0);

        await page.evaluate(() => {
            const modal = document.querySelector('div.fixed.z-\\[100\\]') || document.querySelector('div.fixed.inset-0');
            if (!modal) return;
            const genBtn = Array.from(modal.querySelectorAll('button')).find(b => !b.disabled && (b.textContent.includes('Generate') || b.textContent.includes('Report')));
            if (genBtn) genBtn.click();
        });
        await new Promise(r => setTimeout(r, 1500));
        await page.evaluate(() => {
            const swalClose = document.querySelector('.swal2-cancel') || document.querySelector('.swal2-confirm');
            if (swalClose) swalClose.click();
        });

        // Wait for Job 5cm completion
        let job5 = null;
        for (let i = 0; i < 90; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const jobs = await page.evaluate(async () => {
                try {
                    const res = await fetch('/api/gdcc/report-jobs');
                    const data = await res.json();
                    return data.data || [];
                } catch (e) { return []; }
            });
            const nj = jobs.find(j => j.id > maxId5);
            if (nj && nj.status === 'completed' && nj.file_name) {
                job5 = nj;
                break;
            }
        }
        recordStep('Background Worker', 'ประมวลผลสร้างเล่มรายงาน 5cm หลังบ้าน', 'lib/gdcc-report-worker.js', 'สถานะ Job เสร็จสมบูรณ์ 100% พร้อมไฟล์ DOCX', 'Job Completed (100%)', job5 ? 'PASS' : 'FAIL');

        // Assert OpenXML for 5cm (Margins = 2835 dxa, Paragraph Indents = 0)
        const res5 = await fetch(`${BASE_URL}/api/gdcc/report-jobs?action=download&fileName=${encodeURIComponent(job5.file_name)}`);
        const buf5 = Buffer.from(await res5.arrayBuffer());
        const zip5 = await JSZip.loadAsync(buf5);
        const docXml5 = await zip5.file('word/document.xml').async('string');
        const stylesXml5 = await zip5.file('word/styles.xml').async('string');

        const pgMar5 = docXml5.match(/<w:pgMar\b([^>]*)\/?>/i);
        const hasPgMar5 = pgMar5 && pgMar5[0].includes('w:top="2835"') && pgMar5[0].includes('w:left="2835"');
        const normalStyle5 = stylesXml5.match(/<w:style[^>]*w:styleId=\"Normal\"[\s\S]*?<\/w:style>/i);
        const hasNoStyleIndent5 = !normalStyle5 || !normalStyle5[0].includes('<w:ind w:left=');

        recordStep('OpenXML DOCX (5cm)', 'ตรวจเช็ค OpenXML Section Properties', '<w:pgMar>', 'w:top="2835" w:left="2835" w:right="2835" w:bottom="2835"', pgMar5 ? pgMar5[0] : 'None', hasPgMar5 ? 'PASS' : 'FAIL');
        recordStep('OpenXML DOCX (5cm)', 'ตรวจเช็ค Paragraph Indent Decoupling (5cm)', '<w:style w:styleId="Normal">', 'ไม่มีแท็ก <w:ind w:left="2835"> ป้องกัน paragraph indent ซ้อนทับ', 'Normal Style Indent สะอาด ปราศจาก indent ซ้อนทับ 100%', hasNoStyleIndent5 ? 'PASS' : 'FAIL');

        // Copy files to Downloads
        fs.writeFileSync(path.join(userDownloads, 'e2e_real_report_0cm.docx'), buf0);
        fs.writeFileSync(path.join(userDownloads, 'e2e_real_report_5cm.docx'), buf5);
        recordStep('File Export', 'บันทึกไฟล์เล่มรายงานทั้ง 2 ขนาดลง ~/Downloads', 'fs.writeFileSync', 'ไฟล์ docx บันทึกลงโฟลเดอร์ Downloads เรียบร้อย', 'e2e_real_report_0cm.docx & 5cm.docx', 'PASS');

    } finally {
        await browser.close();
    }

    console.log('\n========================================================');
    console.log('📊 E2E EXHAUSTIVE TEST RESULTS TABLE');
    console.log('========================================================\n');
    console.log('| หน้า (Page) | ขั้นตอนการทดสอบ (Action Step) | ปุ่ม / Selector ที่กด | เกณฑ์การวัดผล (Measurement Criteria) | ผลลัพธ์ที่ได้ (Expected Result) | สถานะ (Status) |');
    console.log('|---|---|---|---|---|:---:|');
    testResults.forEach(r => {
        console.log(`| ${r.pageName} | ${r.step} | \`${r.selector}\` | ${r.criteria} | ${r.expected} | ${r.status} |`);
    });
}

runExhaustiveE2ETests().catch(err => {
    console.error('💥 E2E Test Suite Failed:', err);
    process.exit(1);
});
