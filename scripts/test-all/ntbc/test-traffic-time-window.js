const puppeteer = require('puppeteer');

(async () => {
    console.log('🚀 Starting End-to-End Test for HTTP Traffic Time Window (1 Day vs 30 Days)...');
    let uiBrowser = null;
    let cfBrowser = null;

    try {
        // Connect directly to the Cloudflare Browser (port 9222)
        console.log('🔌 Connecting to remote Cloudflare Browser (chrome-browser:9222)...');
        const dns = require('dns');
        const axios = require('axios');
        
        let host = 'chrome-browser';
        host = await new Promise((resolve, reject) => {
            dns.lookup(host, (err, address) => err ? reject(err) : resolve(address));
        });
        
        const res = await axios.get(`http://${host}:9222/json/version`, { headers: { 'Host': 'localhost' } });
        const wsUrlObj = new URL(res.data.webSocketDebuggerUrl);
        const wsUrl = `ws://${host}:9222${wsUrlObj.pathname}${wsUrlObj.search}`;
        
        cfBrowser = await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });

        const pages = await cfBrowser.pages();
        let cfPage = pages.find(p => p.url().includes('dash.cloudflare.com'));
        
        if (!cfPage) {
            cfPage = pages[0]; // fallback
            await cfPage.goto('https://dash.cloudflare.com/');
            await new Promise(r => setTimeout(r, 3000));
        }
        await cfPage.bringToFront();

        // Extract Account ID from current URL
        const currentUrl = cfPage.url();
        const accountMatch = currentUrl.match(/dash\.cloudflare\.com\/([a-z0-9]+)/i);
        if (!accountMatch) {
            throw new Error('Could not find Cloudflare Account ID in URL. Is the browser logged in?');
        }
        const accountId = accountMatch[1];
        const domain = 'log.softdebut.online';

        // Function to navigate and extract requests
        const testTimeWindow = async (label, queryStr) => {
            console.log(`\n⏳ Testing Time Window: [${label}]`);
            const targetUrl = `https://dash.cloudflare.com/${accountId}/${domain}/analytics/traffic${queryStr}`;
            
            console.log(`▶️ Navigating to: ${targetUrl}`);
            await cfPage.goto(targetUrl, { waitUntil: 'load' });
            
            console.log('🕒 Waiting 15 seconds for Cloudflare to render the metrics...');
            await new Promise(r => setTimeout(r, 15000));

            // Take screenshot to prove it loaded
            const screenshotName = `traffic_${label.replace(/\s+/g, '')}.png`;
            await cfPage.screenshot({ path: `/app/${screenshotName}`, fullPage: false });
            console.log(`📸 Saved screenshot as ${screenshotName}`);

            // Extract Total Requests number (just dump to file for debugging)
            const innerText = await cfPage.evaluate(() => document.body.innerText);
            const fs = require('fs');
            fs.writeFileSync(`/app/traffic_${label.replace(/\s+/g, '')}_text.txt`, innerText);
            
            // Basic regex attempt
            let extractedNumber = "COULD_NOT_PARSE_SPECIFIC_NUMBER";
            const match = innerText.match(/Total Requests[^\d]*([\d,.]+[KMBkmb]?)/i) || innerText.match(/Requests[^\d]*([\d,.]+[KMBkmb]?)/i);
            if (match) {
                extractedNumber = match[1];
            }


            console.log(`📊 Extracted Requests for ${label}: ${extractedNumber}`);
            return extractedNumber;
        };

        // Test 1 Day
        const value1Day = await testTimeWindow('1 Day', '?time-window=1440');
        
        // Let it rest
        await new Promise(r => setTimeout(r, 3000));

        // Test 30 Days
        const value30Days = await testTimeWindow('30 Days', '?time-window=43200');

        console.log('\n=========================================');
        console.log(`📈 RESULTS:`);
        console.log(`- 1 Day Traffic:  ${value1Day}`);
        console.log(`- 30 Days Traffic: ${value30Days}`);
        console.log('=========================================');

        if (value1Day !== value30Days && value1Day !== "COULD_NOT_PARSE_SPECIFIC_NUMBER" && value30Days !== "COULD_NOT_PARSE_SPECIFIC_NUMBER") {
            console.log('✅ TEST PASSED: The numbers changed successfully between 1 Day and 30 Days!');
        } else {
            console.log('❌ TEST FAILED or INCONCLUSIVE: The numbers did not change, or could not be parsed.');
        }

    } catch (error) {
        console.error('❌ Test execution failed:', error);
    } finally {
        if (cfBrowser) {
            console.log('🛑 Disconnecting from Cloudflare browser...');
            cfBrowser.disconnect();
        }
    }
})();
