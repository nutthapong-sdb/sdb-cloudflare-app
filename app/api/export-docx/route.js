import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import libreoffice from 'libreoffice-convert';
import HTMLtoDOCX from 'html-to-docx';

const execAsync = promisify(exec);
const convertAsync = promisify(libreoffice.convert);

export async function POST(request) {
    let tempInputPath = null;
    let tempOutputPath = null;

    try {
        const contentType = request.headers.get('content-type') || '';

        let html;
        let filename = 'document.docx';
        let title;

        if (contentType.includes('application/json')) {
            const body = await request.json();
            html = body?.html;
            filename = body?.filename || filename;
            title = body?.title;
        } else {
            // Support form POST to allow browsers to download as a normal file
            // (avoids programmatic download restrictions in some browsers)
            const form = await request.formData();
            html = form.get('html');
            filename = form.get('filename') || filename;
            title = form.get('title');
        }

        html = typeof html === 'string' ? html : (html ? String(html) : '');
        filename = typeof filename === 'string' ? filename : String(filename);

        // Pre-process HTML content to convert local image URLs into base64 strings so they render in the downloaded Word file
        if (html) {
            const fsNode = require('fs');
            const pathNode = require('path');
            const publicDir = pathNode.join(process.cwd(), 'public');
            
            console.log("📄 Pre-processing HTML images for Word export...");
            
            // Search for any img tag and inspect its src attribute
            const imgTagRegex = /<img[^>]+src=["']([^"']+)["']/gi;
            let match;
            let modifiedHtml = html;
            
            while ((match = imgTagRegex.exec(html)) !== null) {
                let rawSrc = match[1];
                console.log(`🔍 Found image tag with src: "${rawSrc}"`);
                
                // Decode URL entities (e.g. %20, %3F, etc.)
                let decodedSrc = rawSrc;
                try {
                    decodedSrc = decodeURIComponent(rawSrc);
                } catch (e) {
                    console.warn(`Could not decode URI components of src: ${rawSrc}`);
                }
                
                // Extract clean filename from query string or folder path
                let imgFile = decodedSrc;
                if (imgFile.includes('?')) {
                    imgFile = imgFile.split('?')[0];
                }
                if (imgFile.includes('/')) {
                    imgFile = imgFile.substring(imgFile.lastIndexOf('/') + 1);
                }
                
                console.log(`   Cleaned filename target: "${imgFile}"`);
                
                if (imgFile.startsWith('captured-') && imgFile.endsWith('.png')) {
                    const localImgPath = pathNode.join(publicDir, imgFile);
                    console.log(`   Looking for local image file at: "${localImgPath}"`);
                    
                    try {
                        if (fsNode.existsSync(localImgPath)) {
                            const imgBuffer = fsNode.readFileSync(localImgPath);
                            const imgBase64 = imgBuffer.toString('base64');
                            
                            // Replace this exact raw src attribute in the HTML
                            const dataUri = `data:image/png;base64,${imgBase64}`;
                            // Use direct string replace to be safe against regex escaping issues
                            modifiedHtml = modifiedHtml.split(`src="${rawSrc}"`).join(`src="${dataUri}"`);
                            modifiedHtml = modifiedHtml.split(`src='${rawSrc}'`).join(`src='${dataUri}'`);
                            console.log(`   ✅ Successfully inlined local image "${imgFile}"`);
                        } else {
                            console.warn(`   ❌ Image file does NOT exist on disk: "${localImgPath}"`);
                        }
                    } catch (err) {
                        console.warn(`   ❌ Error reading image file "${imgFile}":`, err.message);
                    }
                }
            }
            html = modifiedHtml;
        }

        if (!html) {
            return NextResponse.json({ success: false, message: 'Missing HTML content' }, { status: 400 });
        }

        // --- Security: Prevent HTTP Header Injection ---
        const safeFileName = path.basename(filename).replace(/[^a-zA-Z0-9_\\-\\.]/g, '');
        const finalFileName = safeFileName || 'document.docx';

        let docxBuffer = null;

        // ---------------------------------------------------------
        // Cross-Platform Conversion Logic (Headless)
        // ---------------------------------------------------------
        // IMPORTANT: Do not use Microsoft Word/AppleScript here.
        // That opens the Word app on the host and is not "normal download" behavior.

        // 1) First try pure-JS HTML -> DOCX. No external apps/binaries.
        try {
            console.log('🔄 Converting to DOCX using html-to-docx...');
            // html-to-docx returns a Buffer/Uint8Array
            docxBuffer = await HTMLtoDOCX(String(html), null, {
                // Keep defaults; avoid fancy options for stability
            });
        } catch (e) {
            console.warn('html-to-docx failed, falling back to LibreOffice:', e?.message || e);
            docxBuffer = null;
        }

        // 2) Try libreoffice-convert (in-memory, headless).
        if (!docxBuffer) {
            try {
                console.log('🔄 Converting to DOCX using libreoffice-convert...');
                const input = Buffer.from(String(html), 'utf-8');
                docxBuffer = await convertAsync(input, '.docx');
            } catch (e) {
                console.warn('libreoffice-convert failed, falling back to soffice CLI:', e?.message || e);
                docxBuffer = null;
            }
        }

        // 3) Fallback to LibreOffice CLI if convertAsync isn't available.
        if (!docxBuffer) {
            const tmpDir = path.join(os.tmpdir(), 'WordConversion');
            await fs.mkdir(tmpDir, { recursive: true });

            const timestamp = Date.now();
            const safeBaseName = `api_report_${timestamp}`;
            const inputPath = path.join(tmpDir, `${safeBaseName}.html`);
            const outputPath = path.join(tmpDir, `${safeBaseName}.docx`);
            tempInputPath = inputPath;
            tempOutputPath = outputPath;

            await fs.writeFile(inputPath, html, 'utf-8');

            const command = `soffice --headless --infilter="HTML Document" --convert-to "docx:MS Word 2007 XML" --outdir "${tmpDir}" "${inputPath}"`;
            console.log(`LibreOffice Command: ${command}`);

            try {
                const { stderr } = await execAsync(command, { env: { ...process.env, HOME: '/tmp' } });
                if (stderr) console.warn(`LibreOffice Stderr: ${stderr}`);
            } catch (cmdErr) {
                console.error('LibreOffice Exec failed:', cmdErr);
                throw new Error(`LibreOffice failed: ${cmdErr.message}`);
            }

            try {
                await fs.access(outputPath);
            } catch {
                throw new Error('Conversion failed: Output file not created by LibreOffice.');
            }

            docxBuffer = await fs.readFile(outputPath);
        }

        console.log(`✅ API Conversion successful. Buffer length: ${docxBuffer.length}`);

        // 5. Return the new DOCX
        return new Response(docxBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${finalFileName}"`,
                'Content-Length': docxBuffer.length.toString(),
            },
        });

    } catch (error) {
        console.error('DOCX Export/Conversion Error:', error);
        return NextResponse.json({
            success: false,
            message: 'Failed to convert to DOCX. Make sure LibreOffice is installed and available to the server runtime.',
            error: error.message
        }, { status: 500 });
    } finally {
        // Cleanup temp files safely
        if (tempInputPath) {
            try { await fs.unlink(tempInputPath); } catch (e) { }
        }
        if (tempOutputPath) {
            try { await fs.unlink(tempOutputPath); } catch (e) { }
        }
    }
}
