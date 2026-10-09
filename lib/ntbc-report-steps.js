// The 21 report steps shared by the in-page progress modal (ntbc_cfreport/page.js)
// and the background worker, which turns the page's live step state into a
// readable job status ("ขั้น 12/21: ...") and a per-step log stored on the job.
export const NTBC_REPORT_STEPS = [
    { key: 'launch', label: '1. Start debug browser' },
    { key: 'domains', label: '2. Capture Domains Overview' },
    { key: 'dns', label: '3. Capture DNS Records' },
    { key: 'bot', label: '4. Capture Bot Management' },
    { key: 'securityLevel', label: '5. Capture Security Level & BIC' },
    { key: 'sslOverview', label: '6. Capture SSL/TLS Overview' },
    { key: 'sslEdge', label: '7. Capture Min TLS & TLS 1.3' },
    { key: 'traffic', label: '8. Capture HTTP Traffic' },
    { key: 'trafficCountries', label: '9. Capture Traffic by Country' },
    { key: 'firewall', label: '10. Capture Firewall Events' },
    { key: 'topEvents', label: '11. Capture Top Events by Source' },
    { key: 'rules', label: '12. Capture Security Rules' },
    { key: 'rateLimiting', label: '13. Capture Rate Limiting Rules' },
    { key: 'managedRules', label: '14. Capture Managed WAF Rules' },
    { key: 'ipAccess', label: '15. Capture IP Access Rules' },
    { key: 'zoneLockdown', label: '16. Capture Zone Lockdown' },
    { key: 'argo', label: '17. Capture Argo Routing' },
    { key: 'speed', label: '18. Capture Speed Test' },
    { key: 'speedMobile', label: '19. Capture Speed Test Mobile' },
    { key: 'stats', label: '20. Fetch CF Statistics' },
    { key: 'report', label: '21. Generate & Download Report' },
];

// Per-job time limit (minutes) for a background report. One zone normally takes
// ~15 min; the default leaves plenty of headroom and the user can raise it per job.
export const NTBC_TIMEOUT_DEFAULT_MIN = 45;
export const NTBC_TIMEOUT_MIN_MIN = 10;
export const NTBC_TIMEOUT_MAX_MIN = 240;

// Fail a job whose page shows no step activity for this long (it is stuck, not slow).
export const NTBC_STALL_MIN = 10;

export const clampNtbcTimeout = (v) => {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return NTBC_TIMEOUT_DEFAULT_MIN;
    return Math.min(NTBC_TIMEOUT_MAX_MIN, Math.max(NTBC_TIMEOUT_MIN_MIN, n));
};

// "running" step first, otherwise the last step that has started.
export const getCurrentNtbcStep = (statusMap = {}) => {
    const running = NTBC_REPORT_STEPS.findIndex(s => statusMap[s.key] === 'running');
    if (running >= 0) return { ...NTBC_REPORT_STEPS[running], index: running };
    let last = -1;
    NTBC_REPORT_STEPS.forEach((s, i) => { if (statusMap[s.key] && statusMap[s.key] !== 'pending') last = i; });
    return last >= 0 ? { ...NTBC_REPORT_STEPS[last], index: last } : null;
};
