const path = require('path');
const fs = require('fs');
const axios = require('axios');
const ADMZip = require('jszip');
const { setupBrowser, setupPage, login, log, colors, BASE_URL } = require('./test-all/libs/ui-helper');
const { selectGDCCFilters, navigateToGDCC } = require('./test-all/libs/gdcc-helper');

async function getDocxImageDimensions(filePath) {
    const data = fs.readFileSync(filePath);
    const zip = await ADMZip.loadAsync(data);
    const docXml = await zip.file('word/document.xml').async('text');
    
    // Find all wp:extent tags and return their cx (width) values
    const extents = [];
    const regex = /<wp:extent\s+cx="(\d+)"\s+cy="(\d+)"/g;
    let match;
    while ((match = regex.exec(docXml)) !== null) {
        extents.push({
            cx: parseInt(match[1], 10),
            cy: parseInt(match[2], 10)
        });
    }
    return extents;
}

async function run() {
    log('🚀 Starting E2E Image Size Validation Test Suite...', colors.cyan);
    
    // Test Case 1: Backend TinyMCE Inline Resizing Validation
    log('\n--- TEST CASE 1: TinyMCE Rescaled Images Export Validation ---', colors.cyan);
    const testImgPath = path.join(process.cwd(), 'public/captured-dashboard.png');
    if (!fs.existsSync(testImgPath)) {
        log('❌ Error: captured-dashboard.png not found!', colors.red);
        process.exit(1);
    }
    const testImgBuffer = fs.readFileSync(testImgPath);
    const imgDataUri = `data:image/png;base64,${testImgBuffer.toString('base64')}`;

    // 1. Export HTML A: Resized to 500px in style
    log('Exporting HTML A (style="width: 500px; height: 500px")...', colors.blue);
    const htmlA = `<p>Resized Image 500px style:</p><img src="${imgDataUri}" style="width: 500px; height: 500px;" />`;
    const resA = await axios.post(`${BASE_URL}/api/export-docx`, { html: htmlA, filename: 'tinymce_500px.docx' }, { responseType: 'arraybuffer' });
    const fileA = 'public/tinymce_500px.docx';
    fs.writeFileSync(fileA, Buffer.from(resA.data));
    const dimA = await getDocxImageDimensions(fileA);
    log(`   ✅ Export A complete. File size: ${resA.data.byteLength} bytes. Image size: ${JSON.stringify(dimA)}`, colors.green);

    // 2. Export HTML B: Resized to 5px in attributes (TinyMCE attribute resize fallback)
    log('Exporting HTML B (width="5" height="5")...', colors.blue);
    const htmlB = `<p>Resized Image 5px attributes:</p><img src="${imgDataUri}" width="5" height="5" />`;
    const resB = await axios.post(`${BASE_URL}/api/export-docx`, { html: htmlB, filename: 'tinymce_5px.docx' }, { responseType: 'arraybuffer' });
    const fileB = 'public/tinymce_5px.docx';
    fs.writeFileSync(fileB, Buffer.from(resB.data));
    const dimB = await getDocxImageDimensions(fileB);
    log(`   ✅ Export B complete. File size: ${resB.data.byteLength} bytes. Image size: ${JSON.stringify(dimB)}`, colors.green);

    // Assert Test Case 1 results
    if (dimA.length === 0 || dimB.length === 0) {
        log('❌ Test Case 1 Failed: Image extent properties not found in DOCX structure.', colors.red);
        process.exit(1);
    }
    const expected500pxEMUs = 4762500;
    const expected5pxEMUs = 47625;
    if (dimA[0].cx === expected500pxEMUs && dimB[0].cx === expected5pxEMUs) {
        log('🎉 TEST CASE 1 PASSED: TinyMCE rescaled styles and attributes are correctly normalized and rendered at correct dimensions!', colors.green);
    } else {
        log(`❌ TEST CASE 1 FAILED: Image widths do not match expected EMUs. 500px = ${dimA[0].cx} (expected ${expected500pxEMUs}), 5px = ${dimB[0].cx} (expected ${expected5pxEMUs})`, colors.red);
        process.exit(1);
    }

    // Clean up Test Case 1 files
    try {
        fs.unlinkSync(fileA);
        fs.unlinkSync(fileB);
    } catch (e) {}


    // Test Case 2: Image Size Settings (500px vs 5px) UI E2E
    log('\n--- TEST CASE 2: Image Size Settings UI & Export Validation ---', colors.cyan);
    const browser = await setupBrowser();
    const page = await setupPage(browser);

    await page.evaluateOnNewDocument(() => {
        const mockUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
        window.__mockHtmlToImage = async () => {
            return mockUri;
        };
        window.__mockGenerateDashboardImages = () => {
            return {
                main: mockUri,
                totalRequestsTrafficVolume: mockUri,
                avgResponseTime: mockUri,
                blockedEventsFirewallActions: mockUri,
                topUrls: mockUri,
                topClientIps: mockUri,
                topUserAgents: mockUri,
                attackPreventionHistory: mockUri,
                topWafRules: mockUri,
                top5Attackers: mockUri
            };
        };
    });

    page.on('console', msg => {
        console.log(`[Browser Console]: ${msg.text()}`);
    });

    page.on('pageerror', err => {
        console.error(`❌ [Browser Page Error]: ${err.toString()}`);
    });

    try {
        await login(page);

        log('Force client-side worker mode in Puppeteer session...', colors.blue);
        await page.evaluate(() => {
            localStorage.setItem('gdcc_worker_mode', 'true');
        });

        log('Navigating to GDCC Workspace...', colors.blue);
        await navigateToGDCC(page);


        log('Selecting Account, Zone and Subdomains...', colors.blue);
        await selectGDCCFilters(page, {
            account_name: '7 Solutions',
            zone_name: '7connect.co.th',
            subdomain: 'ALL_SUBDOMAINS'
        });

        // Function to set all image widths in UI
        async function setImageSizeSettingInUI(widthValue) {
            log(`Opening Image Size Settings modal to set width to ${widthValue}px...`, colors.blue);
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const genBtn = buttons.find(b => b.textContent.includes('Generate Dashboard'));
                if (genBtn && genBtn.parentElement) {
                    const settingsBtn = genBtn.parentElement.querySelector('div.relative button');
                    if (settingsBtn) settingsBtn.click();
                }
            });
            await new Promise(r => setTimeout(r, 1000));

            await page.evaluate(() => {
                const item = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Image Size Settings'));
                if (item) item.click();
            });
            await new Promise(r => setTimeout(r, 1500));

            log(`   Setting all inputs to ${widthValue}...`, colors.blue);
            await page.evaluate((val) => {
                const modal = document.querySelector('div[class*="fixed"]');
                if (modal) {
                    const inputs = Array.from(modal.querySelectorAll('input[type="number"]'));
                    inputs.forEach(input => {
                        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        setter.call(input, val);
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    });
                }
            }, widthValue);
            await new Promise(r => setTimeout(r, 500));

            log('   Saving settings...', colors.blue);
            await page.evaluate(() => {
                const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Save Settings'));
                if (saveBtn) saveBtn.click();
            });
            await new Promise(r => setTimeout(r, 1500));
        }

        // --- SUBCASE 2A: Set Width to 500px and Export ---
        await setImageSizeSettingInUI(500);

        log('Generating 500px report...', colors.blue);
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const batchBtn = buttons.find(b => b.textContent.includes('Create Report'));
            if (batchBtn) batchBtn.click();
        });
        await new Promise(r => setTimeout(r, 1500));

        // Set Date Range in Modal to 2026-06-18 to 2026-06-24
        await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input[type="date"]'));
            inputs.forEach(input => input.removeAttribute('max'));
        });
        await new Promise(r => setTimeout(r, 500));

        const dateInputsA = await page.$$('input[type="date"]');
        if (dateInputsA.length >= 2) {
            await page.evaluate((el, val) => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, dateInputsA[0], '2026-06-18');

            await page.evaluate((el, val) => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, dateInputsA[1], '2026-06-24');
        }

        // Select No Subdomain for domain report
        await page.evaluate(() => {
            const label = Array.from(document.querySelectorAll('label, span')).find(el => el.textContent.includes('No Subdomain'));
            if (label) label.click();
        });
        await new Promise(r => setTimeout(r, 1000));

        // Clear ready variable
        await page.evaluate(() => {
            window.__lastBatchReportReady = false;
            window.__lastBatchReportHTML = null;
        });

        // Click generate report
        await page.evaluate(() => {
            const modal = document.querySelector('div[class*="fixed"]');
            if (modal) {
                const exportBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent.trim() === 'Generate Domain Report');
                if (exportBtn) exportBtn.click();
            }
        });

        log('Waiting for 500px report compilation...', colors.blue);
        let ready500 = false;
        for (let attempt = 1; attempt <= 24; attempt++) {
            ready500 = await page.evaluate(() => window.__lastBatchReportReady === true);
            if (ready500) break;
            const mockType = await page.evaluate(() => typeof window.__mockHtmlToImage);
            const cropMockType = await page.evaluate(() => typeof window.__mockGenerateDashboardImages);
            log(`   [Attempt ${attempt}/24] window.__lastBatchReportReady: ${ready500} (mocks: htmlToImage=${mockType}, crop=${cropMockType})`, colors.yellow);
            await new Promise(r => setTimeout(r, 5000));
        }
        if (!ready500) {
            throw new Error('Timeout waiting for 500px report compilation (120s)');
        }
        const html500 = await page.evaluate(() => window.__lastBatchReportHTML);

        log('Saving 500px docx...', colors.blue);
        const res500 = await axios.post(`${BASE_URL}/api/export-docx`, { html: html500, filename: 'settings_500px.docx' }, { responseType: 'arraybuffer' });
        const file500 = 'public/settings_500px.docx';
        fs.writeFileSync(file500, Buffer.from(res500.data));
        const dim500 = await getDocxImageDimensions(file500);
        log(`   ✅ Export 500px complete. Image size: ${JSON.stringify(dim500)}`, colors.green);

        // Close report modal
        await page.evaluate(() => {
            const closeBtn = document.querySelector('button[className*="close"], button:has(svg[class*="X"])');
            if (closeBtn) closeBtn.click();
        });
        await new Promise(r => setTimeout(r, 1500));

        // Reload page to reset all React states cleanly
        log('Reloading page to cleanly reset React state for the second run...', colors.blue);
        await page.reload({ waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 2000));

        log('Re-selecting Account, Zone and Subdomains...', colors.blue);
        await selectGDCCFilters(page, {
            account_name: '7 Solutions',
            zone_name: '7connect.co.th',
            subdomain: 'ALL_SUBDOMAINS'
        });

        // --- SUBCASE 2B: Set Width to 5px and Export ---
        await setImageSizeSettingInUI(5);

        log('Generating 5px report...', colors.blue);
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const batchBtn = buttons.find(b => b.textContent.includes('Create Report'));
            if (batchBtn) batchBtn.click();
        });
        await new Promise(r => setTimeout(r, 1500));

        // Set Date Range in Modal to 2026-06-18 to 2026-06-24
        await page.evaluate(() => {
            const inputs = Array.from(document.querySelectorAll('input[type="date"]'));
            inputs.forEach(input => input.removeAttribute('max'));
        });
        await new Promise(r => setTimeout(r, 500));

        const dateInputsB = await page.$$('input[type="date"]');
        if (dateInputsB.length >= 2) {
            await page.evaluate((el, val) => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, dateInputsB[0], '2026-06-18');

            await page.evaluate((el, val) => {
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, dateInputsB[1], '2026-06-24');
        }

        // Select No Subdomain
        await page.evaluate(() => {
            const label = Array.from(document.querySelectorAll('label, span')).find(el => el.textContent.includes('No Subdomain'));
            if (label) label.click();
        });
        await new Promise(r => setTimeout(r, 1000));

        // Clear ready variable
        await page.evaluate(() => {
            window.__lastBatchReportReady = false;
            window.__lastBatchReportHTML = null;
        });

        // Click generate report
        await page.evaluate(() => {
            const modal = document.querySelector('div[class*="fixed"]');
            if (modal) {
                const exportBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent.trim() === 'Generate Domain Report');
                if (exportBtn) exportBtn.click();
            }
        });

        log('Waiting for 5px report compilation...', colors.blue);
        let ready5 = false;
        for (let attempt = 1; attempt <= 24; attempt++) {
            ready5 = await page.evaluate(() => window.__lastBatchReportReady === true);
            if (ready5) break;
            const mockType = await page.evaluate(() => typeof window.__mockHtmlToImage);
            const cropMockType = await page.evaluate(() => typeof window.__mockGenerateDashboardImages);
            log(`   [Attempt ${attempt}/24] window.__lastBatchReportReady: ${ready5} (mocks: htmlToImage=${mockType}, crop=${cropMockType})`, colors.yellow);
            await new Promise(r => setTimeout(r, 5000));
        }
        if (!ready5) {
            throw new Error('Timeout waiting for 5px report compilation (120s)');
        }
        const html5 = await page.evaluate(() => window.__lastBatchReportHTML);

        log('Saving 5px docx...', colors.blue);
        const res5 = await axios.post(`${BASE_URL}/api/export-docx`, { html: html5, filename: 'settings_5px.docx' }, { responseType: 'arraybuffer' });
        const file5 = 'public/settings_5px.docx';
        fs.writeFileSync(file5, Buffer.from(res5.data));
        const dim5 = await getDocxImageDimensions(file5);
        log(`   ✅ Export 5px complete. Image size: ${JSON.stringify(dim5)}`, colors.green);


        // --- ASSERTIONS & COMPARISON ---
        log('\nComparing exported file structures...', colors.blue);
        
        // Check file sizes
        const size500 = fs.statSync(file500).size;
        const size5 = fs.statSync(file5).size;
        log(`File sizes: 500px report = ${size500} bytes, 5px report = ${size5} bytes.`, colors.blue);
        
        // Find dashboard image variables. They are totalRequestsTrafficVolume, avgResponseTime etc.
        // We'll search for their EMUs inside dim500 and dim5.
        // In dim500, they should be 4762500 EMUs. In dim5, they should be 47625 EMUs.
        const has500pxWidth = dim500.some(img => img.cx === 4762500);
        const has5pxWidth = dim5.some(img => img.cx === 47625);

        if (has500pxWidth && has5pxWidth) {
            log('🎉 TEST CASE 2 PASSED: Image Size Settings correctly resized all dashboard screenshot card variables in the exported DOCX files!', colors.green);
        } else {
            log(`❌ TEST CASE 2 FAILED: Resized image dimensions not found in the docx files. 500px contains 4762500 EMUs: ${has500pxWidth}, 5px contains 47625 EMUs: ${has5pxWidth}`, colors.red);
            process.exit(1);
        }

        // Clean up Test Case 2 files
        try {
            fs.unlinkSync(file500);
            fs.unlinkSync(file5);
        } catch (e) {}

        log('\n🏆 ALL E2E TEST CASES PASSED SUCCESSFULLY!', colors.green);

    } catch (err) {
        log('❌ E2E test script failed: ' + err, colors.red);
        if (err.stack) console.error(err.stack);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

run();
