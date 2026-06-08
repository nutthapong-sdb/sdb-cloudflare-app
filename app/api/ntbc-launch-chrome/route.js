import { exec } from 'child_process';
import puppeteer from 'puppeteer';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Check if Chrome debugging is already active and running
        try {
            const checkRes = await fetch('http://localhost:9222/json');
            if (checkRes.ok) {
                const tabs = await checkRes.json();
                if (tabs && tabs.length > 0) {
                    console.log('Chrome is already running on port 9222. Navigating active debugging session to Cloudflare...');
                    const browser = await puppeteer.connect({
                        browserURL: 'http://localhost:9222',
                        defaultViewport: null
                    });
                    const pages = await browser.pages();
                    let page = pages.find(p => p.url().includes('cloudflare.com')) || pages[0];
                    if (!page) {
                        page = await browser.newPage();
                    }
                    await page.bringToFront();
                    await page.goto('https://dash.cloudflare.com/', { waitUntil: 'load', timeout: 30000 });
                    await browser.disconnect();
                    return Response.json({ success: true, reused: true });
                }
            }
        } catch (checkErr) {
            console.log('No Chrome instance detected on port 9222. Spawning new process...', checkErr.message);
        }

        console.log('Launching Chrome on port 9222 with custom profile in full screen...');
        // Open Google Chrome on macOS with port 9222 debugging, clean temporary profile, and full screen
        const cmd = `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="/Users/litarcopperkaikem/Documents/Repositiry/sdb-cf-get-data/.chrome-debug-profile" --start-fullscreen "https://dash.cloudflare.com/" > /dev/null 2>&1 &`;
        exec(cmd, (error) => {
            if (error) {
                console.error('Failed to launch Chrome:', error);
            }
        });
        return Response.json({ success: true, reused: false });
    } catch (e) {
        console.error('Launch Chrome API error:', e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}
