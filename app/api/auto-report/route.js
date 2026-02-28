import { NextResponse } from 'next/server';
import {
    getAutoReportConfigs,
    saveAutoReportConfig,
    deleteAutoReportConfig,
    deleteAutoReportFile
} from '@/lib/gdcc-db';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const configs = await getAutoReportConfigs();
        return NextResponse.json({ success: true, data: configs });
    } catch (error) {
        console.error('API Error:', error.message);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'create-config') {
            const { accountId, accountName, zoneId, zoneName, subdomain, targetDate, intervalDays, templateId } = body;

            if (!accountId || !zoneId || !subdomain || !targetDate || !intervalDays) {
                return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
            }

            const id = await saveAutoReportConfig(accountId, accountName, zoneId, zoneName, subdomain, targetDate, intervalDays, templateId);
            return NextResponse.json({ success: true, data: { id } });
        }
        else {
            return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('API Error:', error.message);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const url = new URL(request.url);
        const action = url.searchParams.get('action');
        const id = url.searchParams.get('id');

        if (!id) return NextResponse.json({ success: false, message: 'Missing ID' }, { status: 400 });

        if (action === 'delete-config') {
            // 1. Fetch file names before deleting from DB
            const { getAutoReportFiles } = await import('@/lib/gdcc-db');
            const files = await getAutoReportFiles(id);

            // 2. Delete physical files
            for (const file of files) {
                try {
                    const filePath = path.join(process.cwd(), 'public', 'reports', file.file_name);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`🗑️ Deleted config file: ${file.file_name}`);
                    }
                } catch (err) {
                    console.error(`❌ Failed to delete file ${file.file_name}:`, err.message);
                }
            }

            // 3. Delete from DB (Cascade will handle gdcc_auto_report_files table)
            await deleteAutoReportConfig(id);
            return NextResponse.json({ success: true, message: 'Config and associated files deleted successfully' });
        }
        else if (action === 'delete-file') {
            const fileName = url.searchParams.get('fileName');
            // Try to delete physical file if name is provided
            if (fileName) {
                try {
                    const filePath = path.join(process.cwd(), 'public', 'reports', fileName);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (err) {
                    console.error('Failed to delete physical file:', err.message);
                }
            }
            // Delete DB record
            await deleteAutoReportFile(id);
            return NextResponse.json({ success: true, message: 'File deleted successfully' });
        }
        else {
            return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('API Error:', error.message);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
