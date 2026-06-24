import puppeteer from 'puppeteer';
import axios from 'axios';

export async function connectChrome() {
    const host = process.env.CHROME_HOST || 'localhost';
    const port = 9222;
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
