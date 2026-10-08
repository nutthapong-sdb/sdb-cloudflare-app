import { connectChrome } from '@/lib/chrome-helper';
import { checkCloudflareLogin, CF_UNAUTH_MESSAGE } from '@/lib/cf-auth';

export const dynamic = 'force-dynamic';

// GET /api/ntbc-cf-auth -> { loggedIn, url, message? }
export async function GET() {
    let browser;
    try {
        browser = await connectChrome();
        const r = await checkCloudflareLogin(browser);
        return Response.json({ success: true, ...r, ...(r.loggedIn ? {} : { message: CF_UNAUTH_MESSAGE }) });
    } catch (err) {
        return Response.json({ success: false, loggedIn: false, error: err.message }, { status: 500 });
    } finally {
        try { await browser?.disconnect(); } catch {}
    }
}
