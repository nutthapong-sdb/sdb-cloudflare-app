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

    await page.evaluate(() => {
        const id = 'cf-domains-render-fix';
        let style = document.getElementById(id);
        if (!style) {
            style = document.createElement('style');
            style.id = id;
            document.head.appendChild(style);
        }
        style.innerHTML = `
            [role="table"] {
                display: block !important;
                width: 100% !important;
                overflow: visible !important;
            }
            [role="table"] [class*="overflow-x-clip"],
            [role="table"] [class*="overflow-y-clip"],
            [role="table"] [data-sentry-component="TableBody"] {
                overflow: visible !important;
            }
            [role="table"] [role="row"],
            [role="table"] [role="rowgroup"] > div {
                display: flex !important;
                flex-direction: row !important;
                width: 100% !important;
                min-height: 44px !important;
                border-bottom: 1px solid #e5e7eb !important;
            }
            [role="table"] [role="cell"],
            [role="table"] [role="columnheader"] {
                display: flex !important;
                align-items: center !important;
                padding: 8px 12px !important;
                flex: 1 1 0 !important;
            }
            [role="table"] [role="cell"]:first-child,
            [role="table"] [role="columnheader"]:first-child {
                flex: 2 1 0 !important;
            }
        `;
    });
    await new Promise(r => setTimeout(r, 600));

    // Calculate crop for Domains
    const crop = await page.evaluate(() => {
        const h = Array.from(document.querySelectorAll('h1, h2, h3, div, span')).find(el => (el.innerText || '').trim().startsWith('Domains') && el.getBoundingClientRect().left > 200);
        const footer = Array.from(document.querySelectorAll('*')).find(el => (el.innerText || '').trim().startsWith('Showing 1'));
        
        const hRect = h ? h.getBoundingClientRect() : { top: 80, left: 328 };
        const fRect = footer ? footer.getBoundingClientRect() : { bottom: 480, right: 1650 };
        
        return {
            x: Math.max(0, Math.round(hRect.left) - 30),
            y: Math.max(0, Math.round(hRect.top) - 20),
            width: Math.min(1920, Math.round(1350)),
            height: Math.round(fRect.bottom - hRect.top + 40)
        };
    });

    console.log('Crop:', crop);
    await page.screenshot({ path: '/app/public/captured-domains-perfect.png', clip: crop });
    console.log('Saved captured-domains-perfect.png');
    await browser.disconnect();
})();
