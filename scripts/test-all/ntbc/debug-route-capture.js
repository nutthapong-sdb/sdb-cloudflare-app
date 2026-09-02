const dns = require('dns');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const fs = require('fs');

(async () => {
    const ip = await new Promise((res, rej) => dns.lookup('sdb-chrome-browser', (e, a) => e ? rej(e) : res(a)));
    const fetchRes = await fetch('http://' + ip + ':9222/json/version');
    const v = await fetchRes.json();
    const wsUrl = v.webSocketDebuggerUrl.replace(/localhost:[0-9]+/, ip + ':9222');
    const browser = await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('cloudflare.com')) || pages[0];
    await page.setViewport({ width: 1920, height: 1080 });

    const type = 'domains';
    const qXStart = '255';
    const qXEnd = '1610';
    const qYStart = '38';
    const qYEnd = '485';

    // Step 1: Inject style
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

    // Step 2: Screenshot
    const fullScreenshotBase64 = await page.screenshot({
        encoding: 'base64',
        type: 'png'
    });
    const pageBuffer = Buffer.from(fullScreenshotBase64, 'base64');

    // Step 3: Sharp crop
    const xs = parseInt(qXStart, 10);
    const xe = parseInt(qXEnd, 10);
    const ys = parseInt(qYStart, 10);
    const ye = parseInt(qYEnd, 10);
    const cropCoords = {
        x: xs,
        y: ys,
        width: xe - xs,
        height: ye - ys
    };

    const cropped = await sharp(pageBuffer)
        .extract({
            left: cropCoords.x,
            top: cropCoords.y,
            width: cropCoords.width,
            height: cropCoords.height
        })
        .toBuffer();

    fs.writeFileSync('/app/public/debug-route-domains.png', cropped);
    console.log('Saved debug-route-domains.png, size:', cropped.length);
    await browser.disconnect();
})();
