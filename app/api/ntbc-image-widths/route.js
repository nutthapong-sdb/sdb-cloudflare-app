import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

// Report image display widths (Image Size Settings), keyed by the ImageSettingsModal config key.
// Kept on the server so every browser — including the background worker's Chrome tab — builds
// reports with the same sizes, instead of each browser's own localStorage.
const filePath = path.join(process.cwd(), 'app', 'data', 'ntbc_image_widths.json');

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        if (fs.existsSync(filePath)) {
            return NextResponse.json({ success: true, widths: JSON.parse(fs.readFileSync(filePath, 'utf8')) });
        }
        return NextResponse.json({ success: true, widths: null });
    } catch (e) {
        console.error('Error reading ntbc_image_widths.json:', e);
        return NextResponse.json({ success: false, error: e.message, widths: null }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const { widths } = await req.json();
        if (!widths || typeof widths !== 'object') {
            return NextResponse.json({ success: false, error: 'widths is required' }, { status: 400 });
        }
        const clean = {};
        for (const [k, v] of Object.entries(widths)) {
            const n = parseInt(v, 10);
            if (Number.isFinite(n) && n > 0) clean[k] = n;
        }
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(clean, null, 2), 'utf8');
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Error writing ntbc_image_widths.json:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
