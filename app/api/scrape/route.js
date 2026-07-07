import { NextResponse } from 'next/server';
import { connectChrome } from '@/lib/chrome-helper';
import axios from 'axios';
import {
    getLatestSyncDate,
    saveDailyStats,
    getStatsInRange,
    getAllSyncStatus,
    deleteSyncData,
    checkDateExists,
    createSyncJob,
    getSyncJobById,
    getSyncJobs,
    getActiveSyncJobForZone,
    claimQueuedSyncJob,
    updateSyncJob,
    markSyncJobRateLimited,
    deleteSyncJob,
    recoverSyncJobs,
    requestStopSyncJob,
    requestRetrySyncJob,
    purgeLatestZoneDays,
    addCompletedSyncJobHistory,
    getCompletedSyncJobHistory,
    clearCompletedSyncJobHistory,
} from '../../../lib/gdcc-db';


const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const SYNC_JOB_CONCURRENCY = 2;
let syncRunnerBootstrapped = false;
let activeSyncWorkers = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchHostRequestTotal = async (token, zoneId, host, since, until) => {
    if (!host) return 0;

    const query = `
        query GetHostRequestTotal($zoneTag: String, $since: String, $until: String, $host: String) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              httpRequestsAdaptiveGroups(
                filter: {
                  datetime_geq: $since,
                  datetime_leq: $until,
                  clientRequestHTTPHost: $host
                }
                limit: 5
              ) {
                count
              }
            }
          }
        }
    `;

    const response = await axios({
        method: 'POST',
        url: `${CLOUDFLARE_API_BASE}/graphql`,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        data: {
            query,
            variables: {
                zoneTag: zoneId,
                since: since.toISOString(),
                until: until.toISOString(),
                host
            }
        }
    });

    if (response.data?.errors) {
        console.warn(`⚠️ Host total GraphQL errors for ${host}:`, JSON.stringify(response.data.errors));
    }

    return response.data?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups?.[0]?.count || 0;
};

const enumerateDateStrings = (startDateStr, endDateStr) => {
    const dates = [];
    let cursor = new Date(`${startDateStr}T00:00:00.000Z`);
    const end = new Date(`${endDateStr}T00:00:00.000Z`);
    while (cursor <= end) {
        dates.push(cursor.toISOString().split('T')[0]);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
};

const buildMissingDateRanges = (requestedDates, availableDates, forceFreshDates = new Set()) => {
    const missingDates = requestedDates.filter((date) => !availableDates.has(date) || forceFreshDates.has(date));
    if (missingDates.length === 0) return [];

    const ranges = [];
    let rangeStart = missingDates[0];
    let previous = new Date(`${missingDates[0]}T00:00:00.000Z`);

    for (let i = 1; i < missingDates.length; i++) {
        const currentStr = missingDates[i];
        const current = new Date(`${currentStr}T00:00:00.000Z`);
        const expected = new Date(previous);
        expected.setUTCDate(expected.getUTCDate() + 1);

        if (current.getTime() !== expected.getTime()) {
            ranges.push({ start: rangeStart, end: previous.toISOString().split('T')[0] });
            rangeStart = currentStr;
        }

        previous = current;
    }

    ranges.push({ start: rangeStart, end: previous.toISOString().split('T')[0] });
    return ranges;
};

const fetchCloudflareAnalytics = async (token, zoneId, targetSubdomain, since, until, hostTotalRange = null) => {
    const query = `
       query GetZoneAnalytics($zoneTag: String, $since: String, $until: String, $since_date: String, $until_date: String${targetSubdomain ? ', $host: String' : ''}) {
         viewer {
           zones(filter: { zoneTag: $zoneTag }) {
             zoneSummary: httpRequests1dGroups(
                limit: 1000, filter: { date_geq: $since_date, date_leq: $until_date }
             ) {
                sum {
                  requests bytes cachedRequests cachedBytes pageViews
                  countryMap { clientCountryName requests bytes }
                }
                uniq {
                  uniques
                }
             }
             httpRequestsAdaptiveGroups(
               filter: { datetime_geq: $since, datetime_leq: $until ${targetSubdomain ? ', clientRequestHTTPHost: $host' : ''} }
               limit: 8000, orderBy: [count_DESC]
             ) {
               count avg { edgeTimeToFirstByteMs }
               dimensions {
                 clientRequestHTTPHost clientIP clientRequestPath clientCountryName userAgent clientDeviceType userAgentOS edgeResponseStatus datetimeMinute
               }
             }
             firewallActivity: firewallEventsAdaptiveGroups(
                filter: { datetime_geq: $since, datetime_leq: $until ${targetSubdomain ? ', clientRequestHTTPHost: $host' : ''} }
                limit: 5000, orderBy: [datetimeMinute_ASC]
             ) { count dimensions { action datetimeMinute } }
             firewallRules: firewallEventsAdaptiveGroups(
                filter: { datetime_geq: $since, datetime_leq: $until ${targetSubdomain ? ', clientRequestHTTPHost: $host' : ''} }
                limit: 500, orderBy: [count_DESC]
             ) { count dimensions { description ruleId source } }
             firewallIPs: firewallEventsAdaptiveGroups(
                filter: { datetime_geq: $since, datetime_leq: $until ${targetSubdomain ? ', clientRequestHTTPHost: $host' : ''} }
                limit: 100, orderBy: [count_DESC]
             ) { count dimensions { clientIP clientCountryName action } }
             firewallSources: firewallEventsAdaptiveGroups(
                filter: { datetime_geq: $since, datetime_leq: $until ${targetSubdomain ? ', clientRequestHTTPHost: $host' : ''} }
                limit: 100, orderBy: [count_DESC]
             ) { count dimensions { source } }
           }
         }
       }
     `;

    const variables = {
        zoneTag: zoneId,
        since: since.toISOString(),
        until: until.toISOString(),
        since_date: since.toISOString().split('T')[0],
        until_date: until.toISOString().split('T')[0],
    };
    if (targetSubdomain) { variables.host = targetSubdomain; }

    const [response, hostRequestTotal] = await Promise.all([
        axios({
            method: 'POST',
            url: `${CLOUDFLARE_API_BASE}/graphql`,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            data: { query, variables }
        }),
        targetSubdomain
            ? fetchHostRequestTotal(
                token,
                zoneId,
                targetSubdomain,
                hostTotalRange?.since || since,
                hostTotalRange?.until || until
            )
            : Promise.resolve(0)
    ]);

    if (response.data.errors) {
        console.error('❌ Cloudflare GraphQL Errors:', JSON.stringify(response.data.errors, null, 2));
    }

    const zoneData = response.data?.data?.viewer?.zones?.[0];
    const result = {
        httpRequestsAdaptiveGroups: zoneData?.httpRequestsAdaptiveGroups || [],
        zoneSummary: zoneData?.zoneSummary || [],
        firewallActivity: zoneData?.firewallActivity || [],
        firewallRules: zoneData?.firewallRules || [],
        firewallIPs: zoneData?.firewallIPs || [],
        firewallSources: zoneData?.firewallSources || [],
        hostRequestTotal: hostRequestTotal || 0
    };

    // Limit detection — warn if result count is at or near the query limit
    const LIMITS = {
        httpRequestsAdaptiveGroups: targetSubdomain ? 8000 : 8000,
        firewallActivity: targetSubdomain ? 5000 : 5000,
        firewallRules: 500,
        firewallIPs: 100,
        firewallSources: 100,
    };
    const label = targetSubdomain ? `[${targetSubdomain}]` : '[ZoneOverview]';
    let hitLimit = false;
    for (const [key, limit] of Object.entries(LIMITS)) {
        const count = result[key]?.length || 0;
        if (count >= limit) {
            console.warn(`⚠️ LIMIT HIT ${label} ${key}: ${count}/${limit} rows — data may be TRUNCATED`);
            hitLimit = true;
        }
    }
    if (!hitLimit) {
        const counts = Object.entries(LIMITS)
            .map(([k, lim]) => `${k.replace('httpRequests', 'req').replace('AdaptiveGroups', '').replace('firewall', 'fw')}: ${result[k]?.length || 0}/${lim}`)
            .join(' | ');
        console.log(`✅ ${label} fetchAnalytics OK — ${counts}`);
    }

    return result;
};

// Lightweight analytics for per-subdomain syncing (avoids 502 by splitting the query)
// Only fetches httpRequestsAdaptiveGroups with host filter (no heavy firewall tables combined)
const fetchSubdomainAnalytics = async (token, zoneId, host, since, until, hostTotalRange = null) => {
    const trafficQuery = `
        query GetSubdomainTraffic($zoneTag: String, $since: String, $until: String, $since_date: String, $until_date: String, $host: String) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              zoneSummary: httpRequests1dGroups(
                limit: 1, filter: { date_geq: $since_date, date_leq: $until_date }
              ) {
                sum { requests bytes cachedRequests cachedBytes pageViews }
                uniq { uniques }
              }
              httpRequestsAdaptiveGroups(
                filter: { datetime_geq: $since, datetime_leq: $until, clientRequestHTTPHost: $host }
                limit: 5000, orderBy: [count_DESC]
              ) {
                count avg { edgeTimeToFirstByteMs }
                dimensions {
                  clientRequestHTTPHost clientIP clientRequestPath clientCountryName
                  userAgent clientDeviceType userAgentOS edgeResponseStatus datetimeMinute
                }
              }
            }
          }
        }
    `;

    const firewallQuery = `
        query GetSubdomainFirewall($zoneTag: String, $since: String, $until: String, $host: String) {
          viewer {
            zones(filter: { zoneTag: $zoneTag }) {
              firewallActivity: firewallEventsAdaptiveGroups(
                filter: { datetime_geq: $since, datetime_leq: $until, clientRequestHTTPHost: $host }
                limit: 2000, orderBy: [datetimeMinute_ASC]
              ) { count dimensions { action datetimeMinute } }
              firewallRules: firewallEventsAdaptiveGroups(
                filter: { datetime_geq: $since, datetime_leq: $until, clientRequestHTTPHost: $host }
                limit: 200, orderBy: [count_DESC]
              ) { count dimensions { description ruleId source } }
              firewallIPs: firewallEventsAdaptiveGroups(
                filter: { datetime_geq: $since, datetime_leq: $until, clientRequestHTTPHost: $host }
                limit: 100, orderBy: [count_DESC]
              ) { count dimensions { clientIP clientCountryName action } }
              firewallSources: firewallEventsAdaptiveGroups(
                filter: { datetime_geq: $since, datetime_leq: $until, clientRequestHTTPHost: $host }
                limit: 50, orderBy: [count_DESC]
              ) { count dimensions { source } }
            }
          }
        }
    `;

    const variables = {
        zoneTag: zoneId,
        since: since.toISOString(),
        until: until.toISOString(),
        since_date: since.toISOString().split('T')[0],
        until_date: until.toISOString().split('T')[0],
        host
    };

    // Run traffic and firewall queries in parallel (separate requests = lighter per call)
    const [trafficResp, firewallResp, hostRequestTotal] = await Promise.all([
        axios({ method: 'POST', url: `${CLOUDFLARE_API_BASE}/graphql`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, data: { query: trafficQuery, variables } }),
        axios({ method: 'POST', url: `${CLOUDFLARE_API_BASE}/graphql`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, data: { query: firewallQuery, variables } }),
        fetchHostRequestTotal(
            token,
            zoneId,
            host,
            hostTotalRange?.since || since,
            hostTotalRange?.until || until
        )
    ]);

    if (trafficResp.data?.errors) console.warn(`⚠️ Subdomain traffic GraphQL errors for ${host}:`, JSON.stringify(trafficResp.data.errors));
    if (firewallResp.data?.errors) console.warn(`⚠️ Subdomain firewall GraphQL errors for ${host}:`, JSON.stringify(firewallResp.data.errors));

    const tZone = trafficResp.data?.data?.viewer?.zones?.[0];
    const fZone = firewallResp.data?.data?.viewer?.zones?.[0];

    return {
        httpRequestsAdaptiveGroups: tZone?.httpRequestsAdaptiveGroups || [],
        zoneSummary: tZone?.zoneSummary || [],
        firewallActivity: fZone?.firewallActivity || [],
        firewallRules: fZone?.firewallRules || [],
        firewallIPs: fZone?.firewallIPs || [],
        firewallSources: fZone?.firewallSources || [],
        hostRequestTotal: hostRequestTotal || 0
    };
};

// Helper to split a date range into smaller sub-ranges of at most maxDays duration
const splitDateRangeIntoSubRanges = (startStr, endStr, maxDays = 15) => {
    const subRanges = [];
    let currentStart = new Date(`${startStr}T00:00:00.000Z`);
    const finalEnd = new Date(`${endStr}T23:59:59.999Z`);

    while (currentStart < finalEnd) {
        let currentEnd = new Date(currentStart.getTime() + maxDays * 24 * 60 * 60 * 1000 - 1);
        if (currentEnd > finalEnd) {
            currentEnd = finalEnd;
        }

        subRanges.push({
            start: currentStart,
            end: currentEnd
        });

        // Set next chunk start to 1ms after currentEnd
        currentStart = new Date(currentEnd.getTime() + 1);
    }
    return subRanges;
};

// ─── Merge multiple analytics chunks into one ────────────────────────────────
// Concatenates time-based arrays; aggregates firewall dimensions to avoid duplicates
const mergeChunks = (...chunks) => {
    const base = chunks[0];
    const merged = {
        zoneSummary: [],
        zoneName: base.zoneName,
        accountName: base.accountName,
        httpRequestsAdaptiveGroups: [],
        firewallActivity: [],
        hostRequestTotal: 0,
        _fwRules: {}, _fwIPs: {}, _fwSources: {},
    };
    for (const chunk of chunks) {
        if (chunk.zoneSummary) {
            merged.zoneSummary.push(...chunk.zoneSummary);
        }
        merged.httpRequestsAdaptiveGroups.push(...(chunk.httpRequestsAdaptiveGroups || []));
        merged.firewallActivity.push(...(chunk.firewallActivity || []));
        merged.hostRequestTotal += chunk.hostRequestTotal || 0;
        for (const r of (chunk.firewallRules || [])) {
            const k = `${r.dimensions?.ruleId}|${r.dimensions?.description}`;
            if (!merged._fwRules[k]) merged._fwRules[k] = { ...r };
            else merged._fwRules[k].count += r.count;
        }
        for (const r of (chunk.firewallIPs || [])) {
            const k = `${r.dimensions?.clientIP}|${r.dimensions?.action}`;
            if (!merged._fwIPs[k]) merged._fwIPs[k] = { ...r };
            else merged._fwIPs[k].count += r.count;
        }
        for (const r of (chunk.firewallSources || [])) {
            const k = r.dimensions?.source;
            if (!merged._fwSources[k]) merged._fwSources[k] = { ...r };
            else merged._fwSources[k].count += r.count;
        }
    }
    merged.firewallRules = Object.values(merged._fwRules).sort((a, b) => b.count - a.count);
    merged.firewallIPs = Object.values(merged._fwIPs).sort((a, b) => b.count - a.count);
    merged.firewallSources = Object.values(merged._fwSources).sort((a, b) => b.count - a.count);
    delete merged._fwRules; delete merged._fwIPs; delete merged._fwSources;
    return merged;
};

// ─── Summarize large raw logs into compact statistics ───────────────────────
// Reduces 150,000+ rows (~60MB) into top-10 lists and hourly buckets (~50KB)
const summarizeDailyResult = (raw) => {
    const summary = {
        isSummary: true,
        zoneName: raw.zoneName || '',
        accountName: raw.accountName || '',
        // 1. Accurate Totals from zoneSummary (1dGroups)
        totals: {
            requests: 0, bytes: 0, cachedRequests: 0, cachedBytes: 0,
            countries: [], // uses countryMap from 1dGroups (100% accurate)
            avgResponseTime: 0,
            pageViews: 0,
            uniques: 0
        },
        // 2. Top-10 lists from adaptive logs
        topUrls: [], topIps: [], topHosts: [], topUAs: [],
        statusDistribution: {},
        // 3. Time Series (Hourly buckets to save space)
        hourlyTimeline: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 })),
        // 4. Firewall Summary
        firewall: {
            total: 0,
            topRules: (raw.firewallRules || []).slice(0, 10),
            topIPs: (raw.firewallIPs || []).slice(0, 10),
            topSources: (raw.firewallSources || []).slice(0, 10),
            activity: (raw.firewallActivity || []).slice(0, 100) // Keep some activity dots
        }
    };

    // Use host aggregate total when available; otherwise fall back to zone 1d summary.
    if (raw.hostRequestTotal > 0) {
        summary.totals.requests = raw.hostRequestTotal;
    }

    // Use 1d summary for zone truth metrics (requests, bytes, countries)
    if (summary.totals.requests === 0 && raw.zoneSummary && raw.zoneSummary.length > 0) {
        const s = raw.zoneSummary[0].sum;
        summary.totals.requests = s.requests || 0;
        summary.totals.bytes = s.bytes || 0;
        summary.totals.cachedRequests = s.cachedRequests || 0;
        summary.totals.cachedBytes = s.cachedBytes || 0;
        summary.totals.pageViews = s.pageViews || 0;
        summary.totals.uniques = raw.zoneSummary[0].uniq?.uniques || 0;
        summary.totals.countries = (s.countryMap || [])
            .sort((a, b) => b.requests - a.requests)
            .slice(0, 10);
    } else if (raw.zoneSummary && raw.zoneSummary.length > 0) {
        const zoneSum = raw.zoneSummary.reduce((acc, day) => {
            acc.bytes += day?.sum?.bytes || 0;
            acc.cachedRequests += day?.sum?.cachedRequests || 0;
            acc.cachedBytes += day?.sum?.cachedBytes || 0;
            acc.pageViews += day?.sum?.pageViews || 0;
            acc.uniques += day?.uniq?.uniques || 0;
            return acc;
        }, { bytes: 0, cachedRequests: 0, cachedBytes: 0, pageViews: 0, uniques: 0 });
        summary.totals.bytes = zoneSum.bytes;
        summary.totals.cachedRequests = zoneSum.cachedRequests;
        summary.totals.cachedBytes = zoneSum.cachedBytes;
        summary.totals.pageViews = zoneSum.pageViews;
        summary.totals.uniques = zoneSum.uniques;
    }

    // Process Adaptive Logs for Breakdown (Top 10)
    const urlMap = {}; const ipMap = {}; const hostMap = {}; const uaMap = {};
    const adaptive = raw.httpRequestsAdaptiveGroups || [];
    let weightedAvgSum = 0;
    let avgCountTotal = 0;

    // Fallback if 1d summary was missing
    if (summary.totals.requests === 0) {
        summary.totals.requests = adaptive.reduce((acc, curr) => acc + (curr.count || 0), 0);
    }

    adaptive.forEach(item => {
        const c = item.count || 0;
        const d = item.dimensions || {};
        const avgTime = item.avg?.edgeTimeToFirstByteMs || 0;

        if (avgTime > 0) {
            weightedAvgSum += (avgTime * c);
            avgCountTotal += c;
        }

        if (d.clientRequestPath) urlMap[d.clientRequestPath] = (urlMap[d.clientRequestPath] || 0) + c;
        if (d.clientIP) ipMap[d.clientIP] = (ipMap[d.clientIP] || 0) + c;
        if (d.clientRequestHTTPHost) hostMap[d.clientRequestHTTPHost] = (hostMap[d.clientRequestHTTPHost] || 0) + c;
        if (d.userAgent) uaMap[d.userAgent] = (uaMap[d.userAgent] || 0) + c;

        if (d.edgeResponseStatus) {
            summary.statusDistribution[d.edgeResponseStatus] = (summary.statusDistribution[d.edgeResponseStatus] || 0) + c;
        }

        if (d.datetimeMinute) {
            const hour = new Date(d.datetimeMinute).getUTCHours();
            if (summary.hourlyTimeline[hour]) summary.hourlyTimeline[hour].count += c;
        }
    });

    // Finalize average
    if (avgCountTotal > 0) {
        summary.totals.avgResponseTime = weightedAvgSum / avgCountTotal;
    }

    const sortSlice = (map) => Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([k, v]) => ({ key: k, count: v }));

    summary.topUrls = sortSlice(urlMap);
    summary.topIps = sortSlice(ipMap);
    summary.topHosts = sortSlice(hostMap);
    summary.topUAs = sortSlice(uaMap);

    // Sum firewall blocked total
    summary.firewall.total = (raw.firewallActivity || []).reduce((acc, curr) => acc + (curr.count || 0), 0);

    return summary;
};

const getSyncStartDate = async (zoneId, targetKey) => {
    const lastSyncStr = await getLatestSyncDate(zoneId, targetKey);
    let startDate = new Date();
    if (lastSyncStr) {
        startDate = new Date(`${lastSyncStr}T00:00:00.000Z`);
        startDate.setUTCDate(startDate.getUTCDate() + 1);
    } else {
        startDate.setUTCDate(startDate.getUTCDate() - 30);
    }
    startDate.setUTCHours(0, 0, 0, 0);
    return startDate;
};

const shouldStopJob = async (jobId) => {
    const job = await getSyncJobById(jobId);
    return !job || job.stop_requested === 1;
};

const setJobPhase = async (jobId, updates = {}) => {
    await updateSyncJob(jobId, updates);
};

const syncTargetForJob = async ({ jobId, zoneId, zoneName, accountName, token, targetKey, targetFilter, startDate, yesterday, zoneTotalSteps, zoneCompletedSteps, targetLabel }) => {
    const allDates = [];
    let d = new Date(startDate);
    while (d.getTime() < yesterday.getTime()) {
        allDates.push(d.toISOString().split('T')[0]);
        d.setUTCDate(d.getUTCDate() + 1);
    }

    const totalDates = allDates.length;
    await setJobPhase(jobId, {
        current_phase: targetFilter ? 'subdomain' : 'zone',
        current_domain: targetLabel,
        current_date: totalDates > 0 ? allDates[0] : null,
        current_date_started_at: totalDates > 0 ? new Date().toISOString() : null,
        zone_total_steps: zoneTotalSteps,
        zone_completed_steps: zoneCompletedSteps,
        subdomain_total_days: totalDates,
        subdomain_completed_days: 0,
    });

    if (totalDates === 0) {
        await updateSyncJob(jobId, { zone_completed_steps: zoneCompletedSteps + 1, current_date: null, subdomain_total_days: 0, subdomain_completed_days: 0 });
        return { syncedDates: 0, errorDates: 0 };
    }

    let syncedDates = 0;
    let errorDates = 0;

    for (let di = 0; di < allDates.length; di++) {
        if (await shouldStopJob(jobId)) {
            throw new Error('Stopped by user');
        }

        const dStr = allDates[di];
        const isSubdomainTarget = !!targetFilter;
        const dStart = isSubdomainTarget ? new Date(`${dStr}T00:00:00+07:00`) : new Date(`${dStr}T00:00:00.000Z`);
        const dEnd = isSubdomainTarget ? new Date(`${dStr}T00:00:00+07:00`) : new Date(`${dStr}T23:59:59.999Z`);
        if (isSubdomainTarget) dEnd.setUTCDate(dEnd.getUTCDate() + 1);

        await updateSyncJob(jobId, {
            current_date: dStr,
            current_date_started_at: new Date().toISOString(),
            subdomain_completed_days: di,
        });

        const alreadySynced = await checkDateExists(zoneId, targetKey, dStr);
        if (alreadySynced) {
            syncedDates++;
            await updateSyncJob(jobId, { subdomain_completed_days: di + 1 });
            continue;
        }

        let data = null;
        for (let attempt = 1; attempt <= 4; attempt++) {
            try {
                data = targetFilter
                    ? await fetchSubdomainAnalytics(token, zoneId, targetFilter, dStart, dEnd)
                    : await fetchWithAutoChunking(token, zoneId, targetFilter, dStart, dEnd, targetLabel);
                break;
            } catch (fetchErr) {
                const status = fetchErr.response?.status;
                if (status === 429 && attempt < 4) {
                    const delayMs = Math.min(2000 * (2 ** (attempt - 1)), 15000);
                    await markSyncJobRateLimited(jobId, dStr, targetLabel, 1);
                    await updateSyncJob(jobId, {
                        last_error: `Rate limited on ${zoneName} (${targetLabel}) ${dStr}, retry ${attempt} in ${Math.round(delayMs / 1000)}s`,
                    });
                    await sleep(delayMs);
                    continue;
                }
                if (attempt < 4 && (status === 502 || status === 503 || status === 504)) {
                    await sleep(3000);
                    continue;
                }
                errorDates++;
                data = null;
                await updateSyncJob(jobId, {
                    last_error: `${targetLabel} ${dStr}: ${status || fetchErr.message}`,
                });
                break;
            }
        }

        if (data) {
            if (zoneName) data.zoneName = zoneName;
            if (accountName) data.accountName = accountName;
            const summary = summarizeDailyResult(data);
            await saveDailyStats(zoneId, targetKey, dStr, summary);
        } else {
            const marker = { isSummary: true, zoneName: zoneName || '', accountName: accountName || '', totals: { requests: 0, bytes: 0 }, topUrls: [], topIps: [], firewall: { total: 0 }, _fetchError: true };
            await saveDailyStats(zoneId, targetKey, dStr, marker);
        }

        syncedDates++;
        await updateSyncJob(jobId, { subdomain_completed_days: di + 1 });
        if (di < allDates.length - 1) {
            await sleep(500);
        }
    }

    await updateSyncJob(jobId, {
        zone_completed_steps: zoneCompletedSteps + 1,
        subdomain_completed_days: totalDates,
        current_date: null,
        current_date_started_at: null,
    });

    return { syncedDates, errorDates };
};

const executeSyncJob = async (job) => {
    const zoneId = job.zone_id;
    const zoneName = job.zone_name;
    const accountName = job.account_name;
    const token = job.api_token;

    if (!token) {
        await updateSyncJob(job.id, { status: 'failed', last_error: 'Missing API token for sync job' });
        return;
    }

    try {
        await updateSyncJob(job.id, {
            last_error: null,
            current_phase: 'check',
            current_domain: null,
            current_date: null,
            current_date_started_at: null,
            zone_total_steps: 0,
            zone_completed_steps: 0,
            subdomain_total_days: 0,
            subdomain_completed_days: 0,
            rate_limit_count: 0,
            last_rate_limited_date: null,
            last_rate_limited_domain: null,
            finished_at: null,
        });

        await purgeLatestZoneDays(zoneId, 2);

        let zoneStatus = 'active';
        try {
            const zoneInfoResp = await axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            zoneStatus = zoneInfoResp.data?.result?.status || 'active';
        } catch (e) {
            await updateSyncJob(job.id, { last_error: `Could not check zone status: ${e.message}` });
        }

        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        yesterday.setUTCHours(23, 59, 59, 999);

        const zoneStartDate = await getSyncStartDate(zoneId, 'ALL_SUBDOMAINS');
        let subdomains = [];
        if (zoneStatus !== 'pending' && zoneStatus !== 'deactivated') {
            await updateSyncJob(job.id, { current_phase: 'discover', current_domain: null, current_date: null });
            try {
                const dnsResp = await axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records?per_page=500`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const dnsRecords = dnsResp.data?.result || [];
                const hostSet = new Set(
                    dnsRecords
                        .filter((r) => ['A', 'AAAA', 'CNAME'].includes(r.type))
                        .map((r) => r.name)
                        .filter(Boolean)
                );
                if (zoneName) hostSet.delete(zoneName);
                subdomains = Array.from(hostSet).sort();
            } catch (e) {
                await updateSyncJob(job.id, { last_error: `DNS discovery failed: ${e.message}` });
            }
        } else {
            await updateSyncJob(job.id, { last_error: `Zone is ${zoneStatus}; subdomain sync skipped.` });
        }

        const zoneTotalSteps = 1 + subdomains.length;
        await updateSyncJob(job.id, { zone_total_steps: zoneTotalSteps, zone_completed_steps: 0 });

        await syncTargetForJob({
            jobId: job.id,
            zoneId,
            zoneName,
            accountName,
            token,
            targetKey: 'ALL_SUBDOMAINS',
            targetFilter: null,
            startDate: zoneStartDate,
            yesterday,
            zoneTotalSteps,
            zoneCompletedSteps: 0,
            targetLabel: 'Zone Overview',
        });

        if (zoneStatus !== 'pending' && zoneStatus !== 'deactivated') {
            for (let i = 0; i < subdomains.length; i++) {
                if (await shouldStopJob(job.id)) {
                    throw new Error('Stopped by user');
                }
                const sd = subdomains[i];
                const sdStartDate = await getSyncStartDate(zoneId, sd);
                await syncTargetForJob({
                    jobId: job.id,
                    zoneId,
                    zoneName,
                    accountName,
                    token,
                    targetKey: sd,
                    targetFilter: sd,
                    startDate: sdStartDate,
                    yesterday,
                    zoneTotalSteps,
                    zoneCompletedSteps: i + 1,
                    targetLabel: sd,
                });
            }
        }

        const finishedJob = await updateSyncJob(job.id, {
            finished_at: new Date().toISOString(),
            current_phase: 'completed',
            current_domain: null,
            current_date: null,
            current_date_started_at: null,
        });
        await addCompletedSyncJobHistory(finishedJob);
        await deleteSyncJob(job.id);
    } catch (error) {
        const stopRequested = await shouldStopJob(job.id);
        if (stopRequested || error.message === 'Stopped by user') {
            const latestJob = await getSyncJobById(job.id);
            const shouldRetry = latestJob?.retry_requested === 1;
            if (shouldRetry) {
                await createSyncJob({
                    zoneId: job.zone_id,
                    zoneName: job.zone_name,
                    accountName: job.account_name,
                    requestedBy: job.requested_by,
                    apiToken: token,
                });
            }
            await updateSyncJob(job.id, {
                status: 'cancelled',
                last_error: shouldRetry ? 'Retry requested by user' : 'Stopped by user',
                api_token: null,
                finished_at: new Date().toISOString(),
                current_date_started_at: null,
                retry_requested: 0,
            });
            if (shouldRetry) {
                await kickSyncRunner();
            }
            return;
        }

        await updateSyncJob(job.id, {
            status: 'failed',
            last_error: error.message,
            api_token: null,
            finished_at: new Date().toISOString(),
            current_date_started_at: null,
        });
    }
};

const processNextSyncJob = async () => {
    const job = await claimQueuedSyncJob();
    if (!job) return false;
    await executeSyncJob(job);
    return true;
};

const kickSyncRunner = async () => {
    while (activeSyncWorkers < SYNC_JOB_CONCURRENCY) {
        activeSyncWorkers += 1;
        (async () => {
            let handledJob = false;
            try {
                handledJob = await processNextSyncJob();
            } catch (error) {
                console.error('Sync runner error:', error);
            } finally {
                activeSyncWorkers -= 1;
                if (syncRunnerBootstrapped && handledJob) {
                    setTimeout(() => { kickSyncRunner().catch(() => {}); }, 0);
                }
            }
        })();
    }
};

const ensureSyncRunnerInitialized = async () => {
    if (syncRunnerBootstrapped) return;
    syncRunnerBootstrapped = true;
    await recoverSyncJobs();
    await kickSyncRunner();
};

// ─── Adaptive chunking: 1x24h → 2x12h → 4x6h → 6x4h → 12x2h → 24x1h ────────
// Progressively splits the day into smaller windows until no chunk hits the ADAPTIVE_LIMIT
const ADAPTIVE_LIMIT = 8000;
const CHUNK_LEVELS = [1, 2, 4, 6, 12, 24]; // Number of equal slices per day
const CHUNK_LABELS = ['24h', '12h', '6h', '4h', '2h', '1h'];

const fetchWithAutoChunking = async (token, zoneId, targetFilter, since, until, label = '') => {
    const dayMs = until.getTime() - since.getTime();

    for (let lvl = 0; lvl < CHUNK_LEVELS.length; lvl++) {
        const n = CHUNK_LEVELS[lvl];
        const sliceMs = dayMs / n;
        const chunkLabel = CHUNK_LABELS[lvl];

        if (lvl > 0) {
            console.log(`⚡ [${label}] Limit hit — splitting into ${n}x ${chunkLabel}...`);
        }

        // Fetch all chunks of this level in parallel
        const chunks = await Promise.all(
            Array.from({ length: n }, (_, i) => {
                const chunkSince = new Date(since.getTime() + sliceMs * i);
                const chunkUntil = i < n - 1
                    ? new Date(since.getTime() + sliceMs * (i + 1) - 1)
                    : until;
                return fetchCloudflareAnalytics(token, zoneId, targetFilter, chunkSince, chunkUntil);
            })
        );

        const anyHit = chunks.some(c => c.httpRequestsAdaptiveGroups.length >= ADAPTIVE_LIMIT);
        const totalRows = chunks.reduce((s, c) => s + c.httpRequestsAdaptiveGroups.length, 0);

        if (!anyHit || lvl === CHUNK_LEVELS.length - 1) {
            if (n > 1) {
                const suffix = anyHit ? ' (still hitting limit — max resolution reached)' : ' OK';
                console.log(`✅ [${label}] ${n}x ${chunkLabel}${suffix} — merged (${totalRows} rows)`);
            }
            return n === 1 ? chunks[0] : mergeChunks(...chunks);
        }
        // else: continue to next finer level
    }
};



export async function POST(request) {
    try {
        const body = await request.json();
        const { action, zoneId, accountId, apiToken } = body;

        // Determine which token to use
        let token = apiToken;

        if (!token || typeof token !== 'string') {
            return NextResponse.json({ success: false, message: 'Missing or Invalid Cloudflare API Token' }, { status: 401 });
        }

        // --- Security: Input Validation ---
        if (zoneId && !/^[a-zA-Z0-9_-]+$/.test(zoneId)) {
            return NextResponse.json({ success: false, message: 'Invalid zoneId format' }, { status: 400 });
        }
        if (accountId && !/^[a-zA-Z0-9_-]+$/.test(accountId)) {
            return NextResponse.json({ success: false, message: 'Invalid accountId format' }, { status: 400 });
        }

        // console.log(`🔔 API Action: ${action}`);

        // 1. Test Connection
        if (action === 'test') {
            return NextResponse.json({ success: true, message: 'API is working' });
        }

        // 2. List Zones (Domains)
        else if (action === 'list-zones') {
            let url = `${CLOUDFLARE_API_BASE}/zones?per_page=50`;
            if (accountId) {
                url += `&account.id=${accountId}`;
            }

            // console.log(`📋 Listing Zones for Account: ${accountId || 'All'}...`);
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                }
            });

            let zones = response.data.result || [];

            const simplifiedZones = zones.map(z => ({
                id: z.id,
                name: z.name,
                status: z.status,
                account: z.account
            }));

            return NextResponse.json({ success: true, data: simplifiedZones });

        }

        // 3. Get DNS Records (Subdomains) - With Pagination
        else if (action === 'get-dns-records') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });

            let allRecords = [];
            let page = 1;
            const perPage = 100; // Cloudflare max is usually 100
            let hasMore = true;

            console.log(`📝 Fetching ALL DNS Records for Zone: ${zoneId}...`);

            try {
                while (hasMore) {
                    process.stdout.write(`   Fetching page ${page}... `); // Show progress in backend logs
                    const response = await axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        params: {
                            per_page: perPage,
                            page: page
                        }
                    });

                    const records = response.data.result;
                    if (records && records.length > 0) {
                        allRecords = allRecords.concat(records);
                        console.log(`Found ${records.length} records.`);
                        if (records.length < perPage) {
                            hasMore = false; // Last page
                        } else {
                            page++;
                        }
                    } else {
                        console.log('No more records.');
                        hasMore = false;
                    }
                }
            } catch (error) {
                console.error('Error fetching DNS page:', error.message);
                // Return what we have so far, or error
                if (allRecords.length === 0) return NextResponse.json({ success: false, message: 'Failed to fetch DNS records' }, { status: 500 });
            }

            // --- Fetch Load Balancers (Inject as Type: LB) ---
            process.stdout.write(`   Fetching Load Balancers... `);
            let lbRecords = [];
            try {
                const lbResponse = await axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/load_balancers`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    }
                });

                if (lbResponse.data.result) {
                    lbRecords = lbResponse.data.result.map(lb => ({
                        id: lb.id,
                        name: lb.name,
                        type: "LB", // Custom Type
                        content: lb.description || "Load Balancer Activity",
                        ttl: 1, // Dynamic
                        proxied: true, // LBs are always proxied
                        proxiable: true,
                        settings: {},
                        meta: {},
                        created_on: lb.created_on,
                        modified_on: lb.modified_on
                    }));
                    console.log(`Found ${lbRecords.length} Load Balancers.`);
                }
            } catch (lbError) {
                console.warn('   ⚠️ Failed to fetch Load Balancers (might be restricted/irrelevant):', lbError.message);
            }

            // Combine: LBs on TOP
            allRecords = [...lbRecords, ...allRecords];

            // Filter: Only PROXIED records
            const totalBefore = allRecords.length;
            allRecords = allRecords.filter(r => r.proxied === true);
            console.log(`   📉 Filtered DNS Only records: ${totalBefore} -> ${allRecords.length} (Proxied Only)`);

            console.log(`\n🔍 [DEBUG] RAW DNS RECORDS for Zone ${zoneId}:`);
            console.log(`Total Fetched: ${allRecords.length} (incl. ${lbRecords.length} LBs)`);
            // console.log(JSON.stringify(allRecords, null, 2)); // Too big to log all
            console.log('---------------------------------------------------\n');

            return NextResponse.json({ success: true, data: allRecords });
        }

        // 4. Get Account Info (With Pagination)
        else if (action === 'get-account-info') {
            console.log(`👤 Fetching Account Info...`);
            let allAccounts = [];
            let page = 1;
            let hasMore = true;
            const perPage = 50;

            try {
                while (hasMore) {
                    process.stdout.write(`   Fetching Accounts page ${page}... `);
                    const response = await axios.get(`${CLOUDFLARE_API_BASE}/accounts`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                        params: {
                            page: page,
                            per_page: perPage
                        }
                    });

                    const accounts = response.data.result || [];
                    const resultInfo = response.data.result_info;

                    if (accounts.length > 0) {
                        allAccounts = allAccounts.concat(accounts);

                        // Check pagination using result_info
                        if (resultInfo) {
                            if (page >= resultInfo.total_pages) {
                                hasMore = false;
                            } else {
                                page++;
                            }
                        } else {
                            // Fallback logic
                            if (accounts.length < perPage) {
                                hasMore = false;
                            } else {
                                page++;
                            }
                        }
                    } else {
                        hasMore = false;
                    }
                }

                console.log(`\n✅ Total Accounts Fetched: ${allAccounts.length}`);
                return NextResponse.json({ success: true, data: allAccounts });

            } catch (error) {
                console.error('\n❌ Error fetching accounts:', error.response?.data || error.message);
                return NextResponse.json({ success: false, message: 'Failed to fetch accounts', error: error.message }, { status: 500 });
            }
        }

        // 6. Get Traffic Analytics (GraphQL) - MAIN DASHBOARD
        else if (action === 'get-traffic-analytics') {
            console.log('🔹 API: Traffic Request Received for Zone:', zoneId);
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });
            // console.log(`📊 Fetching GraphQL Analytics for Zone: ${zoneId}...`);

            // Dynamic Time Range
            let since, until;
            let hostTotalRange = null;

            if (body.startDate && body.endDate) {
                since = new Date(body.startDate + 'T00:00:00.000Z');
                until = new Date(body.endDate + 'T23:59:59.999Z');
                if (until > new Date()) {
                    until = new Date(); // Cap to current time
                }

                if (body.subdomain && body.subdomain !== 'ALL_SUBDOMAINS') {
                    hostTotalRange = {
                        since: new Date(`${body.startDate}T00:00:00+07:00`),
                        until: new Date(`${body.endDate}T00:00:00+07:00`)
                    };
                }
            } else {
                const minutes = body.timeRange || 1440;
                until = new Date();
                since = new Date(until.getTime() - minutes * 60 * 1000);
            }

            let targetSubdomain = body.subdomain;
            if (targetSubdomain === 'ALL_SUBDOMAINS') targetSubdomain = null;

            try {
                const liveOnly = body.liveOnly === true;
                let finalData = {
                    httpRequestsAdaptiveGroups: [],
                    zoneSummary: [],
                    firewallActivity: [],
                    firewallRules: [],
                    firewallIPs: [],
                    firewallSources: [],
                    hostRequestTotal: 0
                };

                const statsStartStr = (targetSubdomain && body.startDate) ? body.startDate : since.toISOString().split('T')[0];
                const statsEndStr = (() => {
                    if (!(targetSubdomain && body.endDate)) return until.toISOString().split('T')[0];
                    const endExclusive = new Date(`${body.endDate}T00:00:00.000Z`);
                    endExclusive.setUTCDate(endExclusive.getUTCDate() - 1);
                    return endExclusive.toISOString().split('T')[0];
                })();

                let sqliteData = [];
                if (!liveOnly) {
                    // Check if history in DB
                    try {
                        sqliteData = statsEndStr >= statsStartStr
                            ? await getStatsInRange(zoneId, targetSubdomain || 'ALL_SUBDOMAINS', statsStartStr, statsEndStr)
                            : [];
                    } catch (e) {
                        console.warn('Could not fetch from SQLite:', e.message);
                    }
                }

                if (sqliteData.length > 0) {
                    console.log(`🔹 Found ${sqliteData.length} days of historical data in SQLite.`);
                    for (const row of sqliteData) {
                        const d = row.data;
                        if (d.isSummary) {
                            // ─── Case 1: Summarized Compressed record ──────
                            // Push the whole summary as one special item in the list
                            finalData.httpRequestsAdaptiveGroups.push({ ...d, report_date: row.report_date });

                            // Re-map totals back to the expected structure
                            if (d.totals) {
                                finalData.zoneSummary.push({
                                    sum: { ...d.totals, countryMap: d.totals.countries || [] }
                                });
                                if (targetSubdomain) {
                                    finalData.hostRequestTotal += d.totals.requests || 0;
                                }
                            }

                            // Firewall data
                            if (d.firewall) {
                                if (d.firewall.activity) finalData.firewallActivity.push(...d.firewall.activity);
                                if (d.firewall.topRules) finalData.firewallRules.push(...d.firewall.topRules);
                                if (d.firewall.topIPs) finalData.firewallIPs.push(...d.firewall.topIPs);
                                if (d.firewall.topSources) finalData.firewallSources.push(...d.firewall.topSources);
                            }
                        } else {
                            // ─── Case 2: Legacy Raw Record ────────────────
                            finalData.httpRequestsAdaptiveGroups.push(...(d.httpRequestsAdaptiveGroups || []));
                            finalData.zoneSummary.push(...(d.zoneSummary || []));
                            finalData.firewallActivity.push(...(d.firewallActivity || []));
                            finalData.firewallRules.push(...(d.firewallRules || []));
                            finalData.firewallIPs.push(...(d.firewallIPs || []));
                            finalData.firewallSources.push(...(d.firewallSources || []));
                        }
                    }
                }

                // If the requested range includes today, fetch today directly!
                const todayStr = new Date().toISOString().split('T')[0];
                const endStr = until.toISOString().split('T')[0];
                const startStr = since.toISOString().split('T')[0];

                const availableDates = new Set(sqliteData.map((row) => row.report_date));
                const requestedDates = statsEndStr >= statsStartStr
                    ? enumerateDateStrings(statsStartStr, statsEndStr)
                    : [];
                const forceFreshDates = new Set();
                if (todayStr >= statsStartStr && todayStr <= statsEndStr) {
                    forceFreshDates.add(todayStr);
                }

                const missingRanges = liveOnly
                    ? [{ start: startStr, end: endStr }]
                    : buildMissingDateRanges(requestedDates, availableDates, forceFreshDates);

                if (missingRanges.length > 0) {
                    console.log('🔹 Fetching live data from Cloudflare for missing ranges...', missingRanges);
                }

                const allChunksToMerge = [finalData];

                for (const range of missingRanges) {
                    // Split the missing range into sub-ranges of at most 15 days to respect Cloudflare GraphQL quotas
                    const subRanges = splitDateRangeIntoSubRanges(range.start, range.end, 15);
                    console.log(`🔹 Range ${range.start} to ${range.end} split into ${subRanges.length} sub-ranges.`);

                    for (const subRange of subRanges) {
                        const liveSince = subRange.start;
                        const liveUntil = subRange.end;

                        // Create local timezone strings for the subRange to match +07:00 exactly
                        const startLocalStr = liveSince.toISOString().split('T')[0];
                        const endLocalStr = liveUntil.toISOString().split('T')[0];

                        const liveHostRange = targetSubdomain && hostTotalRange
                            ? {
                                since: new Date(`${startLocalStr}T00:00:00+07:00`),
                                until: new Date(`${endLocalStr}T00:00:00+07:00`)
                            }
                            : null;

                        if (liveHostRange?.until) {
                            liveHostRange.until.setUTCDate(liveHostRange.until.getUTCDate() + 1);
                        }

                        console.log(`   👉 Fetching live chunk: ${startLocalStr} to ${endLocalStr}`);
                        const liveData = targetSubdomain
                            ? await fetchSubdomainAnalytics(token, zoneId, targetSubdomain, liveSince, liveUntil, liveHostRange)
                            : await fetchCloudflareAnalytics(token, zoneId, targetSubdomain, liveSince, liveUntil, liveHostRange);

                        allChunksToMerge.push(liveData);
                    }
                }

                // Merge all chunks (historical sqlite data + all live chunks)
                if (allChunksToMerge.length > 1) {
                    finalData = mergeChunks(...allChunksToMerge);
                }

                console.log('🔹 API: Sending Traffic Response...');
                const bodyStr = JSON.stringify({
                    success: true,
                    data: finalData
                });
                return new NextResponse(bodyStr, {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(bodyStr).toString()
                    }
                });

            } catch (gqlError) {
                console.error('API Error:', gqlError.response?.data || gqlError.message);
                return NextResponse.json({
                    success: false,
                    message: 'Analytics Error',
                    error: gqlError.response?.data || gqlError.message
                }, { status: 500 });
            }

        }

        else if (action === 'get-traffic-raw-live') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });

            let since, until;
            if (body.startDate && body.endDate) {
                since = new Date(body.startDate + 'T00:00:00.000Z');
                until = new Date(body.endDate + 'T23:59:59.999Z');
                if (until > new Date()) {
                    until = new Date();
                }
            } else {
                const minutes = body.timeRange || 1440;
                until = new Date();
                since = new Date(until.getTime() - minutes * 60 * 1000);
            }

            let targetSubdomain = body.subdomain;
            if (targetSubdomain === 'ALL_SUBDOMAINS') targetSubdomain = null;

            try {
                const query = `
                    query GetRawTraffic($zoneTag: String, $since: String, $until: String${targetSubdomain ? ', $host: String' : ''}) {
                      viewer {
                        zones(filter: { zoneTag: $zoneTag }) {
                          httpRequestsAdaptiveGroups(
                            filter: {
                              datetime_geq: $since,
                              datetime_leq: $until
                              ${targetSubdomain ? ', clientRequestHTTPHost: $host' : ''}
                            }
                            limit: 8000,
                            orderBy: [count_DESC]
                          ) {
                            count
                            avg { edgeTimeToFirstByteMs }
                            dimensions {
                              clientRequestHTTPHost
                              clientIP
                              clientRequestPath
                              clientCountryName
                              userAgent
                              clientDeviceType
                              userAgentOS
                              edgeResponseStatus
                              datetimeMinute
                            }
                          }
                        }
                      }
                    }
                `;

                const startStr = since.toISOString().split('T')[0];
                const endStr = until.toISOString().split('T')[0];
                const subRanges = splitDateRangeIntoSubRanges(startStr, endStr, 15);
                const combinedGroups = [];

                for (const subRange of subRanges) {
                    const chunkSince = subRange.start;
                    const chunkUntil = subRange.end;

                    const variables = {
                        zoneTag: zoneId,
                        since: chunkSince.toISOString(),
                        until: chunkUntil.toISOString()
                    };
                    if (targetSubdomain) variables.host = targetSubdomain;

                    const response = await axios({
                        method: 'POST',
                        url: `${CLOUDFLARE_API_BASE}/graphql`,
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        data: { query, variables }
                    });

                    if (response.data?.errors) {
                        console.warn('⚠️ Raw traffic GraphQL errors:', JSON.stringify(response.data.errors));
                    }

                    const rawGroups = response.data?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups || [];
                    combinedGroups.push(...rawGroups);
                }

                // Slice to 8000 to match the original limit constraint
                const finalGroups = combinedGroups.slice(0, 8000);

                const bodyStr = JSON.stringify({
                    success: true,
                    data: {
                        httpRequestsAdaptiveGroups: finalGroups
                    }
                });
                return new NextResponse(bodyStr, {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(bodyStr).toString()
                    }
                });
            } catch (gqlError) {
                console.error('Raw traffic API Error:', gqlError.response?.data || gqlError.message);
                return NextResponse.json({
                    success: false,
                    message: 'Raw analytics error',
                    error: gqlError.response?.data || gqlError.message
                }, { status: 500 });
            }
        }

        // 7. Get API Discovery (API Discovery)
        else if (action === 'get-api-discovery') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });

            console.log(`🔍 Fetching API Discovery for Zone: ${zoneId}...`);

            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            };

            try {
                // Use the API Gateway Discovery Endpoint directly (better than GraphQL for this)
                const response = await axios.get(
                    `${CLOUDFLARE_API_BASE}/zones/${zoneId}/api_gateway/discovery`,
                    { headers }
                );

                const result = response.data;
                console.log('📦 Raw API Response Success:', result.success);

                if (result.success) {
                    let discoveries = [];

                    // Logic to handle different Cloudflare API response formats (Arrays, Objects, Schemas)
                    if (Array.isArray(result.result)) {
                        console.log('✅ result.result is an array with', result.result.length, 'elements');

                        if (result.result.length > 0) {
                            const firstItem = result.result[0];
                            // Flat Operations Format
                            if (firstItem.method && firstItem.endpoint) {
                                console.log('✅ Data is flat operations format!');
                                discoveries = result.result.map(op => ({
                                    id: op.id,
                                    host: op.host || '-',
                                    method: op.method || '-',
                                    path: op.endpoint || '-',
                                    state: op.state || '-',
                                    source: op.source || '-', // If available directly
                                    last_seen: op.last_updated || '-',
                                }));
                            }
                            // Nested Array/Schema Format
                            else if (Array.isArray(firstItem)) {
                                console.log('📋 Data is nested array format');
                                for (const item of result.result) {
                                    if (Array.isArray(item)) {
                                        // Flatten OpenAPI schemas
                                        for (const schema of item) {
                                            if (schema && schema.paths && typeof schema.paths === 'object') {
                                                const host = schema.info?.title?.replace('Schema for ', '') || '-';
                                                for (const [path, pathObj] of Object.entries(schema.paths)) {
                                                    for (const [method, methodObj] of Object.entries(pathObj)) {
                                                        if (typeof methodObj === 'object' && method !== 'parameters') {
                                                            discoveries.push({
                                                                host: host,
                                                                method: method.toUpperCase(),
                                                                path: path,
                                                                state: schema.state || methodObj['x-cf-api-discovery-state'] || 'review',
                                                                source: methodObj['x-cf-api-discovery-source']?.join(', ') || '-',
                                                                last_seen: schema.last_seen || schema.timestamp || '-',
                                                            });
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    } else if (result.result && typeof result.result === 'object') {
                        // Object Format (Schemas, endpoints, etc.)
                        console.log('⚠️ result.result is an object:', Object.keys(result.result));
                        let targetArray = [];

                        if (result.result.schemas) targetArray = result.result.schemas;
                        else if (result.result.discovered_origins) targetArray = result.result.discovered_origins;
                        else if (result.result.operations) targetArray = result.result.operations;
                        else if (result.result.endpoints) targetArray = result.result.endpoints;
                        else targetArray = Object.values(result.result).find(v => Array.isArray(v)) || [];

                        for (const schema of targetArray) {
                            if (schema && schema.paths && typeof schema.paths === 'object') {
                                const host = schema.info?.title?.replace('Schema for ', '') || '-';
                                for (const [path, pathObj] of Object.entries(schema.paths)) {
                                    for (const [method, methodObj] of Object.entries(pathObj)) {
                                        if (typeof methodObj === 'object' && method !== 'parameters') {
                                            discoveries.push({
                                                host: host,
                                                method: method.toUpperCase(),
                                                path: path,
                                                state: schema.state || methodObj['x-cf-api-discovery-state'] || 'review',
                                                source: methodObj['x-cf-api-discovery-source']?.join(', ') || '-',
                                                last_seen: schema.last_seen || schema.timestamp || '-',
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }

                    console.log(`✅ Discovery found ${discoveries.length} paths`);

                    return NextResponse.json({
                        success: true,
                        data: discoveries,
                        raw: result.result // Optional for debug
                    });

                } else {
                    console.error('API returned success: false', result.errors);
                    return NextResponse.json({ success: false, message: 'Cloudflare API Error', error: result.errors }, { status: 500 });
                }

            } catch (error) {
                console.error('Discovery API Error:', error.response?.data || error.message);
                console.warn('⚠️ API Discovery not available - this could be due to:');
                console.warn('   - Token lacks API Gateway permissions');
                console.warn('   - Zone does not have API Gateway Discovery enabled');
                console.warn('   - Feature not available on this plan');
                console.warn('→ Returning empty discoveries list');

                // Return empty array instead of error (graceful degradation)
                return NextResponse.json({
                    success: true,
                    data: [],
                    message: 'API Discovery not available for this zone'
                });
            }
        }

        // 7.0b Get API Endpoints (Saved endpoints in API Gateway)
        else if (action === 'get-api-endpoints') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });

            console.log(`🔍 Fetching Saved API Endpoints for Zone: ${zoneId}...`);

            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            };

            try {
                // Use the API Gateway Operations Endpoint
                const response = await axios.get(
                    `${CLOUDFLARE_API_BASE}/zones/${zoneId}/api_gateway/operations`,
                    { headers }
                );

                const result = response.data;
                console.log('📦 Raw API Endpoints Success:', result.success);

                if (result.success && Array.isArray(result.result)) {
                    let endpoints = result.result.map(op => ({
                        id: op.id,
                        host: op.host || '-',
                        method: op.method || '-',
                        path: op.endpoint || '-',
                        source: 'saved', // Since it's in the operations list
                        state: 'saved',
                        last_seen: op.last_updated || '-', // match discovery field name
                    }));

                    return NextResponse.json({ success: true, data: endpoints });
                } else {
                    return NextResponse.json({ success: true, data: [] });
                }
            } catch (error) {
                console.error('API Endpoints Error:', error.response?.data || error.message);
                return NextResponse.json({
                    success: true,
                    data: [],
                    message: 'API Endpoints not available for this zone'
                });
            }
        }

        // 7.0c Get OpenAPI Schemas (raw) for export
        else if (action === 'get-api-openapi-schemas') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });

            console.log(`📦 Fetching OpenAPI Schemas for Zone: ${zoneId}...`);

            const {
                hostname,
                includeLearnedParameters,
                includeRecommendedThresholds
            } = body;

            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            };

            const params = {};
            if (hostname) params.host = hostname;

            const feature = [];
            if (includeLearnedParameters) {
                // `parameter_schemas` = learned query/path params (enum values)
                // `body_schema` = learned requestBody content (application/json schema)
                // Both are required to match the Cloudflare Dashboard's full export format
                feature.push('parameter_schemas');
                feature.push('body_schema');
            }
            if (includeRecommendedThresholds) feature.push('thresholds');
            if (feature.length === 1) params.feature = feature[0];
            else if (feature.length > 1) params.feature = feature.join(',');


            try {
                const response = await axios.get(
                    `${CLOUDFLARE_API_BASE}/zones/${zoneId}/api_gateway/schemas`,
                    { headers, params }
                );

                const result = response.data;

                if (result.success) {
                    const schemas = Array.isArray(result?.result?.schemas) ? result.result.schemas : [];

                    // Cloudflare dashboard export includes `requestBody: {}` for operations.
                    // The API may omit this key entirely; we normalize for a consistent export.
                    const normalizeSchema = (schema) => {
                        if (!schema || typeof schema !== 'object') return schema;
                        const paths = schema.paths;
                        if (!paths || typeof paths !== 'object') return schema;

                        Object.values(paths).forEach((pathItem) => {
                            if (!pathItem || typeof pathItem !== 'object') return;
                            Object.values(pathItem).forEach((op) => {
                                if (!op || typeof op !== 'object') return;

                                // 1. If it's a learned operation, ensure the labels and placeholder match CF exactly
                                if (Object.prototype.hasOwnProperty.call(op, 'x-cf-parameter-schemas')) {
                                    op['x-cf-parameter-schemas'] = 'automatically learned schema';
                                }

                                // 2. Cloudflare Dashboard export ALWAYS includes requestBody: {} for both
                                //    learned and non-learned operations if they are present in the list.
                                if (!Object.prototype.hasOwnProperty.call(op, 'requestBody')) {
                                    op.requestBody = {};
                                }
                            });
                        });

                        return schema;
                    };

                    const normalized = schemas.map(normalizeSchema);
                    return NextResponse.json({
                        success: true,
                        data: normalized,
                        timestamp: result?.result?.timestamp || null
                    });
                }

                return NextResponse.json({ success: true, data: [] });
            } catch (error) {
                const apiErrors = Array.isArray(error?.response?.data?.errors) ? error.response.data.errors : [];
                const firstApiError = apiErrors[0] || null;
                const isFeatureUnentitled = firstApiError?.code === 15400;
                const featureLabel = feature.length > 0 ? feature.join(', ') : 'requested feature';

                console.error('OpenAPI Schemas Error:', error.response?.data || error.message);

                return NextResponse.json({
                    success: true,
                    data: [],
                    message: isFeatureUnentitled
                        ? `OpenAPI schema feature not entitled for this token/zone (${featureLabel})`
                        : 'OpenAPI Schemas not available for this zone',
                    errorCode: firstApiError?.code || null,
                    errorDetail: firstApiError?.message || null
                });
            }
        }

        // 7.1 Get Subdomain Stats (GraphQL for {hostVar1} and/or path {var1})
        else if (action === 'get-subdomain-stats') {
            const { zoneId, method, path, host, limit } = body;
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });

            // Default 7 days scan to find subdomains
            const now = new Date();
            const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days

            const hasPathVar = typeof path === 'string' && path.includes('{var1}');
            const hasHostVar = typeof host === 'string' && host.includes('{hostVar1}');

            console.log(`🔍 Fetching Subdomain/Path Stats for Path: ${path} [hasVar:${hasPathVar}], Host: ${host} [hasVar:${hasHostVar}], Method: ${method}...`);

            let hostFilter = hasHostVar ? '' : `clientRequestHTTPHost: $host,`;
            let pathFilter = hasPathVar ? `clientRequestPath_like: $pathLike` : `clientRequestPath: $path`;

            let queryArgs = `$zoneTag: String, $since: String, $until: String, $method: String`;
            if (!hasHostVar && host) queryArgs += `, $host: String`;
            if (hasPathVar) queryArgs += `, $pathLike: String`;
            else queryArgs += `, $path: String`;

            const dimensionHost = hasHostVar ? `clientRequestHTTPHost` : ``;
            const dimensionPath = hasPathVar ? `clientRequestPath` : ``;
            const dimensions = [dimensionHost, dimensionPath].filter(Boolean).join('\n                                    ');

            const query = `
                query GetStats(${queryArgs}) {
                    viewer {
                        zones(filter: { zoneTag: $zoneTag }) {
                            httpRequestsAdaptiveGroups(
                                filter: {
                                    datetime_geq: $since,
                                    datetime_leq: $until,
                                    clientRequestHTTPMethodName: $method,
                                    ${hostFilter}
                                    ${pathFilter}
                                }
                                limit: ${limit || 50}
                                orderBy: [count_DESC]
                            ) {
                                count
                                dimensions {
                                    ${dimensions || 'clientRequestHTTPHost'}
                                }
                            }
                        }
                    }
                }
            `;

            const variables = {
                zoneTag: zoneId,
                since: since.toISOString(),
                until: now.toISOString(),
                method: method
            };
            if (!hasHostVar && host) variables.host = host;
            if (hasPathVar) variables.pathLike = path.replace(/\{var\d+\}/g, '%');
            else variables.path = path;

            try {
                const response = await axios({
                    method: 'POST',
                    url: `${CLOUDFLARE_API_BASE}/graphql`,
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    data: { query, variables }
                });

                if (response.data.errors) {
                    return NextResponse.json({ success: false, message: 'GraphQL Error', error: response.data.errors }, { status: 500 });
                }

                const groups = response.data.data.viewer.zones[0].httpRequestsAdaptiveGroups || [];
                const subdomains = groups.map(g => ({
                    host: hasHostVar && g.dimensions.clientRequestHTTPHost ? g.dimensions.clientRequestHTTPHost : host,
                    path: hasPathVar && g.dimensions.clientRequestPath ? g.dimensions.clientRequestPath : path,
                    count: g.count
                }));

                return NextResponse.json({ success: true, data: subdomains });

            } catch (error) {
                console.error('Subdomain/Path Stats Error:', error.response?.data || error.message);
                return NextResponse.json({ success: false, message: 'Failed to fetch subdomain/path stats' }, { status: 500 });
            }
        }

        else if (action === 'get-firewall-logs') {
            const { ruleId, zoneId, timeRange, limit } = body;
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });
            // Rule ID is optional (if empty, fetch recent logs for zone)

            console.log(`🔍 Fetching Firewall Logs for Zone: ${zoneId}, Rule: ${ruleId || 'ALL'}...`);

            // Time Range Calculation
            const minutes = timeRange || 360; // Default 6 hours
            const now = new Date();
            const since = new Date(now.getTime() - minutes * 60 * 1000);

            const query = `
                query GetFirewallEvents($zoneTag: String, $since: String, $until: String, $ruleId: String, $limit: Int) {
                    viewer {
                        zones(filter: { zoneTag: $zoneTag }) {
                            firewallEventsAdaptive(
                                filter: {
                                    datetime_geq: $since,
                                    datetime_leq: $until
                                    ${ruleId ? ', ruleId: $ruleId' : ''}
                                }
                                limit: $limit
                                orderBy: [datetime_DESC]
                            ) {
                                datetime
                                action
                                clientCountryName
                                clientIP
                                clientAsn
                                clientASNDescription
                                userAgent
                                source
                                ruleId
                                rayName
                                clientRequestHTTPProtocol
                                clientRequestHTTPMethod: clientRequestHTTPMethodName
                                clientRequestHTTPHost
                                clientRequestPath
                                clientRequestQuery
                                userAgent
                                # Analysis Scores
                                wafAttackScore
                                wafSqliAttackScore
                                wafXssAttackScore
                                wafRceAttackScore
                                botScore
                                botScoreSrcName
                                ja3Hash
                                ja4
                            }
                        }
                    }
                }
            `;

            const variables = {
                zoneTag: zoneId,
                since: since.toISOString(),
                until: now.toISOString(),
                ruleId: ruleId || undefined,
                limit: limit || 5000
            };

            try {
                const response = await axios({
                    method: 'POST',
                    url: `${CLOUDFLARE_API_BASE}/graphql`,
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    data: { query, variables }
                });

                if (response.data.errors) {
                    console.error('❌ Cloudflare User API GraphQL Errors:', response.data.errors);
                    return NextResponse.json({ success: false, message: 'GraphQL Error', error: response.data.errors }, { status: 500 });
                }

                const logs = response.data.data.viewer.zones[0].firewallEventsAdaptive || [];
                // console.log(`✅ Found ${logs.length} firewall logs`);

                return NextResponse.json({ success: true, data: logs });

            } catch (error) {
                console.error('Firewall Logs API Error:', error.response?.data || error.message);
                return NextResponse.json({ success: false, message: 'Failed to fetch logs' }, { status: 500 });
            }
        }

        // 8. Get Zone Settings (Bot Management, Security Level, etc.)
        else if (action === 'get-zone-settings') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });
            // console.log(`🔧 Fetching Zone Settings for: ${zoneId}...`);

            try {
                const headers = {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                };

                // Fetch multiple settings in parallel
                const [
                    securityLevelRes,
                    sslRes,
                    minTlsRes,
                    tls13Res,
                    dnsRecordsRes,
                    leakedCredsRes,
                    browserCheckRes,
                    hotlinkRes,
                    lockdownRes
                ] = await Promise.all([
                    // Security Level
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/settings/security_level`, { headers }).catch(() => ({ data: {} })),
                    // SSL/TLS Mode
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/settings/ssl`, { headers }).catch(() => ({ data: {} })),
                    // Minimum TLS Version
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/settings/min_tls_version`, { headers }).catch(() => ({ data: {} })),
                    // TLS 1.3
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/settings/tls_1_3`, { headers }).catch(() => ({ data: {} })),
                    // DNS Records
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records?per_page=1`, { headers }).catch(() => ({ data: {} })),
                    // Leaked Credentials Check
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/settings/security_header`, { headers })
                        .catch(() => ({ data: { result: { value: 'unknown' } } })),
                    // Browser Integrity Check
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/settings/browser_check`, { headers }).catch(() => ({ data: {} })),
                    // Hotlink Protection
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/settings/hotlink_protection`, { headers }).catch(() => ({ data: {} })),
                    // Zone Lockdown Rules
                    axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/lockdowns?per_page=1`, { headers })
                        .catch(() => ({ data: { result_info: { total_count: 0 } } }))
                ]);

                // Fetch Bot Management Configuration
                let botManagementConfig = null;
                try {
                    const botMgmtRes = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/bot_management`,
                        { headers }
                    );
                    botManagementConfig = botMgmtRes.data.result;
                    console.log(`\n🔍 [DEBUG] RAW BOT MANAGEMENT for Zone ${zoneId}:`);
                    console.log(JSON.stringify(botManagementConfig, null, 2));
                } catch (err) {
                    console.log('Bot Management not available (likely not Enterprise plan)');
                }

                // Fetch DDoS Protection Settings
                let ddosSettings = {
                    enabled: 'unknown',
                    httpDdos: 'unknown',
                    sslTlsDdos: 'unknown',
                    networkDdos: 'unknown'
                };
                try {
                    const ddosRes = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/settings/ddos_protection`,
                        { headers }
                    ).catch(() => null);

                    if (ddosRes) {
                        ddosSettings.enabled = ddosRes.data.result?.value || 'on'; // Usually always on
                    }
                } catch (err) {
                    console.log('DDoS settings fetch failed');
                }

                // Fetch WAF Managed Rulesets
                let wafRulesets = {
                    cloudflareManaged: 'unknown',
                    owaspCore: 'unknown',
                    exposedCredentials: 'unknown',
                    ddosL7Ruleset: 'unknown',
                    managedRulesCount: 0,
                    rulesetActions: []
                };
                try {
                    const wafRes = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/rulesets/phases/http_request_firewall_managed/entrypoint`,
                        { headers }
                    ).catch(() => null);

                    if (wafRes && wafRes.data.result) {
                        const rules = wafRes.data.result.rules || [];

                        // Count total managed rules
                        wafRulesets.managedRulesCount = rules.filter(r => r.action === 'execute').length;

                        // Capture unique actions
                        const actions = [...new Set(rules.map(r => r.action))];
                        wafRulesets.rulesetActions = actions.join(', ');

                        // Check for Cloudflare Managed Ruleset
                        const cfManaged = rules.find(r => r.action === 'execute' && r.action_parameters?.id?.includes('efb7b8c949ac4650a09736fc376e9aee'));
                        wafRulesets.cloudflareManaged = cfManaged?.enabled ? 'enabled' : 'disabled';

                        // Check for OWASP Core Ruleset
                        const owasp = rules.find(r => r.action === 'execute' && r.action_parameters?.id?.includes('4814384a9e5d4991b9815dcfc25d2f1f'));
                        wafRulesets.owaspCore = owasp?.enabled ? 'enabled' : 'disabled';

                        // Check for Exposed Credentials Check
                        const exposedCreds = rules.find(r => r.action === 'execute' && r.action_parameters?.id?.includes('c2e184081120413c86c3ab7e14069605'));
                        wafRulesets.exposedCredentials = exposedCreds?.enabled ? 'enabled' : 'disabled';
                    }

                    // Fetch DDoS L7 Ruleset
                    const ddosL7Res = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/rulesets/phases/ddos_l7/entrypoint`,
                        { headers }
                    ).catch(() => null);

                    if (ddosL7Res && ddosL7Res.data.result) {
                        wafRulesets.ddosL7Ruleset = ddosL7Res.data.result.rules?.length > 0 ? 'enabled' : 'disabled';
                    }
                } catch (err) {
                    console.log('WAF Rulesets fetch failed');
                }

                // Fetch IP Access Rules details
                let ipAccessRulesData = [];
                try {
                    const ipRulesRes = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/access_rules/rules?per_page=100`,
                        { headers }
                    ).catch(() => null);

                    if (ipRulesRes && ipRulesRes.data.result) {
                        // Extract relevant info: IP, action, scope
                        ipAccessRulesData = ipRulesRes.data.result.map(rule => ({
                            ip: rule.configuration?.value || 'unknown',
                            action: rule.mode || 'unknown', // e.g., "block", "challenge", "whitelist"
                            scope: rule.scope?.type || 'unknown', // e.g., "zone", "account", "user"
                            notes: rule.notes || ''
                        }));
                        // console.log(`✓ Found ${ipAccessRulesData.length} IP Access Rules`);
                        const scopes = [...new Set(ipAccessRulesData.map(r => r.scope))];
                        // console.log(`Debug API: IP Access Rules Scopes found: ${scopes.join(', ')}`);
                        if (ipAccessRulesData.length > 0) {
                            // console.log('Debug API: First rule sample:', JSON.stringify(ipAccessRulesData[0]));
                        }
                    }
                } catch (err) {
                    console.log('IP Access Rules fetch failed');
                }

                // Fetch Custom Rules (Firewall Rules)
                let customRulesData = {
                    status: 'None',
                    rules: []
                };
                try {
                    const customRulesRes = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/firewall/rules?per_page=100`,
                        { headers }
                    ).catch(() => null);

                    if (customRulesRes && customRulesRes.data.result) {
                        const rules = customRulesRes.data.result;
                        // Check if ANY rule is active (not paused)
                        const anyActive = rules.some(r => !r.paused);
                        customRulesData.status = rules.length > 0 ? (anyActive ? 'Enabled' : 'Disabled') : 'None';

                        customRulesData.rules = rules.map(r => ({
                            description: r.description || 'No Description',
                            action: r.action || 'unknown',
                            status: r.paused ? 'Disabled' : 'Enabled'
                        }));
                    }
                } catch (err) {
                    console.log('Custom Rules fetch failed');
                }

                // Fetch Rate Limiting Rules (Legacy + Rulesets)
                let rateLimitData = {
                    status: 'None',
                    rules: []
                };
                try {
                    // 1. Legacy Rate Limits
                    // console.log(`Fetching Legacy Rate Limits for ${zoneId}...`);
                    const rateLimitRes = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/rate_limits?per_page=100`,
                        { headers }
                    ).catch(err => {
                        console.log('Legacy Rate Limit Error:', err.message);
                        return null;
                    });

                    if (rateLimitRes && rateLimitRes.data.result) {
                        const rules = rateLimitRes.data.result;
                        // console.log(`Found ${rules.length} Legacy Rate Limits`);
                        rules.forEach(r => {
                            rateLimitData.rules.push({
                                description: r.description || 'No Description',
                                match: r.match ? 'Custom Match' : 'All',
                                action: (r.action && typeof r.action === 'object' ? r.action.mode : r.action) || 'unknown',
                                status: r.disabled ? 'Disabled' : 'Enabled'
                            });
                        });
                    }

                    // 2. New Rate Limiting Rulesets (http_ratelimit)
                    // Note: Use 'http_ratelimit' phase for compatibility with most zones
                    const rateLimitRulesetRes = await axios.get(
                        `${CLOUDFLARE_API_BASE}/zones/${zoneId}/rulesets/phases/http_ratelimit/entrypoint`,
                        { headers }
                    ).catch(err => {
                        console.log('Ruleset Rate Limit fetch failed (api):', err.response?.status, err.response?.data?.errors?.[0]?.message);
                        return null;
                    });

                    if (rateLimitRulesetRes && rateLimitRulesetRes.data.result && rateLimitRulesetRes.data.result.rules) {
                        const rules = rateLimitRulesetRes.data.result.rules;
                        // console.log(`Found ${rules.length} Ruleset Rate Limits`);
                        rules.forEach(r => {
                            // Only include if not already present (check description)
                            if (!rateLimitData.rules.some(existing => existing.description === r.description)) {
                                rateLimitData.rules.push({
                                    description: r.description || 'Rate Limiting Rule',
                                    match: r.expression || 'Custom Match',
                                    action: r.action || 'unknown',
                                    status: r.enabled ? 'Enabled' : 'Disabled'
                                });
                            }
                        });
                    }

                    // console.log(`Total Rate Limits collected: ${rateLimitData.rules.length}`);

                    if (rateLimitData.rules.length > 0) {
                        const anyActive = rateLimitData.rules.some(r => r.status === 'Enabled');
                        rateLimitData.status = anyActive ? 'Enabled' : 'Disabled';
                    }

                } catch (err) {
                    console.log('Rate Limit Rules fetch failed', err.message);
                }

                const settings = {
                    // Security
                    // securityLevel removed as requested

                    // SSL/TLS
                    sslMode: sslRes.data.result?.value || 'unknown',
                    minTlsVersion: minTlsRes.data.result?.value || 'unknown',
                    tls13: tls13Res.data.result?.value || 'off',

                    // DNS
                    dnsRecordsCount: dnsRecordsRes.data.result_info?.total_count || 0,

                    // Security Features
                    leakedCredentials: leakedCredsRes.data.result?.value || 'unknown',
                    browserIntegrityCheck: browserCheckRes.data.result?.value || 'off',
                    hotlinkProtection: hotlinkRes.data.result?.value || 'off',
                    zoneLockdownRules: lockdownRes.data.result_info?.total_count || 0,

                    // DDoS Protection
                    ddosProtection: {
                        enabled: ddosSettings.enabled,
                        httpDdos: ddosSettings.httpDdos,
                        sslTlsDdos: ddosSettings.sslTlsDdos,
                        networkDdos: ddosSettings.networkDdos
                    },

                    // WAF Managed Rulesets
                    wafManagedRules: {
                        cloudflareManaged: wafRulesets.cloudflareManaged,
                        owaspCore: wafRulesets.owaspCore,
                        exposedCredentials: wafRulesets.exposedCredentials,
                        ddosL7Ruleset: wafRulesets.ddosL7Ruleset,
                        managedRulesCount: wafRulesets.managedRulesCount,
                        rulesetActions: wafRulesets.rulesetActions
                    },

                    // IP Access Rules
                    ipAccessRules: ipAccessRulesData,

                    // Custom Rules
                    customRules: customRulesData,

                    // Rate Limiting
                    rateLimits: rateLimitData,

                    // Bot Management
                    botManagement: {
                        enabled: botManagementConfig ? true : false,
                        // SBFM fields use sbfm_ prefix
                        definitelyAutomated: botManagementConfig?.sbfm_definitely_automated
                            ? (botManagementConfig.sbfm_definitely_automated.charAt(0).toUpperCase() + botManagementConfig.sbfm_definitely_automated.slice(1))
                            : 'unknown',
                        likelyAutomated: botManagementConfig?.sbfm_likely_automated
                            ? (botManagementConfig.sbfm_likely_automated.charAt(0).toUpperCase() + botManagementConfig.sbfm_likely_automated.slice(1))
                            : 'unknown',
                        verifiedBots: botManagementConfig?.sbfm_verified_bots
                            ? (botManagementConfig.sbfm_verified_bots.charAt(0).toUpperCase() + botManagementConfig.sbfm_verified_bots.slice(1))
                            : 'unknown',
                        blockAiBots: (botManagementConfig?.ai_bots_protection === 'block' ? 'Enabled' : (botManagementConfig?.ai_bots_protection ? 'Disabled' : 'unknown')),
                        superBotFightMode: botManagementConfig?.sbfm_definitely_automated ? true : false
                    }
                };

                // console.log(`✅ Settings fetched:`, settings);

                return NextResponse.json({
                    success: true,
                    data: settings
                });

            } catch (error) {
                console.error('Settings Fetch Error:', error.message);
                return NextResponse.json({
                    success: false,
                    message: 'Failed to fetch zone settings',
                    error: error.message
                }, { status: 500 });
            }
        }

        else if (action === 'get-sync-status') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });
            try {
                const targetSubdomain = body.subdomain || 'ALL_SUBDOMAINS';
                const latestDateStr = await getLatestSyncDate(zoneId, targetSubdomain);
                return NextResponse.json({ success: true, data: { lastSync: latestDateStr } });
            } catch (err) {
                console.error('Error fetching sync status:', err);
                return NextResponse.json({ success: false, message: 'Failed to fetch sync status' }, { status: 500 });
            }
        }

        else if (action === 'get-all-sync-status') {
            try {
                const results = await getAllSyncStatus();
                return NextResponse.json({ success: true, data: results });
            } catch (err) {
                console.error('Error fetching all sync status:', err);
                return NextResponse.json({ success: false, message: 'Failed to fetch all sync status' }, { status: 500 });
            }
        }

        else if (action === 'start-sync-jobs') {
            await ensureSyncRunnerInitialized();
            const zonesToSync = Array.isArray(body.zones) ? body.zones : [];
            if (zonesToSync.length === 0) {
                return NextResponse.json({ success: false, message: 'No zones selected for sync' }, { status: 400 });
            }

            const requestedBy = body.requestedBy || 'unknown';
            const results = [];
            for (const zone of zonesToSync) {
                if (!zone?.id || !zone?.name || !zone?.accountName) {
                    results.push({ zoneId: zone?.id || null, status: 'rejected', reason: 'Invalid zone payload' });
                    continue;
                }
                const existing = await getActiveSyncJobForZone(zone.id);
                if (existing) {
                    results.push({ zoneId: zone.id, zoneName: zone.name, status: 'rejected', reason: `Active job already exists (${existing.status})` });
                    continue;
                }
                const jobId = await createSyncJob({
                    zoneId: zone.id,
                    zoneName: zone.name,
                    accountName: zone.accountName,
                    requestedBy,
                    apiToken: token,
                });
                results.push({ zoneId: zone.id, zoneName: zone.name, status: 'queued', jobId });
            }

            await kickSyncRunner();
            return NextResponse.json({ success: true, data: results });
        }

        else if (action === 'get-sync-jobs') {
            await ensureSyncRunnerInitialized();
            const jobs = await getSyncJobs();
            const sanitized = jobs.map((job) => ({ ...job, api_token: undefined }));
            return NextResponse.json({ success: true, data: sanitized });
        }

        else if (action === 'get-completed-sync-history') {
            const history = await getCompletedSyncJobHistory();
            return NextResponse.json({ success: true, data: history });
        }

        else if (action === 'clear-completed-sync-history') {
            await clearCompletedSyncJobHistory();
            return NextResponse.json({ success: true });
        }

        else if (action === 'force-stop-sync-job') {
            await ensureSyncRunnerInitialized();
            const jobId = body.jobId;
            if (!jobId) return NextResponse.json({ success: false, message: 'Missing jobId' }, { status: 400 });
            const job = await requestStopSyncJob(jobId);
            if (!job) return NextResponse.json({ success: false, message: 'Job not found' }, { status: 404 });
            return NextResponse.json({ success: true, data: { id: jobId, status: job.status, stop_requested: job.stop_requested } });
        }

        else if (action === 'retry-sync-job') {
            await ensureSyncRunnerInitialized();
            const jobId = body.jobId;
            if (!jobId) return NextResponse.json({ success: false, message: 'Missing jobId' }, { status: 400 });
            const job = await requestRetrySyncJob(jobId);
            if (!job) return NextResponse.json({ success: false, message: 'Job not found' }, { status: 404 });
            return NextResponse.json({ success: true, data: { id: jobId, status: job.status, retry_requested: job.retry_requested } });
        }

        else if (action === 'delete-sync-job') {
            const jobId = body.jobId;
            if (!jobId) return NextResponse.json({ success: false, message: 'Missing jobId' }, { status: 400 });
            const job = await getSyncJobById(jobId);
            if (!job) return NextResponse.json({ success: false, message: 'Job not found' }, { status: 404 });
            if (job.status === 'queued' || job.status === 'running') {
                return NextResponse.json({ success: false, message: 'Cannot delete an active job' }, { status: 400 });
            }
            await deleteSyncJob(jobId);
            return NextResponse.json({ success: true });
        }

        else if (action === 'sync-gdcc-history' || action === 'sync-ntbc-history') {
            if (!zoneId) return NextResponse.json({ success: false, message: 'Missing zoneId' }, { status: 400 });

            const encoder = new TextEncoder();

            // Helper to sync one target, per-day for data completeness
            // Zone overview uses full limits; subdomains use reduced limits (less traffic per host)
            const syncTarget = async (controller, targetKey, targetFilter, startDate, yesterday, labelPrefix) => {
                let currentDate = new Date(startDate);
                let syncedDates = 0;
                let errorDates = 0;

                const allDates = [];
                let d = new Date(startDate);
                while (d.getTime() < yesterday.getTime()) {
                    allDates.push(d.toISOString().split('T')[0]);
                    d.setUTCDate(d.getUTCDate() + 1);
                }
                const totalDates = allDates.length;
                if (totalDates === 0) return { syncedDates: 0, errorDates: 0 };

                for (let di = 0; di < allDates.length; di++) {
                    const dStr = allDates[di];
                    const isSubdomainTarget = !!targetFilter;
                    const dStart = isSubdomainTarget
                        ? new Date(`${dStr}T00:00:00+07:00`)
                        : new Date(dStr + 'T00:00:00.000Z');
                    const dEnd = isSubdomainTarget
                        ? new Date(`${dStr}T00:00:00+07:00`)
                        : new Date(dStr + 'T23:59:59.999Z');
                    if (isSubdomainTarget) {
                        dEnd.setUTCDate(dEnd.getUTCDate() + 1);
                    }

                    controller.enqueue(encoder.encode(JSON.stringify({
                        type: 'progress',
                        date: dStr,
                        current: di + 1,
                        total: totalDates,
                        label: labelPrefix
                    }) + '\n'));

                    // ─── Check if already synced (skip re-sync) ───────────────
                    const alreadySynced = await checkDateExists(zoneId, targetKey, dStr);
                    if (alreadySynced) {
                        console.log(`⏭️  [${labelPrefix}] ${dStr} already in DB — skipping`);
                        syncedDates++;
                        continue;
                    }

                    let data = null;
                    for (let attempt = 1; attempt <= 4; attempt++) {
                        try {
                            // Both zone overview and subdomains use the SAME function —
                            // same pattern as get-traffic-analytics / batch report.
                            // targetFilter=null for zone overview, hostname string for subdomain.
                            data = targetFilter
                                ? await fetchSubdomainAnalytics(token, zoneId, targetFilter, dStart, dEnd)
                                : await fetchWithAutoChunking(token, zoneId, targetFilter, dStart, dEnd, labelPrefix);
                            break;
                        } catch (fetchErr) {
                            const status = fetchErr.response?.status;
                            console.warn(`⚠️ [${labelPrefix}] ${dStr} attempt ${attempt} failed (${status || fetchErr.message})`);
                            if (status === 429 && attempt < 4) {
                                const delayMs = Math.min(2000 * (2 ** (attempt - 1)), 15000);
                                controller.enqueue(encoder.encode(JSON.stringify({
                                    type: 'rate_limit',
                                    zoneId,
                                    zoneName: body.zoneName || zoneId,
                                    target: labelPrefix,
                                    date: dStr,
                                    attempt,
                                    delayMs,
                                    message: `Cloudflare rate limited ${body.zoneName || zoneId} on ${dStr} (${labelPrefix}); retrying in ${Math.round(delayMs / 1000)}s.`
                                }) + '\n'));
                                await new Promise(r => setTimeout(r, delayMs));
                            } else if (attempt < 4 && (status === 502 || status === 503 || status === 504)) {
                                await new Promise(r => setTimeout(r, 3000));
                            } else {
                                errorDates++;
                                data = null;
                            }
                        }
                    }

                    // Always save a record for each processed date so:
                    // 1) getLatestSyncDate advances correctly (no re-sync next time)
                    // 2) Zone appears in Currently Backed Up Zones table
                    if (data) {
                        const totalRequests = (data.httpRequestsAdaptiveGroups || []).reduce((s, g) => s + (g.count || 0), 0);
                        const hasFirewall = (data.firewallActivity || []).length > 0;
                        if (totalRequests === 0 && !hasFirewall) {
                            console.log(`⏭️  [${labelPrefix}] ${dStr} — 0 requests, saving empty marker`);
                        }
                        if (body.zoneName) data.zoneName = body.zoneName;
                        if (body.accountName) data.accountName = body.accountName;

                        // SUMMARIZE BEFORE SAVE: Compress 150k rows to stats
                        const summary = summarizeDailyResult(data);
                        await saveDailyStats(zoneId, targetKey, dStr, summary);
                    } else if (data === null && errorDates > 0) {
                        // Fetch failed — save a minimal marker so we don't retry this date forever
                        const marker = { isSummary: true, zoneName: body.zoneName || '', accountName: body.accountName || '', totals: { requests: 0, bytes: 0 }, topUrls: [], topIps: [], firewall: { total: 0 }, _fetchError: true };
                        await saveDailyStats(zoneId, targetKey, dStr, marker);
                    }

                    syncedDates++;
                    // Small delay between days to avoid rate-limiting
                    if (di < allDates.length - 1) {
                        await new Promise(r => setTimeout(r, 500));
                    }
                }
                return { syncedDates, errorDates };
            };

            // Helper to compute start date for a target
            const getStartDate = async (targetKey) => {
                const lastSyncStr = await getLatestSyncDate(zoneId, targetKey);
                let startDate = new Date();
                if (lastSyncStr) {
                    startDate = new Date(lastSyncStr + 'T00:00:00.000Z');
                    startDate.setUTCDate(startDate.getUTCDate() + 1);
                } else {
                    startDate.setUTCDate(startDate.getUTCDate() - 30);
                }
                startDate.setUTCHours(0, 0, 0, 0);
                return startDate;
            };

            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        const requestedSubdomain = body.subdomain && body.subdomain !== 'ALL_SUBDOMAINS'
                            ? body.subdomain
                            : null;
                        const yesterday = new Date();
                        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
                        yesterday.setUTCHours(23, 59, 59, 999);

                        // ─── Pre-check: Zone status ───────────────────────────
                        controller.enqueue(encoder.encode(JSON.stringify({ type: 'phase', phase: 'check', label: 'Checking zone status...' }) + '\n'));
                        let zoneStatus = 'active';
                        try {
                            const zoneInfoResp = await axios.get(`${CLOUDFLARE_API_BASE}/zones/${zoneId}`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            zoneStatus = zoneInfoResp.data?.result?.status || 'active';
                            console.log(`ℹ️  Zone ${zoneId} status: ${zoneStatus}`);
                        } catch (e) {
                            console.warn('Could not check zone status:', e.message);
                        }

                        if (zoneStatus === 'pending' || zoneStatus === 'deactivated') {
                            const msg = `Zone is "${zoneStatus}" — subdomain sync will be skipped. Syncing zone overview only.`;
                            console.warn(`⚠️  ${msg}`);
                            controller.enqueue(encoder.encode(JSON.stringify({ type: 'warning', message: msg }) + '\n'));
                        }

                        if (requestedSubdomain) {
                            if (zoneStatus === 'pending' || zoneStatus === 'deactivated') {
                                controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: `Zone is "${zoneStatus}" — cannot sync ${requestedSubdomain}.` }) + '\n'));
                                controller.close();
                                return;
                            }

                            const subdomainStartDate = await getStartDate(requestedSubdomain);
                            controller.enqueue(encoder.encode(JSON.stringify({ type: 'phase', phase: 'subdomain', label: requestedSubdomain, index: 1, total: 1 }) + '\n'));
                            await syncTarget(controller, requestedSubdomain, requestedSubdomain, subdomainStartDate, yesterday, requestedSubdomain);
                            controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', subdomainCount: 1 }) + '\n'));
                            controller.close();
                            return;
                        }

                        // Step 1: Sync zone overview (ALL_SUBDOMAINS) — always run, even for pending zones
                        const zoneStartDate = await getStartDate('ALL_SUBDOMAINS');
                        controller.enqueue(encoder.encode(JSON.stringify({ type: 'phase', phase: 'zone', label: 'Zone Overview' }) + '\n'));
                        await syncTarget(controller, 'ALL_SUBDOMAINS', null, zoneStartDate, yesterday, 'Zone Overview');

                        // Step 2: Discover subdomains from DNS Records — skip if zone is pending/deactivated
                        if (zoneStatus === 'pending' || zoneStatus === 'deactivated') {
                            console.log(`ℹ️  Zone is ${zoneStatus} — skipping subdomain discovery and sync.`);
                            controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
                            controller.close();
                            return;
                        }

                        controller.enqueue(encoder.encode(JSON.stringify({ type: 'phase', phase: 'discover', label: 'Discovering subdomains from DNS...' }) + '\n'));

                        let subdomains = [];
                        try {
                            // Use REST API DNS records (same as get-dns-records action used by dashboard)
                            const dnsResp = await axios.get(
                                `${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records?per_page=500`,
                                { headers: { 'Authorization': `Bearer ${token}` } }
                            );

                            const dnsRecords = dnsResp.data?.result || [];
                            console.log(`📋 DNS records found: ${dnsRecords.length} for zone ${zoneId}`);

                            // Extract A, AAAA, CNAME host names — same logic as dashboard
                            const hostSet = new Set(
                                dnsRecords
                                    .filter(r => ['A', 'AAAA', 'CNAME'].includes(r.type))
                                    .map(r => r.name)
                                    .filter(Boolean)
                            );

                            // Optionally remove the bare zone name (root domain) — it has less useful per-subdomain data
                            const zoneName = body.zoneName;
                            if (zoneName) hostSet.delete(zoneName);

                            subdomains = Array.from(hostSet).sort();
                            console.log(`✅ Discovered ${subdomains.length} subdomains from DNS:`, subdomains);

                        } catch (e) {
                            console.error('❌ DNS-based subdomain discovery failed:', e.message);
                            controller.enqueue(encoder.encode(JSON.stringify({ type: 'warning', message: `DNS discovery failed: ${e.message}. Continuing without subdomain data.` }) + '\n'));
                        }

                        controller.enqueue(encoder.encode(JSON.stringify({ type: 'discovered', count: subdomains.length, subdomains }) + '\n'));

                        // Step 3: Sync each subdomain individually
                        let sdSuccess = 0;
                        let sdFailed = 0;
                        for (let si = 0; si < subdomains.length; si++) {
                            const sd = subdomains[si];
                            controller.enqueue(encoder.encode(JSON.stringify({ type: 'phase', phase: 'subdomain', label: sd, index: si + 1, total: subdomains.length }) + '\n'));
                            try {
                                const sdStartDate = await getStartDate(sd);
                                await syncTarget(controller, sd, sd, sdStartDate, yesterday, sd);
                                sdSuccess++;
                            } catch (sdErr) {
                                sdFailed++;
                                const msg = `Skipped ${sd}: ${sdErr.response?.status || sdErr.message}`;
                                console.error('❌ Subdomain sync failed:', msg);
                                controller.enqueue(encoder.encode(JSON.stringify({ type: 'warning', message: msg }) + '\n'));
                            }
                        }

                        controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', subdomainCount: subdomains.length }) + '\n'));
                        controller.close();
                    } catch (err) {
                        console.error('Error syncing history:', err);
                        controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: err.message }) + '\n'));
                        controller.close();
                    }
                }
            });

            return new Response(stream, {
                headers: {
                    'Content-Type': 'application/x-ndjson',
                    'Cache-Control': 'no-cache, no-transform',
                    'Connection': 'keep-alive',
                },
            });
        }

        else if (action === 'run-speed-test') {
            const domainVal = body.domainVal || 'nbtc.go.th';
            console.log(`Running speed test for domainVal: ${domainVal}`);
            const browser = await connectChrome();
            const pages = await browser.pages();
            let page = pages.find(p => p.url().includes('cloudflare.com')) || pages[0];
            if (!page) {
                await browser.disconnect();
                return NextResponse.json({ success: false, error: 'No active browser page found.' }, { status: 400 });
            }

            // Bring to front
            await page.bringToFront();

            // Wait for input selector to ensure the page is loaded
            await page.waitForSelector('input[name="url"]', { timeout: 10000 });


            // Update this element to '<input name="region" type="hidden" value="asia-northeast1">'
            await page.evaluate(async () => {
                // Helper to trigger events
                const triggerEvents = (el, val) => {
                    el.value = val;
                    el.setAttribute('value', val);
                    const tracker = el._valueTracker;
                    if (tracker) tracker.setValue(val);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                };

                // Method 0: XPath lookup and parent node lookup
                let input = null;
                const parent = document.getElementById('cf-form-input5');
                if (parent) {
                    input = parent.querySelector('input');
                }
                
                if (!input) {
                    const result = document.evaluate('//*[@id="cf-form-input5"]/input', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    input = result.singleNodeValue;
                }

                if (!input) {
                    input = document.querySelector('input[name="region"]');
                }
                
                if (!input) {
                    input = document.querySelector('[id*="region"]') || document.querySelector('[class*="region"] input');
                }

                // If input is found, attempt direct change
                if (input) {
                    triggerEvents(input, 'asia-northeast1');
                    // Check if value successfully changed
                    if (input.value === 'asia-northeast1') {
                        return; // Done
                    }
                }

                // Dropdown fallback action (React Select wrapper)
                // Try finding option directly without opening first
                let option = document.querySelector('#react-select-4-option-15');
                if (option) {
                    option.click();
                    return;
                }

                // If not found, open the selection box
                const dropdownIndicator = document.querySelector('#cf-form-input5 div[class*="-indicatorContainer"]') || 
                                          document.querySelector('#cf-form-input5 [class*="DropdownIndicator"]') || 
                                          document.querySelector('#cf-form-input5 .react-select__dropdown-indicator') ||
                                          document.querySelector('#cf-form-input5 div.react-select__control div.react-select__indicators div.react-select__indicator');
                
                if (dropdownIndicator) {
                    dropdownIndicator.click();
                    
                    // Wait a short time for listbox to render
                    await new Promise(r => setTimeout(r, 600));
                    
                    option = document.querySelector('#react-select-4-option-15');
                    if (!option) {
                        const options = Array.from(document.querySelectorAll('[id*="-option-"]'));
                        option = options.find(opt => opt.innerText.includes('asia-northeast1') || opt.id.endsWith('-option-15'));
                    }
                    
                    if (option) {
                        option.click();
                    } else {
                        // Click indicator again to close the selection box since we didn't find the option
                        dropdownIndicator.click();
                    }
                    return;
                }

                // Final injection fallback
                const form = document.querySelector('form') || document.querySelector('input[name="url"]')?.closest('form');
                if (form) {
                    // Remove existing input to prevent duplicates
                    const old = form.querySelector('input[name="region"]');
                    if (old) old.remove();

                    const newInput = document.createElement('input');
                    newInput.setAttribute('name', 'region');
                    newInput.setAttribute('type', 'hidden');
                    newInput.setAttribute('value', 'asia-northeast1');
                    newInput.value = 'asia-northeast1';
                    form.appendChild(newInput);
                    triggerEvents(newInput, 'asia-northeast1');
                }
            });

            // Wait a moment for form validation and React state updates
            console.log('Waiting 1500ms for form validation and state updates to settle...');
            await new Promise(r => setTimeout(r, 1500));

            // Log current button state from the DOM to help diagnose failures
            try {
                const buttonInfo = await page.evaluate(() => {
                    const btn = document.querySelector('#add-url > div > div.c_ka.c_kb > button') ||
                                document.querySelector('form button[type="submit"]') ||
                                Array.from(document.querySelectorAll('button')).find(b => 
                                    (b.textContent || '').toLowerCase().includes('run test once')
                                );
                    if (!btn) return { found: false };
                    return {
                        found: true,
                        tagName: btn.tagName,
                        type: btn.getAttribute('type'),
                        disabled: btn.disabled || btn.hasAttribute('disabled'),
                        className: btn.className,
                        textContent: btn.textContent,
                        visible: !!(btn.offsetWidth || btn.offsetHeight || btn.getClientRects().length),
                        rect: btn.getBoundingClientRect() ? {
                            x: btn.getBoundingClientRect().x,
                            y: btn.getBoundingClientRect().y,
                            width: btn.getBoundingClientRect().width,
                            height: btn.getBoundingClientRect().height
                        } : null
                    };
                });
                console.log('🔍 Button status in DOM:', JSON.stringify(buttonInfo, null, 2));
            } catch (err) {
                console.warn('Could not read button status:', err.message);
            }

            // Click the submit button using 8 different sequential strategies
            let clickSuccess = false;
            
            // Method 1: Precise CSS selector click via Puppeteer
            try {
                console.log('Attempting Method 1: Native Puppeteer CSS Selector click...');
                const btnSelector = '#add-url > div > div.c_ka.c_kb > button';
                await page.waitForSelector(btnSelector, { timeout: 3000 });
                // Force remove disabled attribute if it exists, just in case
                await page.evaluate((sel) => {
                    const btn = document.querySelector(sel);
                    if (btn && (btn.disabled || btn.hasAttribute('disabled'))) {
                        console.log('Forcing button enabled in DOM prior to Puppeteer click...');
                        btn.removeAttribute('disabled');
                        btn.disabled = false;
                    }
                }, btnSelector);
                await page.click(btnSelector);
                console.log('Method 1 Success: Clicked via native selector.');
                clickSuccess = true;
            } catch (err) {
                console.warn('Method 1 Failed:', err.message);
            }

            // Method 2: Pressing Enter on the input field (Form submission trigger)
            if (!clickSuccess) {
                try {
                    console.log('Attempting Method 2: Form submit via Enter key on input...');
                    await page.focus('input[name="url"]');
                    await page.keyboard.press('Enter');
                    console.log('Method 2 Success: Dispatched Enter key.');
                    clickSuccess = true;
                    await new Promise(r => setTimeout(r, 1000));
                } catch (err) {
                    console.warn('Method 2 Failed:', err.message);
                }
            }

            // Method 3: DOM level button.click() evaluation after forcing enabled
            if (!clickSuccess) {
                try {
                    console.log('Attempting Method 3: DOM evaluate button.click()...');
                    const domSuccess = await page.evaluate(() => {
                        const btn = document.querySelector('#add-url > div > div.c_ka.c_kb > button') ||
                                    document.querySelector('form button[type="submit"]') ||
                                    Array.from(document.querySelectorAll('button')).find(b => 
                                        (b.textContent || '').toLowerCase().includes('run test once')
                                    );
                        if (btn) {
                            btn.removeAttribute('disabled');
                            btn.disabled = false;
                            btn.click();
                            return true;
                        }
                        return false;
                    });
                    if (domSuccess) {
                        console.log('Method 3 Success: Evaluated DOM button click.');
                        clickSuccess = true;
                    } else {
                        console.warn('Method 3 Failed: Button not found in DOM.');
                    }
                } catch (err) {
                    console.warn('Method 3 Failed with error:', err.message);
                }
            }

            // Method 4: DOM level form dispatchEvent submit
            if (!clickSuccess) {
                try {
                    console.log('Attempting Method 4: Form submit dispatchEvent...');
                    const formSuccess = await page.evaluate(() => {
                        const form = document.querySelector('form') || document.querySelector('input[name="url"]')?.closest('form');
                        if (form) {
                            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                            try { form.submit(); } catch (e) {}
                            return true;
                        }
                        return false;
                    });
                    if (formSuccess) {
                        console.log('Method 4 Success: Submitted form container.');
                        clickSuccess = true;
                    } else {
                        console.warn('Method 4 Failed: Form element not found.');
                    }
                } catch (err) {
                    console.warn('Method 4 Failed with error:', err.message);
                }
            }

            // Method 5: XPath text selector find & Puppeteer click (with forced enabled)
            if (!clickSuccess) {
                try {
                    console.log('Attempting Method 5: XPath text selection & click...');
                    const buttons = await page.$$('button');
                    for (const btn of buttons) {
                        const text = await page.evaluate(el => el.textContent, btn);
                        if (text && text.toLowerCase().includes('run test once')) {
                            await page.evaluate(el => {
                                el.removeAttribute('disabled');
                                el.disabled = false;
                            }, btn);
                            await btn.click();
                            console.log('Method 5 Success: Clicked button containing target text.');
                            clickSuccess = true;
                            break;
                        }
                    }
                } catch (err) {
                    console.warn('Method 5 Failed:', err.message);
                }
            }

            // Method 6: Click by coordinates / bounding box using Puppeteer mouse
            if (!clickSuccess) {
                try {
                    console.log('Attempting Method 6: Clicking at element coordinates...');
                    const btnSelector = '#add-url > div > div.c_ka.c_kb > button';
                    const buttonEl = await page.$(btnSelector);
                    if (buttonEl) {
                        const box = await buttonEl.boundingBox();
                        if (box) {
                            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                            console.log('Method 6 Success: Clicked bounding box center.');
                            clickSuccess = true;
                        }
                    }
                } catch (err) {
                    console.warn('Method 6 Failed:', err.message);
                }
            }

            // Method 7: DOM dispatch mouse & pointer events directly to the button
            if (!clickSuccess) {
                try {
                    console.log('Attempting Method 7: DOM pointer/mouse events simulation...');
                    const eventsSuccess = await page.evaluate(() => {
                        const btn = document.querySelector('#add-url > div > div.c_ka.c_kb > button') ||
                                    document.querySelector('form button[type="submit"]') ||
                                    Array.from(document.querySelectorAll('button')).find(b => 
                                        (b.textContent || '').toLowerCase().includes('run test once')
                                    );
                        if (btn) {
                            btn.removeAttribute('disabled');
                            btn.disabled = false;
                            
                            const dispatch = (type) => {
                                const ev = new MouseEvent(type, { bubbles: true, cancelable: true, view: window });
                                btn.dispatchEvent(ev);
                            };
                            
                            dispatch('pointerdown');
                            dispatch('mousedown');
                            dispatch('pointerup');
                            dispatch('mouseup');
                            dispatch('click');
                            return true;
                        }
                        return false;
                    });
                    if (eventsSuccess) {
                        console.log('Method 7 Success: Dispatched DOM mouse events.');
                        clickSuccess = true;
                    }
                } catch (err) {
                    console.warn('Method 7 Failed:', err.message);
                }
            }

            // Method 8: Focus button and press Enter/Space key
            if (!clickSuccess) {
                try {
                    console.log('Attempting Method 8: Focus button and keyboard press Enter/Space...');
                    const btnSelector = '#add-url > div > div.c_ka.c_kb > button';
                    await page.focus(btnSelector);
                    await page.keyboard.press('Enter');
                    await new Promise(r => setTimeout(r, 200));
                    await page.keyboard.press('Space');
                    console.log('Method 8 Success: Focused and pressed Enter/Space.');
                    clickSuccess = true;
                } catch (err) {
                    console.warn('Method 8 Failed:', err.message);
                }
            }

            if (!clickSuccess) {
                console.error('❌ ALL 8 CLICK METHODS FAILED.');
            }

            await browser.disconnect();
            return NextResponse.json({ success: clickSuccess, message: clickSuccess ? 'Speed test started successfully' : 'Failed to click Run Test Once' });
        }

        else if (action === 'check-speed-results') {
            const browser = await connectChrome();
            const pages = await browser.pages();
            let page = pages.find(p => p.url().includes('cloudflare.com')) || pages[0];
            if (!page) {
                await browser.disconnect();
                return NextResponse.json({ success: false, error: 'No active browser page found.' }, { status: 400 });
            }

            // Search for "Speed test result"
            const found = await page.evaluate(() => {
                const bodyText = document.body.innerText;
                return bodyText.includes('Speed test result');
            });

            await browser.disconnect();
            return NextResponse.json({ success: true, found });
        }

        else if (action === 'click-speed-mobile') {
            const browser = await connectChrome();
            const pages = await browser.pages();
            let page = pages.find(p => p.url().includes('cloudflare.com')) || pages[0];
            if (!page) {
                await browser.disconnect();
                return NextResponse.json({ success: false, error: 'No active browser page found.' }, { status: 400 });
            }

            await page.bringToFront();

            const selector = '#react-app > div > div > div > div.grid.grid-cols-1.content-start.min-h-screen.transition-\\[grid-template-columns\\].duration-250.ease-\\[cubic-bezier\\(0\\.77\\,0\\,0\\.175\\,1\\)\\].will-change-\\[grid-template-columns\\].grid-rows-1 > div > main > div > div > div:nth-child(4) > div.c_gv.c_rh.c_hi.c_ri.c_is.c_it.c_mm > a:nth-child(2)';
            
            try {
                await page.waitForSelector(selector, { timeout: 10000 });
                await page.click(selector);
                console.log('Successfully clicked Mobile speed test tab.');
            } catch (err) {
                console.warn('Selector failed to click, falling back to document link lookup:', err.message);
                await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a'));
                    const mobileLink = links.find(a => {
                        const span = a.querySelector('span');
                        return (span && span.textContent.trim() === 'Mobile') || a.textContent.trim() === 'Mobile';
                    });
                    if (mobileLink) {
                        mobileLink.click();
                    }
                });
            }

            await new Promise(r => setTimeout(r, 3000));
            await browser.disconnect();
            return NextResponse.json({ success: true });
        }

        else {
            return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        console.error('❌ Server Error:', error.message);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ success: true, message: 'Cloudflare API Scraper Running' });
}
