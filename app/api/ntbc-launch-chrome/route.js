import { exec } from 'child_process';
import { connectChrome } from '@/lib/chrome-helper';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url || '');
        const checkOnly = searchParams.get('check') === 'true';

        let host = process.env.CHROME_HOST || 'localhost';
        if (host !== 'localhost' && host !== '127.0.0.1') {
            try {
                const dns = await import('dns');
                host = await new Promise((resolve, reject) => {
                    dns.lookup(host, (err, address) => err ? reject(err) : resolve(address));
                });
            } catch (e) {
                console.warn(`Could not resolve CHROME_HOST ${host}`);
            }
        }

        // Check if Chrome debugging is already active and running
        try {
            const checkRes = await axios.get(`http://${host}:9222/json`, {
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

        console.log('Spawning standalone Chrome is disabled in container mode. Please ensure docker-compose provides the chrome-browser container.');
        return Response.json({ success: false, error: 'Chrome is not running in the container. Please restart the Chrome container.' }, { status: 500 });
        return Response.json({ success: true, reused: false });
    } catch (e) {
        console.error('Launch Chrome API error:', e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}
