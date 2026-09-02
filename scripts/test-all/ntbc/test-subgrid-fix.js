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
            /* Fix subgrid issue in Chrome headless */
            [class*="grid-cols-subgrid"] {
                display: flex !important;
                flex-direction: row !important;
                width: 100% !important;
            }
            [role="cell"] {
                flex: 1 1 auto !important;
                min-width: 120px !important;
            }
            [role="cell"]:first-child {
                flex: 2 1 auto !important;
                min-width: 250px !important;
            }
        `;
        document.head.appendChild(style);
    });
    await new Promise(r => setTimeout(r, 600));

    await page.screenshot({ path: '/app/public/domains-subgrid-fixed.png' });
    console.log('Saved domains-subgrid-fixed.png');
    await browser.disconnect();
})();
