const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { login, log, colors } = require('./test-all/libs/ui-helper');
const { navigateToGDCC } = require('./test-all/libs/gdcc-helper');

// Helper to inspect w:line attribute from exported docx file buffer
async function getDocxLineSpacing(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file('word/document.xml').async('text');
    
    // Find w:spacing tag
    const spacingMatch = docXml.match(/<w:spacing\s+[^>]*w:line="(\d+)"/);
    if (spacingMatch) {
        return parseInt(spacingMatch[1], 10);
    }
    return null;
}

async function run() {
    log('🚀 Starting E2E Line Spacing Validation Test Suite...', colors.magenta);
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });

    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[Trace') || text.includes('📸') || text.includes('Error')) {
            console.log(`[Browser Console]: ${text}`);
        }
    });

    try {
        await login(page);
        await navigateToGDCC(page);
        await new Promise(r => setTimeout(r, 2000));

        // Inject mock hooks
        await page.evaluate(() => {
            window.__mockHtmlToImage = async () => 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAAEAAQBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
            window.__mockGenerateDashboardImages = () => ({
                main: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAAEAAQBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
                totalRequestsTrafficVolume: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAAEAAQBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
                avgResponseTime: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAAEAAQBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
                blockedEventsFirewallActions: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAAEAAQBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
                topUrls: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAAEAAQBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
                topClientIps: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAAEAAQBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
                topUserAgents: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAAEAAQBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
                attackPreventionHistory: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAAEAAQBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
                topWafRules: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAAEAAQBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
                top5Attackers: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAAEAAQBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='
            });
        });

        // Select Account and Zone
        log('Selecting Account, Zone and Subdomains...', colors.blue);
        await page.evaluate(() => {
            const accSelect = document.querySelector('select');
            if (accSelect) {
                accSelect.value = '2f09e2e29d1ac07662b573e58c91ff3d';
                accSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        await new Promise(r => setTimeout(r, 2000));

        await page.evaluate(() => {
            const zoneSelects = Array.from(document.querySelectorAll('select'));
            if (zoneSelects[1]) {
                zoneSelects[1].value = '7connect.co.th';
                zoneSelects[1].dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        await new Promise(r => setTimeout(r, 2000));

        // Function to set template content in TinyMCE
        async function updateTemplateSpacing(lineHeightStyle, marginBottomStyle) {
            log(`Opening Manage Template modal for spacing setting...`, colors.blue);
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const genBtn = buttons.find(b => b.textContent.includes('Generate Dashboard'));
                if (genBtn && genBtn.parentElement) {
                    const settingsBtn = genBtn.parentElement.querySelector('div.relative button');
                    if (settingsBtn) settingsBtn.click();
                }
            });
            await new Promise(r => setTimeout(r, 800));

            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Manage Template'));
                if (btn) btn.click();
            });
            await new Promise(r => setTimeout(r, 1500));

            await page.evaluate(() => {
                const cards = Array.from(document.querySelectorAll('div.group'));
                const targetCard = cards.find(c => c.textContent.includes('User Custom Template') || c.textContent.includes('default') || c.textContent.includes('GDCC'));
                if (targetCard) {
                    const btn = Array.from(targetCard.querySelectorAll('button')).find(b => b.textContent.includes('Domain Report'));
                    if (btn) btn.click();
                }
            });
            await new Promise(r => setTimeout(r, 2500));

            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Edit Template'));
                if (btn) btn.click();
            });
            await new Promise(r => setTimeout(r, 2000));

            await page.evaluate((lh, mb) => {
                if (window.tinymce && tinymce.activeEditor) {
                    tinymce.activeEditor.setContent(`<p style="line-height: ${lh}; margin-bottom: ${mb};">Test Spacing Content Paragraph</p>`);
                }
            }, lineHeightStyle, marginBottomStyle);
            await new Promise(r => setTimeout(r, 1000));

            log(`Saving template spacing style...`, colors.blue);
            await page.evaluate(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Save Template'));
                if (btn) btn.click();
            });
            await new Promise(r => setTimeout(r, 2000));

            // Close editor modal
            await page.evaluate(() => {
                const modals = Array.from(document.querySelectorAll('div[class*="fixed"]'));
                const editorModal = modals.find(m => m.textContent.includes('Domain Report') || m.textContent.includes('Edit Report') || m.textContent.includes('Cancel') || m.textContent.includes('Save Template'));
                if (editorModal) {
                    const closeBtn = editorModal.querySelector('button');
                    if (closeBtn) {
                        console.log('📸 Closing editor modal...');
                        closeBtn.click();
                    }
                }
            });
            await new Promise(r => setTimeout(r, 1000));

            // Close Manage Template modal
            await page.evaluate(() => {
                const modals = Array.from(document.querySelectorAll('div[class*="fixed"]'));
                const manageModal = modals.find(m => m.textContent.includes('Manage Report Templates'));
                if (manageModal) {
                    const closeBtn = manageModal.querySelector('button');
                    if (closeBtn) {
                        console.log('📸 Closing Manage Template modal...');
                        closeBtn.click();
                    }
                }
            });
            await new Promise(r => setTimeout(r, 1000));
        }

        // Helper to generate and retrieve HTML
        async function generateReportHTML() {
            // Enable worker mode to capture final html
            await page.evaluate(() => {
                localStorage.setItem('gdcc_worker_mode', 'true');
                window.__lastBatchReportReady = false;
                window.__lastBatchReportHTML = null;
            });

            // Click Create Report button to open export options
            const opened = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const batchBtn = buttons.find(b => b.textContent.includes('Create Report'));
                if (batchBtn) {
                    console.log('📸 Found Create Report button, clicking...');
                    batchBtn.click();
                    return true;
                }
                console.error('❌ Create Report button not found!');
                return false;
            });
            if (!opened) throw new Error('Could not open Create Report modal');
            await new Promise(r => setTimeout(r, 2000));

            // Set Date Inputs
            const dateSet = await page.evaluate(() => {
                const modal = Array.from(document.querySelectorAll('div[class*="fixed"]')).find(m => m.textContent.includes('Create Report'));
                if (modal) {
                    const dateInputs = Array.from(modal.querySelectorAll('input[type="date"]'));
                    if (dateInputs.length >= 2) {
                        console.log('📸 Found date inputs, setting values...');
                        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        setter.call(dateInputs[0], '2026-06-18');
                        dateInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
                        dateInputs[0].dispatchEvent(new Event('change', { bubbles: true }));

                        setter.call(dateInputs[1], '2026-06-24');
                        dateInputs[1].dispatchEvent(new Event('input', { bubbles: true }));
                        dateInputs[1].dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    }
                }
                console.error('❌ Date inputs not found inside modal!');
                return false;
            });
            if (!dateSet) throw new Error('Could not set dates');
            await new Promise(r => setTimeout(r, 1000));

            // Select "No Subdomain"
            const labelClicked = await page.evaluate(() => {
                const label = Array.from(document.querySelectorAll('label, span')).find(el => el.textContent.includes('No Subdomain'));
                if (label) {
                    console.log('📸 Found No Subdomain label, clicking...');
                    label.click();
                    return true;
                }
                console.error('❌ No Subdomain label not found!');
                return false;
            });
            if (!labelClicked) throw new Error('Could not select No Subdomain');
            await new Promise(r => setTimeout(r, 1000));

            // Click Generate Domain Report
            const generated = await page.evaluate(() => {
                const modal = Array.from(document.querySelectorAll('div[class*="fixed"]')).find(m => m.textContent.includes('Create Report'));
                if (modal) {
                    const exportBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent.trim() === 'Generate Domain Report');
                    if (exportBtn) {
                        console.log('📸 Found Generate Domain Report button, clicking...');
                        exportBtn.click();
                        return true;
                    }
                }
                console.error('❌ Generate Domain Report button not found!');
                return false;
            });
            if (!generated) throw new Error('Could not click Generate Domain Report');

            log('Waiting for report compilation...', colors.blue);
            let compiledHtml = '';
            for (let attempt = 1; attempt <= 24; attempt++) {
                const ready = await page.evaluate(() => window.__lastBatchReportReady === true);
                if (ready) {
                    compiledHtml = await page.evaluate(() => window.__lastBatchReportHTML);
                    break;
                }
                await new Promise(r => setTimeout(r, 2000));
            }
            
            if (!compiledHtml) {
                throw new Error('Report generation timed out');
            }
            return compiledHtml;
        }

        // --- STEP 1: Spacing 1.0 ---
        log('=== Generating Spacing 1.0 Report ===', colors.magenta);
        await updateTemplateSpacing('1.0', '6px');
        const html1 = await generateReportHTML();

        // --- STEP 2: Spacing 2.0 ---
        log('=== Generating Spacing 2.0 Report ===', colors.magenta);
        await updateTemplateSpacing('2.0', '24px');
        const html2 = await generateReportHTML();

        // --- STEP 3: Convert both to DOCX using the backend ---
        log('Sending HTML contents to backend export-docx API...', colors.blue);
        
        const convertResponse1 = await page.evaluate(async (html) => {
            const res = await fetch('/api/export-docx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html, filename: 'report_spacing_1.docx' })
            });
            const blob = await res.blob();
            const reader = new FileReader();
            return new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        }, html1);

        const convertResponse2 = await page.evaluate(async (html) => {
            const res = await fetch('/api/export-docx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html, filename: 'report_spacing_2.docx' })
            });
            const blob = await res.blob();
            const reader = new FileReader();
            return new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        }, html2);

        // Convert base64 data URIs back to Buffers
        const buffer1 = Buffer.from(convertResponse1.split(',')[1], 'base64');
        const buffer2 = Buffer.from(convertResponse2.split(',')[1], 'base64');

        fs.writeFileSync('scratch/report_spacing_1.docx', buffer1);
        fs.writeFileSync('scratch/report_spacing_2.docx', buffer2);
        log('Saved exported report spacing files.', colors.green);

        // --- STEP 4: Inspect XML w:line spacing properties ---
        log('Inspecting exported DOCX line spacing properties...', colors.blue);
        const lineSpacing1 = await getDocxLineSpacing(buffer1);
        const lineSpacing2 = await getDocxLineSpacing(buffer2);

        log(`Report 1 (spacing 1.0) line attribute value: ${lineSpacing1}`, colors.yellow);
        log(`Report 2 (spacing 2.0) line attribute value: ${lineSpacing2}`, colors.yellow);

        if (!lineSpacing1 || !lineSpacing2) {
            throw new Error(`Line spacing tag not resolved properly. Spacing 1: ${lineSpacing1}, Spacing 2: ${lineSpacing2}`);
        }

        if (lineSpacing1 === lineSpacing2) {
            throw new Error(`FAILED: Both reports have the same line spacing (${lineSpacing1}). Line spacing did not adjust correctly.`);
        }

        log(`🎉 SUCCESS: Spacing 1.0 (value: ${lineSpacing1}) is different from Spacing 2.0 (value: ${lineSpacing2})!`, colors.green);
        log(`🏆 LINE SPACING E2E TEST PASSED SUCCESSFULLY!`, colors.green);

    } catch (e) {
        log(`❌ E2E Validation Error: ${e.message}`, colors.red);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

run();
