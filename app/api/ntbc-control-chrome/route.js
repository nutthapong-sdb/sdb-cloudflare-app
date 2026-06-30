import { connectChrome } from '@/lib/chrome-helper';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId');

        // Mock mode check using the bind-mounted db directory
        const fs = require('fs');
        const path = require('path');
        const mockModePath = path.join(process.cwd(), 'db', 'mock_capture.txt');
        if (fs.existsSync(mockModePath)) {
            console.log("ℹ️ [MOCK MODE] Simulating successful Chrome navigation...");
            return Response.json({ success: true, redirectedUrl: 'https://dash.cloudflare.com/' });
        }

        console.log(`Connecting to Chrome on port 9222. Target Account: ${accountId}`);
        const browser = await connectChrome();
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

        // Wait up to 3 seconds for either the login page to appear or the dashboard to load
        try {
            await page.waitForFunction(() => {
                const url = window.location.href;
                const text = document.body ? document.body.innerText.toLowerCase() : '';
                const hasLoginText = text.includes('sign in to cloudflare') || text.includes('log in to cloudflare');
                const hasLoginElement = !!(document.querySelector('input[type="email"]') || document.querySelector('input[name="email"]') || document.querySelector('a[href*="/login"]'));
                const isLoginPage = url.includes('/login') || url.includes('/sign-in') || hasLoginText || hasLoginElement;
                const hasDashboardElement = !!(document.querySelector('#react-app') || document.querySelector('[data-testid="zone-card"]') || document.querySelector('main'));
                return isLoginPage || hasDashboardElement;
            }, { timeout: 3000 });
        } catch (e) {
            console.log('Timeout waiting for page load state, checking current state...');
        }

        const isUnauthenticated = await page.evaluate(() => {
            const url = window.location.href;
            const text = document.body ? document.body.innerText.toLowerCase() : '';
            const hasLoginText = text.includes('sign in to cloudflare') || text.includes('log in to cloudflare');
            const hasLoginElement = !!(document.querySelector('input[type="email"]') || document.querySelector('input[name="email"]') || document.querySelector('a[href*="/login"]'));
            return url.includes('/login') || url.includes('/sign-in') || hasLoginText || hasLoginElement;
        });

        if (isUnauthenticated) {
            await browser.disconnect();
            return Response.json({ 
                success: false, 
                error: 'Cloudflare session is not authenticated. Please open the "Live Browser Monitor" (noVNC) from the Actions menu and log in to Cloudflare first.',
                errorType: 'unauthenticated'
            }, { status: 401 });
        }

        await browser.disconnect();
        return Response.json({ success: true, redirectedUrl: targetUrl });
    } catch (e) {
        console.error('Puppeteer remote control error:', e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}
