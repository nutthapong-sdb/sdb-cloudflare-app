import { NextResponse } from 'next/server';
import { createReportJob, getReportJobs, deleteReportJob } from '@/lib/gdcc-db';
import { runBackgroundReportJob } from '@/lib/gdcc-report-worker';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const id = searchParams.get('id');
        const userId = searchParams.get('userId');

        if (action === 'download') {
            const fileName = searchParams.get('fileName');
            if (!fileName) {
                return NextResponse.json({ success: false, message: 'Missing fileName' }, { status: 400 });
            }
            
            // Clean/sanitize filename to prevent directory traversal
            const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9_\\-\\.]/g, '');
            if (!safeFileName) {
                return NextResponse.json({ success: false, message: 'Invalid fileName' }, { status: 400 });
            }
            
            const filePath = path.join(process.cwd(), 'public', 'reports', safeFileName);
            if (!fs.existsSync(filePath)) {
                return NextResponse.json({ success: false, message: 'File not found' }, { status: 404 });
            }
            
            const fileBuffer = fs.readFileSync(filePath);
            const contentType = safeFileName.endsWith('.zip') ? 'application/zip' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            
            return new NextResponse(fileBuffer, {
                headers: {
                    'Content-Disposition': `attachment; filename="${safeFileName}"`,
                    'Content-Type': contentType
                }
            });
        }

        if (action === 'delete') {
            if (!id) {
                return NextResponse.json({ success: false, message: 'Missing ID' }, { status: 400 });
            }
            
            // Delete associated file if it exists
            const { getReportJobById } = await import('@/lib/gdcc-db');
            const job = await getReportJobById(id);
            if (job && job.file_name) {
                try {
                    const safeFileName = path.basename(job.file_name).replace(/[^a-zA-Z0-9_\\-\\.]/g, '');
                    if (safeFileName) {
                        const filePath = path.join(process.cwd(), 'public', 'reports', safeFileName);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            console.log(`🗑️ Deleted background report file: ${safeFileName}`);
                        }
                    }
                } catch (err) {
                    console.error('Failed to delete background report file:', err.message);
                }
            }
            
            await deleteReportJob(id);
            return NextResponse.json({ success: true, message: 'Job deleted successfully' });
        }

        const jobs = await getReportJobs(userId);
        return NextResponse.json({ success: true, data: jobs });
    } catch (error) {
        console.error('API Error:', error.message);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const {
            userId,
            accountId,
            accountName,
            zoneId,
            zoneName,
            subdomains,
            startDate,
            endDate,
            templateId,
            promotedHosts,
            exportSeparated,
            exportThaiDigits,
            userSession
        } = body;

        if (!accountId || !zoneId || !subdomains || !startDate || !endDate || !userSession) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        // Create the job record in database
        const jobId = await createReportJob(
            userId,
            accountId,
            accountName,
            zoneId,
            zoneName,
            subdomains,
            startDate,
            endDate,
            templateId || 'default',
            promotedHosts || [],
            exportSeparated || false,
            exportThaiDigits || false
        );

        // Get baseUrl from request
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host');
        const baseUrl = `${protocol}://${host}`;

        // Start background worker without await to run it asynchronously
        runBackgroundReportJob(jobId, baseUrl, userSession).catch(err => {
            console.error(`❌ Background job ${jobId} failed:`, err.message);
        });

        return NextResponse.json({
            success: true,
            message: 'Background report generation started.',
            data: { jobId }
        });
    } catch (error) {
        console.error('API Error:', error.message);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
