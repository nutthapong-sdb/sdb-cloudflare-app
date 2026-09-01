const dns = require('dns');
const puppeteer = require('puppeteer');

const ACCOUNT_ID = 'ae240d50da44461d1fc5e34f708ebec8';
const DOMAIN_NAME = 'log.softdebut.online';

const TABS = [
    { key: 'domains', label: 'Domains Overview', path: '/domains/overview', expectedKeywords: ['Domains', 'Sites', 'Speed up and protect'] },
    { key: 'dns', label: 'DNS Records', path: `/${DOMAIN_NAME}/dns/records`, expectedKeywords: ['DNS', 'Records'] },
    { key: 'botManagement', label: 'Bot Management', path: `/${DOMAIN_NAME}/security/settings`, expectedKeywords: ['Bot', 'Security', 'Fight'] },
    { key: 'securityLevel', label: 'Security Level & BIC', path: `/${DOMAIN_NAME}/security/settings`, expectedKeywords: ['Security Level', 'Browser Integrity Check', 'Challenge'] },
    { key: 'sslOverview', label: 'SSL/TLS Encryption', path: `/${DOMAIN_NAME}/ssl-tls`, expectedKeywords: ['SSL/TLS', 'Encryption', 'Full', 'Flexible'] },
    { key: 'sslEdge', label: 'Edge Certificates', path: `/${DOMAIN_NAME}/ssl-tls/edge-certificates`, expectedKeywords: ['Edge Certificates', 'TLS', 'Certificate'] },
    { key: 'traffic', label: 'HTTP Traffic Overview', path: `/${DOMAIN_NAME}/analytics/traffic`, expectedKeywords: ['Traffic', 'Requests', 'Bandwidth'] },
    { key: 'trafficCountries', label: 'Traffic by Country', path: `/${DOMAIN_NAME}/analytics/traffic`, expectedKeywords: ['Country', 'Requests', 'Traffic'] },
    { key: 'firewall', label: 'Firewall Overview', path: `/${DOMAIN_NAME}/security/analytics/events`, expectedKeywords: ['Security Events', 'Events', 'Activity log'] },
    { key: 'topEventsSource', label: 'Top Events by Source', path: `/${DOMAIN_NAME}/security/analytics/events`, expectedKeywords: ['Events by source', 'Top events', 'Events'] },
    { key: 'securityRules', label: 'Security Custom Rules', path: `/${DOMAIN_NAME}/security/security-rules`, expectedKeywords: ['Custom rules', 'Rules', 'WAF'] },
    { key: 'rateLimiting', label: 'Rate Limiting Rules', path: `/${DOMAIN_NAME}/security/security-rules`, expectedKeywords: ['Rate limiting', 'Rules'] },
    { key: 'managedRules', label: 'Managed WAF Rules', path: `/${DOMAIN_NAME}/security/security-rules`, expectedKeywords: ['Managed Rules', 'Cloudflare Managed Rules', 'Rules'] },
    { key: 'ipAccess', label: 'IP Access Rules', path: `/${DOMAIN_NAME}/security/security-rules`, expectedKeywords: ['IP Access', 'Tools', 'Rules'] },
    { key: 'zoneLockdown', label: 'Zone Lockdown Rules', path: `/${DOMAIN_NAME}/security/security-rules`, expectedKeywords: ['Zone Lockdown', 'Lockdown', 'Rules'] },
    { key: 'argo', label: 'Argo Smart Routing', path: `/${DOMAIN_NAME}/traffic`, expectedKeywords: ['Argo', 'Smart Routing', 'Traffic'] },
    { key: 'speed', label: 'Speed Test Results', path: `/${DOMAIN_NAME}/speed/test/browser`, expectedKeywords: ['Speed', 'Performance', 'Test', 'Page Speed'] }
];

async function run() {
    console.log('🔍 Starting All 17 Tabs Content & OCR/DOM Verification on Live Cloudflare...');
    const ip = await new Promise((res, rej) => dns.lookup('sdb-chrome-browser', (e, a) => e ? rej(e) : res(a)));
    const fetchRes = await fetch('http://' + ip + ':9222/json/version');
    const v = await fetchRes.json();
    const wsUrl = v.webSocketDebuggerUrl.replace(/localhost:[0-9]+/, ip + ':9222');
    const browser = await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('cloudflare.com')) || pages[0];
    await page.setViewport({ width: 1920, height: 1080 });

    const results = [];

    for (const tab of TABS) {
        const fullUrl = `https://dash.cloudflare.com/${ACCOUNT_ID}${tab.path}`;
        console.log(`\n--------------------------------------------------`);
        console.log(`🚀 Testing [${tab.key}] ${tab.label}`);
        console.log(`   Navigating to: ${fullUrl}`);

        try {
            await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(r => setTimeout(r, 3000));

            const actualUrl = page.url();
            const pageTitle = await page.title();

            // Extract visible text from body/headings
            const pageText = await page.evaluate(() => {
                const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, [role="heading"], nav, main, aside, header, div'))
                    .map(el => el.innerText ? el.innerText.trim() : '')
                    .filter(t => t.length > 0);
                return headings.join(' | ').toLowerCase();
            });

            // Check if any expected keyword is found in page text or title
            const matchedKeywords = tab.expectedKeywords.filter(kw => 
                pageText.includes(kw.toLowerCase()) || pageTitle.toLowerCase().includes(kw.toLowerCase())
            );

            const isMatch = matchedKeywords.length > 0;

            console.log(`   Title: "${pageTitle}"`);
            console.log(`   Resolved URL: ${actualUrl}`);
            console.log(`   Matched Keywords: ${matchedKeywords.join(', ') || 'NONE'}`);
            console.log(`   Status: ${isMatch ? '✅ MATCH' : '❌ MISMATCH'}`);

            results.push({
                tab: tab.key,
                label: tab.label,
                path: tab.path,
                resolvedUrl: actualUrl,
                matched: matchedKeywords,
                status: isMatch ? '✅ OK' : '❌ MISMATCH'
            });
        } catch (err) {
            console.error(`   Error testing ${tab.key}:`, err.message);
            results.push({
                tab: tab.key,
                label: tab.label,
                path: tab.path,
                resolvedUrl: 'ERROR',
                matched: [],
                status: `❌ ERROR: ${err.message}`
            });
        }
    }

    console.log('\n==================================================');
    console.log('📊 SUMMARY REPORT OF ALL 17 TABS:');
    console.table(results);
    await browser.disconnect();
}

run().catch(console.error);
