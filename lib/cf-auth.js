import { findCloudflarePage } from './chrome-helper';

// Shared Cloudflare login detection used by the NTBC API routes and the
// background report worker. Works on any puppeteer Page that is (or can be
// navigated to) the Cloudflare dashboard.

export const CF_UNAUTH_MESSAGE =
    'ยังไม่ได้ล็อกอิน Cloudflare — กรุณาเปิด Live Browser Monitor แล้วล็อกอิน Cloudflare ก่อน จากนั้นลองใหม่อีกครั้ง';

// Runs inside the page: true when the page shows a login / sign-in screen.
export function pageLooksUnauthenticated() {
    const url = window.location.href;
    const text = document.body ? document.body.innerText.toLowerCase() : '';
    const hasLoginText = text.includes('sign in to cloudflare') || text.includes('log in to cloudflare');
    const hasLoginElement = !!(document.querySelector('input[type="email"]') ||
        document.querySelector('input[name="email"]') ||
        document.querySelector('input[type="password"]'));
    return url.includes('/login') || url.includes('/sign-in') || hasLoginText || hasLoginElement;
}

// Opens (or reuses) a Cloudflare tab on the shared Chrome and reports login state.
// Never throws for "not logged in" — returns { loggedIn:false }.
export async function checkCloudflareLogin(browser, { navigate = true } = {}) {
    const pages = await browser.pages();
    let page = findCloudflarePage(pages);
    if (!page) page = await browser.newPage();

    const cur = page.url() || '';
    if (navigate && !cur.includes('dash.cloudflare.com')) {
        await page.goto('https://dash.cloudflare.com/', { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    }
    // Let client-side redirects (dashboard -> /login) settle.
    await new Promise(r => setTimeout(r, 2500));

    const loggedOut = await page.evaluate(pageLooksUnauthenticated).catch(() => true);
    return { loggedIn: !loggedOut, url: page.url() };
}
