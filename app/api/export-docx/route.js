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
            font: 'TH SarabunPSK',
            fontSize: 32, // html-to-docx uses half-points (16pt * 2)
            footer: true,
            pageNumber: true,
        };

        // Convert HTML to DOCX Buffer
        const docxBuffer = await HTMLToDOCX(html, null, docxOptions);

        // Return the binary data with correct headers
        return new Response(docxBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${filename}"`,
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
