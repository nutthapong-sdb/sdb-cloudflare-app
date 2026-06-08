import puppeteer from 'puppeteer';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId');

        console.log(`Connecting to Chrome on port 9222. Target Account: ${accountId}`);
        const browser = await puppeteer.connect({
            browserURL: 'http://localhost:9222',
            defaultViewport: null
        });
        const pages = await browser.pages();
        // Find page with cloudflare, otherwise use the first page
        let page = pages.find(p => p.url().includes('cloudflare.com')) || pages[0];

        if (!page) {
            await browser.disconnect();
            return Response.json({ success: false, error: 'No active browser page found. Please start Step 1.' }, { status: 400 });
        }

        // Determine redirect target
        const customUrl = searchParams.get('url');
        const targetUrl = customUrl || (accountId 
            ? `https://dash.cloudflare.com/${accountId}/domains/overview`
            : 'https://dash.cloudflare.com/');

        console.log(`Activating and bringing target tab to front...`);
        await page.bringToFront();

        console.log(`Redirecting active tab to: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'load', timeout: 30000 });

        await browser.disconnect();
        return Response.json({ success: true, redirectedUrl: targetUrl });
    } catch (e) {
        console.error('Puppeteer remote control error:', e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}
