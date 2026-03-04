import { NextResponse } from 'next/server';
import { saveAutoReportFile } from '@/lib/gdcc-db';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const configId = formData.get('configId');
        const reportDate = formData.get('reportDate');

        if (!file || !configId || !reportDate) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        // --- Security: Input Validation ---
        if (isNaN(parseInt(configId, 10))) {
            return NextResponse.json({ success: false, message: 'Invalid configId format' }, { status: 400 });
        }
        if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(reportDate)) {
            return NextResponse.json({ success: false, message: 'Invalid reportDate format. Expected YYYY-MM-DD' }, { status: 400 });
        }

        const reportsDir = path.join(process.cwd(), 'public', 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        // --- Security: Prevent Path Traversal ---
        const rawFileName = file.name || `auto_report_${Date.now()}.docx`;
        const safeFileName = path.basename(rawFileName).replace(/[^a-zA-Z0-9_\\-\\.]/g, '');

        if (!safeFileName) {
            return NextResponse.json({ success: false, message: 'Invalid filename' }, { status: 400 });
        }

        const filePath = path.join(reportsDir, safeFileName);

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        fs.writeFileSync(filePath, buffer);

        // Save DB record
        await saveAutoReportFile(parseInt(configId, 10), reportDate, fileName);

        return NextResponse.json({ success: true, message: 'File saved successfully' });
    } catch (error) {
        console.error('API Error saving file:', error.message);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
