import { exec } from 'child_process';
import { connectChrome } from '@/lib/chrome-helper';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url || '');
        const checkOnly = searchParams.get('check') === 'true';

        // Check if Chrome debugging is already active and running
        try {
            const checkRes = await axios.get(`http://${process.env.CHROME_HOST || 'localhost'}:9222/json`, {
                headers: {
                    'Host': 'localhost'
                }
            });
            if (checkRes.status === 200) {
                const tabs = checkRes.data;
                if (tabs && tabs.length > 0) {
                    if (checkOnly) {
                        return Response.json({ success: true, running: true });
                    }
                    console.log('Chrome is already running on port 9222. Navigating active debugging session to Cloudflare...');
                    const browser = await connectChrome();
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
            if (checkOnly) {
                return Response.json({ success: true, running: false });
            }
        }

        if (checkOnly) {
            return Response.json({ success: true, running: false });
        }

        if (process.env.CHROME_HOST && process.env.CHROME_HOST !== 'localhost' && process.env.CHROME_HOST !== '127.0.0.1' && process.env.CHROME_HOST !== 'host.docker.internal') {
            return Response.json({ success: false, error: `Chrome container at ${process.env.CHROME_HOST} is not running. Please verify that the sdb-chrome-browser container is active.` }, { status: 500 });
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
