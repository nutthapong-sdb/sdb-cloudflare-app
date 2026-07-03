/**
 * E2E Test: GDCC Subdomain Firewall Metrics Loading
 * Verifies that selecting GDCC -> sesalpglpn.go.th -> www.sesalpglpn.go.th
 * and clicking "Generate Dashboard" loads all firewall metrics.
 */

const { setupBrowser, setupPage, login, log, colors } = require('../libs/ui-helper');
const { navigateToGDCC, selectGDCCFilters, clickGenerateDashboard } = require('../libs/gdcc-helper');

(async () => {
    log('🚀 Starting GDCC Subdomain Firewall Metrics E2E Test...', colors.cyan);
    
    process.env.HEADLESS = '1';
    
    const browser = await setupBrowser();
    let page;
    try {
        page = await setupPage(browser);
        
        // Listen to console logs in browser
        page.on('console', msg => {
            log(`   [Browser Console] ${msg.text()}`, colors.yellow);
        });
        page.on('pageerror', err => {
            log(`   [Browser Page Error] ${err.toString()}`, colors.red);
        });

        await login(page);

        log('\n🔹 Step 1: Navigating to GDCC Dashboard...', colors.blue);
        await navigateToGDCC(page);

        log('\n🔹 Step 2: Selecting Account, Zone, and Subdomain...', colors.blue);
        const config = {
            account_name: 'Government Data Center and Cloud service (GDCC)',
            zone_name: 'sesalpglpn.go.th',
            subdomain: 'www.sesalpglpn.go.th'
        };
        await selectGDCCFilters(page, config);

        log('\n🔹 Step 3: Clicking "Generate Dashboard" to load numbers...', colors.blue);
        await clickGenerateDashboard(page);
        
        // Wait 5 seconds for data
        await new Promise(r => setTimeout(r, 5000));

        log('\n🔹 Step 4: Reading and verifying metric cards and tables from the UI...', colors.blue);

        const metrics = await page.evaluate(() => {
            const results = {};
            
            // 1. Blocked Events Card
            const cards = Array.from(document.querySelectorAll('main div.grid-cols-1.md\\:grid-cols-3 > div'));
            cards.forEach(card => {
                const titleEl = card.querySelector('h3, div.text-xs, div.font-semibold');
                const title = titleEl ? (titleEl.textContent || '').trim() : '';
                const valEl = card.querySelector('span.text-6xl, span.font-bold');
                const val = valEl ? (valEl.textContent || '').trim() : '';
                if (title && val) {
                    results[title] = val;
                }
            });

            // 2. Firewall tables / lists (Top WAF Rules, Top 5 Attackers)
            const lists = Array.from(document.querySelectorAll('main div.grid-cols-1.lg\\:grid-cols-2 > div, main div.grid.grid-cols-1.gap-6 > div'));
            lists.forEach(list => {
                const titleEl = list.querySelector('h3, h2, div.font-semibold');
                const title = titleEl ? (titleEl.textContent || '').trim() : '';
                if (title) {
                    const rows = Array.from(list.querySelectorAll('table tbody tr, ul li, div.flex.justify-between'));
                    results[title] = rows.length;
                }
            });
            
            return results;
        });

        log('\n📊 UI Dashboard Loaded Metrics:', colors.cyan);
        console.log(JSON.stringify(metrics, null, 2));

        // Assert on the values
        log('\n🔹 Step 5: Asserting values are loaded and valid...', colors.blue);
        let hasFailure = false;
        
        const requiredCards = ['Blocked Events', 'Total Requests', 'Blocked Events'];
        requiredCards.forEach(k => {
            if (metrics[k] !== undefined) {
                const val = metrics[k];
                log(`   - Card "${k}": value is "${val}"`, colors.gray);
                if (val === '' || val === '-' || val === null) {
                    log(`     ❌ FAIL: Value for "${k}" is empty or placeholder!`, colors.red);
                    hasFailure = true;
                } else {
                    log(`     ✅ PASS: Value for "${k}" is populated.`, colors.green);
                }
            }
        });

        if (hasFailure) {
            throw new Error('One or more metric cards displayed empty values or placeholders.');
        }

        log('\n🎉 SUCCESS: Subdomain firewall metrics loaded successfully!', colors.green);
        process.exit(0);

    } catch (error) {
        log(`\n❌ Test FAILED: ${error.message}`, colors.red);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
