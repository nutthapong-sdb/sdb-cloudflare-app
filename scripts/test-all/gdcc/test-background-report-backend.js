const axios = require('axios');
const { log, colors, BASE_URL } = require('../libs/ui-helper');

(async () => {
    log('=====================================', colors.blue);
    log('🧪 GDCC Background Report - Backend API Test', colors.blue);
    log('=====================================', colors.blue);

    try {
        // Prepare user session details
        const userSession = {
            id: 1,
            username: 'root',
            role: 'root',
            cloudflare_api_token: process.env.CLOUDFLARE_API_TOKEN || 'mock-token'
        };

        const payload = {
            userId: '1',
            accountId: '556111fa674b6ccdb9c819dbbf11111b',
            accountName: 'Government Data Center and Cloud service (GDCC)',
            zoneId: 'sesalpglpn.go.th',
            zoneName: 'sesalpglpn.go.th',
            subdomains: ['service.sesalpglpn.go.th'],
            startDate: '2026-06-18',
            endDate: '2026-06-24',
            templateId: 'default',
            promotedHosts: [],
            exportSeparated: false,
            exportThaiDigits: false,
            userSession: userSession
        };

        log(`🔹 Triggering POST /api/gdcc/report-jobs...`, colors.blue);
        const res = await axios.post(`${BASE_URL}/api/gdcc/report-jobs`, payload);
        
        if (!res.data.success) {
            throw new Error(`API failed: ${res.data.message}`);
        }

        const jobId = res.data.data.jobId;
        log(`✅ Job successfully queued! Job ID: ${jobId}`, colors.green);

        // Poll for job status
        log(`🔹 Polling status of job #${jobId}...`, colors.blue);
        const start = Date.now();
        let finished = false;
        let finalJob = null;

        while (Date.now() - start < 180000) { // 3 minutes timeout
            await new Promise(r => setTimeout(r, 3000));
            const statusRes = await axios.get(`${BASE_URL}/api/gdcc/report-jobs?id=${jobId}`);
            if (statusRes.data.success) {
                const jobList = statusRes.data.data;
                const job = jobList.find(j => j.id === jobId);
                if (!job) {
                    throw new Error(`Job #${jobId} not found in listing!`);
                }
                
                log(`   [Progress] ${job.status.toUpperCase()} (${job.progress}%): ${job.status_message || ''}`, colors.yellow);
                
                if (job.status === 'completed') {
                    finished = true;
                    finalJob = job;
                    break;
                } else if (job.status === 'failed') {
                    throw new Error(`Job failed on server: ${job.error_message}`);
                }
            }
        }

        if (!finished) {
            throw new Error('Timeout: Job took longer than 3 minutes to complete.');
        }

        log(`\n✅ Background report job finished successfully!`, colors.green);
        log(`📂 Generated file name: ${finalJob.file_name}`, colors.green);
        
        // Clean up: delete the job to keep DB clean
        log(`🔹 Cleaning up job from DB...`, colors.blue);
        await axios.get(`${BASE_URL}/api/gdcc/report-jobs?action=delete&id=${jobId}`);
        log(`✅ Clean up complete.`, colors.green);
        
        process.exit(0);
    } catch (error) {
        log(`❌ Test Failed: ${error.message}`, colors.red);
        if (error.response) {
            log(`   Response status: ${error.response.status}`, colors.red);
            log(`   Response data: ${JSON.stringify(error.response.data)}`, colors.red);
        }
        process.exit(1);
    }
})();
