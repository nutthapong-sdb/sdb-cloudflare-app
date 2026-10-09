import { connectChrome, findCloudflarePage } from '@/lib/chrome-helper';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { UPLOADED_SLUGS } from '@/app/systems/ntbc_cfreport/utils/uploadedVariables';

export const dynamic = 'force-dynamic';

let sessionCachedAccId = null;
let sessionCachedZoneName = 'log.softdebut.online';

const FILE_MAPPING = {
    dns: 'captured-dns.png',
    traffic: 'captured-traffic.png',
    firewall: 'captured-firewall.png',
    'security-rules': 'captured-security-rules.png',
    argo: 'captured-argo.png',
    speed: 'captured-speed.png',
    'speed-mobile': 'captured-speed-mobile.png',
    domains: 'captured-domains.png',
    'bot-management': 'captured-bot-management.png',
    'security-level': 'captured-security-level.png',
    'ssl-overview': 'captured-ssl-overview.png',
    'ssl-edge': 'captured-ssl-edge.png',
    'min-tls-version': 'captured-min-tls-version.png',
    'tls-1-3': 'captured-tls-1-3.png',
    'browser-integrity-check': 'captured-browser-integrity.png',
    'browser-integrity': 'captured-browser-integrity.png',
    'load-balancing-spectrum': 'captured-load-balancing-spectrum.png',
    'load-balancing': 'captured-load-balancing-spectrum.png',
    'rate-limiting': 'captured-rate-limiting.png',
    'managed-rules': 'captured-managed-rules.png',
    'ip-access-rules': 'captured-ip-access.png',
    'ip-access': 'captured-ip-access.png',
    'zone-lockdown': 'captured-zone-lockdown.png',
    'traffic-countries': 'captured-traffic-countries.png',
    'top-events-source': 'captured-top-events-source.png'
};

const SECTION_TARGETS = {
    'bot-management': {
        title: '🤖 Bot Management / Fight Mode',
        keywords: ['super bot fight mode', 'bot fight mode', 'bot management'],
        description: 'ไม่พบโหมด Bot Fight Mode, Super Bot Fight Mode หรือ Bot Management ใน Cloudflare Account/Zone นี้'
    },
    'security-level': {
        title: '🛡️ Security Level & Settings',
        keywords: ['security level', 'browser integrity check', 'challenge passage', 'privacy pass'],
        description: 'ไม่พบเมนู Security Level ในหน้าการตั้งค่าความปลอดภัย'
    },
    'min-tls-version': {
        title: '🔒 Minimum TLS Version',
        keywords: ['minimum tls version', 'minimum tls', 'min tls version'],
        description: 'ไม่พบการตั้งค่า Minimum TLS Version ในหน้านี้'
    },
    'ssl-edge': {
        title: '🔒 Minimum TLS Version',
        keywords: ['minimum tls version', 'minimum tls', 'min tls version'],
        description: 'ไม่พบการตั้งค่า Minimum TLS Version ในหน้านี้'
    },
    'tls-1-3': {
        title: '⚡ TLS 1.3',
        keywords: ['tls 1.3', 'tls 1.3 encryption', 'tls 1.3 (with 0-rtt)'],
        description: 'ฟีเจอร์ TLS 1.3 ปิดการใช้งาน (Disabled) หรือไม่พบในแพ็กเกจนี้'
    },
    'browser-integrity-check': {
        title: '🛡️ Browser Integrity Check',
        keywords: ['browser integrity check', 'browser integrity', 'browser check'],
        description: 'ฟีเจอร์ Browser Integrity Check ปิดการใช้งาน (Disabled) หรือไม่พบในแพ็กเกจนี้'
    },
    'load-balancing-spectrum': {
        title: '⚖️ Load Balancing',
        keywords: ['load balancing', 'manage public load balancers', 'load balancers', 'traffic'],
        description: 'ไม่พบการตั้งค่า Load Balancing ในโดเมนนี้ (Not Configured / Disabled)'
    },
    'argo': {
        title: '⚡ Argo Smart Routing',
        keywords: ['argo smart routing', 'argo', 'smart routing', 'tiered cache'],
        description: 'ไม่พบฟีเจอร์ Argo Smart Routing ในโดเมนหรือแพ็กเกจนี้'
    },
    'rate-limiting': {
        title: '⏱️ Rate Limiting Rules',
        keywords: ['rate limiting', 'rate limiting rules', 'rate limits'],
        description: 'ไม่พบเมนู Rate Limiting Rules ในโดเมนนี้'
    },
    'managed-rules': {
        title: '🧱 Managed WAF Rules',
        keywords: ['managed rules', 'cloudflare managed rules', 'owasp', 'managed ruleset', 'waf rules'],
        description: 'ไม่พบเมนู Managed WAF Rules ในโดเมนนี้'
    },
    'zone-lockdown': {
        title: '🔐 Zone Lockdown Rules',
        keywords: ['zone lockdown', 'lockdown rules', 'lockdown', 'custom rules', 'waf'],
        description: 'ไม่พบเมนู Zone Lockdown Rules ในโดเมนนี้'
    },
    'ip-access-rules': {
        title: '🚫 IP Access Rules',
        keywords: ['ip access rules', 'ip access', 'ip firewall', 'custom rules', 'waf'],
        description: 'ไม่พบเมนู IP Access Rules ในโดเมนนี้'
    },
    'ip-access': {
        title: '🚫 IP Access Rules',
        keywords: ['ip access rules', 'ip access', 'ip firewall', 'custom rules', 'waf'],
        description: 'ไม่พบเมนู IP Access Rules ในโดเมนนี้'
    },
    'browser-integrity': {
        title: '🛡️ Browser Integrity Check',
        keywords: ['browser integrity check', 'browser integrity', 'browser check'],
        description: 'ฟีเจอร์ Browser Integrity Check ปิดการใช้งาน (Disabled) หรือไม่พบในแพ็กเกจนี้'
    },
    'load-balancing': {
        title: '⚖️ Load Balancing and Spectrum records',
        keywords: ['load balancing', 'spectrum', 'load balancing and spectrum'],
        description: 'ไม่พบการตั้งค่าหรือบันทึก Load Balancing / Spectrum records ในโดเมนนี้ (Not Configured / Disabled)'
    }
};

function escapeXml(unsafe) {
    return (unsafe || '').replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

async function generateUnavailableImage(title, subtitle = 'ไม่พบข้อมูลหรือฟีเจอร์นี้ใน Cloudflare Zone / Account ปัจจุบัน') {
    // Strip emojis for pure font rendering compatibility
    let cleanTitle = title.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
    let cleanSubtitle = subtitle.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();

    cleanTitle = escapeXml(cleanTitle);
    cleanSubtitle = escapeXml(cleanSubtitle);

    const svg = `
    <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#090d16" />
                <stop offset="50%" stop-color="#0f172a" />
                <stop offset="100%" stop-color="#020617" />
            </linearGradient>
            <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#1e293b" />
                <stop offset="100%" stop-color="#0f172a" />
            </linearGradient>
            <linearGradient id="alertGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#f59e0b" />
                <stop offset="100%" stop-color="#d97706" />
            </linearGradient>
        </defs>

        <!-- Background -->
        <rect width="1280" height="720" fill="url(#bgGrad)" />

        <!-- Grid pattern overlay -->
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="0.8" stroke-opacity="0.4"/>
        </pattern>
        <rect width="1280" height="720" fill="url(#grid)" />

        <!-- Main Card Container -->
        <rect x="140" y="100" width="1000" height="520" rx="24" fill="url(#cardGrad)" stroke="#334155" stroke-width="2" />

        <!-- Top Header Bar inside card -->
        <path d="M 140 124 Q 140 100 164 100 L 1116 100 Q 1140 100 1140 124 L 1140 160 L 140 160 Z" fill="#090d16" fill-opacity="0.8" />
        <circle cx="175" cy="130" r="6" fill="#f43f5e" />
        <circle cx="195" cy="130" r="6" fill="#fbbf24" />
        <circle cx="215" cy="130" r="6" fill="#34d399" />
        <text x="640" y="136" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" text-anchor="middle" fill="#94a3b8">Cloudflare Dashboard &gt; Feature Verification</text>

        <!-- Vector Shield/Warning Icon -->
        <circle cx="640" cy="260" r="50" fill="#334155" fill-opacity="0.6" stroke="#475569" stroke-width="2" />
        <path d="M 640 230 L 670 285 L 610 285 Z" fill="url(#alertGrad)" stroke="#b45309" stroke-width="2" stroke-linejoin="round" />
        <rect x="638" y="250" width="4" height="18" rx="2" fill="#ffffff" />
        <circle cx="640" cy="276" r="2.5" fill="#ffffff" />

        <!-- Main Title -->
        <text x="640" y="370" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="bold" text-anchor="middle" fill="#f8fafc">${cleanTitle}</text>

        <!-- Subtitle & Reason -->
        <text x="640" y="420" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" text-anchor="middle" fill="#94a3b8">${cleanSubtitle}</text>
        <text x="640" y="455" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" text-anchor="middle" fill="#64748b">(ไม่สามารถแคปรูปภาพได้เนื่องจากไม่พบส่วนนี้ในแพ็กเกจหรือ Account ปัจจุบัน)</text>

        <!-- Status Tag Badge -->
        <rect x="420" y="500" width="440" height="46" rx="23" fill="#e11d48" fill-opacity="0.15" stroke="#f43f5e" stroke-width="1.5" />
        <text x="640" y="529" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#fda4af">[!] Feature Not Found / ไม่พบข้อมูลบนหน้าเว็บ</text>
    </svg>
    `;
    return await sharp(Buffer.from(svg)).png().toBuffer();
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const type = searchParams.get('type') || 'domains';
        const qXStart = searchParams.get('xStart');
        const qXEnd = searchParams.get('xEnd');
        const qYStart = searchParams.get('yStart');
        const qYEnd = searchParams.get('yEnd');

        const publicDir = path.join(process.cwd(), 'public');
        const dbCapturedDir = path.join(process.cwd(), 'db', 'captured');
        if (!fs.existsSync(dbCapturedDir)) {
            try { fs.mkdirSync(dbCapturedDir, { recursive: true }); } catch (e) {}
        }

        // Action to get all saved screenshots directly from disk
        if (action === 'get-saved') {
            const tabs = [
                { id: 'domains', file: 'captured-domains.png' },
                { id: 'botManagement', file: 'captured-bot-management.png' },
                { id: 'securityLevel', file: 'captured-security-level.png' },
                { id: 'sslOverview', file: 'captured-ssl-overview.png' },
                { id: 'sslEdge', file: 'captured-ssl-edge.png' },
                { id: 'traffic', file: 'captured-traffic.png' },
                { id: 'trafficCountries', file: 'captured-traffic-countries.png' },
                { id: 'firewall', file: 'captured-firewall.png' },
                { id: 'topEventsSource', file: 'captured-top-events-source.png' },
                { id: 'securityRules', file: 'captured-security-rules.png' },
                { id: 'rateLimiting', file: 'captured-rate-limiting.png' },
                { id: 'managedRules', file: 'captured-managed-rules.png' },
                { id: 'ipAccess', file: 'captured-ip-access.png' },
                { id: 'zoneLockdown', file: 'captured-zone-lockdown.png' },
                { id: 'argo', file: 'captured-argo.png' },
                { id: 'speed', file: 'captured-speed.png' },
                { id: 'speedMobile', file: 'captured-speed-mobile.png' },
                { id: 'minTlsVersion', file: 'captured-min-tls-version.png' },
                { id: 'tls13', file: 'captured-tls-1-3.png' },
                { id: 'browserIntegrity', file: 'captured-browser-integrity.png', altFile: 'captured-browser-integrity-check.png' },
                { id: 'loadBalancingSpectrum', file: 'captured-load-balancing-spectrum.png' }
            ];

            const screenshots = {};
            const metadata = {};

            // Check DNS pages
            const dnsPages = [];
            let pageNum = 1;
            while (pageNum <= 10) {
                const dnsFile = `captured-dns-${pageNum}.png`;
                const p1 = path.join(dbCapturedDir, dnsFile);
                const p2 = path.join(publicDir, dnsFile);
                const target = fs.existsSync(p1) ? p1 : (fs.existsSync(p2) ? p2 : null);
                if (target) {
                    dnsPages.push(`data:image/png;base64,${fs.readFileSync(target).toString('base64')}`);
                    pageNum++;
                } else {
                    break;
                }
            }
            if (dnsPages.length === 0) {
                const singleP1 = path.join(dbCapturedDir, 'captured-dns.png');
                const singleP2 = path.join(publicDir, 'captured-dns.png');
                const singleTarget = fs.existsSync(singleP1) ? singleP1 : (fs.existsSync(singleP2) ? singleP2 : null);
                if (singleTarget) {
                    dnsPages.push(`data:image/png;base64,${fs.readFileSync(singleTarget).toString('base64')}`);
                    metadata['dns'] = { capturedAt: fs.statSync(singleTarget).mtime.toISOString() };
                }
            } else {
                const dnsStatTarget = fs.existsSync(path.join(dbCapturedDir, 'captured-dns-1.png')) ? path.join(dbCapturedDir, 'captured-dns-1.png') : path.join(publicDir, 'captured-dns-1.png');
                if (fs.existsSync(dnsStatTarget)) {
                    metadata['dns'] = { capturedAt: fs.statSync(dnsStatTarget).mtime.toISOString() };
                }
            }
            if (dnsPages.length > 0) {
                screenshots['dns'] = dnsPages;
            }

            // Check other single files
            for (const item of tabs) {
                const p1 = path.join(dbCapturedDir, item.file);
                const p2 = path.join(publicDir, item.file);
                let target = fs.existsSync(p1) ? p1 : (fs.existsSync(p2) ? p2 : null);
                if (!target && item.altFile) {
                    const altP1 = path.join(dbCapturedDir, item.altFile);
                    const altP2 = path.join(publicDir, item.altFile);
                    target = fs.existsSync(altP1) ? altP1 : (fs.existsSync(altP2) ? altP2 : null);
                }
                if (target) {
                    try {
                        const buf = fs.readFileSync(target);
                        screenshots[item.id] = `data:image/png;base64,${buf.toString('base64')}`;
                        metadata[item.id] = { capturedAt: fs.statSync(target).mtime.toISOString() };
                    } catch (e) {
                        console.error(`Failed to read ${target}:`, e);
                    }
                }
            }

            // Check Traffic sub1 to sub5
            for (let i = 1; i <= 5; i++) {
                const subFile = `captured-traffic-sub${i}.png`;
                const p1 = path.join(dbCapturedDir, subFile);
                const p2 = path.join(publicDir, subFile);
                const target = fs.existsSync(p1) ? p1 : (fs.existsSync(p2) ? p2 : null);
                if (target) {
                    try {
                        screenshots[`trafficSub${i}`] = `data:image/png;base64,${fs.readFileSync(target).toString('base64')}`;
                    } catch (e) {}
                }
            }

            // User-uploaded manual overrides ("@uploaded_*" template variables). Same id/file
            // naming convention as the captured screenshots above, just with an "uploaded-"
            // prefix instead of "captured-" — see app/systems/ntbc_cfreport/utils/uploadedVariables.js
            // for the canonical id list this must stay in sync with.
            const uploaded = {};
            const uploadedMetadata = {};
            const uploadedTabs = tabs.map(item => ({ id: item.id, file: item.file.replace('captured-', 'uploaded-') }));
            for (const item of uploadedTabs) {
                const p1 = path.join(dbCapturedDir, item.file);
                if (fs.existsSync(p1)) {
                    try {
                        const buf = fs.readFileSync(p1);
                        uploaded[item.id] = `data:image/png;base64,${buf.toString('base64')}`;
                        uploadedMetadata[item.id] = { uploadedAt: fs.statSync(p1).mtime.toISOString() };
                    } catch (e) {
                        console.error(`Failed to read uploaded ${p1}:`, e);
                    }
                }
            }
            // "traffic" is already covered by uploadedTabs above (it's in the base `tabs` list).
            // DNS is not in `tabs` (captured DNS is handled separately, multi-page) — uploads
            // only support a single override image for DNS, so read it directly here.
            const uploadedDnsPath = path.join(dbCapturedDir, 'uploaded-dns.png');
            if (fs.existsSync(uploadedDnsPath)) {
                try {
                    uploaded['dns'] = `data:image/png;base64,${fs.readFileSync(uploadedDnsPath).toString('base64')}`;
                    uploadedMetadata['dns'] = { uploadedAt: fs.statSync(uploadedDnsPath).mtime.toISOString() };
                } catch (e) {}
            }
            for (let i = 1; i <= 5; i++) {
                const subFile = `uploaded-traffic-sub${i}.png`;
                const p1 = path.join(dbCapturedDir, subFile);
                if (fs.existsSync(p1)) {
                    try {
                        uploaded[`trafficSub${i}`] = `data:image/png;base64,${fs.readFileSync(p1).toString('base64')}`;
                        uploadedMetadata[`trafficSub${i}`] = { uploadedAt: fs.statSync(p1).mtime.toISOString() };
                    } catch (e) {}
                }
            }

            return Response.json({
                success: true,
                screenshots,
                metadata,
                uploaded,
                uploadedMetadata
            });
        }

        // Mock mode check using the bind-mounted db directory
        const mockModePath = path.join(process.cwd(), 'db', 'mock_capture.txt');
        if (fs.existsSync(mockModePath)) {
            console.log(`ℹ️ [MOCK MODE] Simulating capture for type: ${type}...`);
            
            // Map types to filenames
            const fileMapping = {
                dns: 'captured-dns.png',
                traffic: 'captured-traffic.png',
                firewall: 'captured-firewall.png',
                'security-rules': 'captured-security-rules.png',
                argo: 'captured-argo.png',
                speed: 'captured-speed.png',
                'speed-mobile': 'captured-speed-mobile.png',
                domains: 'captured-domains.png',
                'bot-management': 'captured-bot-management.png',
                'security-level': 'captured-security-level.png',
                'ssl-overview': 'captured-ssl-overview.png',
                'ssl-edge': 'captured-ssl-edge.png',
                'rate-limiting': 'captured-rate-limiting.png',
                'managed-rules': 'captured-managed-rules.png',
                'ip-access-rules': 'captured-ip-access.png',
                'zone-lockdown': 'captured-zone-lockdown.png',
                'traffic-countries': 'captured-traffic-countries.png',
                'top-events-source': 'captured-top-events-source.png'
            };
            
            const fileName = fileMapping[type] || 'captured-domains.png';
            const filePath = path.join(publicDir, fileName);
            
            let finalBuffer;
            if (fs.existsSync(filePath)) {
                finalBuffer = fs.readFileSync(filePath);
            } else {
                // Fallback to a 1x1 transparent PNG if the file doesn't exist
                finalBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
            }
            
            const responseData = {
                success: true,
                image: `data:image/png;base64,${finalBuffer.toString('base64')}`,
                filePath: `/${fileName}?t=${Date.now()}`
            };
            
            if (type === 'dns') {
                responseData.dnsPages = [responseData.image];
            }
            
            if (type === 'traffic') {
                for (let i = 1; i <= 5; i++) {
                    const subFile = `captured-traffic-sub${i}.png`;
                    const subPath = path.join(publicDir, subFile);
                    if (fs.existsSync(subPath)) {
                        const subBuf = fs.readFileSync(subPath);
                        responseData[`imageSub${i}`] = `data:image/png;base64,${subBuf.toString('base64')}`;
                        responseData[`filePathSub${i}`] = `/${subFile}?t=${Date.now()}`;
                    } else {
                        responseData[`imageSub${i}`] = responseData.image;
                        responseData[`filePathSub${i}`] = responseData.filePath;
                    }
                }
            }
            
            return Response.json(responseData);
        }

        console.log(`Connecting to Chrome on port 9222 for ${type} screenshot capture...`);
        const browser = await connectChrome();
        const pages = await browser.pages();
        // Find page with cloudflare, otherwise use the first page
        let page = findCloudflarePage(pages);

        if (!page) {
            console.log('No active browser tab found. Automatically opening new page...');
            page = await browser.newPage();
        }

        // Clear any device metrics override to keep native resolution
        try {
            const client = await page.target().createCDPSession();
            await client.send('Emulation.clearDeviceMetricsOverride');
            await client.send('Emulation.resetPageScaleFactor');
        } catch (e) {}

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
                console.log('Sidebar expansion triggered.');
            } else {
                console.log('Sidebar is already expanded. No action needed.');
            }
        } catch (err) {
            console.warn('Could not check/ensure sidebar expanded state:', err.message);
        }

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

        // 1. Clear any leftover search box filters from previous captures if not targeting settings
        try {
            if (type !== 'bot-management' && type !== 'security-level') {
                const lingeringSearch = await page.$('input[name="settings-search"], input[placeholder*="Search"]');
                if (lingeringSearch) {
                    await lingeringSearch.click({ clickCount: 3 });
                    await lingeringSearch.press('Backspace');
                    await new Promise(r => setTimeout(r, 200));
                }
            }
        } catch (clearErr) {
            console.warn('Could not clear lingering search filter:', clearErr.message);
        }

        // 2. Intelligent URL Auto-Routing for Target Subpath
        try {
            const queryAcc = searchParams.get('account') || searchParams.get('accountId');
            const queryZone = searchParams.get('zone') || searchParams.get('domain') || searchParams.get('siteName');

            const currentUrl = page.url();
            const urlMatch = currentUrl.match(/dash\.cloudflare\.com\/([a-zA-Z0-9._-]+)(?:\/([a-zA-Z0-9._-]+))?/i);
            
            let accId = queryAcc || (urlMatch ? urlMatch[1] : null) || sessionCachedAccId;
            if (accId) sessionCachedAccId = accId;

            const nonZoneWords = ['domains', 'profile', 'analytics', 'billing', 'members', 'login', 'sign-in', 'api-tokens'];
            let zoneName = queryZone;
            if (!zoneName && urlMatch && urlMatch[2] && !nonZoneWords.includes(urlMatch[2].toLowerCase())) {
                zoneName = urlMatch[2];
            }
            if (!zoneName) {
                // If currently on domains page, try getting domain from page DOM
                try {
                    const domDomain = await page.evaluate(() => {
                        const rowAnchor = document.querySelector('tr a[href*="/"], [data-testid*="domain"] a, [role="row"] a');
                        if (rowAnchor) {
                            const href = rowAnchor.getAttribute('href') || '';
                            const text = (rowAnchor.textContent || '').trim();
                            const m = href.match(/\/([a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/);
                            if (m) return m[1];
                            if (text.includes('.')) return text;
                        }
                        return null;
                    });
                    if (domDomain) zoneName = domDomain;
                } catch (e) {}
            }
            if (!zoneName) zoneName = sessionCachedZoneName;
            if (zoneName) sessionCachedZoneName = zoneName;

            const URL_MAPPING = {
                'domains': (acc) => `https://dash.cloudflare.com/${acc}/domains/overview`,
                'dns': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/dns/records`,
                'load-balancing-spectrum': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/traffic/load-balancing`,
                'load-balancing': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/traffic/load-balancing`,
                'traffic': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/analytics/traffic`,
                'traffic-countries': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/analytics/traffic`,
                'firewall': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/security/analytics/events`,
                'top-events-source': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/security/analytics/events`,
                'security-rules': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/security/waf/custom-rules`,
                'rate-limiting': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/security/waf/rate-limiting-rules`,
                'managed-rules': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/security/waf/managed-rules`,
                'ip-access-rules': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/security/waf/custom-rules`,
                'ip-access': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/security/waf/custom-rules`,
                'zone-lockdown': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/security/waf/custom-rules`,
                'bot-management': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/security/settings`,
                'security-level': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/security/settings`,
                'browser-integrity-check': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/security/settings`,
                'browser-integrity': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/security/settings`,
                'ssl-overview': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/ssl-tls`,
                'ssl-edge': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/ssl-tls/edge-certificates`,
                'min-tls-version': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/ssl-tls/edge-certificates`,
                'tls-1-3': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/ssl-tls/edge-certificates`,
                'argo': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/traffic`,
                'speed': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/speed/test/browser`,
                'speed-mobile': (acc, zone) => `https://dash.cloudflare.com/${acc}/${zone}/speed/test/browser`
            };

            const isSameCloudflarePage = (cur, tgt) => {
                if (!cur || !tgt) return false;
                try {
                    const curObj = new URL(cur);
                    const tgtObj = new URL(tgt);
                    
                    const curPath = curObj.pathname.toLowerCase().replace(/\/+$/, '');
                    const tgtPath = tgtObj.pathname.toLowerCase().replace(/\/+$/, '');

                    // For speed tests, any subpath within /speed/test/ or /speed is considered the target section
                    if ((type === 'speed' || type === 'speed-mobile') && (curPath.includes('/speed/test') || curPath.includes('/speed'))) {
                        return true;
                    }
                    
                    const pathMatches = (curPath === tgtPath) || 
                                        curPath.endsWith(tgtPath.replace(/^\/[a-f0-9]+/, '')) ||
                                        tgtPath.endsWith(curPath.replace(/^\/[a-f0-9]+/, ''));
                    
                    if (tgtObj.search && tgtObj.search.length > 1) {
                        return pathMatches && (curObj.search === tgtObj.search);
                    }
                    return pathMatches;
                } catch {
                    const cleanCur = (cur || '').split('?')[0].split('#')[0].replace(/\/+$/, '').toLowerCase();
                    const cleanTgt = (tgt || '').split('?')[0].split('#')[0].replace(/\/+$/, '').toLowerCase();
                    if ((type === 'speed' || type === 'speed-mobile') && cleanCur.includes('/speed')) return true;
                    return cleanCur === cleanTgt || cleanCur.endsWith(cleanTgt);
                }
            };

            const targetFn = URL_MAPPING[type];
            if (targetFn && accId) {
                const targetUrl = (type === 'domains') ? targetFn(accId) : (zoneName ? targetFn(accId, zoneName) : null);
                if (targetUrl) {
                    const isAlreadyOnPage = isSameCloudflarePage(currentUrl, targetUrl);
                    if (!isAlreadyOnPage) {
                        console.log(`Auto-navigating page from ${currentUrl} to ${targetUrl}...`);
                        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 15000 });
                        await new Promise(r => setTimeout(r, 1000));
                    } else {
                        console.log(`⚡ [SKIP AUTO-NAV] Chrome is already on target page (${currentUrl}). Skipping reload & redirect to protect against bot detection.`);
                    }
                }
            }
        } catch (navErr) {
            console.warn('Auto-navigation warning:', navErr.message);
        }

        // 3. Initial short stabilization delay
        await new Promise(r => setTimeout(r, 600));

        // Check if the requested feature/section exists on the Cloudflare page
        const targetCheck = SECTION_TARGETS[type];
        if (targetCheck) {
            console.log(`Checking if feature "${targetCheck.title}" is present on Cloudflare page...`);

            // If on settings page, search keywords to reveal items that may be virtualized or unrendered
            const searchableTypes = ['bot-management', 'security-level', 'browser-integrity-check', 'browser-integrity', 'min-tls-version', 'ssl-edge', 'tls-1-3'];
            if (searchableTypes.includes(type)) {
                try {
                    const searchInput = await page.$('input[name="settings-search"], input[placeholder*="Search"]');
                    if (searchInput) {
                        const searchTerm = 
                            type === 'bot-management' ? 'Bot' :
                            type === 'security-level' ? 'Security Level' :
                            (type === 'browser-integrity-check' || type === 'browser-integrity') ? 'Browser Integrity' :
                            (type === 'min-tls-version' || type === 'ssl-edge') ? 'Minimum TLS' :
                            type === 'tls-1-3' ? 'TLS 1.3' : '';
                        if (searchTerm) {
                            console.log(`Filtering settings search box with "${searchTerm}" for verification...`);
                            await searchInput.click({ clickCount: 3 });
                            await searchInput.press('Backspace');
                            await searchInput.type(searchTerm, { delay: 15 });
                            await new Promise(r => setTimeout(r, 600));
                        }
                    }
                } catch (searchErr) {
                    console.warn('Error applying search filter:', searchErr.message);
                }
            }

            let isFound = await page.evaluate((keywords) => {
                const is404 = document.title.includes('404') || (document.body && (document.body.innerText.includes("404 | We can't find") || document.body.innerText.includes("We can't find the page")));
                if (is404) return false;

                const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, [role="heading"], [data-testid], section, [class*="card"], [class*="setting"], div, span, p, label, a, button, tr, td'));
                for (const kw of keywords) {
                    const match = elements.find(el => {
                        const txt = (el.textContent || '').toLowerCase().trim();
                        const isVisible = (el.offsetWidth > 0 || el.offsetHeight > 0);
                        return isVisible && (txt === kw || txt.startsWith(kw) || txt.includes(kw));
                    });
                    if (match) return true;
                }
                return false;
            }, targetCheck.keywords);

            // If not found and it's bot-management, try navigating to alternate URL
            if (!isFound && type === 'bot-management') {
                const currentUrl = page.url();
                let altUrl = null;
                if (currentUrl.includes('/security/settings')) {
                    altUrl = currentUrl.replace('/security/settings', '/security/bots');
                } else if (currentUrl.includes('/security/bots')) {
                    altUrl = currentUrl.replace('/security/bots', '/security/settings');
                }
                if (altUrl) {
                    console.log(`Bot feature not found on ${currentUrl}. Trying alternate URL: ${altUrl}...`);
                    try {
                        await page.goto(altUrl, { waitUntil: 'networkidle2', timeout: 8000 });
                        await new Promise(r => setTimeout(r, 1000));
                        const altSearchInput = await page.$('input[name="settings-search"], input[placeholder*="Search"]');
                        if (altSearchInput) {
                            await altSearchInput.click({ clickCount: 3 });
                            await altSearchInput.press('Backspace');
                            await altSearchInput.type('Bot', { delay: 15 });
                            await new Promise(r => setTimeout(r, 600));
                        }
                        isFound = await page.evaluate((keywords) => {
                            const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, [role="heading"], [data-testid], section, [class*="card"], [class*="setting"], div, span, p, label, a, button, tr, td'));
                            for (const kw of keywords) {
                                const match = elements.find(el => {
                                    const txt = (el.textContent || '').toLowerCase().trim();
                                    const isVisible = (el.offsetWidth > 0 || el.offsetHeight > 0);
                                    return isVisible && (txt === kw || txt.startsWith(kw) || txt.includes(kw));
                                });
                                if (match) return true;
                            }
                            return false;
                        }, targetCheck.keywords);
                    } catch (navErr) {
                        console.warn('Alternate navigation error:', navErr.message);
                    }
                }
            }

            if (!isFound) {
                console.log(`⚠️ Feature "${targetCheck.title}" NOT found on Cloudflare page. Generating professional placeholder image...`);
                const placeholderBuffer = await generateUnavailableImage(targetCheck.title, targetCheck.description);
                const fileName = FILE_MAPPING[type] || `captured-${type}.png`;
                const filePath = path.join(publicDir, fileName);
                fs.writeFileSync(filePath, placeholderBuffer);
                try { fs.writeFileSync(path.join(dbCapturedDir, fileName), placeholderBuffer); } catch (e) {}

                await browser.disconnect();

                return Response.json({
                    success: true,
                    image: `data:image/png;base64,${placeholderBuffer.toString('base64')}`,
                    filePath: `/${fileName}?t=${Date.now()}`,
                    isUnavailable: true,
                    unavailableTitle: targetCheck.title,
                    unavailableMessage: targetCheck.description
                });
            } else {
                console.log(`✅ Feature "${targetCheck.title}" verified present on Cloudflare page.`);
            }
        }

        // Check if Speed Test page is showing "Test failed"
        if (type === 'speed' || type === 'speed-mobile') {
            const speedStatus = await page.evaluate(() => {
                const text = document.body ? document.body.innerText : '';
                if (text.includes('Test failed') || text.toLowerCase().includes("couldn't run the speed test") || text.includes('was redirected to a different domain')) {
                    let failDetail = 'การทดสอบความเร็วล้มเหลว (Test Failed)';
                    const failMsgMatch = text.match(/Test failed[\s\S]*?(?=Run daily test|Run test once|Run test on target url|$)/i);
                    if (failMsgMatch) {
                        failDetail = failMsgMatch[0].replace(/\n+/g, ' ').trim();
                    }
                    return { isFailed: true, message: failDetail };
                }
                return { isFailed: false };
            });

            if (speedStatus.isFailed) {
                console.log(`⚠️ Speed Test reported Failed on screen: ${speedStatus.message}`);
                const title = type === 'speed-mobile' ? '📱 Mobile Speed Test Failed' : '🚀 Speed Test Failed';
                const placeholderBuffer = await generateUnavailableImage(title, speedStatus.message);
                const fileName = FILE_MAPPING[type] || `captured-${type}.png`;
                const filePath = path.join(publicDir, fileName);
                fs.writeFileSync(filePath, placeholderBuffer);
                try { fs.writeFileSync(path.join(dbCapturedDir, fileName), placeholderBuffer); } catch (e) {}

                await browser.disconnect();

                return Response.json({
                    success: true,
                    image: `data:image/png;base64,${placeholderBuffer.toString('base64')}`,
                    filePath: `/${fileName}?t=${Date.now()}`,
                    isUnavailable: true,
                    unavailableTitle: title,
                    unavailableMessage: speedStatus.message
                });
            }
        }

        let pageIndex = 1;
        let hasNextPage = true;
        const pageBuffers = [];
        let sub1Buffer = null;
        let sub2Buffer = null;
        let sub3Buffer = null;
        let sub4Buffer = null;
        let sub5Buffer = null;

        while (hasNextPage) {
            // 2. Wait dynamically for page elements to be loaded and verify NO lazy loading skeleton or spinner exists
            console.log(`Checking for lazy loading elements and waiting for ${type} page ${pageIndex} content to finish rendering...`);
            
            // Trigger micro-scroll to wake up lazy intersection observers and virtualized rows
            try {
                await page.evaluate(() => {
                    window.scrollBy(0, 15);
                    setTimeout(() => window.scrollBy(0, -15), 50);
                });
                await new Promise(r => setTimeout(r, 200));
            } catch (e) {}

            try {
                await page.waitForFunction((captureType) => {
                    const findElementByText = (selector, text) => {
                        const elements = Array.from(document.querySelectorAll(selector));
                        return elements.find(el => {
                            const content = el.textContent || '';
                            const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
                            return isVisible && content.trim().toLowerCase().includes(text.toLowerCase());
                        });
                    };

                    // 1. Check if any skeleton loader, loading spinner, progress bar or shimmering placeholder is active
                    const hasShimmerOrSkeleton = !!(
                        document.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="shimmer"], [data-testid*="skeleton"], [data-testid*="loading"], [role="progressbar"], svg[class*="spin"], [class*="spinner"], [aria-busy="true"]') ||
                        Array.from(document.querySelectorAll('span, div, p')).find(el => {
                            const text = (el.textContent || '').trim().toLowerCase();
                            const isVisible = (el.offsetWidth > 0 || el.offsetHeight > 0);
                            return isVisible && (text === 'loading...' || text === 'loading' || text.includes('fetching data') || text.includes('please wait') || text.includes('loading table'));
                        })
                    );
                    if (hasShimmerOrSkeleton) return false;

                    // 2. Type-specific Data Content Verification (Ensures actual entries/items exist, not just titles)
                    if (captureType === 'domains') {
                        const hasRows = !!(
                            document.querySelector('[data-testid*="table_row"]') ||
                            (document.querySelectorAll('[role="row"]').length > 1) ||
                            (document.querySelectorAll('tbody tr').length > 0) ||
                            findElementByText('div, span, button, p, td', 'Showing 1')
                        );
                        return hasRows;
                    }

                    if (captureType === 'dns') {
                        const rows = Array.from(document.querySelectorAll('table tbody tr, [role="row"], [data-testid*="dns-record"]'));
                        const hasDnsData = rows.some(r => {
                            const txt = (r.innerText || r.textContent || '').trim().toLowerCase();
                            return (txt.includes('a\t') || txt.includes('cname') || txt.includes('mx') || txt.includes('txt') || txt.includes('proxied') || txt.includes('dns only') || txt.includes('auto') || txt.includes('records added'));
                        }) || !!findElementByText('div, span, p, td', 'records added') || !!findElementByText('div, span, p, td', 'Showing 1');
                        return hasDnsData;
                    }

                    if (captureType === 'load-balancing-spectrum' || captureType === 'load-balancing') {
                        const lbTable = document.querySelector('[data-testid*="load-balancing-table"]') || document.querySelector('[role="table"]');
                        const dataRows = Array.from(document.querySelectorAll('[data-testid*="row_"], [role="row"], table tbody tr'));
                        const hasLbRows = dataRows.some(r => {
                            const txt = (r.innerText || r.textContent || '').trim().toLowerCase();
                            return (txt.includes('pool') || txt.includes('automatic') || txt.includes('critical') || txt.includes('healthy') || txt.includes('edit') || txt.includes('hostname'));
                        });
                        const hasLbEmptyOrActive = !!(
                            findElementByText('h1, h2, h3, div, p, span', 'Manage public load balancers') ||
                            findElementByText('h1, h2, h3, div, p, span', 'Load Balancing is active') ||
                            findElementByText('h1, h2, h3, div, p, span', 'No load balancers')
                        );
                        return !!(lbTable && (hasLbRows || hasLbEmptyOrActive));
                    }

                    if (captureType === 'traffic' || captureType === 'traffic-countries') {
                        const hasChart = !!(
                            document.querySelector('svg path[d], canvas') ||
                            document.querySelector('[class*="recharts"], [class*="chart"]') ||
                            findElementByText('div, span, p, h3', 'requests') ||
                            findElementByText('div, span, p, h3', 'bandwidth') ||
                            findElementByText('div, span, p, h3', 'unique visitors')
                        );
                        return hasChart;
                    }

                    if (captureType === 'firewall' || captureType === 'top-events-source') {
                        const hasEvents = !!(
                            document.querySelector('svg path[d], canvas, table tbody tr, [role="row"]') ||
                            findElementByText('div, span, p, h3', 'Activity log') ||
                            findElementByText('div, span, p, h3', 'Events') ||
                            findElementByText('div, span, p, h3', 'Total events') ||
                            findElementByText('div, span, p, h3', 'No events')
                        );
                        return hasEvents;
                    }

                    if (captureType === 'security-rules' || captureType === 'rate-limiting' || captureType === 'managed-rules' || captureType === 'ip-access-rules' || captureType === 'zone-lockdown') {
                        const hasRulesOrEmpty = !!(
                            document.querySelector('table tbody tr, [role="row"], [data-testid*="rule"], [class*="rule"]') ||
                            findElementByText('div, span, p, h3, button', 'Create rule') ||
                            findElementByText('div, span, p, h3, button', 'rule active') ||
                            findElementByText('div, span, p, h3, button', 'rules active') ||
                            findElementByText('div, span, p, h3', 'No rules') ||
                            findElementByText('div, span, p, h3', 'No custom rules')
                        );
                        return hasRulesOrEmpty;
                    }

                    if (captureType === 'bot-management') {
                        const hasBotControl = !!(
                            document.querySelector('button[role="switch"], input[type="checkbox"], [class*="toggle"]') ||
                            findElementByText('h1, h2, h3, h4, span, p, div', 'Bot Fight Mode') ||
                            findElementByText('h1, h2, h3, h4, span, p, div', 'Super Bot Fight Mode') ||
                            findElementByText('h1, h2, h3, h4, span, p, div', 'Bot Management')
                        );
                        return hasBotControl;
                    }

                    if (captureType === 'security-level') {
                        const hasSecLevel = !!(
                            document.querySelector('select, [role="combobox"], [role="radiogroup"], input[type="radio"]') ||
                            findElementByText('div, span, button, p', 'Medium') ||
                            findElementByText('div, span, button, p', 'High') ||
                            findElementByText('div, span, button, p', 'Essentially Off') ||
                            findElementByText('div, span, button, p', 'I\'m Under Attack')
                        );
                        return hasSecLevel;
                    }

                    if (captureType === 'browser-integrity-check' || captureType === 'browser-integrity') {
                        const hasBic = !!(
                            document.querySelector('button[role="switch"], input[type="checkbox"], [class*="toggle"]') ||
                            findElementByText('h1, h2, h3, h4, span, p, label', 'Browser Integrity Check')
                        );
                        return hasBic;
                    }

                    if (captureType === 'ssl-overview') {
                        const hasSslMode = !!(
                            findElementByText('div, span, label, p, h3', 'Full') ||
                            findElementByText('div, span, label, p, h3', 'Strict') ||
                            findElementByText('div, span, label, p, h3', 'Flexible') ||
                            findElementByText('div, span, label, p, h3', 'Off') ||
                            document.querySelector('[role="radiogroup"], input[type="radio"]')
                        );
                        return hasSslMode;
                    }

                    if (captureType === 'min-tls-version' || captureType === 'ssl-edge') {
                        const hasTlsVer = !!(
                            document.querySelector('select, [role="combobox"]') ||
                            findElementByText('div, span, button, p', 'TLS 1.') ||
                            findElementByText('div, span, button, p', '1.2') ||
                            findElementByText('div, span, button, p', '1.3') ||
                            findElementByText('h1, h2, h3, h4, label', 'Minimum TLS Version')
                        );
                        return hasTlsVer;
                    }

                    if (captureType === 'tls-1-3') {
                        const hasTls13 = !!(
                            document.querySelector('button[role="switch"], input[type="checkbox"], [class*="toggle"]') ||
                            findElementByText('h1, h2, h3, h4, label, span', 'TLS 1.3')
                        );
                        return hasTls13;
                    }

                    if (captureType === 'argo') {
                        const hasArgo = !!(
                            document.querySelector('button[role="switch"], input[type="checkbox"], [class*="toggle"]') ||
                            findElementByText('h1, h2, h3, h4, span, p', 'Argo Smart Routing')
                        );
                        return hasArgo;
                    }

                    return !!document.querySelector('main, table, form, section, [class*="card"]');
                }, { timeout: 15000 }, type);
                console.log(`${type} page ${pageIndex} loaded and verified: actual items rendered and zero active lazy loading elements found.`);
                // Add a stabilizing delay for animations and fonts
                await new Promise(r => setTimeout(r, 600));
            } catch (err) {
                console.warn(`Timeout waiting for page elements to finish lazy loading. Proceeding anyway:`, err.message);
            }

            // Inject CSS render fix for Domains table if capture type is domains
            if (type === 'domains') {
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
            }

            // Evaluate coordinates for post-capture cropping (no viewport clipping)
            console.log('Calculating bounding box coordinates on active page...');
            let cropCoords = null;
            const dynamicCardTypes = ['bot-management', 'security-level', 'min-tls-version', 'tls-1-3', 'browser-integrity-check', 'load-balancing-spectrum', 'rate-limiting', 'managed-rules', 'zone-lockdown', 'ip-access-rules', 'ip-access', 'ssl-overview', 'ssl-edge', 'domains', 'dns', 'top-events-source'];
            if (qXStart && qXEnd && qYStart && qYEnd && !dynamicCardTypes.includes(type)) {
                const xs = parseInt(qXStart, 10);
                const xe = parseInt(qXEnd, 10);
                const ys = parseInt(qYStart, 10);
                const ye = parseInt(qYEnd, 10);
                // Only treat as legacy absolute coordinates if strictly > 500 px
                if (!isNaN(xs) && !isNaN(xe) && !isNaN(ys) && !isNaN(ye) && xs > 500 && xe > 500 && xe > xs) {
                    cropCoords = {
                        x: xs,
                        y: ys,
                        width: Math.max(10, xe - xs),
                        height: Math.max(10, ye - ys)
                    };
                    console.log('Using query custom legacy absolute crop coords:', cropCoords);
                }
            }

            if (!cropCoords) {
                cropCoords = await page.evaluate((captureType, qXS, qXE, qYS, qYE) => {
                    if (captureType === 'domains') {
                        const h = Array.from(document.querySelectorAll('h1, h2, h3, div, span')).find(el => (el.innerText || '').trim().startsWith('Domains') && el.getBoundingClientRect().left > 200);
                        const footer = Array.from(document.querySelectorAll('*')).find(el => (el.innerText || '').trim().startsWith('Showing 1'));
                        const table = document.querySelector('table, [role="table"]');

                        const hRect = h ? h.getBoundingClientRect() : { top: 80, left: 328 };
                        const fRect = footer ? footer.getBoundingClientRect() : (table ? table.getBoundingClientRect() : { bottom: 480 });

                        const parsedXS = parseInt(qXS, 10);
                        const parsedXE = parseInt(qXE, 10);
                        const parsedYS = parseInt(qYS, 10);
                        const parsedYE = parseInt(qYE, 10);

                        const autoStartX = Math.max(0, Math.round(hRect.left) - 30);
                        const autoStartY = Math.max(0, Math.round(hRect.top) - 20);
                        const autoWidth = 1350;
                        const autoHeight = Math.max(200, Math.round((fRect.bottom || 480) - (hRect.top - 20) + 40));

                        // If value > 500, treat as absolute coordinate; otherwise treat as offset (+/- px)
                        const startX = (!isNaN(parsedXS) && parsedXS > 500) ? parsedXS : Math.max(0, autoStartX + (!isNaN(parsedXS) ? parsedXS : 0));
                        const startY = (!isNaN(parsedYS) && parsedYS > 500) ? parsedYS : Math.max(0, autoStartY + (!isNaN(parsedYS) ? parsedYS : 0));
                        const targetWidth = (!isNaN(parsedXE) && parsedXE > 500) ? Math.max(10, parsedXE - startX) : Math.max(100, autoWidth + (!isNaN(parsedXE) ? parsedXE : 0));
                        const targetHeight = (!isNaN(parsedYE) && parsedYE > 500) ? Math.max(10, parsedYE - startY) : Math.max(100, autoHeight + (!isNaN(parsedYE) ? parsedYE : 0));

                        return { x: startX, y: startY, width: targetWidth, height: targetHeight };
                    }

                    if (captureType === 'top-events-source') {
                        // Find heading or title for Events by Source / Activity Log / Top Events
                        const allElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, [role="heading"], div, span'));
                        const headingKws = ['events by source', 'top events by source', 'events by service', 'top events', 'activity log', 'security events'];
                        let h = null;
                        for (const kw of headingKws) {
                            h = allElements.find(el => {
                                if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;
                                const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                                return (t === kw || t.startsWith(kw) || t.includes(kw)) && el.getBoundingClientRect().left > 150;
                            });
                            if (h) break;
                        }

                        // Find table
                        const tables = Array.from(document.querySelectorAll('table, [role="table"]')).filter(t => t.offsetWidth > 0 && t.offsetHeight > 0);
                        const table = tables.length > 0 ? tables[tables.length - 1] : document.querySelector('table, [role="table"]');

                        // Find pagination footer containing "n of n", "Showing 1", "1 - 10 of", etc.
                        const allFooters = Array.from(document.querySelectorAll('div, span, button, p, td, li, footer'));
                        const footer = allFooters.reverse().find(el => {
                            if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;
                            const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                            return (
                                (t.includes(' of ') && /\d+\s*of\s*\d+/i.test(t)) ||
                                t.startsWith('showing 1') ||
                                t.startsWith('showing ') ||
                                (t.includes(' of ') && (t.includes('1 -') || t.includes('1-') || t.includes('page '))) ||
                                t.includes('records added') ||
                                (t.includes('records') && /\d+/.test(t))
                            );
                        }) || allFooters.find(el => {
                            const t = (el.innerText || el.textContent || '').trim().toLowerCase();
                            return el.offsetWidth > 0 && el.offsetHeight > 0 && t.includes(' of ') && el.getBoundingClientRect().top > (h ? h.getBoundingClientRect().top : 100);
                        });

                        const scrollY = window.scrollY || window.pageYOffset || 0;
                        const hRect = h ? h.getBoundingClientRect() : (table ? table.getBoundingClientRect() : { top: 250, left: 300 });
                        const tRect = table ? table.getBoundingClientRect() : null;
                        const fRect = footer ? footer.getBoundingClientRect() : (tRect ? { bottom: tRect.bottom } : { bottom: 850 });

                        const parsedXS = parseInt(qXS, 10);
                        const parsedXE = parseInt(qXE, 10);
                        const parsedYS = parseInt(qYS, 10);
                        const parsedYE = parseInt(qYE, 10);

                        const startTop = Math.min(hRect.top, tRect ? (tRect.top - 40) : hRect.top);
                        const startLeft = tRect ? Math.min(tRect.left, hRect.left) : hRect.left;
                        const autoStartX = Math.max(0, Math.min(Math.round(window.innerWidth * 0.15), Math.round(startLeft) - 30));
                        const autoStartY = Math.max(0, Math.round(startTop + scrollY) - 20);
                        const autoWidth = 1350;
                        const bottomCoord = (fRect.bottom || 850) + scrollY;
                        const autoHeight = Math.max(200, Math.round(bottomCoord - autoStartY + 40));

                        // If value > 500, treat as absolute coordinate; otherwise treat as offset (+/- px)
                        const startX = (!isNaN(parsedXS) && parsedXS > 500) ? parsedXS : Math.max(0, autoStartX + (!isNaN(parsedXS) ? parsedXS : 0));
                        const startY = (!isNaN(parsedYS) && parsedYS > 500) ? parsedYS : Math.max(0, autoStartY + (!isNaN(parsedYS) ? parsedYS : 0));
                        const targetWidth = (!isNaN(parsedXE) && parsedXE > 500) ? Math.max(10, parsedXE - startX) : Math.max(100, autoWidth + (!isNaN(parsedXE) ? parsedXE : 0));
                        const targetHeight = (!isNaN(parsedYE) && parsedYE > 500) ? Math.max(10, parsedYE - startY) : Math.max(100, autoHeight + (!isNaN(parsedYE) ? parsedYE : 0));

                        return { x: startX, y: startY, width: targetWidth, height: targetHeight };
                    }

                    if (captureType === 'ip-access-rules' || captureType === 'ip-access') {
                        const isInsideNav = (el) => {
                            let p = el;
                            while (p && p !== document.body) {
                                const tag = (p.tagName || '').toLowerCase();
                                const role = p.getAttribute ? p.getAttribute('role') : null;
                                const cls = typeof p.className === 'string' ? p.className.toLowerCase() : '';
                                if (tag === 'nav' || tag === 'aside' || tag === 'header' || role === 'navigation' || cls.includes('sidebar') || cls.includes('nav-') || cls.includes('navigation')) {
                                    return true;
                                }
                                p = p.parentElement;
                            }
                            return false;
                        };

                        const allSpans = Array.from(document.querySelectorAll('span, div, h2, h3, h4'));
                        const ipSpan = allSpans.find(el => {
                            if (isInsideNav(el)) return false;
                            return (el.innerText || '').trim().toLowerCase() === 'ip access rules' && el.getBoundingClientRect().left > 150;
                        });

                        let card = null;
                        if (ipSpan) {
                            let cur = ipSpan.parentElement;
                            while (cur && cur !== document.body && cur.tagName !== 'MAIN') {
                                const text = (cur.innerText || '').trim().toLowerCase();
                                if (text.includes('ip access rules') && text.includes('create rule') && !text.includes('zone lockdown rules')) {
                                    card = cur;
                                }
                                cur = cur.parentElement;
                            }
                        }

                        const scrollY = window.scrollY || window.pageYOffset || 0;
                        const rect = card ? card.getBoundingClientRect() : null;
                        
                        let autoStartX = 320;
                        let autoStartY = 1780;
                        let autoWidth = 1350;
                        let autoHeight = 265;

                        if (rect) {
                            autoStartX = Math.max(0, Math.round(rect.left) - 15);
                            autoStartY = Math.max(0, Math.round(rect.top + scrollY) - 25);
                            autoWidth = Math.min(1920 - autoStartX, Math.round(rect.width) + 30);
                            autoHeight = Math.max(100, Math.round(rect.height) + 40);
                        }

                        const parsedXS = parseInt(qXS, 10);
                        const parsedXE = parseInt(qXE, 10);
                        const parsedYS = parseInt(qYS, 10);
                        const parsedYE = parseInt(qYE, 10);

                        const startX = (!isNaN(parsedXS) && parsedXS > 500) ? parsedXS : Math.max(0, autoStartX + (!isNaN(parsedXS) ? parsedXS : 0));
                        const startY = (!isNaN(parsedYS) && parsedYS > 500) ? parsedYS : Math.max(0, autoStartY + (!isNaN(parsedYS) ? parsedYS : 0));
                        const targetWidth = (!isNaN(parsedXE) && parsedXE > 500) ? Math.max(10, parsedXE - startX) : Math.max(100, autoWidth + (!isNaN(parsedXE) ? parsedXE : 0));
                        const targetHeight = (!isNaN(parsedYE) && parsedYE > 500) ? Math.max(10, parsedYE - startY) : Math.max(100, autoHeight + (!isNaN(parsedYE) ? parsedYE : 0));

                        return { x: startX, y: startY, width: targetWidth, height: targetHeight };
                    }

                    if (captureType === 'zone-lockdown') {
                        const isInsideNav = (el) => {
                            let p = el;
                            while (p && p !== document.body) {
                                const tag = (p.tagName || '').toLowerCase();
                                const role = p.getAttribute ? p.getAttribute('role') : null;
                                const cls = typeof p.className === 'string' ? p.className.toLowerCase() : '';
                                if (tag === 'nav' || tag === 'aside' || tag === 'header' || role === 'navigation' || cls.includes('sidebar') || cls.includes('nav-') || cls.includes('navigation')) {
                                    return true;
                                }
                                p = p.parentElement;
                            }
                            return false;
                        };

                        const allSpans = Array.from(document.querySelectorAll('span, div, h2, h3, h4'));
                        const zlSpan = allSpans.find(el => {
                            if (isInsideNav(el)) return false;
                            return (el.innerText || '').trim().toLowerCase() === 'zone lockdown rules' && el.getBoundingClientRect().left > 150;
                        });

                        let card = null;
                        if (zlSpan) {
                            let cur = zlSpan.parentElement;
                            while (cur && cur !== document.body && cur.tagName !== 'MAIN') {
                                const text = (cur.innerText || '').trim().toLowerCase();
                                if (text.includes('zone lockdown rules') && text.includes('create rule') && !text.includes('ip access rules')) {
                                    card = cur;
                                }
                                cur = cur.parentElement;
                            }
                        }

                        const scrollY = window.scrollY || window.pageYOffset || 0;
                        const rect = card ? card.getBoundingClientRect() : null;

                        let autoStartX = 320;
                        let autoStartY = 2040;
                        let autoWidth = 1350;
                        let autoHeight = 265;

                        if (rect) {
                            autoStartX = Math.max(0, Math.round(rect.left) - 15);
                            autoStartY = Math.max(0, Math.round(rect.top + scrollY) - 25);
                            autoWidth = Math.min(1920 - autoStartX, Math.round(rect.width) + 30);
                            autoHeight = Math.max(100, Math.round(rect.height) + 40);
                        }

                        const parsedXS = parseInt(qXS, 10);
                        const parsedXE = parseInt(qXE, 10);
                        const parsedYS = parseInt(qYS, 10);
                        const parsedYE = parseInt(qYE, 10);

                        const startX = (!isNaN(parsedXS) && parsedXS > 500) ? parsedXS : Math.max(0, autoStartX + (!isNaN(parsedXS) ? parsedXS : 0));
                        const startY = (!isNaN(parsedYS) && parsedYS > 500) ? parsedYS : Math.max(0, autoStartY + (!isNaN(parsedYS) ? parsedYS : 0));
                        const targetWidth = (!isNaN(parsedXE) && parsedXE > 500) ? Math.max(10, parsedXE - startX) : Math.max(100, autoWidth + (!isNaN(parsedXE) ? parsedXE : 0));
                        const targetHeight = (!isNaN(parsedYE) && parsedYE > 500) ? Math.max(10, parsedYE - startY) : Math.max(100, autoHeight + (!isNaN(parsedYE) ? parsedYE : 0));

                        return { x: startX, y: startY, width: targetWidth, height: targetHeight };
                    }

                    if (captureType === 'bot-management') {
                        const botKeywords = ['super bot fight mode', 'bot fight mode', 'bot management'];
                        let matchedEl = null;
                        let matchedName = '';
                        const allElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, [role="heading"], [class*="heading"], [class*="title"], div, span, p'));
                        for (const kw of botKeywords) {
                            const found = allElements.find(el => {
                                const t = (el.textContent || '').trim().toLowerCase();
                                const isVisible = (el.offsetWidth > 0 || el.offsetHeight > 0);
                                return isVisible && t.includes(kw);
                            });
                            if (found) {
                                matchedEl = found;
                                matchedName = kw;
                                break;
                            }
                        }

                        if (matchedEl) {
                            const card = matchedEl.closest('.setting-card, [class*="setting-card"], [class*="card"], section, [data-testid]') || 
                                         matchedEl.parentElement?.closest('.setting-card, [class*="setting-card"], [class*="card"]') ||
                                         matchedEl.parentElement?.parentElement;

                            const cardRect = (card && card !== document.body) ? card.getBoundingClientRect() : matchedEl.getBoundingClientRect();
                            const scrollY = window.scrollY || window.pageYOffset || 0;
                            
                            const parsedXS = parseInt(qXS, 10);
                            const parsedXE = parseInt(qXE, 10);
                            const parsedYS = parseInt(qYS, 10);
                            const parsedYE = parseInt(qYE, 10);

                            // Perfectly cover the entire card/box from its top-left border to bottom-right border
                            const autoStartX = Math.max(0, Math.round(cardRect.left) - 6);
                            const autoStartY = Math.max(0, Math.round(cardRect.top + scrollY) - 6);
                            const autoWidth = Math.round(cardRect.width) + 12;
                            const autoHeight = Math.round(cardRect.height) + 12;

                            const startX = (!isNaN(parsedXS) && parsedXS > 500) ? parsedXS : Math.max(0, autoStartX + (!isNaN(parsedXS) ? parsedXS : 0));
                            const startY = (!isNaN(parsedYS) && parsedYS > 500) ? parsedYS : Math.max(0, autoStartY + (!isNaN(parsedYS) ? parsedYS : 0));
                            const targetWidth = (!isNaN(parsedXE) && parsedXE > 500) ? Math.max(10, parsedXE - startX) : Math.min(window.innerWidth - startX, autoWidth + (!isNaN(parsedXE) ? parsedXE : 0));
                            const targetHeight = (!isNaN(parsedYE) && parsedYE > 500) ? Math.max(10, parsedYE - startY) : Math.max(100, autoHeight + (!isNaN(parsedYE) ? parsedYE : 0));

                            return { x: startX, y: startY, width: targetWidth, height: targetHeight, matchedMode: matchedName };
                        }
                    }

                    if (captureType === 'security-level') {
                        const secKeywords = ['security level', 'browser integrity check', 'challenge passage'];
                        let matchedEl = null;
                        const allElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, [role="heading"], [class*="heading"], [class*="title"], div, span, p'));
                        for (const kw of secKeywords) {
                            const found = allElements.find(el => {
                                const t = (el.textContent || '').trim().toLowerCase();
                                const isVisible = (el.offsetWidth > 0 || el.offsetHeight > 0);
                                return isVisible && t.includes(kw);
                            });
                            if (found) {
                                matchedEl = found;
                                break;
                            }
                        }

                        if (matchedEl) {
                            const card = matchedEl.closest('.setting-card, [class*="setting-card"], [class*="card"], section, [data-testid]') || 
                                         matchedEl.parentElement?.closest('.setting-card, [class*="setting-card"], [class*="card"]') ||
                                         matchedEl.parentElement?.parentElement;

                            const cardRect = (card && card !== document.body) ? card.getBoundingClientRect() : matchedEl.getBoundingClientRect();
                            const scrollY = window.scrollY || window.pageYOffset || 0;
                            
                            const parsedXS = parseInt(qXS, 10);
                            const parsedXE = parseInt(qXE, 10);
                            const parsedYS = parseInt(qYS, 10);
                            const parsedYE = parseInt(qYE, 10);

                            const autoStartX = Math.max(0, Math.round(cardRect.left) - 6);
                            const autoStartY = Math.max(0, Math.round(cardRect.top + scrollY) - 6);
                            const autoWidth = Math.round(cardRect.width) + 12;
                            const autoHeight = Math.round(cardRect.height) + 12;

                            const startX = (!isNaN(parsedXS) && parsedXS > 500) ? parsedXS : Math.max(0, autoStartX + (!isNaN(parsedXS) ? parsedXS : 0));
                            const startY = (!isNaN(parsedYS) && parsedYS > 500) ? parsedYS : Math.max(0, autoStartY + (!isNaN(parsedYS) ? parsedYS : 0));
                            const targetWidth = (!isNaN(parsedXE) && parsedXE > 500) ? Math.max(10, parsedXE - startX) : Math.min(window.innerWidth - startX, autoWidth + (!isNaN(parsedXE) ? parsedXE : 0));
                            const targetHeight = (!isNaN(parsedYE) && parsedYE > 500) ? Math.max(10, parsedYE - startY) : Math.max(100, autoHeight + (!isNaN(parsedYE) ? parsedYE : 0));

                            return { x: startX, y: startY, width: targetWidth, height: targetHeight };
                        }
                    }
                const findLastElementByText = (selector, text) => {
                    const elements = Array.from(document.querySelectorAll(selector));
                    return elements.reverse().find(el => {
                        const content = el.textContent || '';
                        const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
                        return isVisible && content.trim().toLowerCase().includes(text.toLowerCase());
                    });
                };

                const findElementByText = (selector, text) => {
                    const elements = Array.from(document.querySelectorAll(selector));
                    return elements.find(el => {
                        const content = el.textContent || '';
                        const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
                        return isVisible && content.trim().toLowerCase().includes(text.toLowerCase());
                    });
                };

                const headingKeywordsMap = {
                    'domains': ['domains', 'domain'],
                    'dns': ['dns'],
                    'traffic': ['traffic', 'analytics', 'requests', 'http traffic'],
                    'traffic-countries': ['country', 'countries', 'requests by country', 'traffic', 'analytics'],
                    'firewall': ['security', 'events', 'firewall'],
                    'top-events-source': ['top events by source', 'top events', 'events by service', 'security events', 'activity log', 'security', 'events'],
                    'security-rules': ['rules', 'custom rules', 'waf'],
                    'rate-limiting': ['rate limiting', 'rate limits', 'rules'],
                    'managed-rules': ['managed rules', 'managed', 'waf', 'rules'],
                    'ip-access-rules': ['custom rules', 'ip access', 'waf', 'tools', 'firewall', 'rules'],
                    'ip-access': ['custom rules', 'ip access', 'waf', 'tools', 'firewall', 'rules'],
                    'zone-lockdown': ['custom rules', 'zone lockdown', 'waf', 'tools', 'lockdown', 'rules'],
                    'bot-management': ['settings', 'bot'],
                    'security-level': ['settings', 'security'],
                    'ssl-overview': ['ssl', 'tls', 'encryption mode', 'overview'],
                    'ssl-edge': ['edge certificates', 'certificates', 'ssl', 'tls'],
                    'min-tls-version': ['minimum tls version', 'minimum tls', 'edge certificates'],
                    'tls-1-3': ['tls 1.3', 'edge certificates'],
                    'browser-integrity-check': ['browser integrity check', 'settings'],
                    'browser-integrity': ['browser integrity check', 'settings'],
                    'load-balancing-spectrum': ['load balancing', 'spectrum', 'dns'],
                    'argo': ['argo', 'smart routing', 'routing', 'traffic'],
                    'speed': ['speed', 'observatory', 'performance'],
                    'speed-mobile': ['speed', 'observatory', 'performance']
                };
                const targetKws = headingKeywordsMap[captureType] || [captureType];
                let heading = null;
                for (const kw of targetKws) {
                    heading = findElementByText('h1, h2, h3, h4', kw) || findElementByText('span, div', kw);
                    if (heading) break;
                }
                if (!heading) heading = document.querySelector('main');
                // Look for visible pagination footer text containing item counts from the bottom-up
                const footer = (captureType === 'dns' || captureType === 'firewall' || captureType === 'security-rules')
                    ? (findLastElementByText('div, span, button, p, td', 'records added') || 
                       findLastElementByText('div, span, button, p, td', 'records') || 
                       findLastElementByText('div, span, button, p, td', 'of'))
                    : ((captureType === 'traffic' || captureType === 'argo' || captureType === 'speed' || captureType === 'speed-mobile')
                        ? null
                        : (findLastElementByText('div, span, button, p, td', '1 - 5 of 5') || 
                           findLastElementByText('div, span, button, p, td', 'items') ||
                           findLastElementByText('div, span, button, p, td', '1 - ') ||
                           findLastElementByText('div, span, button, p, td', 'of')));

                if (!heading) {
                    console.warn(`${captureType} heading not found in page DOM`);
                    return null;
                }

                const scrollY = window.scrollY || window.pageYOffset || 0;
                const headingRect = heading.getBoundingClientRect();
                const headingTop = headingRect.top + scrollY;
                let absoluteBottom = window.innerHeight + scrollY;

                const siteFooter = document.querySelector('#site-footer') || document.querySelector('footer');
                if (captureType === 'dns') {
                    if (footer) {
                        const footerRect = footer.getBoundingClientRect();
                        absoluteBottom = footerRect.bottom + scrollY + 15;
                    } else {
                        const dnsRows = document.querySelectorAll('tr[data-testid="dns-table-row"]');
                        if (dnsRows && dnsRows.length > 0) {
                            const lastRow = dnsRows[dnsRows.length - 1];
                            const lastRowRect = lastRow.getBoundingClientRect();
                            absoluteBottom = lastRowRect.bottom + scrollY + 15;
                        } else {
                            const dnsTable = document.querySelector('table');
                            if (dnsTable) {
                                const tableRect = dnsTable.getBoundingClientRect();
                                absoluteBottom = tableRect.bottom + scrollY + 15;
                            } else if (siteFooter) {
                                absoluteBottom = siteFooter.getBoundingClientRect().top + scrollY - 10;
                            }
                        }
                    }
                } else if (footer) {
                    const footerRect = footer.getBoundingClientRect();
                    absoluteBottom = footerRect.bottom + scrollY;
                } else if (siteFooter) {
                    absoluteBottom = siteFooter.getBoundingClientRect().top + scrollY - 10;
                } else {
                    const listContainer = heading.closest('div')?.querySelector('table, ul, [role="table"], [class*="list"], svg, canvas, [class*="chart"]');
                    if (listContainer) {
                        absoluteBottom = listContainer.getBoundingClientRect().bottom + scrollY + 40;
                    }
                }

                if (captureType === 'traffic') {
                    absoluteBottom = absoluteBottom - Math.round(window.innerHeight * 0.03);
                } else if (captureType === 'firewall') {
                    const pixelsReduced = Math.round(window.innerHeight * 0.30);
                    absoluteBottom = absoluteBottom - pixelsReduced;
                    console.log(`${captureType} crop Yend reduced by 30% (${pixelsReduced}px)`);
                } else if (captureType === 'security-rules' || captureType === 'argo') {
                    // Yend must capture until above footer (#site-footer)
                    if (siteFooter) {
                        absoluteBottom = siteFooter.getBoundingClientRect().top + scrollY - 10;
                    }
                } else if (captureType === 'argo' || captureType === 'speed' || captureType === 'speed-mobile') {
                    // Yend -10% of window.innerHeight from siteFooter top
                    if (siteFooter) {
                        absoluteBottom = siteFooter.getBoundingClientRect().top + scrollY - 10 - Math.round(window.innerHeight * 0.10);
                    } else {
                        absoluteBottom = absoluteBottom - Math.round(window.innerHeight * 0.10);
                    }
                }

                let autoStartX;
                const isSpeedResultPage = (captureType === 'speed' || captureType === 'speed-mobile') && 
                    (window.location.href.includes('/tests/') || (document.body && document.body.innerText.includes('Speed test result')));

                if (isSpeedResultPage) {
                    autoStartX = 480;
                } else if (captureType === 'domains') {
                    autoStartX = Math.round(window.innerWidth * 0.18) + 50;
                } else if (captureType === 'dns') {
                    autoStartX = Math.round(window.innerWidth * 0.19);
                } else if (captureType === 'traffic' || captureType === 'traffic-countries') {
                    autoStartX = Math.round(window.innerWidth * 0.22);
                } else if (captureType === 'firewall' || captureType === 'top-events-source') {
                    autoStartX = Math.round(window.innerWidth * 0.15);
                } else if (captureType === 'security-rules' || captureType === 'rate-limiting' || captureType === 'managed-rules' || captureType === 'ip-access-rules' || captureType === 'zone-lockdown') {
                    autoStartX = Math.round(window.innerWidth * 0.15);
                } else if (captureType === 'ssl-overview' || captureType === 'ssl-edge') {
                    autoStartX = Math.round(window.innerWidth * 0.18);
                } else if (captureType === 'argo' || captureType === 'speed' || captureType === 'speed-mobile') {
                    autoStartX = Math.round(window.innerWidth * 0.25);
                } else {
                    autoStartX = Math.round(window.innerWidth * 0.15);
                }

                const parsedXS = parseInt(qXS, 10);
                const startX = !isNaN(parsedXS) 
                    ? ((parsedXS > 500) ? parsedXS : Math.max(0, autoStartX + parsedXS))
                    : autoStartX;

                let autoEndX;
                if (isSpeedResultPage) {
                    autoEndX = 1660;
                } else if (captureType === 'domains') {
                    autoEndX = Math.round(window.innerWidth * 0.93);
                } else if (captureType === 'dns') {
                    autoEndX = Math.round(window.innerWidth * 0.96);
                } else if (captureType === 'traffic' || captureType === 'traffic-countries') {
                    autoEndX = Math.round(window.innerWidth * 0.92);
                } else if (captureType === 'firewall' || captureType === 'top-events-source') {
                    autoEndX = Math.round(window.innerWidth * 0.90);
                } else if (captureType === 'security-rules' || captureType === 'rate-limiting' || captureType === 'managed-rules' || captureType === 'ip-access-rules' || captureType === 'zone-lockdown') {
                    autoEndX = Math.round(window.innerWidth * 1.00);
                } else if (captureType === 'ssl-overview' || captureType === 'ssl-edge') {
                    autoEndX = Math.round(window.innerWidth * 0.92);
                } else if (captureType === 'argo' || captureType === 'speed' || captureType === 'speed-mobile') {
                    autoEndX = Math.round(window.innerWidth * 0.85);
                } else {
                    autoEndX = Math.round(window.innerWidth * 0.90);
                }

                const parsedXE = parseInt(qXE, 10);
                const endX = !isNaN(parsedXE)
                    ? ((parsedXE > 500) ? parsedXE : Math.min(window.innerWidth, autoEndX + parsedXE))
                    : autoEndX;

                const headingAnchorY = isSpeedResultPage ? 70 : Math.max(0, Math.round(headingTop - 20));
                const parsedYS = parseInt(qYS, 10);
                const startY = !isNaN(parsedYS)
                    ? ((parsedYS > 500) ? parsedYS : Math.max(0, headingAnchorY + parsedYS))
                    : headingAnchorY;

                let autoHeight;
                const isDynamic = ['domains', 'dns', 'security-rules', 'rate-limiting', 'managed-rules', 'ip-access-rules', 'zone-lockdown', 'ssl-overview', 'ssl-edge', 'top-events-source'].includes(captureType);
                if (isSpeedResultPage) {
                    autoHeight = 820;
                } else if (isDynamic) {
                    autoHeight = Math.max(100, (absoluteBottom - startY) + 20);
                } else if (captureType === 'traffic' || captureType === 'traffic-countries') {
                    autoHeight = 900;
                } else if (captureType === 'firewall') {
                    autoHeight = 700;
                } else if (captureType === 'argo' || captureType === 'speed' || captureType === 'speed-mobile') {
                    autoHeight = 750;
                } else {
                    autoHeight = Math.max(150, (absoluteBottom - startY));
                }

                const parsedYE = parseInt(qYE, 10);
                let targetHeight;
                if (!isNaN(parsedYE)) {
                    targetHeight = (parsedYE > 500) 
                        ? Math.max(10, parsedYE - startY)
                        : Math.max(100, autoHeight + parsedYE);
                } else {
                    targetHeight = autoHeight;
                }

                return {
                    x: startX,
                    y: startY,
                    width: Math.max(100, endX - startX),
                    height: targetHeight
                };
            }, type, qXStart, qXEnd, qYStart, qYEnd);
            }

            let pageBuffer = null;

            const exactCardTypes = ['bot-management', 'security-level', 'min-tls-version', 'ssl-edge', 'tls-1-3', 'browser-integrity-check', 'browser-integrity', 'load-balancing-spectrum', 'load-balancing'];
            if (exactCardTypes.includes(type)) {
                console.log(`Targeting [${type}] via Exact Card Box Clip...`);
                const isBot = type === 'bot-management';
                const keywords = 
                    type === 'bot-management' ? ['super bot fight mode', 'bot fight mode', 'bot management', 'bots'] :
                    type === 'security-level' ? ['security level'] :
                    (type === 'min-tls-version' || type === 'ssl-edge') ? ['minimum tls version', 'minimum tls', 'min tls version'] :
                    type === 'tls-1-3' ? ['tls 1.3', 'tls 1.3 encryption', 'tls 1.3 (with 0-rtt)'] :
                    (type === 'browser-integrity-check' || type === 'browser-integrity') ? ['browser integrity check', 'browser integrity'] :
                    (type === 'load-balancing-spectrum' || type === 'load-balancing') ? ['load balancing', 'spectrum', 'load balancing and spectrum'] : [];

                try {
                    const searchInput = await page.$('input[name="settings-search"], input[placeholder*="Search"]');
                    if (searchInput && type !== 'load-balancing-spectrum' && type !== 'load-balancing') {
                        const searchTerm = 
                            type === 'bot-management' ? 'Bot' :
                            type === 'security-level' ? 'Security Level' :
                            (type === 'min-tls-version' || type === 'ssl-edge') ? 'Minimum TLS' :
                            type === 'tls-1-3' ? 'TLS 1.3' :
                            (type === 'browser-integrity-check' || type === 'browser-integrity') ? 'Browser Integrity' : '';
                        if (searchTerm) {
                            console.log(`Typing "${searchTerm}" into Cloudflare settings search box...`);
                            await searchInput.click({ clickCount: 3 });
                            await searchInput.press('Backspace');
                            await searchInput.type(searchTerm, { delay: 20 });
                            await new Promise(r => setTimeout(r, 600));
                        }
                    }
                } catch (err) {
                    console.warn('Error filtering settings search box:', err.message);
                }

                const findCardClip = async () => {
                    return await page.evaluate((kws, qXS, qXE, qYS, qYE, captureType) => {
                        const isInsideNav = (el) => {
                            let p = el;
                            while (p && p !== document.body) {
                                const tag = (p.tagName || '').toLowerCase();
                                const role = p.getAttribute ? p.getAttribute('role') : null;
                                const cls = typeof p.className === 'string' ? p.className.toLowerCase() : '';
                                if (tag === 'nav' || tag === 'aside' || tag === 'header' || role === 'navigation' || cls.includes('sidebar') || cls.includes('nav-') || cls.includes('navigation')) {
                                    return true;
                                }
                                p = p.parentElement;
                            }
                            return false;
                        };

                        if (captureType === 'load-balancing-spectrum' || captureType === 'load-balancing') {
                            const main = document.querySelector('main');
                            const nav = document.querySelector('nav, aside');
                            const lbTable = document.querySelector('[data-testid*="load-balancing-table"]') || document.querySelector('[role="table"]');
                            const h1 = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]')).find(h => {
                                if (isInsideNav(h)) return false;
                                const txt = (h.textContent || '').trim().toLowerCase();
                                return txt === 'load balancing' || txt.startsWith('load balancing') || txt.includes('manage public load balancers');
                            });

                            if (lbTable || h1) {
                                const col0 = main && main.children.length > 0 ? main.children[0] : null;
                                const navRight = nav ? nav.getBoundingClientRect().right : 260;
                                const col0Rect = col0 ? col0.getBoundingClientRect() : null;
                                const lbTableRect = lbTable ? lbTable.getBoundingClientRect() : null;
                                const h1Rect = h1 ? h1.getBoundingClientRect() : null;

                                const scrollY = window.scrollY || window.pageYOffset || 0;
                                const scrollX = window.scrollX || window.pageXOffset || 0;

                                const autoStartX = Math.max(0, navRight + 15 + scrollX);
                                const autoStartY = Math.max(0, (h1Rect ? h1Rect.top : (col0Rect ? col0Rect.top : 80)) + scrollY - 20);
                                const rightBound = col0Rect ? (col0Rect.right - 15 + scrollX) : (autoStartX + 1120);
                                const autoWidth = Math.max(800, rightBound - autoStartX);
                                const bottomBound = lbTableRect ? (lbTableRect.bottom + 20 + scrollY) : (col0Rect ? (col0Rect.bottom + scrollY) : (autoStartY + 1000));
                                const autoHeight = Math.max(300, bottomBound - autoStartY);

                                const parsedXS = parseInt(qXS, 10);
                                const parsedXE = parseInt(qXE, 10);
                                const parsedYS = parseInt(qYS, 10);
                                const parsedYE = parseInt(qYE, 10);

                                const startX = (!isNaN(parsedXS) && parsedXS > 500) ? parsedXS : Math.max(0, autoStartX + (!isNaN(parsedXS) ? parsedXS : 0));
                                const startY = (!isNaN(parsedYS) && parsedYS > 500) ? parsedYS : Math.max(0, autoStartY + (!isNaN(parsedYS) ? parsedYS : 0));
                                const targetWidth = (!isNaN(parsedXE) && parsedXE > 500) ? Math.max(10, parsedXE - startX) : Math.max(100, autoWidth + (!isNaN(parsedXE) ? parsedXE : 0));
                                const targetHeight = (!isNaN(parsedYE) && parsedYE > 500) ? Math.max(10, parsedYE - startY) : Math.max(100, autoHeight + (!isNaN(parsedYE) ? parsedYE : 0));

                                return {
                                    x: Math.floor(startX),
                                    y: Math.floor(startY),
                                    width: Math.ceil(targetWidth),
                                    height: Math.ceil(targetHeight)
                                };
                            }

                            const allRows = Array.from(document.querySelectorAll('table tr, [role="row"]'));
                            const lbSpectrumRows = allRows.filter(r => {
                                if (isInsideNav(r)) return false;
                                const txt = (r.innerText || r.textContent || '').trim().toLowerCase();
                                return (
                                    txt.startsWith('lb\t') || txt.startsWith('lb ') || txt.includes('\nlb\t') || txt.includes('\nlb ') ||
                                    txt.startsWith('spectrum\t') || txt.startsWith('spectrum ') || txt.includes('\nspectrum\t') || txt.includes('\nspectrum ') ||
                                    txt.includes('manage in traffic app') || txt.includes('manage in spectrum app') ||
                                    txt.includes('load balancer') || txt.includes('spectrum record')
                                );
                            });

                            if (lbSpectrumRows.length === 0) {
                                const hasSection = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, [role="heading"], div, span')).some(el => {
                                    if (isInsideNav(el)) return false;
                                    const t = (el.textContent || '').trim().toLowerCase();
                                    return t === 'load balancing and spectrum records' || t === 'load balancing & spectrum' || t === 'load balancing' || t === 'spectrum records';
                                });
                                if (!hasSection) {
                                    return { isDisabled: true, reason: 'ไม่พบการตั้งค่า Load Balancing ในโดเมนนี้ (Not Configured / Disabled)' };
                                }
                            }

                            const potentialHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, [role="heading"], [class*="heading"], [class*="title"], div, p, span'));
                            const headingEl = potentialHeadings.find(el => {
                                if (isInsideNav(el)) return false;
                                const t = (el.textContent || '').trim().toLowerCase();
                                const isVisible = (el.offsetWidth > 0 || el.offsetHeight > 0);
                                return isVisible && (t.startsWith('dns management') || t.includes('dns management') || t.startsWith('load balancing and spectrum') || t.startsWith('load balancing'));
                            });

                            let cardContainer = null;
                            if (headingEl) {
                                let cur = headingEl;
                                while (cur && cur !== document.body) {
                                    const s = window.getComputedStyle(cur);
                                    if (s.borderWidth !== '0px' && s.borderStyle !== 'none' && cur.offsetWidth > 600) {
                                        cardContainer = cur;
                                        break;
                                    }
                                    cur = cur.parentElement;
                                }
                                if (!cardContainer) {
                                    cardContainer = headingEl.closest('.setting-card, [class*="setting-card"], [class*="card"], [data-sentry-element="Card"], main section, form') || headingEl.parentElement;
                                }
                            }

                            const firstRow = lbSpectrumRows[0];
                            const lastRow = lbSpectrumRows[lbSpectrumRows.length - 1];

                            if (!cardContainer && firstRow) {
                                let cur = firstRow;
                                while (cur && cur !== document.body) {
                                    const s = window.getComputedStyle(cur);
                                    if (s.borderWidth !== '0px' && s.borderStyle !== 'none' && cur.offsetWidth > 600) {
                                        cardContainer = cur;
                                        break;
                                    }
                                    cur = cur.parentElement;
                                }
                                if (!cardContainer) {
                                    cardContainer = firstRow.closest('.setting-card, [class*="setting-card"], [class*="card"], [data-sentry-element="Card"], main section, form') || firstRow.closest('table');
                                }
                            }

                            if (cardContainer || firstRow || headingEl) {
                                const anchor = headingEl || cardContainer || firstRow;
                                anchor.scrollIntoView({ block: 'center', inline: 'center' });

                                const scrollY = window.scrollY || window.pageYOffset || 0;
                                const headingRect = headingEl ? headingEl.getBoundingClientRect() : null;
                                const cardRect = cardContainer ? cardContainer.getBoundingClientRect() : (anchor ? anchor.getBoundingClientRect() : { left: 300, top: 200, width: 1300, height: 400 });
                                const lastRowRect = lastRow ? lastRow.getBoundingClientRect() : (cardContainer ? cardContainer.getBoundingClientRect() : { bottom: cardRect.bottom });

                                const autoStartX = Math.max(0, Math.min(Math.round(window.innerWidth * 0.18), Math.round(cardRect.left) - 40));
                                const headingTop = headingRect ? headingRect.top + scrollY : cardRect.top + scrollY;
                                const autoStartY = Math.max(0, Math.round(headingTop) - 12);
                                const autoWidth = 1350;
                                const autoEndY = Math.round(lastRowRect.bottom + scrollY + 12);
                                const autoHeight = Math.max(250, autoEndY - autoStartY);

                                const parsedXS = parseInt(qXS, 10);
                                const parsedXE = parseInt(qXE, 10);
                                const parsedYS = parseInt(qYS, 10);
                                const parsedYE = parseInt(qYE, 10);

                                const startX = (!isNaN(parsedXS) && parsedXS > 500) ? parsedXS : Math.max(0, autoStartX + (!isNaN(parsedXS) ? parsedXS : 0));
                                const startY = (!isNaN(parsedYS) && parsedYS > 500) ? parsedYS : Math.max(0, autoStartY + (!isNaN(parsedYS) ? parsedYS : 0));
                                const targetWidth = (!isNaN(parsedXE) && parsedXE > 500) ? Math.max(10, parsedXE - startX) : Math.max(100, autoWidth + (!isNaN(parsedXE) ? parsedXE : 0));
                                const targetHeight = (!isNaN(parsedYE) && parsedYE > 500) ? Math.max(10, parsedYE - startY) : Math.max(100, autoHeight + (!isNaN(parsedYE) ? parsedYE : 0));

                                return {
                                    x: Math.floor(startX),
                                    y: Math.floor(startY),
                                    width: Math.ceil(targetWidth),
                                    height: Math.ceil(targetHeight)
                                };
                            }
                        }

                        const allElements = Array.from(document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main [role="heading"], main [class*="heading"], main [class*="title"], main span, main mark, main a, main p, main div, h1, h2, h3, h4, h5, [role="heading"], [class*="heading"], [class*="title"], span, mark, a, p, div'));
                        let found = null;
                        for (const kw of kws) {
                            found = allElements.find(el => {
                                if (isInsideNav(el)) return false;
                                const t = (el.textContent || '').trim().toLowerCase();
                                const isVisible = (el.offsetWidth > 0 || el.offsetHeight > 0);
                                const isLeaf = (el.children.length === 0 || el.tagName.startsWith('H') || el.tagName === 'SPAN' || el.tagName === 'MARK' || el.tagName === 'A');
                                return isVisible && isLeaf && (t === kw || t.startsWith(kw) || (t.includes(kw) && t.length < 60));
                            });
                            if (found) break;
                        }
                        if (found) {
                            let card = found.closest('.setting-card, [class*="setting-card"], [class*="card"], [data-sentry-element="Card"], section, tr');
                            if (!card) {
                                let cur = found;
                                while (cur && cur !== document.body) {
                                    const s = window.getComputedStyle(cur);
                                    if (s.borderWidth !== '0px' && s.borderStyle !== 'none' && cur.offsetWidth > 300) {
                                        card = cur;
                                        break;
                                    }
                                    cur = cur.parentElement;
                                }
                            }

                            // Conditional IF Enable checks
                            if (captureType === 'tls-1-3' || captureType === 'browser-integrity-check') {
                                const checkEl = card ? card.querySelector('input[type="checkbox"], [role="switch"], [aria-checked]') : null;
                                let isChecked = false;
                                if (checkEl) {
                                    isChecked = checkEl.checked || checkEl.getAttribute('aria-checked') === 'true' || checkEl.getAttribute('data-state') === 'checked' || checkEl.getAttribute('data-state') === 'on';
                                } else if (card) {
                                    const txt = (card.innerText || card.textContent || '').toLowerCase();
                                    isChecked = txt.includes('on') || txt.includes('enabled') || txt.includes('active');
                                }
                                if (checkEl && !isChecked) {
                                    return { isDisabled: true, reason: `ฟีเจอร์ ${captureType} ปิดการใช้งาน (Disabled / Toggle is Off)` };
                                }
                            }

                            if (captureType === 'load-balancing-spectrum') {
                                if (card) {
                                    const rows = card.querySelectorAll('tbody tr, [role="row"], [data-testid*="row"]');
                                    const txt = (card.innerText || card.textContent || '').toLowerCase();
                                    if (txt.includes('no records') || txt.includes('enable load balancing') || txt.includes('add load balancer') || (!rows.length && (txt.includes('get started') || txt.includes('load balancing')))) {
                                        return { isDisabled: true, reason: 'ไม่พบการตั้งค่า Load Balancing หรือ Spectrum records ในโดเมนนี้ (Not Configured / Disabled)' };
                                    }
                                }
                            }

                            if (card) {
                                card.scrollIntoView({ block: 'center', inline: 'center' });
                            } else {
                                found.scrollIntoView({ block: 'center', inline: 'center' });
                            }

                            const headingRect = found.getBoundingClientRect();
                            const cardRect = card ? card.getBoundingClientRect() : headingRect;
                            const scrollY = window.scrollY || window.pageYOffset || 0;
                            
                            const parsedXS = parseInt(qXS, 10);
                            const parsedXE = parseInt(qXE, 10);
                            const parsedYS = parseInt(qYS, 10);
                            const parsedYE = parseInt(qYE, 10);

                            const isTableRow = card && card.tagName === 'TR';

                            const autoStartX = isTableRow
                                ? Math.max(0, cardRect.left - 80)
                                : Math.max(0, Math.min(cardRect.left - 90, headingRect.left - 126));

                            const autoStartY = isTableRow
                                ? Math.max(0, cardRect.top + scrollY - 12)
                                : Math.max(0, Math.min(cardRect.top + scrollY - 20, headingRect.top + scrollY - 52));
                            
                            // Xstart and Ystart as offsets (or legacy direct coords if >500)
                            const startX = (!isNaN(parsedXS) && parsedXS > 500) ? parsedXS : autoStartX + (!isNaN(parsedXS) ? parsedXS : 0);
                            const startY = (!isNaN(parsedYS) && parsedYS > 500) ? parsedYS : autoStartY + (!isNaN(parsedYS) ? parsedYS : 0);
                            
                            const baseWidth = isTableRow ? Math.min(1450, cardRect.width + 80) : 935;
                            const baseHeight = isTableRow
                                ? Math.max(120, cardRect.height + 24)
                                : Math.max(250, (cardRect.height > 100 ? cardRect.height : 370) + 8);

                            // Xend and Yend as offsets (or legacy direct coords if >500)
                            const cardWidth = (!isNaN(parsedXE) && parsedXE > 500) ? Math.max(10, parsedXE - startX) : Math.max(100, baseWidth + (!isNaN(parsedXE) ? parsedXE : 0));
                            const cardHeight = (!isNaN(parsedYE) && parsedYE > 500) ? Math.max(10, parsedYE - startY) : Math.max(100, baseHeight + (!isNaN(parsedYE) ? parsedYE : 0));

                            return {
                                x: Math.floor(startX),
                                y: Math.floor(startY),
                                width: Math.ceil(cardWidth),
                                height: Math.ceil(cardHeight)
                            };
                        }
                        return null;
                    }, keywords, qXStart, qXEnd, qYStart, qYEnd, type);
                };

                let clipBox = await findCardClip();

                if (!clipBox && isBot) {
                    const currentUrl = page.url();
                    let altUrl = null;
                    if (currentUrl.includes('/security/settings')) {
                        altUrl = currentUrl.replace('/security/settings', '/security/bots');
                    } else if (currentUrl.includes('/security/bots')) {
                        altUrl = currentUrl.replace('/security/bots', '/security/settings');
                    }

                    if (altUrl) {
                        console.log(`Bot card not found on ${currentUrl}. Trying alternate page: ${altUrl}...`);
                        try {
                            await page.goto(altUrl, { waitUntil: 'networkidle2', timeout: 8000 });
                            await new Promise(r => setTimeout(r, 1000));
                            const altSearchInput = await page.$('input[name="settings-search"], input[placeholder*="Search"]');
                            if (altSearchInput) {
                                await altSearchInput.click({ clickCount: 3 });
                                await altSearchInput.press('Backspace');
                                await altSearchInput.type('Bot', { delay: 15 });
                                await new Promise(r => setTimeout(r, 600));
                            }
                            clipBox = await findCardClip();
                        } catch (navErr) {
                            console.warn('Could not navigate to alternate bot URL:', navErr.message);
                        }
                    }
                }

                if (!clipBox && type === 'load-balancing-spectrum') {
                    const currentUrl = page.url();
                    if (currentUrl.includes('/dns/records')) {
                        const altUrl = currentUrl.replace('/dns/records', '/traffic/load-balancing');
                        console.log(`Load Balancing card not found on DNS page. Trying alternate page: ${altUrl}...`);
                        try {
                            await page.goto(altUrl, { waitUntil: 'networkidle2', timeout: 8000 });
                            await new Promise(r => setTimeout(r, 1000));
                            clipBox = await findCardClip();
                        } catch (navErr) {
                            console.warn('Could not navigate to alternate load-balancing URL:', navErr.message);
                        }
                    }
                }

                if (clipBox && clipBox.isDisabled) {
                    console.log(`ℹ️ [${type}] is Disabled / Not Active:`, clipBox.reason);
                    const target = SECTION_TARGETS[type] || { title: type, description: clipBox.reason };
                    pageBuffer = await generateUnavailableImage(target.title, clipBox.reason || target.description);
                } else if (clipBox && clipBox.width) {
                    await page.evaluate(() => {
                        if (document.activeElement && typeof document.activeElement.blur === 'function') {
                            document.activeElement.blur();
                        }
                        const id = 'cf-no-highlight-fix';
                        let style = document.getElementById(id);
                        if (!style) {
                            style = document.createElement('style');
                            style.id = id;
                            document.head.appendChild(style);
                        }
                        style.innerHTML = `
                            mark, 
                            [class*="highlight"], 
                            [class*="Highlight"], 
                            [data-sentry-component="Highlight"],
                            [data-testid*="highlight"],
                            mark * {
                                background-color: transparent !important;
                                background: transparent !important;
                                color: inherit !important;
                                box-shadow: none !important;
                                border: none !important;
                                padding: 0 !important;
                                text-decoration: none !important;
                            }
                        `;
                    });
                    await new Promise(r => setTimeout(r, 300));
                    const cardScreenshotBase64 = await page.screenshot({ clip: clipBox, encoding: 'base64', type: 'png' });
                    pageBuffer = Buffer.from(cardScreenshotBase64, 'base64');
                    console.log(`✅ Captured [${type}] via Exact Card Box Clip! Box:`, clipBox, `Size: ${pageBuffer.length} bytes`);
                } else {
                    console.log(`⚠️ Card element for [${type}] not found in DOM, generating fallback image...`);
                    const target = SECTION_TARGETS[type] || { title: type, description: 'ไม่พบข้อมูลฟีเจอร์นี้' };
                    pageBuffer = await generateUnavailableImage(target.title, target.description);
                }
            } else {
                // Retrieve document height to expand the viewport temporarily and prevent visual flickering from fullPage: true
                const originalViewportSize = await page.evaluate(() => {
                    return {
                        width: window.innerWidth,
                        height: window.innerHeight,
                        documentHeight: Math.max(
                            document.body.scrollHeight,
                            document.documentElement.scrollHeight,
                            document.body.offsetHeight,
                            document.documentElement.offsetHeight,
                            window.innerHeight
                        )
                    };
                });

                console.log('Capturing page screenshot (full page, flicker-free)...');
                const fullScreenshotBase64 = await page.screenshot({
                    encoding: 'base64',
                    type: 'png',
                    fullPage: true
                });

                try {
                    const client = await page.target().createCDPSession();
                    await client.send('Emulation.clearDeviceMetricsOverride');
                } catch (e) {}

                pageBuffer = Buffer.from(fullScreenshotBase64, 'base64');

                // Apply sharp crop
                if (cropCoords) {
                    try {
                        console.log('Programmatically cropping image using sharp:', cropCoords);
                        const image = sharp(pageBuffer);
                        const metadata = await image.metadata();

                        // Align coordinates with devicePixelRatio (since Retina displays scale pixels 2x)
                        const pagesDevicePixelRatio = await page.evaluate(() => window.devicePixelRatio || 1);

                        const scaleX = Math.round(cropCoords.x * pagesDevicePixelRatio);
                        const scaleY = Math.round(cropCoords.y * pagesDevicePixelRatio);
                        const scaleWidth = Math.round(cropCoords.width * pagesDevicePixelRatio);
                        const scaleHeight = Math.round(cropCoords.height * pagesDevicePixelRatio);

                        // Safe boundaries
                        const extractLeft = Math.max(0, Math.min(scaleX, metadata.width - 1));
                        const extractTop = Math.max(0, Math.min(scaleY, metadata.height - 1));
                        const extractWidth = Math.max(10, Math.min(scaleWidth, metadata.width - extractLeft));
                        const extractHeight = Math.max(10, Math.min(scaleHeight, metadata.height - extractTop));

                        if (type === 'traffic') {
                            // 1. Crop sub1 (Requests tab using extractHeight)
                            console.log('Cropping sub1...');
                            sub1Buffer = await sharp(pageBuffer)
                                .extract({
                                    left: extractLeft,
                                    top: extractTop,
                                    width: extractWidth,
                                    height: extractHeight
                                })
                                .toBuffer();

                            // 2. Click subsequent tabs and capture
                            const additionalTabs = [
                                { text: 'data transfer', key: 'sub2' },
                                { text: 'page views', key: 'sub3' },
                                { text: 'visits', key: 'sub4' },
                                { text: 'api requests', key: 'sub5' }
                            ];

                            const tabBuffers = {};

                            for (const tabInfo of additionalTabs) {
                                console.log(`Searching for "${tabInfo.text}" tab to click...`);
                                try {
                                    const tabClicked = await page.evaluate((tabText) => {
                                        const anchors = Array.from(document.querySelectorAll('nav a, button, [role="tab"], a'));
                                        const target = anchors.find(a => {
                                            const text = (a.textContent || '').trim().toLowerCase();
                                            return text.includes(tabText);
                                        });
                                        if (target) {
                                            target.click();
                                            return true;
                                        }
                                        return false;
                                    }, tabInfo.text);

                                    if (tabClicked) {
                                        console.log(`Waiting 5 seconds for ${tabInfo.text} content...`);
                                        await new Promise(r => setTimeout(r, 5000));

                                        // Retrieve document height to expand the viewport temporarily
                                        const tempDocHeight = await page.evaluate(() => {
                                            return Math.max(
                                                document.body.scrollHeight,
                                                document.documentElement.scrollHeight,
                                                document.body.offsetHeight,
                                                document.documentElement.offsetHeight,
                                                window.innerHeight
                                            );
                                        });

                                        console.log(`Capturing ${tabInfo.text} page screenshot...`);
                                        const subScreenshotBase64 = await page.screenshot({
                                            encoding: 'base64',
                                            type: 'png',
                                            fullPage: true
                                        });

                                        try {
                                            const client = await page.target().createCDPSession();
                                            await client.send('Emulation.clearDeviceMetricsOverride');
                                        } catch (e) {}

                                        const subFullBuffer = Buffer.from(subScreenshotBase64, 'base64');
                                        const subImage = sharp(subFullBuffer);
                                        const subMetadata = await subImage.metadata();

                                        const extractHeightSub = Math.max(10, Math.min(extractHeight, subMetadata.height - extractTop));

                                        const croppedBuf = await subImage
                                            .extract({
                                                left: extractLeft,
                                                top: extractTop,
                                                width: extractWidth,
                                                height: extractHeightSub
                                            })
                                            .toBuffer();
                                        
                                        tabBuffers[tabInfo.key] = croppedBuf;
                                        console.log(`${tabInfo.text} cropping completed successfully.`);
                                    } else {
                                        console.warn(`Could not find or click the "${tabInfo.text}" tab.`);
                                    }
                                } catch (tabErr) {
                                    console.error(`Failed to process tab "${tabInfo.text}":`, tabErr);
                                }
                            }

                            sub2Buffer = tabBuffers.sub2 || null;
                            sub3Buffer = tabBuffers.sub3 || null;
                            sub4Buffer = tabBuffers.sub4 || null;
                            sub5Buffer = tabBuffers.sub5 || null;
                        }

                        // Proceed with standard crop for the main image
                        pageBuffer = await image
                            .extract({
                                left: extractLeft,
                                top: extractTop,
                                width: extractWidth,
                                height: extractHeight
                            })
                            .toBuffer();
                        console.log('Main cropping completed successfully.');
                    } catch (err) {
                        console.error('Failed to crop screenshot with sharp:', err);
                    }
                }
            }

            pageBuffers.push(pageBuffer);

            // Handle Pagination for DNS Records
            if (type === 'dns') {
                const nextButtonStatus = await page.evaluate(() => {
                    const btn = document.querySelector('button[data-testid="undefined-next-page"]') || 
                                document.querySelector('button[aria-label="Next"]') || 
                                document.querySelector('button[title="Next"]');
                    if (!btn) return { exists: false };
                    
                    const isDisabled = btn.disabled || 
                                       btn.getAttribute('aria-disabled') === 'true' || 
                                       btn.hasAttribute('disabled');
                    return { exists: true, disabled: isDisabled };
                });

                if (nextButtonStatus.exists && !nextButtonStatus.disabled) {
                    console.log(`[Page ${pageIndex}] Clicking Next Page button...`);
                    await page.evaluate(() => {
                        const btn = document.querySelector('button[data-testid="undefined-next-page"]') || 
                                    document.querySelector('button[aria-label="Next"]') || 
                                    document.querySelector('button[title="Next"]');
                        btn.click();
                    });

                    // Wait 2.5 seconds for transition loading
                    await new Promise(r => setTimeout(r, 2500));
                    pageIndex++;
                } else {
                    console.log(`No active Next button found on page ${pageIndex}. Completing loop.`);
                    hasNextPage = false;
                }
            } else {
                hasNextPage = false;
            }
        }

        // Stitch page buffers vertically if multiple pages exist
        let finalBuffer = pageBuffers[0];
        if (pageBuffers.length > 1 && type !== 'dns') {
            console.log(`Stitching ${pageBuffers.length} captured page screenshots vertically...`);
            try {
                const imageMetadatas = await Promise.all(pageBuffers.map(buf => sharp(buf).metadata()));
                const totalHeight = imageMetadatas.reduce((sum, meta) => sum + meta.height, 0);
                const maxWidth = Math.max(...imageMetadatas.map(meta => meta.width));
                
                let yOffset = 0;
                const compositeList = pageBuffers.map((buf, idx) => {
                    const item = {
                        input: buf,
                        top: yOffset,
                        left: 0
                    };
                    yOffset += imageMetadatas[idx].height;
                    return item;
                });
                
                finalBuffer = await sharp({
                    create: {
                        width: maxWidth,
                        height: totalHeight,
                        channels: 4,
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    }
                })
                .composite(compositeList)
                .png()
                .toBuffer();
                console.log('Stitching completed successfully.');
            } catch (stitchErr) {
                console.error('Stitching images failed:', stitchErr);
                // Fallback to first page
            }
        }

        // Ensure directories exist
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }
        if (!fs.existsSync(dbCapturedDir)) {
            try { fs.mkdirSync(dbCapturedDir, { recursive: true }); } catch (e) {}
        }

        // Clean up old captured-dns-*.png files
        if (type === 'dns') {
            try {
                const files = fs.readdirSync(publicDir);
                for (const file of files) {
                    if (file.startsWith('captured-dns-') && file.endsWith('.png')) {
                        fs.unlinkSync(path.join(publicDir, file));
                    }
                }
                if (fs.existsSync(dbCapturedDir)) {
                    const dbFiles = fs.readdirSync(dbCapturedDir);
                    for (const file of dbFiles) {
                        if (file.startsWith('captured-dns-') && file.endsWith('.png')) {
                            fs.unlinkSync(path.join(dbCapturedDir, file));
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to clean up old dns capture files:', e);
            }
        }

        const fileMapping = {
            dns: 'captured-dns.png',
            traffic: 'captured-traffic.png',
            firewall: 'captured-firewall.png',
            'security-rules': 'captured-security-rules.png',
            argo: 'captured-argo.png',
            speed: 'captured-speed.png',
            'speed-mobile': 'captured-speed-mobile.png',
            domains: 'captured-domains.png',
            'bot-management': 'captured-bot-management.png',
            'security-level': 'captured-security-level.png',
            'ssl-overview': 'captured-ssl-overview.png',
            'ssl-edge': 'captured-ssl-edge.png',
            'min-tls-version': 'captured-min-tls-version.png',
            'tls-1-3': 'captured-tls-1-3.png',
            'browser-integrity-check': 'captured-browser-integrity.png',
            'load-balancing-spectrum': 'captured-load-balancing-spectrum.png',
            'rate-limiting': 'captured-rate-limiting.png',
            'managed-rules': 'captured-managed-rules.png',
            'ip-access-rules': 'captured-ip-access.png',
            'zone-lockdown': 'captured-zone-lockdown.png',
            'traffic-countries': 'captured-traffic-countries.png',
            'top-events-source': 'captured-top-events-source.png'
        };
        const fileName = fileMapping[type] || 'captured-domains.png';
        const filePath = path.join(publicDir, fileName);
        fs.writeFileSync(filePath, finalBuffer);
        try { fs.writeFileSync(path.join(dbCapturedDir, fileName), finalBuffer); } catch (e) {}
        console.log(`Screenshot saved to ${filePath} and persistent disk`);

        if (type === 'dns' && pageBuffers.length > 0) {
            for (let i = 0; i < pageBuffers.length; i++) {
                const pageFileName = `captured-dns-${i + 1}.png`;
                const pageFilePath = path.join(publicDir, pageFileName);
                fs.writeFileSync(pageFilePath, pageBuffers[i]);
                try { fs.writeFileSync(path.join(dbCapturedDir, pageFileName), pageBuffers[i]); } catch (e) {}
                console.log(`Saved paginated DNS screenshot to ${pageFilePath}`);
            }
        }

        if (type === 'traffic') {
            if (sub1Buffer) {
                fs.writeFileSync(path.join(publicDir, 'captured-traffic-sub1.png'), sub1Buffer);
                try { fs.writeFileSync(path.join(dbCapturedDir, 'captured-traffic-sub1.png'), sub1Buffer); } catch (e) {}
                console.log('Saved traffic sub1 screenshot');
            }
            if (sub2Buffer) {
                fs.writeFileSync(path.join(publicDir, 'captured-traffic-sub2.png'), sub2Buffer);
                try { fs.writeFileSync(path.join(dbCapturedDir, 'captured-traffic-sub2.png'), sub2Buffer); } catch (e) {}
                console.log('Saved traffic sub2 screenshot');
            }
            if (sub3Buffer) {
                fs.writeFileSync(path.join(publicDir, 'captured-traffic-sub3.png'), sub3Buffer);
                try { fs.writeFileSync(path.join(dbCapturedDir, 'captured-traffic-sub3.png'), sub3Buffer); } catch (e) {}
                console.log('Saved traffic sub3 screenshot');
            }
            if (sub4Buffer) {
                fs.writeFileSync(path.join(publicDir, 'captured-traffic-sub4.png'), sub4Buffer);
                try { fs.writeFileSync(path.join(dbCapturedDir, 'captured-traffic-sub4.png'), sub4Buffer); } catch (e) {}
                console.log('Saved traffic sub4 screenshot');
            }
            if (sub5Buffer) {
                fs.writeFileSync(path.join(publicDir, 'captured-traffic-sub5.png'), sub5Buffer);
                try { fs.writeFileSync(path.join(dbCapturedDir, 'captured-traffic-sub5.png'), sub5Buffer); } catch (e) {}
                console.log('Saved traffic sub5 screenshot');
            }
        }

        await browser.disconnect();

        const finalImageBase64 = finalBuffer.toString('base64');
        const responseData = {
            success: true,
            image: `data:image/png;base64,${finalImageBase64}`,
            filePath: `/${fileName}?t=${Date.now()}`
        };

        if (type === 'dns') {
            responseData.dnsPages = pageBuffers.map(buf => `data:image/png;base64,${buf.toString('base64')}`);
        }

        if (type === 'traffic') {
            if (sub1Buffer) {
                responseData.imageSub1 = `data:image/png;base64,${sub1Buffer.toString('base64')}`;
                responseData.filePathSub1 = `/captured-traffic-sub1.png?t=${Date.now()}`;
            }
            if (sub2Buffer) {
                responseData.imageSub2 = `data:image/png;base64,${sub2Buffer.toString('base64')}`;
                responseData.filePathSub2 = `/captured-traffic-sub2.png?t=${Date.now()}`;
            }
            if (sub3Buffer) {
                responseData.imageSub3 = `data:image/png;base64,${sub3Buffer.toString('base64')}`;
                responseData.filePathSub3 = `/captured-traffic-sub3.png?t=${Date.now()}`;
            }
            if (sub4Buffer) {
                responseData.imageSub4 = `data:image/png;base64,${sub4Buffer.toString('base64')}`;
                responseData.filePathSub4 = `/captured-traffic-sub4.png?t=${Date.now()}`;
            }
            if (sub5Buffer) {
                responseData.imageSub5 = `data:image/png;base64,${sub5Buffer.toString('base64')}`;
                responseData.filePathSub5 = `/captured-traffic-sub5.png?t=${Date.now()}`;
            }
        }

        return Response.json(responseData);
    } catch (e) {
        console.error('Puppeteer remote capture error:', e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}

// Handles the "@uploaded_*" manual-override images: the user picks a file themselves (in the
// control page's upload panel) instead of relying on the automated Puppeteer capture. Kept as
// a separate, much simpler action than the capture flow above — just decode a data URL and
// write/delete a PNG on disk, no Chrome/Puppeteer involved.
export async function POST(request) {
    try {
        const body = await request.json();
        const { action, id } = body;

        if (!id || !UPLOADED_SLUGS[id]) {
            return Response.json({ success: false, error: `Unknown uploaded-image id: ${id}` }, { status: 400 });
        }

        const dbCapturedDir = path.join(process.cwd(), 'db', 'captured');
        if (!fs.existsSync(dbCapturedDir)) {
            try { fs.mkdirSync(dbCapturedDir, { recursive: true }); } catch (e) {}
        }
        const filePath = path.join(dbCapturedDir, `uploaded-${UPLOADED_SLUGS[id]}.png`);

        if (action === 'save-uploaded') {
            const { imageBase64 } = body;
            if (!imageBase64 || typeof imageBase64 !== 'string') {
                return Response.json({ success: false, error: 'Missing imageBase64' }, { status: 400 });
            }
            const match = imageBase64.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
            const rawBase64 = match ? match[1] : imageBase64;
            let buffer;
            try {
                buffer = Buffer.from(rawBase64, 'base64');
                if (buffer.length === 0) throw new Error('Decoded buffer is empty');
            } catch (e) {
                return Response.json({ success: false, error: `Invalid image data: ${e.message}` }, { status: 400 });
            }
            // Normalize to PNG via sharp regardless of the source format (jpeg/webp/etc.),
            // same as the automated capture path does, so downstream <img> embedding and the
            // docx export pipeline see a consistent format.
            const pngBuffer = await sharp(buffer).png().toBuffer();
            fs.writeFileSync(filePath, pngBuffer);
            return Response.json({
                success: true,
                id,
                image: `data:image/png;base64,${pngBuffer.toString('base64')}`
            });
        }

        if (action === 'delete-uploaded') {
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (e) {
                    return Response.json({ success: false, error: `Failed to delete: ${e.message}` }, { status: 500 });
                }
            }
            return Response.json({ success: true, id });
        }

        return Response.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    } catch (e) {
        console.error('Uploaded-image save/delete error:', e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}
