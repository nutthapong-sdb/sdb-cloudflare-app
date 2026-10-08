import { connectChrome } from './chrome-helper';
import fs from 'fs';
import path from 'path';
import { getNtbcReportJobById, updateNtbcReportJobProgress, getNextPendingNtbcJob } from './ntbc-db';

// NTBC background report worker.
//
// IMPORTANT divergence from GDCC's worker: NTBC's screenshots are real Puppeteer
// screenshots of Cloudflare's authenticated dashboard UI, captured server-side
// (by /api/ntbc-capture and friends) against ONE shared debug Chrome instance
// at port 9222 (the same browser shown live in the "Live Browser Monitor").
// That means this worker must ALWAYS attach to that shared browser via
// connectChrome() and must NEVER puppeteer.launch() an independent instance —
// a second browser would have no Cloudflare login/session and would break the
// tab-selection logic other routes rely on. Jobs are processed strictly one at
// a time (see hasActiveNtbcJob() / the caller in the API route) since only one
// Cloudflare tab can be driven safely at once.
export async function runBackgroundNtbcReportJob(jobId, baseUrl, userSession) {
    const localPort = process.env.PORT || '8002';
    // IMPORTANT: unlike GDCC's worker (which can launch its OWN headless Chrome inside the
    // same container as the Next.js server, where 127.0.0.1 works), this worker's Puppeteer
    // commands execute inside the SEPARATE chrome-browser container via connectChrome(). From
    // that container, 127.0.0.1 is its own loopback, not the app's — the app must be reached
    // by its docker-compose service hostname ("app"), same as nginx's proxy_pass http://app:8002.
    const localBaseUrl = `http://app:${localPort}`;
    console.log(`🤖 [NTBC Worker] Starting report job #${jobId} (reaching app container at: ${localBaseUrl})...`);

    let browser = null;
    let page = null;

    try {
        await updateNtbcReportJobProgress(jobId, 5, 'processing', 'Initializing...');

        const job = await getNtbcReportJobById(jobId);
        if (!job) {
            console.error(`❌ [NTBC Worker] Job #${jobId} not found in database.`);
            return;
        }

        const subdomains = JSON.parse(job.subdomains || '[]');

        // Always attach to the shared debug browser. Never launch a fresh one.
        browser = await connectChrome();

        page = await browser.newPage();
        page.on('console', msg => {
            console.log(`[Browser Console in NTBC Worker]: ${msg.text()}`);
        });
        await page.setViewport({ width: 1920, height: 1080 });

        // Navigate to app and inject session
        await updateNtbcReportJobProgress(jobId, 10, 'processing', 'Authenticating session...');
        await page.goto(`${localBaseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });

        await page.evaluate((sess, margins) => {
            localStorage.setItem('sdb_session', JSON.stringify(sess));
            localStorage.setItem('ntbc_theme', 'dark');
            localStorage.setItem('ntbc_worker_mode', 'true');
            if (margins) {
                localStorage.setItem('ntbc:page-margins', margins);
            }
        }, userSession, job.page_margins || null);

        // Navigate to the NTBC dashboard in worker mode
        await updateNtbcReportJobProgress(jobId, 15, 'processing', 'Loading dashboard...');
        await page.goto(`${localBaseUrl}/systems/ntbc_cfreport?mode=worker`, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for the exposed hook to be ready
        await page.waitForFunction(() => typeof window.__ntbcHandleBatchReport === 'function', { timeout: 60000 });

        // Build the batchQueue the same shape handleCaptureScreenshotConfirm expects:
        // one entry per subdomain, all belonging to this job's single zone.
        const batchQueue = subdomains.map(domain => ({
            zoneId: job.zone_id,
            accountId: job.account_id,
            domain
        }));

        await updateNtbcReportJobProgress(jobId, 20, 'processing', 'Triggering report generation...');
        console.log(`🤖 [NTBC Worker] Triggering __ntbcHandleBatchReport for zone ${job.zone_name} with subdomains:`, subdomains);

        await page.evaluate((queue, start, end, tmpl, thai) => {
            window.__ntbcHandleBatchReport(queue, start, end, tmpl, [], null, false, [], thai);
        }, batchQueue, job.start_date, job.end_date, job.template_id, job.export_thai_digits === 1);

        // Poll for completion
        const startTime = Date.now();
        let isDone = false;
        const maxTimeoutMs = Math.max(900000, subdomains.length * 180000); // 15 min floor: real CF dashboard captures (21 steps) can run 3-9+ min depending on CF UI/network speed
        console.log(`🤖 [NTBC Worker] Polling timeout set to ${maxTimeoutMs / 1000}s for ${subdomains.length} subdomain(s).`);

        while (Date.now() - startTime < maxTimeoutMs) {
            await new Promise(r => setTimeout(r, 1500));

            const ready = await page.evaluate(() => window.__ntbcLastBatchReportReady).catch(() => false);
            if (ready) {
                isDone = true;
                break;
            }

            const errorMsg = await page.evaluate(() => window.__ntbcLastBatchReportError).catch(() => null);
            if (errorMsg) {
                throw new Error(`Report generation failed: ${errorMsg}`);
            }

            // Coarse mid-run progress heartbeat (no fine-grained per-step hook exposed yet).
            const elapsedRatio = Math.min(0.9, (Date.now() - startTime) / maxTimeoutMs);
            const scaledProgress = 20 + Math.round(elapsedRatio * 70);
            await updateNtbcReportJobProgress(jobId, scaledProgress, 'processing', 'Capturing screenshots & building report...');
        }

        if (!isDone) {
            throw new Error('Timeout: Report generation took too long or the page stalled.');
        }

        // Extract and save the already-generated docx bytes (built via /api/export-docx
        // inside the page, base64-encoded onto window by the worker-mode branch of
        // handleDownloadWord in ntbc_cfreport/page.js).
        await updateNtbcReportJobProgress(jobId, 95, 'processing', 'Saving generated file...');

        const reportsDir = path.join(process.cwd(), 'public', 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const base64Data = await page.evaluate(() => window.__ntbcLastReportBase64);
        if (!base64Data) {
            throw new Error('Report file data not found in page context.');
        }

        const timestamp = Date.now();
        const fileName = `background_report_${timestamp}_${jobId}.docx`;
        const filePath = path.join(reportsDir, fileName);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

        await updateNtbcReportJobProgress(jobId, 100, 'completed', 'Completed', fileName);
        console.log(`✅ [NTBC Worker] Report saved to ${filePath}`);

    } catch (err) {
        console.error(`❌ [NTBC Worker] Error in job #${jobId}:`, err);

        if (page) {
            try {
                // Saved under db/ (a persistent docker volume) and served via
                // /api/ntbc/report-jobs?action=screenshot&id=<jobId>.
                const shotsDir = path.join(process.cwd(), 'db', 'error_screenshots');
                if (!fs.existsSync(shotsDir)) {
                    fs.mkdirSync(shotsDir, { recursive: true });
                }
                const screenshotPath = path.join(shotsDir, `error_screenshot_ntbc_${jobId}.png`);
                await page.screenshot({ path: screenshotPath });
                console.log(`📸 [NTBC Worker] Saved error screenshot to ${screenshotPath}`);
            } catch (screenshotErr) {
                console.error('❌ [NTBC Worker] Failed to take error screenshot:', screenshotErr);
            }
        }

        await updateNtbcReportJobProgress(jobId, 100, 'failed', `Error: ${err.message}`, null, err.message);
    } finally {
        // Only close the tab this worker opened — never close/disconnect the shared
        // browser itself, since the live monitor and other requests depend on it.
        if (page) {
            try { await page.close(); } catch (e) {}
        }

        // Auto-chain: NTBC jobs run strictly one at a time on the shared debug browser tab,
        // so once this job is done (success or failure) pick up the next queued one, if any,
        // using its own stored user_session (no live browser tab needed to re-supply it).
        try {
            const nextJob = await getNextPendingNtbcJob();
            if (nextJob) {
                let nextUserSession = null;
                try {
                    nextUserSession = nextJob.user_session ? JSON.parse(nextJob.user_session) : null;
                } catch (e) {}

                if (nextUserSession) {
                    console.log(`🤖 [NTBC Worker] Auto-chaining to next queued job #${nextJob.id}...`);
                    runBackgroundNtbcReportJob(nextJob.id, baseUrl, nextUserSession).catch(err => {
                        console.error(`❌ NTBC background job ${nextJob.id} failed:`, err.message);
                    });
                } else {
                    console.error(`❌ [NTBC Worker] Next queued job #${nextJob.id} has no stored session; cannot auto-start it.`);
                    await updateNtbcReportJobProgress(nextJob.id, 100, 'failed', 'No session stored for this job.', null, 'Missing user_session; could not auto-start.');
                }
            }
        } catch (chainErr) {
            console.error('❌ [NTBC Worker] Failed to check/chain next pending job:', chainErr);
        }
    }
}
