import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import libreoffice from 'libreoffice-convert';

const execAsync = promisify(exec);
const convertAsync = promisify(libreoffice.convert);

export async function POST(request) {
    let tempInputPath = null;
    let tempOutputPath = null;

    try {
        const body = await request.json();
        const { html, filename = 'document.docx' } = body;

        if (!html) {
            return NextResponse.json({ success: false, message: 'Missing HTML content' }, { status: 400 });
        }

        let docxBuffer = null;

        // ---------------------------------------------------------
        // Cross-Platform Conversion Logic
        // ---------------------------------------------------------
        if (os.platform() === 'darwin') {
            // ---> macOS Strategy: Microsoft Word + AppleScript (Highest Fidelity) <---
            console.log(`🔄 [macOS] Converting to DOCX using AppleScript (MS Word)...`);

            const tmpDir = path.join(os.tmpdir(), 'WordConversion');
            await fs.mkdir(tmpDir, { recursive: true });

            const timestamp = Date.now();
            const safeBaseName = `api_report_${timestamp}`;
            tempInputPath = path.join(tmpDir, `${safeBaseName}.doc`);
            tempOutputPath = path.join(tmpDir, `${safeBaseName}.docx`);

            await fs.writeFile(tempInputPath, html, 'utf-8');

            const appleScript = `
            tell application "Microsoft Word"
                activate
                set display alerts to none
                
                set inputFile to POSIX file "${tempInputPath}"
                set outputFile to "${tempOutputPath}"
                
                with timeout of 600 seconds
                    open inputFile
                    set activeDoc to active document
                    save as activeDoc file name outputFile file format format document
                    close activeDoc saving no
                end timeout
            end tell
            `;

            const command = `osascript -e '${appleScript}'`;
            const { stdout, stderr } = await execAsync(command);

            if (stderr) console.warn(`AppleScript Stderr: ${stderr}`);

            try {
                await fs.access(tempOutputPath);
            } catch {
                throw new Error("Conversion failed: Output file not created by MS Word.");
            }

            docxBuffer = await fs.readFile(tempOutputPath);

        } else {
            // ---> Linux / Docker Strategy: LibreOffice CLI (Standard Server Support) <---
            console.log(`🔄 [Linux/Docker] Converting to DOCX using LibreOffice CLI...`);
            // Note: Requires 'libreoffice' to be installed in the Docker image.

            const tmpDir = path.join(os.tmpdir(), 'WordConversionLinux');
            await fs.mkdir(tmpDir, { recursive: true });

            const timestamp = Date.now();
            const safeBaseName = `api_report_${timestamp}`;
            const linuxInputPath = path.join(tmpDir, `${safeBaseName}.html`);
            const linuxOutputPathInit = path.join(tmpDir, `${safeBaseName}.docx`);

            // MUST save as .html so LibreOffice knows which import filter to use!
            await fs.writeFile(linuxInputPath, html, 'utf-8');

            // Explicitly set the filter so Alpine's LibreOffice doesn't get confused
            const command = `soffice --headless --infilter="HTML Document" --convert-to "docx:MS Word 2007 XML" --outdir "${tmpDir}" "${linuxInputPath}"`;
            console.log(`Linux Command: ${command}`);

            try {
                const { stdout, stderr } = await execAsync(command, { env: { ...process.env, HOME: '/tmp' } });
                if (stderr) console.warn(`LibreOffice Stderr: ${stderr}`);
            } catch (cmdErr) {
                console.error(`LibreOffice Exec failed:`, cmdErr);
                throw new Error(`LibreOffice failed: ${cmdErr.message}`);
            }

            try {
                await fs.access(linuxOutputPathInit);
            } catch {
                throw new Error("Conversion failed: Output file not created by LibreOffice in Docker.");
            }

            docxBuffer = await fs.readFile(linuxOutputPathInit);

            // Cleanup Linux temp
            try { await fs.unlink(linuxInputPath); } catch (e) { }
            try { await fs.unlink(linuxOutputPathInit); } catch (e) { }
        }

        console.log(`✅ API Conversion successful. Buffer length: ${docxBuffer.length}`);

        // 5. Return the new DOCX
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
            message: 'Failed to convert to DOCX via MS Word AppleScript. Make sure MS Word is installed and Terminal has permission to control it.',
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
