import { connectChrome } from './chrome-helper';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { getReportJobById, updateReportJobProgress } from './gdcc-db';

export async function runBackgroundReportJob(jobId, baseUrl, userSession) {
    console.log(`🤖 [Background Worker] Starting report job #${jobId}...`);
    
    let browser = null;
    let page = null;
    
    try {
        // 1. Update job to processing
        await updateReportJobProgress(jobId, 5, 'processing', 'Initializing browser...');
        
        // 2. Fetch job details
        const job = await getReportJobById(jobId);
        if (!job) {
            console.error(`❌ [Background Worker] Job #${jobId} not found in database.`);
            return;
        }
        
        const subdomains = JSON.parse(job.subdomains);
        const promotedHosts = job.promoted_hosts ? JSON.parse(job.promoted_hosts) : [];
        
        // 3. Connect to or launch Chrome
        try {
            if (process.env.GDCC_WORKER_CONNECT_CHROME === 'true') {
                console.log('🤖 [Background Worker] Trying to connect to existing Chrome instance...');
                browser = await connectChrome();
            } else {
                throw new Error('Forced headless launch');
            }
        } catch (e) {
            console.log('🤖 [Background Worker] Launching new headless browser...');
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
        
        page = await browser.newPage();
        
        // Expose logs from page console
        page.on('console', msg => {
            console.log(`[Browser Console in Worker]: ${msg.text()}`);
        });
        
        await page.setViewport({ width: 1920, height: 1080 });
        
        // 4. Navigate to app and inject session
        await updateReportJobProgress(jobId, 10, 'processing', 'Authenticating session...');
        await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
        
        await page.evaluate((sess) => {
            localStorage.setItem('sdb_session', JSON.stringify(sess));
            localStorage.setItem('gdcc_theme', 'dark'); // Use dark theme for standard screenshotting
        }, userSession);
        
        // 5. Navigate to GDCC dashboard in worker mode
        await updateReportJobProgress(jobId, 15, 'processing', 'Loading dashboard...');
        await page.evaluate(() => {
            localStorage.setItem('gdcc_worker_mode', 'true');
        });
        await page.goto(`${baseUrl}/systems/gdcc?mode=worker`, { waitUntil: 'networkidle2' });
        
        // 6. Wait for window.__handleBatchReport hook to be ready
        await page.waitForFunction(() => typeof window.__handleBatchReport === 'function', { timeout: 30000 });
        
        // 7. Start report generation
        await updateReportJobProgress(jobId, 20, 'processing', 'Triggering report generation...');
        
        console.log(`🤖 [Background Worker] Triggering __handleBatchReport with subdomains:`, subdomains);
        await page.evaluate(async (hosts, start, end, tmpl, promoted, zId, sep, thai, accId) => {
            // Trigger the internal React handleBatchReport
            window.__handleBatchReport(hosts, start, end, tmpl, promoted, zId, sep, [], thai, accId);
        }, subdomains, job.start_date, job.end_date, job.template_id, promotedHosts, job.zone_id, job.export_separated === 1, job.export_thai_digits === 1, job.account_id);
        
        // 8. Poll for progress and completion
        const startTime = Date.now();
        let isDone = false;
        
        while (Date.now() - startTime < 600000) { // 10 minutes timeout
            await new Promise(r => setTimeout(r, 1000));
            
            // Check for progress updates
            const progressInfo = await page.evaluate(() => window.__lastReportProgress).catch(() => null);
            if (progressInfo) {
                // Map page progress (0-100) to job progress (20-95)
                const scaledProgress = 20 + Math.round((progressInfo.progress / 100) * 75);
                const statusMsg = `Processing ${progressInfo.index}/${progressInfo.total} (${progressInfo.hostName}): ${progressInfo.statusMsg}`;
                await updateReportJobProgress(jobId, scaledProgress, 'processing', statusMsg);
            }
            
            // Check if ready
            const ready = await page.evaluate(() => window.__lastBatchReportReady).catch(() => false);
            if (ready) {
                isDone = true;
                break;
            }
        }
        
        if (!isDone) {
            throw new Error('Timeout: Report generation took too long or page stalled.');
        }
        
        // 9. Extract and save file
        await updateReportJobProgress(jobId, 95, 'processing', 'Saving generated files...');
        
        const reportsDir = path.join(process.cwd(), 'public', 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        const timestamp = Date.now();
        
        if (job.export_separated === 1) {
            // Get zip file as base64
            const zipBase64 = await page.evaluate(() => window.__lastBatchReportZIPBase64);
            if (!zipBase64) {
                throw new Error('ZIP file data not found in page context.');
            }
            
            const fileName = `background_report_${timestamp}_${jobId}.zip`;
            const filePath = path.join(reportsDir, fileName);
            fs.writeFileSync(filePath, Buffer.from(zipBase64, 'base64'));
            
            await updateReportJobProgress(jobId, 100, 'completed', 'Completed', fileName);
            console.log(`✅ [Background Worker] Report saved to ${filePath}`);
        } else {
            // Get HTML report
            const htmlContent = await page.evaluate(() => window.__lastBatchReportHTML);
            if (!htmlContent) {
                throw new Error('Report HTML content not found in page context.');
            }
            
            // Call the local export-docx API route to do the conversion using the existing pipeline
            const fileName = `background_report_${timestamp}_${jobId}.docx`;
            const filePath = path.join(reportsDir, fileName);
            
            console.log(`🤖 [Background Worker] Converting HTML to DOCX via local API...`);
            const response = await axios.post(`${baseUrl}/api/export-docx`, {
                html: htmlContent,
                filename: fileName
            }, {
                responseType: 'arraybuffer',
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            
            fs.writeFileSync(filePath, Buffer.from(response.data));
            
            await updateReportJobProgress(jobId, 100, 'completed', 'Completed', fileName);
            console.log(`✅ [Background Worker] Report saved to ${filePath}`);
        }
        
    } catch (err) {
        console.error(`❌ [Background Worker] Error in job #${jobId}:`, err);
        await updateReportJobProgress(jobId, 100, 'failed', `Error: ${err.message}`, null, err.message);
    } finally {
        if (page) {
            try { await page.close(); } catch (e) {}
        }
        if (browser) {
            if (browser.process && browser.process() === null) {
                try { await browser.disconnect(); } catch (e) {}
            } else {
                try { await browser.close(); } catch (e) {}
            }
        }
    }
}
