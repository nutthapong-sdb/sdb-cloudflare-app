import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const filePath = path.join(process.cwd(), 'app', 'data', 'capture_coords.json');

export const dynamic = 'force-dynamic';

const DEFAULT_COORDS = {
    domains: { xStart: '395', xEnd: '1785', yStart: '85', yEnd: '' },
    dns: { xStart: '365', xEnd: '1843', yStart: '95', yEnd: '' },
    traffic: { xStart: '422', xEnd: '1766', yStart: '105', yEnd: '1005' },
    firewall: { xStart: '288', xEnd: '1728', yStart: '115', yEnd: '980' },
    securityRules: { xStart: '350', xEnd: '1880', yStart: '85', yEnd: '' },
    argo: { xStart: '520', xEnd: '1632', yStart: '90', yEnd: '600' },
    speed: { xStart: '480', xEnd: '1632', yStart: '115', yEnd: '870' },
    speedMobile: { xStart: '480', xEnd: '1632', yStart: '95', yEnd: '850' },
    botManagement: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '750' },
    securityLevel: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '850' },
    sslOverview: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '800' },
    sslEdge: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '900' },
    rateLimiting: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '' },
    managedRules: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '' },
    ipAccess: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '' },
    zoneLockdown: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '' },
    trafficCountries: { xStart: '350', xEnd: '1880', yStart: '100', yEnd: '950' },
    topEventsSource: { xStart: '288', xEnd: '1728', yStart: '100', yEnd: '950' }
};

export async function GET() {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return NextResponse.json(JSON.parse(data));
        }
        return NextResponse.json(DEFAULT_COORDS);
    } catch (e) {
        console.error('Error reading capture_coords.json:', e);
        return NextResponse.json(DEFAULT_COORDS);
    }
}

export async function POST(req) {
    try {
        const coords = await req.json();
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(coords, null, 2), 'utf8');
        return NextResponse.json({ success: true, message: 'Coordinates saved successfully to central database.' });
    } catch (e) {
        console.error('Error writing capture_coords.json:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
