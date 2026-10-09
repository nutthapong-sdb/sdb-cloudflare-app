import { connectChrome, findCloudflarePage } from '@/lib/chrome-helper';

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
        let page = findCloudflarePage(pages);

        if (!page) {
            console.log('No active browser tab found. Automatically opening new page...');
            page = await browser.newPage();
        }

        // Set viewport to 1920x1080 to match full window and screen size exactly
        try {
            await page.setViewport({ width: 1920, height: 1080 });
        } catch (emErr) {
            console.error('Failed to set 1920x1080 viewport:', emErr);
        }

        // Determine redirect target
        const customUrl = searchParams.get('url');
        const targetUrl = customUrl || (accountId 
            ? `https://dash.cloudflare.com/${accountId}/domains/overview`
            : 'https://dash.cloudflare.com/');

        console.log(`Activating and bringing target tab to front...`);
        await page.bringToFront();

        // Reset zoom to 100% via keyboard shortcut Ctrl+0
        try {
            await page.keyboard.down('Control');
            await page.keyboard.press('Digit0');
            await page.keyboard.up('Control');
            console.log('Reset zoom to 100% using Ctrl+0');
        } catch (err) {
            console.error('Failed to reset zoom via Ctrl+0:', err);
        }

        // Ensure Cloudflare sidebar navigation is EXPANDED (Press 't' + 's' only if currently collapsed)
        try {
            const isCollapsed = await page.evaluate(() => {
                const nav = document.querySelector('nav') || document.querySelector('aside') || document.querySelector('[aria-label*="navigation"]');
                return nav ? nav.offsetWidth < 150 : false;
            });
            if (isCollapsed) {
                console.log('Sidebar is currently collapsed. Expanding via keyboard shortcut "t" then "s"...');
                await page.keyboard.press('KeyT');
                await new Promise(r => setTimeout(r, 100));
                await page.keyboard.press('KeyS');
                await new Promise(r => setTimeout(r, 400));
            } else {
                console.log('Sidebar is already expanded. No action needed.');
            }
        } catch (err) {
            console.warn('Could not check/ensure sidebar expanded state:', err.message);
        }

        // Check if browser is already on target URL
        // Check if browser is already on target URL or equivalent Cloudflare page
        const currentUrl = page.url() || '';
        const isSameCloudflarePage = (cur, tgt) => {
            if (!cur || !tgt) return false;
            try {
                const curObj = new URL(cur);
                const tgtObj = new URL(tgt);
                
                const curPath = curObj.pathname.toLowerCase().replace(/\/+$/, '');
                const tgtPath = tgtObj.pathname.toLowerCase().replace(/\/+$/, '');
                
                const pathMatches = (curPath === tgtPath);
                
                if (tgtObj.search && tgtObj.search.length > 1) {
                    return pathMatches && (curObj.search === tgtObj.search);
                }
                return pathMatches;
            } catch {
                const cleanCur = (cur || '').split('?')[0].split('#')[0].replace(/\/+$/, '').toLowerCase();
                const cleanTgt = (tgt || '').split('?')[0].split('#')[0].replace(/\/+$/, '').toLowerCase();
                return cleanCur === cleanTgt;
            }
        };

        const isSameUrl = isSameCloudflarePage(currentUrl, targetUrl);
        if (isSameUrl) {
            console.log(`⚡ [SKIP REDIRECT] Browser is already on target URL/page: ${currentUrl}. Skipping reload & redirect to prevent Cloudflare bot challenges.`);
            await browser.disconnect();
            return Response.json({ 
                success: true, 
                redirectedUrl: currentUrl, 
                skippedRedirect: true,
                message: 'Already on target page' 
            });
        }

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

        // Inject visible scrollbars and ensure body scroll is enabled
        try {
            await page.evaluate(() => {
                const styleId = 'force-scrollbars-visible';
                let s = document.getElementById(styleId);
                if (!s) {
                    s = document.createElement('style');
                    s.id = styleId;
                    document.head.appendChild(s);
                }
                s.innerHTML = `
                    ::-webkit-scrollbar {
                        width: 14px !important;
                        height: 14px !important;
                        display: block !important;
                    }
                    ::-webkit-scrollbar-track {
                        background: #1e1e2e !important;
                    }
                    ::-webkit-scrollbar-thumb {
                        background: #6366f1 !important;
                        border-radius: 7px !important;
                    }
                    ::-webkit-scrollbar-thumb:hover {
                        background: #4f46e5 !important;
                    }
                    html, body {
                        overflow-y: auto !important;
                        height: auto !important;
                    }
                `;
                if (document.body) {
                    document.body.tabIndex = -1;
                    document.body.focus();
                }
            });
        } catch (scrollErr) {
            console.warn('Could not inject visible scrollbars:', scrollErr.message);
        }

        await browser.disconnect();
        return Response.json({ success: true, redirectedUrl: targetUrl });
    } catch (e) {
        console.error('Puppeteer remote control error:', e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}
