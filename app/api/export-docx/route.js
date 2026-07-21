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
            // Clean up any tables nested inside p, span, or div tags, which html-to-docx would discard
            let cleanedHtml = html;
            let previousHtml;
            do {
                previousHtml = cleanedHtml;
                cleanedHtml = cleanedHtml.replace(/<p[^>]*>\s*(<table[\s\S]*?<\/table>)\s*<\/p>/gi, '$1');
                cleanedHtml = cleanedHtml.replace(/<span[^>]*>\s*(<table[\s\S]*?<\/table>)\s*<\/span>/gi, '$1');
                cleanedHtml = cleanedHtml.replace(/<div[^>]*>\s*(<table[\s\S]*?<\/table>)\s*<\/div>/gi, '$1');
            } while (cleanedHtml !== previousHtml);
            
            // Clean up any inline style width on td/th elements to prevent html-to-docx crash
            // We find any <td style="... width: XXX; ..."> and convert it to <td style="..." width="XXX">
            cleanedHtml = cleanedHtml.replace(/(<(?:td|th)\b[^>]*\bstyle=["'])([^"']*?)\bwidth:\s*([^;]+);?\s*([^"']*)(["'])/gi, (match, prefix, styleStart, widthVal, styleEnd, suffix) => {
                const newStyle = (styleStart + styleEnd).trim().replace(/;\s*;/g, ';');
                if (match.includes(' width=')) {
                    return `${prefix}${newStyle}${suffix}`;
                } else {
                    return `${prefix}${newStyle}${suffix} width="${widthVal.trim()}"`;
                }
            });

            // Normalize img tags to ensure width/height are in inline style (supported by html-to-docx)
            cleanedHtml = cleanedHtml.replace(/<img\b([^>]*)>/gi, (imgTag) => {
                const widthAttrMatch = imgTag.match(/\bwidth=["']?(\d+)(?:px)?["']?/i);
                const heightAttrMatch = imgTag.match(/\bheight=["']?(\d+)(?:px|%)?["']?/i);
                
                let width = widthAttrMatch ? parseInt(widthAttrMatch[1], 10) : null;
                let height = heightAttrMatch ? heightAttrMatch[1] : null;

                const styleAttrMatch = imgTag.match(/\bstyle=["']([^"']*)["']/i);
                let styleContent = styleAttrMatch ? styleAttrMatch[1] : '';

                const styleWidthMatch = styleContent.match(/\bwidth:\s*([^;]+)/i);
                const styleHeightMatch = styleContent.match(/\bheight:\s*([^;]+)/i);

                if (styleWidthMatch) {
                    const wVal = styleWidthMatch[1].trim();
                    const numMatch = wVal.match(/^(\d+)(?:px)?$/);
                    if (numMatch) {
                        width = parseInt(numMatch[1], 10);
                    } else {
                        width = wVal;
                    }
                }
                if (styleHeightMatch) {
                    height = styleHeightMatch[1].trim();
                }

                let cleanedTag = imgTag
                    .replace(/\bstyle=["']([^"']*)["']/gi, '')
                    .replace(/\bwidth=["']?([^"']*)["']?/gi, '')
                    .replace(/\bheight=["']?([^"']*)["']?/gi, '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .replace(/\/?>$/, '');

                let newStyles = [];
                
                if (width !== null) {
                    const widthStr = typeof width === 'number' ? `${width}px` : width;
                    newStyles.push(`width: ${widthStr}`);
                }
                if (height !== null) {
                    const heightStr = /^\d+$/.test(height) ? `${height}px` : height;
                    newStyles.push(`height: ${heightStr}`);
                }

                if (styleContent) {
                    const parts = styleContent.split(';');
                    parts.forEach(part => {
                        const trimmed = part.trim();
                        if (trimmed && !trimmed.toLowerCase().startsWith('width') && !trimmed.toLowerCase().startsWith('height')) {
                            newStyles.push(trimmed);
                        }
                    });
                }

                const finalStyle = newStyles.join('; ');
                return `${cleanedTag} style="${finalStyle}" />`;
            });

            html = cleanedHtml;

            const fsNode = require('fs');
            const pathNode = require('path');
            const publicDir = pathNode.join(process.cwd(), 'public');
            
            console.log("📄 Pre-processing HTML images for Word export...");
            
            const inlineImageSource = async (src) => {
                if (src.startsWith('data:')) {
                    return src;
                }
                
                let decodedSrc = src;
                try {
                    decodedSrc = decodeURIComponent(src);
                } catch (e) {}

                // 1) Relative local paths (e.g. /tinymce/plugins/... or /captured-dashboard.png)
                if (decodedSrc.startsWith('/') && !decodedSrc.startsWith('//')) {
                    const localImgPath = pathNode.join(publicDir, decodedSrc);
                    try {
                        if (fsNode.existsSync(localImgPath)) {
                            const imgBuffer = fsNode.readFileSync(localImgPath);
                            const mimeType = decodedSrc.endsWith('.png') ? 'image/png' : 'image/jpeg';
                            return `data:${mimeType};base64,${imgBuffer.toString('base64')}`;
                        }
                    } catch (err) {
                        console.warn(`Failed to read local relative image: ${localImgPath}`, err.message);
                    }
                }
                
                // 2) Absolute local host URLs or external remote URLs
                if (decodedSrc.startsWith('http://') || decodedSrc.startsWith('https://')) {
                    try {
                        const urlObj = new URL(decodedSrc);
                        // Check if it points to localhost or standard development port
                        if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1' || urlObj.port === '8002') {
                            const localImgPath = pathNode.join(publicDir, urlObj.pathname);
                            if (fsNode.existsSync(localImgPath)) {
                                const imgBuffer = fsNode.readFileSync(localImgPath);
                                const mimeType = urlObj.pathname.endsWith('.png') ? 'image/png' : 'image/jpeg';
                                return `data:${mimeType};base64,${imgBuffer.toString('base64')}`;
                            }
                        }
                    } catch (e) {}

                    // Fetch remote or external URL with a timeout safety gate
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 5000);
                        const res = await fetch(decodedSrc, { signal: controller.signal });
                        clearTimeout(timeoutId);
                        
                        if (res.ok) {
                            const arrayBuffer = await res.arrayBuffer();
                            const buffer = Buffer.from(arrayBuffer);
                            const mime = res.headers.get('content-type') || 'image/jpeg';
                            return `data:${mime};base64,${buffer.toString('base64')}`;
                        }
                    } catch (err) {
                        console.warn(`Failed to fetch remote image: ${decodedSrc}`, err.message);
                    }
                }

                // 3) Fallback: search by basename directly in public folder (e.g. captured-dashboard.png)
                let imgFile = decodedSrc;
                if (imgFile.includes('?')) imgFile = imgFile.split('?')[0];
                if (imgFile.includes('/')) imgFile = imgFile.substring(imgFile.lastIndexOf('/') + 1);
                
                const fallbackPath = pathNode.join(publicDir, imgFile);
                try {
                    if (fsNode.existsSync(fallbackPath)) {
                        const imgBuffer = fsNode.readFileSync(fallbackPath);
                        const mimeType = imgFile.endsWith('.png') ? 'image/png' : 'image/jpeg';
                        return `data:${mimeType};base64,${imgBuffer.toString('base64')}`;
                    }
                } catch (e) {}

                return src;
            };

            const imgTagRegex = /<img[^>]+src=["']([^"']+)["']/gi;
            let match;
            let modifiedHtml = html;
            const srcList = new Set();
            
            while ((match = imgTagRegex.exec(html)) !== null) {
                srcList.add(match[1]);
            }
            
            for (const rawSrc of srcList) {
                if (rawSrc.startsWith('data:')) {
                    continue;
                }
                console.log(`🔍 Processing image tag with src: "${rawSrc}"`);
                const dataUri = await inlineImageSource(rawSrc);
                if (dataUri !== rawSrc) {
                    modifiedHtml = modifiedHtml.split(`src="${rawSrc}"`).join(`src="${dataUri}"`);
                    modifiedHtml = modifiedHtml.split(`src='${rawSrc}'`).join(`src='${dataUri}'`);
                    console.log(`   ✅ Inlined successfully: "${rawSrc.substring(0, 60)}..."`);
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
                font: 'TH Sarabun PSK',
                fontSize: 32
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
