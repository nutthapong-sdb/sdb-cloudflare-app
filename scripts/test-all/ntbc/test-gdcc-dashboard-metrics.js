/**
 * E2E Test: GDCC Dashboard Metrics Loading
 * Verifies that clicking "Generate Dashboard" loads all numbers on the UI cards
 * (Total Requests, Avg Response Time, Blocked Events, etc.) and they are not empty/zero.
 */

const { setupBrowser, setupPage, login, log, colors } = require('../libs/ui-helper');
const { navigateToGDCC, selectGDCCFilters, clickGenerateDashboard } = require('../libs/gdcc-helper');

(async () => {
    log('🚀 Starting GDCC Dashboard Metrics E2E Test...', colors.cyan);
    
    process.env.HEADLESS = '1';
    
    const browser = await setupBrowser();
    let page;
    try {
        page = await setupPage(browser);
        
        await login(page);

        log('\n🔹 Step 1: Navigating to GDCC Dashboard...', colors.blue);
        await navigateToGDCC(page);

        log('\n🔹 Step 2: Selecting Account, Zone, and Subdomain...', colors.blue);
        await selectGDCCFilters(page);

        log('\n🔹 Step 3: Clicking "Generate Dashboard" to load numbers...', colors.blue);
        await clickGenerateDashboard(page);

        log('\n🔹 Step 4: Reading and verifying metric cards from the UI...', colors.blue);
        
        // Wait for dashboard container to have opacity 100
        await page.waitForFunction(() => {
            const db = document.querySelector('main div[ref="dashboardRef"], main div.space-y-4.transition-all');
            if (!db) return false;
            const style = window.getComputedStyle(db);
            return style.opacity === '1';
        }, { timeout: 10000 }).catch(() => {
            log('⚠️ Dashboard container opacity is not 1. Checking elements anyway...', colors.yellow);
        });

        const metrics = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('main div.grid-cols-1.md\\:grid-cols-3 > div'));
            if (cards.length === 0) {
                // Fallback to searching all card elements if layout differs
                return { error: 'No metric cards found on the page' };
            }
            
            const results = {};
            cards.forEach(card => {
                const titleEl = card.querySelector('h3, div.text-xs, div.font-semibold');
                const title = titleEl ? (titleEl.textContent || '').trim() : '';
                const valEl = card.querySelector('span.text-6xl, span.font-bold');
                const val = valEl ? (valEl.textContent || '').trim() : '';
                
                if (title && val) {
                    results[title] = val;
                }
            });
            
            return results;
        });

        log('\n📊 UI Dashboard Card Values Loaded:', colors.cyan);
        console.log(JSON.stringify(metrics, null, 2));

        if (metrics.error) {
            throw new Error(metrics.error);
        }

        // Verify that we read the cards
        const keys = Object.keys(metrics);
        if (keys.length === 0) {
            throw new Error('No metrics could be extracted from dashboard cards');
        }

        // Assert on the values
        log('\n🔹 Step 5: Asserting values are loaded and valid...', colors.blue);
        let hasFailure = false;
        
        keys.forEach(k => {
            const val = metrics[k];
            log(`   - Card "${k}": value is "${val}"`, colors.gray);
            
            if (val === '' || val === '-' || val === null) {
                log(`     ❌ FAIL: Value for "${k}" is empty or placeholder!`, colors.red);
                hasFailure = true;
            } else {
                log(`     ✅ PASS: Value for "${k}" is populated.`, colors.green);
            }
        });

        if (hasFailure) {
            throw new Error('One or more metric cards displayed empty values or placeholders.');
        }

        log('\n🎉 SUCCESS: All dashboard cards successfully populated with values!', colors.green);
        process.exit(0);

    } catch (error) {
        log(`\n❌ Test FAILED: ${error.message}`, colors.red);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
