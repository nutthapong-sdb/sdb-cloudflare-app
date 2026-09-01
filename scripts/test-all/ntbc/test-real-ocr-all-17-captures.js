const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ACCOUNT_ID = 'ae240d50da44461d1fc5e34f708ebec8';
const DOMAIN_NAME = 'log.softdebut.online';

const TABS = [
    { key: 'domains', label: 'Domains Overview', type: 'domains', path: '/domains/overview', expectedKeywords: ['Domains', 'Sites', 'protect', 'softdebut'] },
    { key: 'dns', label: 'DNS Records', type: 'dns', path: `/${DOMAIN_NAME}/dns/records`, expectedKeywords: ['DNS', 'Records', 'Type', 'Name', 'Content'] },
    { key: 'botManagement', label: 'Bot Management', type: 'bot-management', path: `/${DOMAIN_NAME}/security/settings`, expectedKeywords: ['Bot', 'Security', 'Fight'] },
    { key: 'securityLevel', label: 'Security Level & BIC', type: 'security-level', path: `/${DOMAIN_NAME}/security/settings`, expectedKeywords: ['Security Level', 'Browser Integrity', 'Medium', 'High', 'Challenge'] },
    { key: 'sslOverview', label: 'SSL/TLS Encryption', type: 'ssl-overview', path: `/${DOMAIN_NAME}/ssl-tls`, expectedKeywords: ['SSL', 'TLS', 'Encryption', 'Full', 'Flexible'] },
    { key: 'sslEdge', label: 'Edge Certificates', type: 'ssl-edge', path: `/${DOMAIN_NAME}/ssl-tls/edge-certificates`, expectedKeywords: ['Edge', 'Certificates', 'TLS', 'Universal'] },
    { key: 'traffic', label: 'HTTP Traffic Overview', type: 'traffic', path: `/${DOMAIN_NAME}/analytics/traffic`, expectedKeywords: ['Traffic', 'Requests', 'Bandwidth', 'Total'] },
    { key: 'trafficCountries', label: 'Traffic by Country', type: 'traffic-countries', path: `/${DOMAIN_NAME}/analytics/traffic`, expectedKeywords: ['Country', 'Requests', 'Traffic', 'Thailand', 'United States'] },
    { key: 'firewall', label: 'Firewall Overview', type: 'firewall', path: `/${DOMAIN_NAME}/security/analytics/events`, expectedKeywords: ['Security', 'Events', 'Activity', 'Action'] },
    { key: 'topEventsSource', label: 'Top Events by Source', type: 'top-events-source', path: `/${DOMAIN_NAME}/security/analytics/events`, expectedKeywords: ['Source', 'Events', 'Top'] },
    { key: 'securityRules', label: 'Security Custom Rules', type: 'security-rules', path: `/${DOMAIN_NAME}/security/security-rules`, expectedKeywords: ['Custom', 'Rules', 'WAF', 'Rule'] },
    { key: 'rateLimiting', label: 'Rate Limiting Rules', type: 'rate-limiting', path: `/${DOMAIN_NAME}/security/security-rules`, expectedKeywords: ['Rate', 'Limiting', 'Rules'] },
    { key: 'managedRules', label: 'Managed WAF Rules', type: 'managed-rules', path: `/${DOMAIN_NAME}/security/security-rules`, expectedKeywords: ['Managed', 'Rules', 'Cloudflare'] },
    { key: 'ipAccess', label: 'IP Access Rules', type: 'ip-access-rules', path: `/${DOMAIN_NAME}/security/security-rules`, expectedKeywords: ['IP', 'Access', 'Rules', 'Tools'] },
    { key: 'zoneLockdown', label: 'Zone Lockdown Rules', type: 'zone-lockdown', path: `/${DOMAIN_NAME}/security/security-rules`, expectedKeywords: ['Zone', 'Lockdown', 'Rules'] },
    { key: 'argo', label: 'Argo Smart Routing', type: 'argo', path: `/${DOMAIN_NAME}/traffic`, expectedKeywords: ['Argo', 'Smart Routing', 'Traffic', 'Routing'] },
    { key: 'speed', label: 'Speed Test Results', type: 'speed', path: `/${DOMAIN_NAME}/speed/test/browser`, expectedKeywords: ['Speed', 'Performance', 'Desktop', 'Mobile', 'Score', 'Test'] }
];

async function runOCRTest() {
    console.log('================================================================');
    console.log('👁️ RUNNING REAL TESSERACT OCR TEST ON ALL 17 CAPTURED IMAGES 👁️');
    console.log('================================================================\n');

    const results = [];
    const tmpDir = path.join(process.cwd(), 'tmp_ocr_test');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    for (let i = 0; i < TABS.length; i++) {
        const tab = TABS[i];
        const targetUrl = `https://dash.cloudflare.com/${ACCOUNT_ID}${tab.path}`;
        console.log(`\n[${i + 1}/${TABS.length}] 📸 Processing & Capturing "${tab.label}" (${tab.key})...`);

        try {
            // 1. Navigate live Chrome to target Cloudflare URL
            console.log(`   Navigating to: ${targetUrl}`);
            const navRes = await fetch(`http://localhost:8002/api/ntbc-control-chrome?url=${encodeURIComponent(targetUrl)}`);
            const navData = await navRes.json();
            if (!navData.success) throw new Error(`Navigation failed: ${navData.error}`);

            // Wait for rendering stabilization
            await new Promise(r => setTimeout(r, 2500));

            // 2. Call capture API to capture and crop the screenshot
            console.log(`   Calling /api/ntbc-capture?type=${tab.type}...`);
            const capRes = await fetch(`http://localhost:8002/api/ntbc-capture?type=${tab.type}`);
            const capData = await capRes.json();
            if (!capData.success) throw new Error(`Capture API failed: ${capData.error}`);

            // Get image buffer (either from data URL or dnsPages array)
            let imgDataUrl = capData.image;
            if (!imgDataUrl && capData.dnsPages && capData.dnsPages.length > 0) {
                imgDataUrl = capData.dnsPages[0];
            }
            if (!imgDataUrl) throw new Error('No image returned from capture API');

            const base64Data = imgDataUrl.replace(/^data:image\/\w+;base64,/, '');
            const imgBuffer = Buffer.from(base64Data, 'base64');
            const imgPath = path.join(tmpDir, `captured_${tab.key}.png`);
            fs.writeFileSync(imgPath, imgBuffer);
            console.log(`   Saved image: ${imgPath} (${(imgBuffer.length / 1024).toFixed(1)} KB)`);

            // 3. Run real Tesseract OCR on the image
            console.log(`   Running Tesseract OCR on image pixels...`);
            const ocrOutput = execSync(`tesseract "${imgPath}" stdout --oem 1 -l eng 2>/dev/null`, { encoding: 'utf8' });
            const cleanText = ocrOutput.replace(/\s+/g, ' ').trim();
            const lowerText = cleanText.toLowerCase();

            // 4. Verify matched keywords from the OCR text
            const matched = tab.expectedKeywords.filter(kw => lowerText.includes(kw.toLowerCase()));
            const isOk = matched.length > 0;

            console.log(`   📝 OCR Extracted Text: "${cleanText.substring(0, 150)}${cleanText.length > 150 ? '...' : ''}"`);
            console.log(`   🎯 Matched Keywords: ${matched.length > 0 ? matched.join(', ') : 'NONE'}`);
            console.log(`   Result: ${isOk ? '✅ PASSED (OCR Verified)' : '❌ FAILED'}`);

            results.push({
                index: i + 1,
                tab: tab.key,
                label: tab.label,
                imageSize: `${(imgBuffer.length / 1024).toFixed(1)} KB`,
                ocrSnippet: cleanText.substring(0, 45) + '...',
                matchedKeywords: matched.join(', ') || 'NONE',
                status: isOk ? '✅ PASSED' : '❌ FAILED'
            });
        } catch (err) {
            console.error(`   ❌ Error on ${tab.key}:`, err.message);
            results.push({
                index: i + 1,
                tab: tab.key,
                label: tab.label,
                imageSize: 'ERR',
                ocrSnippet: err.message.substring(0, 40),
                matchedKeywords: 'NONE',
                status: '❌ FAILED'
            });
        }
    }

    console.log('\n================================================================');
    console.log('📊 FINAL REAL OCR VALIDATION SUMMARY (17 TABS):');
    console.log('================================================================');
    console.table(results);

    const passCount = results.filter(r => r.status.includes('PASSED')).length;
    console.log(`\n🏆 Total: ${results.length} | ✅ Passed: ${passCount} | ❌ Failed: ${results.length - passCount}`);
}

runOCRTest().catch(console.error);
