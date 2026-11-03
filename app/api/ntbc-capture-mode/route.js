import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

// How reports get their Cloudflare page images (tab 2, "ตั้งค่าการแคปรูปภาพ"):
// 'captured' (screenshots cropped with the template's preset), 'inapp' (tables built from the
// API data) or 'uploaded' (images uploaded by hand). Kept on the server so the background
// worker's Chrome tab builds reports the same way as the browser that set it.
const filePath = path.join(process.cwd(), 'app', 'data', 'ntbc_capture_mode.json');
const MODES = ['captured', 'inapp', 'uploaded'];

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const saved = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
        return NextResponse.json({ success: true, mode: MODES.includes(saved?.mode) ? saved.mode : 'captured' });
    } catch (e) {
        console.error('Error reading ntbc_capture_mode.json:', e);
        return NextResponse.json({ success: true, mode: 'captured' });
    }
}

export async function POST(req) {
    try {
        const { mode } = await req.json();
        if (!MODES.includes(mode)) {
            return NextResponse.json({ success: false, error: `mode must be one of ${MODES.join(', ')}` }, { status: 400 });
        }
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify({ mode }, null, 2), 'utf8');
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Error writing ntbc_capture_mode.json:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
