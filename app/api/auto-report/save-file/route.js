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

        const reportsDir = path.join(process.cwd(), 'public', 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const fileName = file.name || `auto_report_${Date.now()}.docx`;
        const filePath = path.join(reportsDir, fileName);

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
