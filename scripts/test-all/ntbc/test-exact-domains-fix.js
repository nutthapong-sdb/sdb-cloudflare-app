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

    // Navigate fresh
    await page.goto('https://dash.cloudflare.com/ae240d50da44461d1fc5e34f708ebec8/domains/overview', { waitUntil: 'networkidle2' });
    await page.waitForSelector('[role="row"], [data-testid*="table_row"]', { timeout: 15000 });

    // Inject CSS fix
    await page.evaluate(() => {
        const id = 'cf-domains-render-fix';
        let style = document.getElementById(id);
        if (!style) {
            style = document.createElement('style');
            style.id = id;
            document.head.appendChild(style);
        }
        style.innerHTML = `
            div[class*="overflow-clip"],
            div[class*="overflow-x-clip"],
            div[class*="overflow-y-clip"],
            [role="table"],
            [data-sentry-component="TableBody"] {
                overflow: visible !important;
                clip-path: none !important;
            }
            [role="table"] {
                display: block !important;
                width: 100% !important;
            }
            [role="row"], [role="rowgroup"] > div {
                display: flex !important;
                flex-direction: row !important;
                width: 100% !important;
                min-height: 44px !important;
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
    });
    await new Promise(r => setTimeout(r, 600));

    const fullScreenshotBase64 = await page.screenshot({
        encoding: 'base64',
        type: 'png'
    });
    const pageBuffer = Buffer.from(fullScreenshotBase64, 'base64');

    const cropCoords = {
        x: 255,
        y: 38,
        width: 1355,
        height: 450
    };

    const cropped = await sharp(pageBuffer)
        .extract({
            left: cropCoords.x,
            top: cropCoords.y,
            width: cropCoords.width,
            height: cropCoords.height
        })
        .toBuffer();

    fs.writeFileSync('/app/public/exact-domains-fixed.png', cropped);
    console.log('Saved exact-domains-fixed.png, size:', cropped.length);
    await browser.disconnect();
})();
