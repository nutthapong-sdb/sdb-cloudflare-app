import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET() {
    let host = process.env.CHROME_HOST || '127.0.0.1';
    
    // Resolve hostname to IP to bypass Chromium's DNS Rebinding protection
    if (host !== 'localhost' && host !== '127.0.0.1') {
        try {
            const dns = await import('dns');
            host = await new Promise((resolve, reject) => {
                dns.lookup(host, (err, address) => err ? reject(err) : resolve(address));
            });
        } catch (e) {
            console.warn(`Could not resolve CHROME_HOST ${host}`);
        }
    }

    const results = {
        host_configured: process.env.CHROME_HOST || '127.0.0.1',
        host_resolved: host,
        vnc_port_5800: null,
        vnc_file_vnchtml: null,
        vnc_file_indexhtml: null,
        debug_port_9222: null
    };

    // Test VNC Port Base
    try {
        const res5800 = await axios.get(`http://${host}:5800/`, { timeout: 5000 });
        results.vnc_port_5800 = { success: true, status: res5800.status };
    } catch (e) {
        results.vnc_port_5800 = { success: false, error: e.message, status: e.response?.status };
    }

    // Test VNC vnc.html
    try {
        const resVncHtml = await axios.get(`http://${host}:5800/vnc.html`, { timeout: 5000 });
        results.vnc_file_vnchtml = { success: true, status: resVncHtml.status };
    } catch (e) {
        results.vnc_file_vnchtml = { success: false, error: e.message, status: e.response?.status };
    }

    // Test VNC index.html
    try {
        const resIndexHtml = await axios.get(`http://${host}:5800/index.html`, { timeout: 5000 });
        results.vnc_file_indexhtml = { success: true, status: resIndexHtml.status };
    } catch (e) {
        results.vnc_file_indexhtml = { success: false, error: e.message, status: e.response?.status };
    }

    // Test Debugging Port
    try {
        const res9222 = await axios.get(`http://${host}:9222/json/version`, { 
            headers: { 'Host': 'localhost' }, 
            timeout: 5000 
        });
        results.debug_port_9222 = { success: true, status: res9222.status, browser: res9222.data.Browser };
    } catch (e) {
        results.debug_port_9222 = { success: false, error: e.message };
    }

    return NextResponse.json(results);
}
