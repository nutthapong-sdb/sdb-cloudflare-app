import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET() {
    const host = process.env.CHROME_HOST || '127.0.0.1';
    
    const results = {
        host_configured: host,
        vnc_port_5800: null,
        debug_port_9222: null
    };

    // Test VNC Port
    try {
        const res5800 = await axios.get(`http://${host}:5800/`, { timeout: 5000 });
        results.vnc_port_5800 = { success: true, status: res5800.status };
    } catch (e) {
        results.vnc_port_5800 = { success: false, error: e.message };
    }

    // Test Debugging Port
    try {
        const res9222 = await axios.get(`http://${host}:9222/json/version`, { timeout: 5000 });
        results.debug_port_9222 = { success: true, status: res9222.status, browser: res9222.data.Browser };
    } catch (e) {
        results.debug_port_9222 = { success: false, error: e.message };
    }

    return NextResponse.json(results);
}
