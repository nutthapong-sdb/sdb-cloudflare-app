// The 21 report steps shared by the in-page progress modal (ntbc_cfreport/page.js)
// and the background worker, which turns the page's live step state into a
// readable job status ("ขั้น 12/21: ...") and a per-step log stored on the job.
//
// `tags` = the @captured_* template variables a capture step produces. Steps without
// `tags` (launch, stats, report) always run; see getNeededCaptureSteps().
export const NTBC_REPORT_STEPS = [
    { key: 'launch', label: '1. Start debug browser' },
    { key: 'domains', label: '2. Capture Domains Overview', tags: ['@captured_domain_page'] },
    { key: 'dns', label: '3. Capture DNS Records', tags: ['@captured_dns_page'] },
    { key: 'bot', label: '4. Capture Bot Management', tags: ['@captured_bot_management'] },
    { key: 'securityLevel', label: '5. Capture Security Level & BIC', tags: ['@captured_security_level', '@captured_browser_integrity'] },
    { key: 'sslOverview', label: '6. Capture SSL/TLS Overview', tags: ['@captured_ssl_overview'] },
    { key: 'sslEdge', label: '7. Capture Min TLS & TLS 1.3', tags: ['@captured_ssl_edge', '@captured_min_tls_version', '@captured_tls_1_3'] },
    { key: 'traffic', label: '8. Capture HTTP Traffic', tags: ['@captured_traffic_page', '@captured_request_traffic_page', '@captured_data_transfer_traffic_page', '@captured_page_views_traffic_page', '@captured_visits_traffic_page', '@captured_api_requests_traffic_page'] },
    { key: 'trafficCountries', label: '9. Capture Traffic by Country', tags: ['@captured_traffic_countries_page'] },
    { key: 'firewall', label: '10. Capture Firewall Events', tags: ['@captured_firewall_page'] },
    { key: 'topEvents', label: '11. Capture Top Events by Source', tags: ['@captured_top_events_source_page'] },
    { key: 'rules', label: '12. Capture Security Rules', tags: ['@captured_security_rules_page'] },
    { key: 'rateLimiting', label: '13. Capture Rate Limiting Rules', tags: ['@captured_rate_limiting_page'] },
    { key: 'managedRules', label: '14. Capture Managed WAF Rules', tags: ['@captured_managed_rules_page'] },
    { key: 'ipAccess', label: '15. Capture IP Access Rules', tags: ['@captured_ip_access_page'] },
    { key: 'zoneLockdown', label: '16. Capture Zone Lockdown', tags: ['@captured_zone_lockdown_page'] },
    { key: 'argo', label: '17. Capture Argo Routing', tags: ['@captured_argo_page'] },
    { key: 'speed', label: '18. Capture Speed Test', tags: ['@captured_speed_page'] },
    { key: 'speedMobile', label: '19. Capture Speed Test Mobile', tags: ['@captured_speed_mobile_page'] },
    { key: 'stats', label: '20. Fetch CF Statistics' },
    { key: 'report', label: '21. Generate & Download Report' },
];

// Step keys whose screenshots the template actually uses. null = unknown (template could not
// be loaded), meaning "capture everything" — never silently drop captures on a load failure.
export const getNeededCaptureSteps = (templateHtml) => {
    if (typeof templateHtml !== 'string' || !templateHtml.trim()) return null;
    const needed = new Set(
        NTBC_REPORT_STEPS
            .filter(s => !s.tags || s.tags.some(tag => templateHtml.includes(tag)))
            .map(s => s.key)
    );
    // The Mobile result is reached through the Desktop speed test run.
    if (needed.has('speedMobile')) needed.add('speed');
    return needed;
};

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
