const dns = require('dns');
const puppeteer = require('puppeteer');

(async () => {
    const ip = await new Promise((res, rej) => dns.lookup('sdb-chrome-browser', (e, a) => e ? rej(e) : res(a)));
    const fetchRes = await fetch('http://' + ip + ':9222/json/version');
    const v = await fetchRes.json();
    const wsUrl = v.webSocketDebuggerUrl.replace(/localhost:[0-9]+/, ip + ':9222');
    const browser = await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('cloudflare.com')) || pages[0];
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('Navigating to /domains/overview...');
    await page.goto('https://dash.cloudflare.com/ae240d50da44461d1fc5e34f708ebec8/domains/overview', { waitUntil: 'domcontentloaded' });

    for (let i = 1; i <= 10; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const status = await page.evaluate((sec) => {
            const table = document.querySelector('table, [role="table"], [data-testid*="table"]');
            const rows = document.querySelectorAll('tr, [role="row"], tbody tr, [data-testid*="row"]');
            const text = document.body.innerText;
            const hasDomains = text.includes('softdebut') || text.includes('log.');
            return {
                sec,
                hasTable: !!table,
                rowCount: rows.length,
                hasDomains,
                bodySnippet: text.substring(0, 150).replace(/\n/g, ' ')
            };
        }, i);
        console.log(`[${i}s] Status:`, status);
        if (status.hasDomains) {
            console.log('Domains appeared on page!');
            break;
        }
    }

    await page.screenshot({ path: '/app/public/domains-overview-rendered.png' });
    console.log('Screenshot saved to /app/public/domains-overview-rendered.png');
    await browser.disconnect();
})();
