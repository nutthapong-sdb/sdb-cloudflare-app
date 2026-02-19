import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import libreoffice from 'libreoffice-convert';
import { promisify } from 'util';

const convertAsync = promisify(libreoffice.convert);

export async function POST(request) {
    let tempDocPath = null;
    let outputPath = null;

    try {
        const body = await request.json();
        const { html, filename = 'document.docx' } = body;

        if (!html) {
            return NextResponse.json({ success: false, message: 'Missing HTML content' }, { status: 400 });
        }

        // 1. Create a temporary file path
        const tmpDir = os.tmpdir();
        const timestamp = Date.now();
        const baseName = `report_${timestamp}`;
        tempDocPath = path.join(tmpDir, `${baseName}.html`); // Using .html as input for LibreOffice is safer for MHTML/HTML content
        // Note: We save as .html because LibreOffice handles HTML -> DOCX conversion very well. 
        // If we saved as .doc (MHTML), it might be tricky relying on extensions.
        // Actually, the user's content IS HTML.

        // 2. Prepare Buffer (Skip file write, use buffer directly)
        const inputBuffer = Buffer.from(html, 'utf-8');


        // 3. Convert to DOCX using LibreOffice
        // libreoffice-convert takes a buffer.

        console.log('🔄 Converting to DOCX using LibreOffice...');
        const docxBuffer = await convertAsync(inputBuffer, '.docx', undefined);

        console.log(`✅ Conversion successful. Buffer length: ${docxBuffer.length}`);

        // 4. Return the new DOCX
        return new Response(docxBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': docxBuffer.length.toString(),
            },
        });

    } catch (error) {
        console.error('DOCX Export/Conversion Error:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to convert to DOCX',
            error: error.message
        }, { status: 500 });
    } finally {
        // cleanup if we used files, but here we used buffer with library
    }
}
