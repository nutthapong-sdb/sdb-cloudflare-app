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

    await page.evaluate(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            * {
                overflow: visible !important;
                clip-path: none !important;
            }
            [role="table"] {
                display: block !important;
                width: 100% !important;
                min-height: 200px !important;
            }
            [role="row"], [role="rowgroup"] > div {
                display: flex !important;
                flex-direction: row !important;
                width: 100% !important;
                min-height: 40px !important;
                border-bottom: 1px solid #e5e7eb !important;
            }
            [role="cell"], [role="columnheader"] {
                display: flex !important;
                align-items: center !important;
                padding: 8px 12px !important;
                flex: 1 1 0 !important;
            }
            [role="cell"]:first-child, [role="columnheader"]:first-child {
                flex: 2 1 0 !important;
            }
        `;
        document.head.appendChild(style);
    });
    await new Promise(r => setTimeout(r, 600));

    await page.screenshot({ path: '/app/public/domains-overflow-fixed.png' });
    console.log('Saved domains-overflow-fixed.png');
    await browser.disconnect();
})();
