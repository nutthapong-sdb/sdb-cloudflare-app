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
            
            // Ensure <table> tags are centered and have raw border attributes for LibreOffice compatibility
            cleanedHtml = cleanedHtml.replace(/<table\b([^>]*)>/gi, (tableTag) => {
                let tag = tableTag;
                
                // Add align="center" if not present
                if (!/\balign=/i.test(tag)) {
                    tag = tag.replace('<table', '<table align="center"');
                }
                
                // Add border="1" if not present
                if (!/\bborder=/i.test(tag)) {
                    tag = tag.replace('<table', '<table border="1"');
                }
                
                // Add inline border-collapse if style is present, or add a style attribute
                if (/\bstyle=["']/i.test(tag)) {
                    tag = tag.replace(/\bstyle=["']([^"']*)["']/i, (match, styleContent) => {
                        let newStyle = styleContent;
                        if (!/\bborder-collapse/i.test(newStyle)) {
                            newStyle += '; border-collapse: collapse';
                        }
                        if (!/\bborder\s*:/i.test(newStyle)) {
                            newStyle += '; border: 1px solid #000000';
                        }
                        return `style="${newStyle.trim().replace(/^;+/g, '').replace(/;+/g, ';')}"`;
                    });
                } else {
                    tag = tag.replace('<table', '<table style="border-collapse: collapse; border: 1px solid #000000;"');
                }
                
                return tag;
            });

            // Inline the border styles to all th/td tags to ensure LibreOffice renders all cell borders completely
            cleanedHtml = cleanedHtml.replace(/<(td|th)\b([^>]*)>/gi, (cellTag, tagName, attributes) => {
                let newCellTag = cellTag;
                
                if (/\bstyle=["']/i.test(newCellTag)) {
                    newCellTag = newCellTag.replace(/\bstyle=["']([^"']*)["']/i, (match, styleContent) => {
                        let newStyle = styleContent;
                        if (!/\bborder\s*:/i.test(newStyle)) {
                            newStyle += '; border: 1px solid #000000';
                        }
                        if (!/\bpadding\s*:/i.test(newStyle)) {
                            newStyle += '; padding: 5px';
                        }
                        return `style="${newStyle.trim().replace(/^;+/g, '').replace(/;+/g, ';')}"`;
                    });
                } else {
                    newCellTag = `<${tagName} ${attributes} style="border: 1px solid #000000; padding: 5px;">`;
                }
                
                return newCellTag;
            });

            // Normalize img tags to ensure width/height are in inline style (supported by html-to-docx)
            // and raw attributes (required by LibreOffice to avoid distortion)
            cleanedHtml = cleanedHtml.replace(/<img\b([^>]*)>/gi, (imgTag) => {
                const widthAttrMatch = imgTag.match(/\bwidth=["']?(\d+)(?:px|%)?["']?/i);
                const heightAttrMatch = imgTag.match(/\bheight=["']?(\d+)(?:px|%)?["']?/i);
                
                let width = widthAttrMatch ? widthAttrMatch[1] : null;
                let height = heightAttrMatch ? heightAttrMatch[1] : null;

                const styleAttrMatch = imgTag.match(/\bstyle=["']([^"']*)["']/i);
                let styleContent = styleAttrMatch ? styleAttrMatch[1] : '';

                const styleWidthMatch = styleContent.match(/\bwidth:\s*([^;]+)/i);
                const styleHeightMatch = styleContent.match(/\bheight:\s*([^;]+)/i);

                if (styleWidthMatch) {
                    const wVal = styleWidthMatch[1].trim();
                    const numMatch = wVal.match(/^(\d+)(?:px|%)?$/);
                    if (numMatch) {
                        width = numMatch[1];
                    } else {
                        width = wVal;
                    }
                }
                if (styleHeightMatch) {
                    const hVal = styleHeightMatch[1].trim();
                    const numMatch = hVal.match(/^(\d+)(?:px|%)?$/);
                    if (numMatch) {
                        height = numMatch[1];
                    } else {
                        height = hVal;
                    }
                }

                let cleanedTag = imgTag
                    .replace(/\bstyle=["']([^"']*)["']/gi, '')
                    .replace(/\bwidth=["']?([^"']*)["']?/gi, '')
                    .replace(/\bheight=["']?([^"']*)["']?/gi, '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .replace(/\/?>$/, '');

                let newStyles = [];
                let widthAttr = '';
                let heightAttr = '';
                
                if (width !== null) {
                    const widthStr = /^\d+$/.test(width) ? `${width}px` : width;
                    newStyles.push(`width: ${widthStr}`);
                    const rawWidth = String(width).replace('px', '');
                    widthAttr = ` width="${rawWidth}"`;
                }
                if (height !== null) {
                    const heightStr = /^\d+$/.test(height) ? `${height}px` : height;
                    newStyles.push(`height: ${heightStr}`);
                    const rawHeight = String(height).replace('px', '');
                    heightAttr = ` height="${rawHeight}"`;
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
                return `${cleanedTag}${widthAttr}${heightAttr} style="${finalStyle}" />`;
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
            // Force TH Sarabun font-family on all elements to ensure all elements (including h1/h2/h3) render in TH Sarabun
            const fontOverrideStyle = `<style>
                * { font-family: 'TH Sarabun PSK', 'TH Sarabun New', 'TH SarabunPSK', 'Sarabun', sans-serif !important; }
                h1, h2, h3, h4, h5, h6, p, span, div, table, tr, td, th, a, li, ul, ol {
                    font-family: 'TH Sarabun PSK', 'TH Sarabun New', 'TH SarabunPSK', 'Sarabun', sans-serif !important;
                }
            </style>`;
            if (modifiedHtml.includes('</head>')) {
                modifiedHtml = modifiedHtml.replace('</head>', `${fontOverrideStyle}</head>`);
            } else {
                modifiedHtml = fontOverrideStyle + modifiedHtml;
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

        // 1) First try LibreOffice CLI. It has highest formatting/layout fidelity (respects line-height, margins, page breaks, etc.)
        const tmpDir = path.join(os.tmpdir(), 'WordConversion');
        await fs.mkdir(tmpDir, { recursive: true });

        const timestamp = Date.now();
        const safeBaseName = `api_report_${timestamp}`;
        const inputPath = path.join(tmpDir, `${safeBaseName}.html`);
        const outputPath = path.join(tmpDir, `${safeBaseName}.docx`);
        tempInputPath = inputPath;
        tempOutputPath = outputPath;

        try {
            console.log(`🔄 Writing temporary HTML for LibreOffice: ${inputPath}`);
            await fs.writeFile(inputPath, html, 'utf-8');

            const command = `soffice --headless --infilter="HTML Document" --convert-to "docx:MS Word 2007 XML" --outdir "${tmpDir}" "${inputPath}"`;
            console.log(`LibreOffice Command: ${command}`);

            const { stderr } = await execAsync(command, { env: { ...process.env, HOME: '/tmp' } });
            if (stderr) console.warn(`LibreOffice Stderr: ${stderr}`);

            await fs.access(outputPath);
            docxBuffer = await fs.readFile(outputPath);
            console.log('🔄 Conversion successful using LibreOffice CLI.');
        } catch (loError) {
            console.warn('LibreOffice CLI conversion failed or not available, falling back to html-to-docx:', loError?.message || loError);
            docxBuffer = null;
        }

        // 2) Fallback to html-to-docx if LibreOffice is not available
        if (!docxBuffer) {
            try {
                console.log('🔄 Converting to DOCX using html-to-docx...');
                // html-to-docx returns a Buffer/Uint8Array
                docxBuffer = await HTMLtoDOCX(String(html), null, {
                    font: 'TH Sarabun PSK',
                    fontSize: 32
                });
            } catch (e) {
                console.error('html-to-docx conversion failed:', e?.message || e);
                throw e;
            }
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
