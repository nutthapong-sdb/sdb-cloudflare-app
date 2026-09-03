import { connectChrome } from '@/lib/chrome-helper';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

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
    'rate-limiting': 'captured-rate-limiting.png',
    'managed-rules': 'captured-managed-rules.png',
    'ip-access-rules': 'captured-ip-access.png',
    'zone-lockdown': 'captured-zone-lockdown.png',
    'traffic-countries': 'captured-traffic-countries.png',
    'top-events-source': 'captured-top-events-source.png'
};

const SECTION_TARGETS = {
    'bot-management': {
        title: '🤖 Bot Management',
        keywords: ['bot management', 'bot fight mode', 'super bot fight mode', 'bot protection', 'fight bots', 'bots'],
        description: 'ไม่พบเมนูหรือการตั้งค่า Bot Management ในแพ็กเกจหรือ Account Cloudflare ปัจจุบัน'
    },
    'security-level': {
        title: '🛡️ Security Level & Settings',
        keywords: ['security level', 'browser integrity check', 'challenge passage', 'privacy pass'],
        description: 'ไม่พบเมนู Security Level ในหน้าการตั้งค่าความปลอดภัย'
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
        keywords: ['zone lockdown', 'lockdown rules', 'lockdown'],
        description: 'ไม่พบเมนู Zone Lockdown Rules ในโดเมนนี้'
    },
    'ip-access-rules': {
        title: '🚫 IP Access Rules',
        keywords: ['ip access rules', 'ip access', 'ip firewall'],
        description: 'ไม่พบเมนู IP Access Rules ในโดเมนนี้'
    }
};

async function generateUnavailableImage(title, subtitle = 'ไม่พบข้อมูลหรือฟีเจอร์นี้ใน Cloudflare Zone / Account ปัจจุบัน') {
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

        <!-- Alert Icon -->
        <circle cx="640" cy="270" r="54" fill="#334155" fill-opacity="0.6" stroke="#475569" stroke-width="2" />
        <text x="640" y="290" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="52" text-anchor="middle" fill="#cbd5e1">ℹ️</text>

        <!-- Main Title -->
        <text x="640" y="380" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="bold" text-anchor="middle" fill="#f8fafc">${title}</text>

        <!-- Subtitle & Reason -->
        <text x="640" y="430" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" text-anchor="middle" fill="#94a3b8">${subtitle}</text>
        <text x="640" y="465" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" text-anchor="middle" fill="#64748b">(ไม่สามารถแคปรูปภาพได้เนื่องจากไม่พบส่วนนี้ในแพ็กเกจหรือ Account ปัจจุบัน)</text>

        <!-- Status Tag Badge -->
        <rect x="440" y="510" width="400" height="46" rx="23" fill="#e11d48" fill-opacity="0.15" stroke="#f43f5e" stroke-width="1.5" />
        <text x="640" y="539" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#fda4af">⚠️ Feature Not Found / ไม่พบข้อมูลบนหน้าเว็บ</text>
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
                { id: 'speedMobile', file: 'captured-speed-mobile.png' }
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
                const target = fs.existsSync(p1) ? p1 : (fs.existsSync(p2) ? p2 : null);
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

            return Response.json({
                success: true,
                screenshots,
                metadata
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
        const page = pages.find(p => p.url().includes('cloudflare.com')) || pages[0];

        if (!page) {
            return Response.json({ success: false, error: 'No active browser page found' }, { status: 400 });
        }

        // Force viewport size to 1920x1080 to match browser window size inside VNC container
        await page.setViewport({ width: 1920, height: 1080 });

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

        // 1. Initial short stabilization delay
        await new Promise(r => setTimeout(r, 600));

        // Check if the requested feature/section exists on the Cloudflare page
        const targetCheck = SECTION_TARGETS[type];
        if (targetCheck) {
            console.log(`Checking if feature "${targetCheck.title}" is present on Cloudflare page...`);
            const isFound = await page.evaluate((keywords) => {
                const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, [role="heading"], [data-testid], section, [class*="card"], [class*="setting"], div, span, p, label, a, button'));
                for (const kw of keywords) {
                    const match = elements.find(el => {
                        const txt = (el.textContent || '').toLowerCase().trim();
                        const isVisible = (el.offsetWidth > 0 || el.offsetHeight > 0);
                        return isVisible && txt.includes(kw);
                    });
                    if (match) return true;
                }
                return false;
            }, targetCheck.keywords);

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

        let pageIndex = 1;
        let hasNextPage = true;
        const pageBuffers = [];
        let sub1Buffer = null;
        let sub2Buffer = null;
        let sub3Buffer = null;
        let sub4Buffer = null;
        let sub5Buffer = null;

        while (hasNextPage) {
            console.log(`Processing page ${pageIndex} of ${type}...`);

            // 2. Wait dynamically for page elements to be loaded and verify NO lazy loading skeleton or spinner exists
            console.log(`Checking for lazy loading elements and waiting for ${type} page ${pageIndex} content to finish rendering...`);
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
                    
                    // Check if any visible skeleton loader, loading spinner, progress bar or spinner is active
                    const isLoaderActive = !!(
                        document.querySelector('[class*="skeleton"], [class*="loading"], [role="progressbar"], svg[class*="spin"], [class*="spinner"]') ||
                        Array.from(document.querySelectorAll('span, div, p')).find(el => {
                            const text = (el.textContent || '').toLowerCase();
                            return (el.offsetWidth > 0 || el.offsetHeight > 0) && (text.includes('loading') || text.includes('please wait'));
                        })
                    );

                    // Ensure heading H1-H4 title is visible
                    const headingText = (
                        captureType === 'traffic' || captureType === 'traffic-countries' ? 'traffic' :
                        captureType === 'dns' ? 'dns' :
                        captureType === 'firewall' || captureType === 'top-events-source' ? 'security' :
                        captureType === 'security-rules' || captureType === 'rate-limiting' || captureType === 'managed-rules' || captureType === 'ip-access-rules' || captureType === 'zone-lockdown' ? 'rules' :
                        captureType === 'bot-management' || captureType === 'security-level' ? 'settings' :
                        captureType === 'ssl-overview' ? 'ssl' :
                        captureType === 'ssl-edge' ? 'certificates' :
                        captureType === 'argo' ? 'argo' :
                        (captureType === 'speed' || captureType === 'speed-mobile') ? 'speed' : 'domains'
                    );
                    const heading = findElementByText('h1, h2, h3, h4, span, div', headingText) || document.querySelector('main');
                    // Ensure table body, pagination footer, or traffic chart is loaded
                    let tableOrFooter = true;
                    if (captureType === 'traffic' || captureType === 'traffic-countries' || captureType === 'argo' || captureType === 'speed' || captureType === 'speed-mobile') {
                        tableOrFooter = findElementByText('div, span, button, p, td', 'requests') || findElementByText('div, span, h1, h2, h3, h4', 'traffic') || findElementByText('div, span, button, p, td', 'result') || document.querySelector('svg, canvas, button');
                    } else if (captureType === 'domains') {
                        tableOrFooter = document.querySelector('[data-testid*="table_row"], [role="row"], [role="table"]') || findElementByText('div, span, button, p, td', 'Showing 1') || document.querySelector('table');
                    } else {
                        tableOrFooter = findElementByText('div, span, button, p, td', 'of') || findElementByText('div, span, button, p, td', 'items') || document.querySelector('table, form, section, main');
                    }
                                          
                    // Complete if heading and footer/table exist AND no loading placeholders are active
                    return !!(heading && tableOrFooter && !isLoaderActive);
                }, { timeout: 15000 }, type);
                console.log(`${type} page ${pageIndex} loaded and verified: zero active lazy loading elements found.`);
                // Add a short stabilize delay for visual rendering animations
                await new Promise(r => setTimeout(r, 400));
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
            if (qXStart && qXEnd && qYStart && qYEnd && type !== 'domains' && type !== 'dns') {
                const xs = parseInt(qXStart, 10);
                const xe = parseInt(qXEnd, 10);
                const ys = parseInt(qYStart, 10);
                const ye = parseInt(qYEnd, 10);
                if (!isNaN(xs) && !isNaN(xe) && !isNaN(ys) && !isNaN(ye)) {
                    cropCoords = {
                        x: xs,
                        y: ys,
                        width: Math.max(10, xe - xs),
                        height: Math.max(10, ye - ys)
                    };
                    console.log('Using query custom crop coords:', cropCoords);
                }
            }

            if (!cropCoords) {
                cropCoords = await page.evaluate((captureType, qXS, qXE, qYS, qYE) => {
                    if (captureType === 'domains') {
                        const h = Array.from(document.querySelectorAll('h1, h2, h3, div, span')).find(el => (el.innerText || '').trim().startsWith('Domains') && el.getBoundingClientRect().left > 200);
                        const footer = Array.from(document.querySelectorAll('*')).find(el => (el.innerText || '').trim().startsWith('Showing 1'));
                        const hRect = h ? h.getBoundingClientRect() : { top: 80, left: 328 };
                        const fRect = footer ? footer.getBoundingClientRect() : { bottom: 480 };
                        
                        let offsetVal = 40;
                        const parsedYE = parseInt(qYE, 10);
                        if (!isNaN(parsedYE)) {
                            offsetVal = 40 + parsedYE; // e.g. +50 or -30 offset from standard 40px padding
                        }
                        
                        const parsedXS = parseInt(qXS, 10);
                        const parsedXE = parseInt(qXE, 10);
                        const parsedYS = parseInt(qYS, 10);
                        
                        const x = !isNaN(parsedXS) ? parsedXS : Math.max(0, Math.round(hRect.left) - 30);
                        const y = !isNaN(parsedYS) ? parsedYS : Math.max(0, Math.round(hRect.top) - 20);
                        const width = (!isNaN(parsedXS) && !isNaN(parsedXE)) ? Math.max(10, parsedXE - parsedXS) : 1350;
                        const height = Math.max(100, Math.round((fRect.bottom || 480) - (hRect.top - 20) + offsetVal));
                        
                        return { x, y, width, height };
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

                // Look for visible headings containing target text
                const headingText = captureType === 'traffic' ? 'traffic' : (captureType === 'dns' ? 'dns' : (captureType === 'firewall' ? 'security' : (captureType === 'security-rules' ? 'rules' : (captureType === 'argo' ? 'argo' : (captureType === 'speed' || captureType === 'speed-mobile' ? 'speed' : 'domains')))));
                const heading = findElementByText('h1, h2, h3, h4', headingText) || 
                                findElementByText('span, div', headingText);
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

                let startX;
                const parsedXS = parseInt(qXS, 10);
                if (!isNaN(parsedXS)) {
                    startX = parsedXS;
                } else {
                    startX = Math.round(window.innerWidth * 0.15);
                    if (captureType === 'domains') {
                        startX = Math.round(window.innerWidth * 0.18) + 50;
                    } else if (captureType === 'dns') {
                        startX = Math.round(window.innerWidth * 0.19);
                    } else if (captureType === 'traffic') {
                        startX = Math.round(window.innerWidth * 0.22);
                    } else if (captureType === 'firewall' || captureType === 'security-rules') {
                        startX = Math.round(window.innerWidth * 0.15);
                    } else if (captureType === 'argo' || captureType === 'speed' || captureType === 'speed-mobile') {
                        startX = Math.round(window.innerWidth * 0.25);
                    }
                }

                let endX;
                const parsedXE = parseInt(qXE, 10);
                if (!isNaN(parsedXE)) {
                    endX = parsedXE;
                } else {
                    endX = Math.round(window.innerWidth * 0.90);
                    if (captureType === 'domains') {
                        endX = Math.round(window.innerWidth * 0.93);
                    } else if (captureType === 'dns') {
                        endX = Math.round(window.innerWidth * 0.96);
                    } else if (captureType === 'traffic') {
                        endX = Math.round(window.innerWidth * 0.92);
                    } else if (captureType === 'firewall') {
                        endX = Math.round(window.innerWidth * 0.90);
                    } else if (captureType === 'security-rules') {
                        endX = Math.round(window.innerWidth * 1.00);
                    } else if (captureType === 'argo' || captureType === 'speed' || captureType === 'speed-mobile') {
                        endX = Math.round(window.innerWidth * 0.85);
                    }
                }

                let headingAnchorY = Math.max(0, Math.round(headingTop - 20));
                let startY;
                const parsedYS = parseInt(qYS, 10);
                if (!isNaN(parsedYS)) {
                    // Ystart is treated as offset relative to heading title anchor
                    startY = Math.max(0, headingAnchorY + parsedYS);
                } else {
                    startY = headingAnchorY;
                }

                let targetHeight;
                const isDynamic = ['domains', 'dns', 'security-rules', 'rate-limiting', 'managed-rules', 'ip-access-rules', 'zone-lockdown'].includes(captureType);
                const parsedYE = parseInt(qYE, 10);
                
                if (isDynamic) {
                    let offsetVal = 20;
                    if (!isNaN(parsedYE)) {
                        offsetVal = 20 + parsedYE;
                    }
                    targetHeight = Math.max(100, (absoluteBottom - startY) + offsetVal);
                } else {
                    if (!isNaN(parsedYE)) {
                        targetHeight = Math.max(10, parsedYE - startY);
                    } else {
                        targetHeight = Math.max(150, (absoluteBottom - startY));
                        if (captureType === 'traffic') {
                            targetHeight = 900;
                        } else if (captureType === 'firewall') {
                            targetHeight = 700;
                        } else if (captureType === 'argo' || captureType === 'speed' || captureType === 'speed-mobile') {
                            targetHeight = 750;
                        }
                    }
                }

                return {
                    x: startX,
                    y: startY,
                    width: endX - startX,
                    height: targetHeight
                };
            }, type, qXStart, qXEnd, qYStart, qYEnd);
            }

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

            if (type !== 'domains') {
                console.log(`Temporarily resizing viewport height from ${originalViewportSize.height} to ${originalViewportSize.documentHeight} for full page capture...`);
                await page.setViewport({
                    width: originalViewportSize.width,
                    height: originalViewportSize.documentHeight
                });
            }

            console.log('Capturing page screenshot (flicker-free)...');
            const fullScreenshotBase64 = await page.screenshot({
                encoding: 'base64',
                type: 'png'
            });

            if (type !== 'domains') {
                // Restore viewport size to original window dimensions
                await page.setViewport({
                    width: originalViewportSize.width,
                    height: originalViewportSize.height
                });
            }

            let pageBuffer = Buffer.from(fullScreenshotBase64, 'base64');

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

                                    await page.setViewport({
                                        width: originalViewportSize.width,
                                        height: tempDocHeight
                                    });

                                    console.log(`Capturing ${tabInfo.text} page screenshot...`);
                                    const subScreenshotBase64 = await page.screenshot({
                                        encoding: 'base64',
                                        type: 'png'
                                    });

                                    await page.setViewport({
                                        width: originalViewportSize.width,
                                        height: originalViewportSize.height
                                    });

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
