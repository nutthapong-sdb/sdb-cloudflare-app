import puppeteer from 'puppeteer';
import axios from 'axios';

import dns from 'dns';

export async function connectChrome() {
    let host = process.env.CHROME_HOST || 'localhost';
    const port = 9222;
    
    // Resolve hostname to IP to bypass Chromium's DNS Rebinding protection (which blocks non-localhost hostnames but allows IPs)
    if (host !== 'localhost' && host !== '127.0.0.1') {
        try {
            host = await new Promise((resolve, reject) => {
                dns.lookup(host, (err, address) => err ? reject(err) : resolve(address));
            });
            console.log(`Resolved CHROME_HOST to IP: ${host}`);
        } catch (e) {
            console.warn(`Could not resolve CHROME_HOST ${host}, proceeding with hostname.`);
        }
    }

    const url = `http://${host}:${port}/json/version`;
    
    console.log(`Connecting to Chrome at ${host}:${port} via WS discovery...`);
    
    try {
        const res = await axios.get(url, {
            headers: {
                'Host': 'localhost' // Bypass Chromium Host header check
            }
        });
        const data = res.data;
        
        // Extract the WebSocket path to avoid issues if the returned URL lacks the port
        const wsUrlObj = new URL(data.webSocketDebuggerUrl);
        const wsUrl = `ws://${host}:${port}${wsUrlObj.pathname}${wsUrlObj.search}`;
        console.log(`WS debugger URL resolved: ${wsUrl}`);
        
        return await puppeteer.connect({
            browserWSEndpoint: wsUrl,
            defaultViewport: null
        });
    } catch (err) {
        console.error(`Failed to connect to Chromium at ${host}:${port}:`, err.message);
        throw err;
    }
}
