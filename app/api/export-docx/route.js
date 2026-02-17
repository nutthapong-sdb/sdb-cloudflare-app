import { NextResponse } from 'next/server';
import HTMLToDOCX from 'html-to-docx';

export async function POST(request) {
    try {
        const body = await request.json();
        const { html, filename = 'document.docx', title = 'Report' } = body;

        if (!html) {
            return NextResponse.json({ success: false, message: 'Missing HTML content' }, { status: 400 });
        }

        // Configure document options
        // Note: TH SarabunPSK name might need to match what Word expects
        const docxOptions = {
            title: title,
            orientation: 'portrait',
            margins: {
                top: 1440, // 1 inch
                right: 1440,
                bottom: 1440,
                left: 1440,
            },
            font: 'Arial',
            fontSize: 32, // html-to-docx uses half-points (16pt * 2)
            footer: true,
            pageNumber: true,
        };

        // Convert HTML to DOCX Buffer
        const docxBuffer = await HTMLToDOCX(html, null, docxOptions);

        if (!docxBuffer) {
            throw new Error('HTMLToDOCX returned null/undefined');
        }

        const length = docxBuffer.length || docxBuffer.byteLength || 0;
        console.log(`DOCX Generation: Buffer Type: ${docxBuffer.constructor.name}, Length: ${length}`);

        if (length < 2000) { // Standard empty docx is around 20k
            console.warn('DOCX Buffer is suspiciously small:', length);
        }

        // Ensure we have a Buffer/Uint8Array for the Response
        const responseData = Buffer.isBuffer(docxBuffer) ? docxBuffer : Buffer.from(docxBuffer);

        // Return the binary data with correct headers
        return new Response(responseData, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': responseData.length.toString(),
            },
        });


    } catch (error) {
        console.error('DOCX Export Error:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to generate DOCX',
            error: error.message
        }, { status: 500 });
    }
}
