/**
 * Test: GDCC - Manage Template TinyMCE 404 Check
 * Verifies if opening the Manage Template Modal causes a 404 on TinyMCE assets.
 */
const { setupBrowser, setupPage, login, log, colors } = require('../libs/ui-helper');
const { navigateToGDCC } = require('../libs/gdcc-helper');

(async () => {
    log('🚀 Starting Test: Manage Template TinyMCE 404 Check...', colors.cyan);
    const browser = await setupBrowser();
    try {
        const page = await setupPage(browser);
        
        // Listen for console messages
        const consoleErrors = [];
        page.on('console', msg => {
            const txt = msg.text();
            if (msg.type() === 'error') {
                log(`[Browser Console Error] ${txt}`, colors.red);
                consoleErrors.push(txt);
            } else {
                log(`[Browser Console] ${txt}`, colors.gray);
            }
        });

        // Listen for failed requests
        const failedRequests = [];
        page.on('requestfailed', request => {
            const url = request.url();
            const err = request.failure()?.errorText || 'Unknown error';
            log(`[Request Failed] ${url} - ${err}`, colors.red);
            failedRequests.push({ url, err });
        });

        page.on('response', response => {
            const url = response.url();
            if (response.status() >= 400) {
                log(`[HTTP Error] ${url} - ${response.status()} ${response.statusText()}`, colors.red);
                failedRequests.push({ url, status: response.status(), text: response.statusText() });
            }
        });

        // Perform login
        await login(page);
        
        // Navigate to GDCC
        await navigateToGDCC(page);

        // Click the Settings (Report Menu) dropdown
        log('🔹 Opening settings dropdown...', colors.blue);
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const settingsBtn = btns.find(b => {
                const text = b.textContent.trim();
                if (text !== '') return false;
                const svgs = b.querySelectorAll('svg');
                return svgs.length >= 1;
            });
            if (settingsBtn) {
                settingsBtn.click();
            } else {
                throw new Error('Settings button not found in page.evaluate');
            }
        });
        
        log('   Settings dropdown clicked', colors.gray);
        await new Promise(r => setTimeout(r, 1500));

        // Click "Manage Template"
        log('🔹 Clicking "Manage Template" button...', colors.blue);
        const clickedManage = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const manageBtn = buttons.find(b => b.textContent.includes('Manage Template'));
            if (manageBtn) {
                manageBtn.click();
                return true;
            }
            return false;
        });

        if (!clickedManage) {
            throw new Error('"Manage Template" button not found or could not be clicked');
        }
        log('   "Manage Template" clicked', colors.gray);
        
        log('🔹 Waiting 8 seconds to load TinyMCE assets...', colors.blue);
        await new Promise(r => setTimeout(r, 8000));

        // Log results
        log('\n--- VERIFICATION RESULTS ---', colors.cyan);
        const tinymce404 = failedRequests.some(r => r.url.includes('tinymce') && (r.status === 404 || r.err?.includes('404')));
        if (tinymce404) {
            log('❌ TinyMCE asset returned 404!', colors.red);
        } else {
            log('✅ No TinyMCE 404 detected during the session!', colors.green);
        }

        if (failedRequests.length > 0) {
            log('\nFailed Requests / Error responses list:', colors.yellow);
            failedRequests.forEach(r => log(`  - ${r.url} (Status: ${r.status || r.err})`, colors.red));
        } else {
            log('No failed requests or HTTP errors detected.', colors.green);
        }

    } catch (error) {
        log(`❌ Test failed with error: ${error.message}`, colors.red);
        console.error(error.stack);
    } finally {
        await browser.close();
        log('🏁 Test finished.', colors.cyan);
    }
})();
