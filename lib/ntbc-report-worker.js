import { connectChrome } from './chrome-helper';
import { checkCloudflareLogin, CF_UNAUTH_MESSAGE } from './cf-auth';
import fs from 'fs';
import path from 'path';
import { getNtbcReportJobById, updateNtbcReportJobProgress, getNextPendingNtbcJob, claimNtbcReportJob, updateNtbcReportJobSteps } from './ntbc-db';
import { NTBC_REPORT_STEPS, NTBC_STALL_MIN, clampNtbcTimeout, getCurrentNtbcStep } from './ntbc-report-steps';

const formatElapsed = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}`;
};

// "ขั้น 12/21: 12. Capture Security Rules — ถ่ายภาพหน้าจอ"
const describeStep = (progress) => {
    const statusMap = Object.fromEntries((progress?.steps || []).map(s => [s.key, s.status]));
    const cur = getCurrentNtbcStep(statusMap);
    if (!cur) return null;
    return `ขั้น ${cur.index + 1}/${NTBC_REPORT_STEPS.length}: ${cur.label}${progress.detail ? ` — ${progress.detail}` : ''}`;
};

// Never let a hung puppeteer call (e.g. screenshot of a background tab) block the worker.
const withTimeout = (promise, ms, what) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000}s`)), ms))
]);

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
    // Human-readable name of the phase in progress, recorded as failed_step if anything throws.
    let phase = 'เริ่มงาน';
    let lastProgress = null;

    if (!(await claimNtbcReportJob(jobId))) {
        console.log(`🤖 [NTBC Worker] Job #${jobId} is no longer pending (already taken); skipping.`);
        return;
    }

    try {

        const job = await getNtbcReportJobById(jobId);
        if (!job) {
            console.error(`❌ [NTBC Worker] Job #${jobId} not found in database.`);
            return;
        }

        const subdomains = JSON.parse(job.subdomains || '[]');

        // Always attach to the shared debug browser. Never launch a fresh one.
        phase = 'เชื่อมต่อ Chrome (debug browser)';
        browser = await connectChrome();

        // Fail fast (instead of a 15-min Timeout) when Cloudflare is not logged in.
        phase = 'ตรวจสอบการล็อกอิน Cloudflare';
        await updateNtbcReportJobProgress(jobId, 8, 'processing', 'Checking Cloudflare login...');
        const cfAuth = await checkCloudflareLogin(browser);
        if (!cfAuth.loggedIn) {
            throw new Error(`UNAUTHENTICATED_CLOUDFLARE: ${CF_UNAUTH_MESSAGE}`);
        }

        page = await browser.newPage();
        page.on('console', msg => {
            console.log(`[Browser Console in NTBC Worker]: ${msg.text()}`);
        });
        await page.setViewport({ width: 1920, height: 1080 });

        // Navigate to app and inject session
        phase = 'ล็อกอินเข้าเว็บ (inject session)';
        await updateNtbcReportJobProgress(jobId, 10, 'processing', 'Authenticating session...');
        // Any same-origin page works for writing localStorage. Use a plain JSON API response, not
        // /login: once the shared Chrome profile already holds a session, /login starts a
        // client-side redirect that swallows the next goto() and leaves the worker page half-loaded.
        await page.goto(`${localBaseUrl}/api/ntbc/report-jobs?action=has-active`, { waitUntil: 'domcontentloaded', timeout: 60000 });

        await page.evaluate((sess, margins) => {
            localStorage.setItem('sdb_session', JSON.stringify(sess));
            localStorage.setItem('ntbc_theme', 'dark');
            localStorage.setItem('ntbc_worker_mode', 'true');
            if (margins) {
                localStorage.setItem('ntbc:page-margins', margins);
            }
        }, userSession, job.page_margins || null);

        // Navigate to the NTBC dashboard in worker mode
        phase = 'เปิดหน้า NTBC CFReport';
        await updateNtbcReportJobProgress(jobId, 15, 'processing', 'Loading dashboard...');
        const workerUrl = `${localBaseUrl}/systems/ntbc_cfreport?mode=worker`;
        try {
            await page.goto(workerUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        } catch (navErr) {
            // A client-side redirect still running from /login can swallow the navigation event,
            // so goto() times out even though the page did load. Carry on when it did — the
            // waitForFunction below is the real readiness check.
            if (navErr.name !== 'TimeoutError' || !page.url().includes('/systems/ntbc_cfreport')) throw navErr;
            console.warn(`⚠️ [NTBC Worker] goto timed out but page is at ${page.url()}; continuing.`);
        }

        // Wait for the exposed hook to be ready
        await page.waitForFunction(() => typeof window.__ntbcHandleBatchReport === 'function', { timeout: 60000 });

        // Build the batchQueue the same shape handleCaptureScreenshotConfirm expects:
        // one entry per subdomain, all belonging to this job's single zone.
        const batchQueue = subdomains.map(domain => ({
            zoneId: job.zone_id,
            accountId: job.account_id,
            domain
        }));

        phase = 'เริ่มสร้างรายงาน';
        await updateNtbcReportJobProgress(jobId, 20, 'processing', 'Triggering report generation...');
        console.log(`🤖 [NTBC Worker] Triggering __ntbcHandleBatchReport for zone ${job.zone_name} with subdomains:`, subdomains);

        await page.evaluate((queue, start, end, tmpl, thai) => {
            window.__ntbcHandleBatchReport(queue, start, end, tmpl, [], null, false, [], thai);
        }, batchQueue, job.start_date, job.end_date, job.template_id, job.export_thai_digits === 1);

        // Poll for completion. Two limits: the user's per-job time limit for the whole run,
        // and a stall limit — no step activity on the page for NTBC_STALL_MIN minutes.
        const timeoutMin = clampNtbcTimeout(job.timeout_minutes);
        const maxTimeoutMs = timeoutMin * 60000;
        const stallMs = NTBC_STALL_MIN * 60000;
        const startTime = Date.now();
        let lastActivity = Date.now();
        let lastSeenUpdate = 0;
        let lastSavedLog = '';
        let broughtToFront = false;
        console.log(`🤖 [NTBC Worker] Time limit ${timeoutMin} min, stall limit ${NTBC_STALL_MIN} min.`);

        while (true) {
            await new Promise(r => setTimeout(r, 1500));
            const elapsed = Date.now() - startTime;

            const snap = await withTimeout(page.evaluate(() => ({
                ready: !!window.__ntbcLastBatchReportReady,
                error: window.__ntbcLastBatchReportError || null,
                progress: window.__ntbcProgress || null,
            })), 30000, 'Reading page progress').catch(() => null);

            if (snap?.progress) {
                lastProgress = snap.progress;
                if (snap.progress.updatedAt !== lastSeenUpdate) {
                    lastSeenUpdate = snap.progress.updatedAt;
                    lastActivity = Date.now();
                }
                const logJson = JSON.stringify(snap.progress);
                if (logJson !== lastSavedLog) {
                    lastSavedLog = logJson;
                    await updateNtbcReportJobSteps(jobId, { steps: snap.progress.steps, detail: snap.progress.detail });
                }
                phase = describeStep(snap.progress) || phase;

                // All Cloudflare captures are done once step 21 starts: bring the worker tab to
                // the front so Chrome doesn't throttle the hidden tab's timers during the Word
                // export (in case the Chrome container runs without the --disable-background* flags).
                const reportStep = snap.progress.steps?.find(s => s.key === 'report');
                if (!broughtToFront && reportStep && reportStep.status !== 'pending') {
                    broughtToFront = true;
                    await withTimeout(page.bringToFront(), 10000, 'Bringing worker tab to front').catch(() => {});
                }
            }

            if (snap?.ready) break;
            if (snap?.error) {
                throw new Error(`Report generation failed: ${snap.error}`);
            }
            if (elapsed > maxTimeoutMs) {
                throw new Error(`เกินเวลาที่กำหนด ${timeoutMin} นาที (เพิ่มได้ที่ช่อง "Time limit per zone" ตอนสร้างรายงาน)`);
            }
            if (Date.now() - lastActivity > stallMs) {
                throw new Error(`หน้ารายงานค้าง ไม่มีความคืบหน้านานเกิน ${NTBC_STALL_MIN} นาที`);
            }

            // Progress bar: 20% → 95% by completed steps; message names the step being worked on.
            const steps = snap?.progress?.steps || [];
            const doneCount = steps.filter(s => s.status !== 'pending' && s.status !== 'running').length;
            const scaledProgress = 20 + Math.round((doneCount / NTBC_REPORT_STEPS.length) * 74);
            const message = `${describeStep(snap?.progress) || 'Capturing screenshots & building report...'} (ผ่านไป ${formatElapsed(elapsed)} / ${timeoutMin} นาที)`;
            await updateNtbcReportJobProgress(jobId, scaledProgress, 'processing', message);
        }

        // Extract and save the already-generated docx bytes (built via /api/export-docx
        // inside the page, base64-encoded onto window by the worker-mode branch of
        // handleDownloadWord in ntbc_cfreport/page.js).
        phase = 'บันทึกไฟล์ Word';
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

        const warnings = (lastProgress?.steps || []).filter(s => s.status === 'warn' || s.status === 'error');
        const doneMessage = warnings.length
            ? `Completed — มีคำเตือน ${warnings.length} ขั้น: ${warnings.map(w => w.label).join(', ')}`
            : 'Completed';
        await updateNtbcReportJobProgress(jobId, 100, 'completed', doneMessage, fileName);
        console.log(`✅ [NTBC Worker] Report saved to ${filePath}`);

    } catch (err) {
        console.error(`❌ [NTBC Worker] Error in job #${jobId} at "${phase}":`, err);

        // Record the failure first, so the job never stays "processing" if the screenshot below hangs.
        const reason = String(err.message || err).replace(/^Report generation failed:\s*/, '');
        try {
            await updateNtbcReportJobSteps(jobId, lastProgress ? { steps: lastProgress.steps, detail: lastProgress.detail } : null, phase);
            await updateNtbcReportJobProgress(jobId, 100, 'failed', `ล้มเหลวที่ ${phase} — ${reason}`, null, reason);
        } catch (dbErr) {
            console.error('❌ [NTBC Worker] Failed to record job failure:', dbErr);
        }

        if (page) {
            try {
                // Saved under db/ (a persistent docker volume) and served via
                // /api/ntbc/report-jobs?action=screenshot&id=<jobId>.
                const shotsDir = path.join(process.cwd(), 'db', 'error_screenshots');
                if (!fs.existsSync(shotsDir)) {
                    fs.mkdirSync(shotsDir, { recursive: true });
                }
                const screenshotPath = path.join(shotsDir, `error_screenshot_ntbc_${jobId}.png`);
                await withTimeout(page.screenshot({ path: screenshotPath }), 20000, 'Error screenshot');
                console.log(`📸 [NTBC Worker] Saved error screenshot to ${screenshotPath}`);
            } catch (screenshotErr) {
                console.error('❌ [NTBC Worker] Failed to take error screenshot:', screenshotErr.message);
            }
        }
    } finally {
        // Only close the tab this worker opened — never close/disconnect the shared
        // browser itself, since the live monitor and other requests depend on it.
        if (page) {
            try { await withTimeout(page.close(), 20000, 'Closing worker tab'); } catch (e) {}
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
