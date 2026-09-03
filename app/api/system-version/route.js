import { NextResponse } from 'next/server';

const BOOT_TIME = Date.now();

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({
        bootTime: BOOT_TIME,
        timestamp: Date.now(),
        version: '1.1.0'
    }, {
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        }
    });
}
