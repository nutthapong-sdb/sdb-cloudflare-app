'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/app/utils/auth';
import { getUserProfileAction } from '@/app/actions/authActions';
import { loadTemplate, saveTemplate, loadStaticTemplate, saveStaticTemplate, loadMiddleTemplate, saveMiddleTemplate, listTemplates } from '@/app/utils/templateApi';
import ManageTemplateModal from './ManageTemplateModal';
import AutoReportModal from './AutoReportModal';
import DepartmentModal from './DepartmentModal';
import SearchableDropdown from './SearchableDropdown';
import { saveCloudflareTokenAction } from '@/app/actions/authActions';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
    ShieldAlert, Activity, Clock, Globe,
    AlertTriangle, FileText, LayoutDashboard, Database,
    Search, Bell, Menu, Download, Server, Key, List, X, Edit3, Copy, FileType, Settings, Check, Trash2, Calendar, Users
} from 'lucide-react';
import jsPDF from 'jspdf';
import * as htmlToImage from 'html-to-image';
import Swal from 'sweetalert2';
import { THEMES } from '@/app/utils/themes';
import { Editor } from '@tinymce/tinymce-react';
import { REPORT_VARIABLES, STATIC_VARIABLES } from './variableDefinitions';

// --- CONSTANTS ---
// --- CONSTANTS ---
const CHART_COLORS = [
    '#ef4444', // Red 500
    '#3b82f6', // Blue 500
    '#10b981', // Emerald 500
    '#f59e0b', // Amber 500
    '#8b5cf6', // Violet 500
    '#ec4899', // Pink 500
    '#06b6d4', // Cyan 500
    '#f97316', // Orange 500
    '#84cc16', // Lime 500
    '#6366f1', // Indigo 500
    '#eab308', // Yellow 500
    '#d946ef', // Fuchsia 500
    '#14b8a6', // Teal 500
    '#f43f5e', // Rose 500
    '#0ea5e9', // Sky 500
    '#a855f7', // Purple 500
    '#64748b', // Slate 500
    '#a1a1aa', // Zinc 400
];

const DEFAULT_TEMPLATE = `
<h2 style="font-size: 22pt; font-weight: bold; color: #1a56db; margin-bottom: 0.5em;">สรุปรายงาน WAF (Executive Summary)</h2>

<p style="text-align: justify; text-indent: 1.5cm;">
    จากภาพรายงานการใช้งานและความปลอดภัยของระบบ <em>Web Application Firewall</em> โดยสรุปข้อมูลจาก <span style="color: #f97316; font-weight: bold;">Cloudflare</span>
    ในช่วงเวลา <strong>@TIME_RANGE</strong> ของ URL <span style="background-color: #ffff00;">@DOMAIN</span> รายละเอียดดังนี้
</p>

<h3 style="font-size: 18pt; font-weight: bold; border-bottom: 2px solid #ddd; padding-bottom: 5px; margin-top: 20px;">1. ภาพรวมการใช้งาน (Traffic Overview)</h3>

<ul class="list-disc pl-10 space-y-1">
    <li>การใช้งาน Request ทั้งหมด <strong>@TOTAL_REQ</strong> request</li>
    <li>ช่วงเวลาตอบสนองเฉลี่ย (Average Response Time): <u>@AVG_TIME วินาที</u></li>
    <li>เหตุการณ์ที่ถูกจัดการโดยไฟร์วอลล์:
        <span style="color: #dc2626;">Block <strong>@BLOCK_PCT%</strong></span> / 
        <span style="color: #16a34a;">Log <strong>@LOG_PCT%</strong></span>
    </li>
    <li>ปริมาณการเรียกใช้งานสูงสุด (Peak Traffic) เมื่อเวลา <strong>@PEAK_TIME</strong> จำนวน <strong>@PEAK_COUNT</strong> Requests</li>
</ul>

<h3 style="font-size: 18pt; font-weight: bold; border-bottom: 2px solid #ddd; padding-bottom: 5px; margin-top: 20px;">2. ข้อมูลเชิงลึก (Detailed Statistics)</h3>

<h4 style="font-size: 16pt; font-weight: bold; margin-top: 15px;">2.1 URL ที่มีการเรียกใช้งานมากที่สุด 3 อันดับ</h4>
@TOP_URLS_LIST

<h4 style="font-size: 16pt; font-weight: bold; margin-top: 15px;">2.2 IP ที่มีการเชื่อมต่อมากที่สุด 3 อันดับ</h4>
@TOP_IPS_LIST

<div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 20px;">
    <strong>ข้อมูลผู้ใช้งาน (Client Info):</strong>
    <ul class="list-disc pl-10 space-y-1 mt-2">
        <li>User Agent ที่พบบ่อยที่สุด: <span style="font-family: monospace;">@TOP_UA_AGENT</span> (<strong>@TOP_UA_COUNT</strong> ครั้ง)</li>
        <li>ช่วงเวลาที่มีการโจมตีสูงสุด: <span style="color: #dc2626; font-weight: bold;">@PEAK_ATTACK_TIME</span> (<strong>@PEAK_ATTACK_COUNT</strong> Requests)</li>
        <li>ช่วงเวลาที่มีการตอบกลับ HTTP สูงสุด: <strong>@PEAK_HTTP_TIME</strong> (<strong>@PEAK_HTTP_COUNT</strong> Requests)</li>
    </ul>
</div>

<h3 style="font-size: 18pt; font-weight: bold; border-bottom: 2px solid #ddd; padding-bottom: 5px; margin-top: 20px;">3. ข้อมูลความปลอดภัย (Security Threats)</h3>

<p><strong>อันดับ WAF Rules ที่ถูกใช้มากที่สุด 3 อันดับ:</strong></p>
@TOP_RULES_LIST

<p><strong>5 อันดับ ผู้โจมตีสูงสุด (Top 5 Attackers):</strong></p>
@TOP_ATTACKERS_LIST
`;


// Helper to generate HTML tables for lists
const generateHtmlTable = (headers, rows, styles = {}) => {
    const thStyle = "border: 1px solid black; padding: 8px; background-color: #f3f4f6; font-weight: bold;";
    const tdStyle = "border: 1px solid black; padding: 8px;";

    let html = `<table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd; margin-top: 0; margin-bottom: 0; ${styles.table || ''}">
        <thead><tr>`;

    headers.forEach(h => {
        html += `<th style="${thStyle} width: ${h.width || 'auto'}; text-align: ${h.align || 'left'};">${h.label}</th>`;
    });

    html += `</tr></thead><tbody>`;

    rows.forEach(row => {
        html += `<tr>`;
        row.forEach((cell, idx) => {
            const align = headers[idx]?.align || 'left';
            html += `<td style="${tdStyle} text-align: ${align};">${cell}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    return html;
};



// Helper for Thai Date
const formatThaiDate = (date) => {
    return date.toLocaleString('th-TH', {
        year: '2-digit', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    });
};

// --- TEMPLATE PROCESSING ---
// Helper to escape special regex characters
const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const formatCompactNumber = (num) => {
    if (!num || isNaN(num)) return '0';
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'k';
    return num.toLocaleString();
};

const formatEventCount = (num) => {
    return formatCompactNumber(num);
};

const getCountryName = (code) => {
    try {
        if (!code || code === 'T1' || code === 'XX' || code === 'Unknown' || code === 'Tor') return code || 'Unknown';
        const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
        return displayNames.of(code) || code;
    } catch (e) {
        return code;
    }
};

const formatActionName = (action) => {
    if (!action) return '-';
    const lower = action.toLowerCase();
    if (lower === 'challenge') return 'Interactive Challenge';
    if (lower === 'managed_challenge') return 'Managed Challenge';
    if (lower === 'js_challenge' || lower === 'jschallenge') return 'JS Challenge';

    return action.replace(/_/g, ' ').split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
};

const processTemplate = (tmpl, safeData, now = new Date(), dashboardImage = null) => {
    // If static template mode, return raw HTML (no replacement)
    // Mode check removed here as we pass safeData specifically for processing
    let html = tmpl;

    const startDate = safeData.startDate ? new Date(safeData.startDate + 'T00:00:00.000Z') : new Date(now.getTime() - 1440 * 60 * 1000);
    const endDate = safeData.endDate ? new Date(Math.min(new Date(safeData.endDate + 'T23:59:59.999Z').getTime(), now.getTime())) : now;
    const timeRangeStr = `${formatThaiDate(startDate)} - ${formatThaiDate(endDate)}`;
    const avgTimeSec = safeData.avgTime ? (safeData.avgTime / 1000).toFixed(3) : "0.000";
    const totalFirewall = (safeData.blockedEvents || 0) + (safeData.logEvents || 0);
    const blockPct = totalFirewall > 0 ? ((safeData.blockedEvents / totalFirewall) * 100).toFixed(2) : "0.00";
    const logPct = totalFirewall > 0 ? ((safeData.logEvents / totalFirewall) * 100).toFixed(2) : "0.00";
    const topUA = safeData.topUserAgents && safeData.topUserAgents.length > 0 ? safeData.topUserAgents[0] : { agent: '-', count: 0 };
    const domainDisplay = safeData.domain === 'ALL_SUBDOMAINS' ? `ทุก Subdomain ของ Domain ${safeData.zoneName || '...'}` : safeData.domain;

    // 1. Simple Replacements
    const replacements = {
        '@TIME_RANGE': timeRangeStr,
        '@DOMAIN': domainDisplay,
        '@TOTAL_REQ': (safeData.totalRequests || 0).toLocaleString(),
        '@AVG_TIME': avgTimeSec,
        '@BLOCK_PCT': blockPct,
        '@LOG_PCT': logPct,
        '@PEAK_TIME': safeData.peakTime || '-',
        '@PEAK_COUNT': (safeData.peakCount || 0).toLocaleString(),
        '@TOP_UA_AGENT': topUA.agent,
        '@TOP_UA_COUNT': topUA.count.toLocaleString(),
        '@PEAK_ATTACK_TIME': safeData.peakAttack?.time || '-',
        '@PEAK_ATTACK_COUNT': (safeData.peakAttack?.count || 0).toLocaleString(),
        '@PEAK_HTTP_TIME': safeData.peakHttpStatus?.time || '-',
        '@PEAK_HTTP_COUNT': (safeData.peakHttpStatus?.count || 0).toLocaleString(),
        '@DAY': now.getDate().toString(),
        '@MONTH': now.toLocaleString('th-TH', { month: 'long' }),
        '@YEAR': (now.getFullYear() + 543).toString(),
        '@FULL_DATE': now.toLocaleString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
        '@ACCOUNT_NAME': safeData.accountName || '-',
        '@ZONE_NAME': safeData.zoneName || '-',
        // Zone Settings (Security Level removed)
        '@BOT_MANAGEMENT_STATUS': safeData.botManagementEnabled || 'unknown',
        '@BLOCK_AI_BOTS': safeData.blockAiBots || 'unknown',
        '@DEFINITELY_AUTOMATED': safeData.definitelyAutomated || 'unknown',
        '@LIKELY_AUTOMATED': safeData.likelyAutomated || 'unknown',
        '@VERIFIED_BOTS': safeData.verifiedBots || 'unknown',
        // SSL/TLS Settings
        '@SSL_MODE': safeData.sslMode || 'unknown',
        '@MIN_TLS_VERSION': safeData.minTlsVersion || 'unknown',
        '@TLS_1_3': safeData.tls13 || 'unknown',
        // DNS
        '@DNS_RECORDS': safeData.dnsRecordsStatus || 'unknown',
        // Additional Security
        '@LEAKED_CREDENTIALS': safeData.leakedCredentials || 'unknown',
        '@BROWSER_INTEGRITY_CHECK': safeData.browserIntegrityCheck || 'unknown',
        '@HOTLINK_PROTECTION': safeData.hotlinkProtection || 'unknown',


        // DDoS Protection - individual protections (convert Always On to Enable)
        '@HTTP_DDOS_PROTECTION': (safeData.httpDdosProtection === 'Always On' ? 'Enable' : safeData.httpDdosProtection) || 'unknown',
        '@SSL_TLS_DDOS_PROTECTION': (safeData.sslTlsDdosProtection === 'Always On' ? 'Enable' : safeData.sslTlsDdosProtection) || 'unknown',
        '@NETWORK_DDOS_PROTECTION': (safeData.networkDdosProtection === 'Always On' ? 'Enable' : safeData.networkDdosProtection) || 'unknown',
        // Note: @DDOS_PROTECTION is computed below based on the 3 individual protections
        // WAF Managed Rules
        '@CLOUDFLARE_MANAGED_RULESET': safeData.cloudflareManaged || 'unknown',
        '@OWASP_CORE_RULESET': safeData.owaspCore || 'unknown',


        '@MANAGED_RULES_COUNT': safeData.managedRulesCount || '0',

        // IP Access Rules

        // Custom Rules
        '@CUSTOM_RULES_STATUS': safeData.customRules?.status || 'None',

        // Rate Limiting
        '@RATE_LIMIT_RULES_STATUS': safeData.rateLimits?.status || 'None',

        // --- New Traffic & Cache Stats ---
        '@ZONE_TOTAL_REQ': (safeData.zoneTotalRequests || (safeData.totalRequests || 0).toLocaleString()),
        '@ZONE_CACHE_HIT_REQ': safeData.zoneCacheHitRequests || '0',
        '@ZONE_CACHE_HIT_REQ_RATIO': safeData.zoneCacheHitRequestsRatio || '0.00%',
        '@ZONE_TOTAL_BANDWIDTH': safeData.zoneTotalDataTransfer || '0.00 GB',
        '@ZONE_CACHE_HIT_BANDWIDTH': safeData.zoneCacheHitDataTransfer || '0.00 GB',
        '@ZONE_CACHE_HIT_BANDWIDTH_RATIO': safeData.zoneCacheHitDataTransferRatio || '0.00%',
        // --- New Firewall Event Stats ---
        '@FW_TOTAL_EVENTS': formatEventCount(safeData.fwEvents?.total || 0),
        '@FW_MANAGED_EVENTS': formatEventCount(safeData.fwEvents?.managed || 0),
        '@FW_CUSTOM_EVENTS': formatEventCount(safeData.fwEvents?.custom || 0),
        '@FW_BIC_EVENTS': formatEventCount(safeData.fwEvents?.bic || 0),
        '@FW_ACCESS_EVENTS': formatEventCount(safeData.fwEvents?.access || 0),
        // --- Single Value Stats ---
        '@TOP_IP_VAL': safeData.topIps && safeData.topIps.length > 0 ? safeData.topIps[0].ip : '-',
        '@TOP_UA_VAL': safeData.topUserAgents && safeData.topUserAgents.length > 0 ? safeData.topUserAgents[0].agent : '-',
        '@TOP_COUNTRY_VAL': safeData.topCountries && safeData.topCountries.length > 0 ? getCountryName(safeData.topCountries[0].name) : '-',
        '@TOP_HOST_VAL': safeData.topHosts && safeData.topHosts.length > 0 ? safeData.topHosts[0].host : '-',
        // Page Break for Word
        '@PAGE_BREAK': '<br clear="all" style="page-break-before:always" />',
        // Dashboard Screenshot Image
        '@DASHBOARD_IMAGE': dashboardImage ? `<div class="mb-6" style="text-align: center;"><img src="${dashboardImage}" alt="Dashboard Snapshot" width="504" style="height: auto; display: block; margin: 0 auto;" /></div>` : '',
    };

    // CRITICAL: Process special placeholders FIRST before simple replacements
    // This prevents conflicts like @DNS_RECORDS replacing part of @DNS_RECORDS_ROWS

    // Compute DDOS_PROTECTION based on the 3 individual protections
    // Logic: Enable if any is Enable, Disable if all are Disable
    const computeDdosProtectionStatus = () => {
        const protections = [
            replacements['@HTTP_DDOS_PROTECTION'],
            replacements['@SSL_TLS_DDOS_PROTECTION'],
            replacements['@NETWORK_DDOS_PROTECTION']
        ];

        // Check if any protection is Enable
        const hasEnabled = protections.some(p => p === 'Enable');
        if (hasEnabled) return 'Enable';

        // Check if all protections are Disable
        const allDisabled = protections.every(p => p === 'Disable');
        if (allDisabled) return 'Disable';

        // Otherwise unknown
        return 'unknown';
    };

    // Add computed DDOS_PROTECTION to replacements
    replacements['@DDOS_PROTECTION'] = computeDdosProtectionStatus();

    // DNS Records - Real data from API (Proxied only)
    // Format: 3 columns - empty | DNS name (Type:X name) with 8-space indent | Proxy status
    let dnsRowsHtml = '';

    if (safeData.dnsRecords && safeData.dnsRecords.length > 0) {
        // Filter only Proxied records
        const proxiedRecords = safeData.dnsRecords.filter(record => record.proxied === true);

        proxiedRecords.forEach(record => {
            // Use single line to avoid line breaks in Word export
            // Add 8 spaces (using &nbsp; for non-breaking spaces) before the DNS record
            const indent = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
            dnsRowsHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">${indent}Type:${record.type} ${record.name}</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">Proxied</span></p></td></tr>`;
        });
        console.log(`Generated ${proxiedRecords.length} Proxied DNS record rows (out of ${safeData.dnsRecords.length} total) for domain report`);
    } else {
        console.log('No DNS records found for domain report');
    }

    // Smart replacement: DNS Records
    // Regex explanation: Match <tr...> content @VARIABLE content </tr>
    // (?:(?!<\/tr>)[\s\S])*  matches any content that does NOT contain "</tr>"
    const dnsRegex = /<tr[^>]*>(?:(?!<\/tr>)[\s\S])*?@DNS_TOTAL_ROWS(?:(?!<\/tr>)[\s\S])*?<\/tr>/i;
    if (dnsRegex.test(html)) {
        if (dnsRowsHtml) {
            // Has data: replace with new rows
            html = html.replace(dnsRegex, dnsRowsHtml);
        } else {
            // Empty data: remove the entire row
            html = html.replace(dnsRegex, '');
        }
    } else {
        // Fallback: simple replacement (no <tr> wrapper found)
        html = html.replace(/@DNS_TOTAL_ROWS(@)?/g, dnsRowsHtml);
    }

    // IP Access Rules - Real data from API
    // Format according to user requirements:
    // Row 1: Column 2 = "Applies to: All websites in account", Column 3 = empty
    // Row 2+: Column 2 = IP address, Column 3 = Action (e.g., Block)
    let ipAccessRulesHtml = '';

    if (safeData.ipAccessRules && Array.isArray(safeData.ipAccessRules)) {
        console.log(`Debug IP Access Rules: Found ${safeData.ipAccessRules.length} total rules in safeData`);
        console.log('Debug IP Access Rules Data:', JSON.stringify(safeData.ipAccessRules));
    } else {
        console.log('Debug IP Access Rules: safeData.ipAccessRules is missing or not an array', safeData.ipAccessRules);
    }

    if (safeData.ipAccessRules && Array.isArray(safeData.ipAccessRules) && safeData.ipAccessRules.length > 0) {
        // Group rules by scope
        const accountRules = safeData.ipAccessRules.filter(rule => rule.scope === 'account' || rule.scope === 'organization');
        const zoneRules = safeData.ipAccessRules.filter(rule => rule.scope === 'zone');

        if (accountRules.length > 0) {
            // Row 1: Scope header
            ipAccessRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">Applies to: All websites in account</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';"> </span></p></td></tr>`;

            // Row 2+: IP rules
            // Row 2+: IP rules
            accountRules.forEach(rule => {
                if (rule.mode === 'disable' || rule.mode === 'disabled') return;
                const actionName = rule.mode || rule.action;
                const actionDisplay = 'Action: ' + formatActionName(actionName);
                ipAccessRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${rule.ip}</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">${actionDisplay}</span></p></td></tr>`;
            });

            console.log(`Generated ${accountRules.length} IP Access Rule rows (account-level) for domain report`);
        }

        if (zoneRules.length > 0) {
            // Header for Zone rules
            ipAccessRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">Applies to: This website</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';"> </span></p></td></tr>`;

            // Zone rules rows
            // Zone rules rows
            zoneRules.forEach(rule => {
                if (rule.mode === 'disable' || rule.mode === 'disabled') return;
                const actionName = rule.mode || rule.action;
                const actionDisplay = 'Action: ' + formatActionName(actionName);
                ipAccessRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${rule.ip}</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">${actionDisplay}</span></p></td></tr>`;
            });
            console.log(`Generated ${zoneRules.length} IP Access Rule rows (zone-level) for domain report`);
        }
    } else {
        console.log('No IP Access Rules found for domain report');
    }

    // Smart replacement: IP Access Rules
    const ipAccessRegex = /<tr[^>]*>(?:(?!<\/tr>)[\s\S])*?@IP_ACCESS_RULES_ROWS(?:(?!<\/tr>)[\s\S])*?<\/tr>/i;
    if (ipAccessRegex.test(html)) {
        if (ipAccessRulesHtml) {
            // Has data: replace with new rows
            html = html.replace(ipAccessRegex, ipAccessRulesHtml);
        } else {
            // Empty data: remove the entire row
            html = html.replace(ipAccessRegex, '');
        }
    } else {
        // Fallback: simple replacement (no <tr> wrapper found)
        html = html.replace(/@IP_ACCESS_RULES_ROWS(@)?/g, ipAccessRulesHtml);
    }

    // Custom Rules - Real data from API
    let customRulesHtml = '';
    if (safeData.customRules && safeData.customRules.rules && safeData.customRules.rules.length > 0) {
        safeData.customRules.rules.forEach(rule => {
            // Use 8-space indent for the description
            const indent = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
            // SKIP if Filtered (Status Disabled)
            const status = rule.status || '';
            if (status.toLowerCase() === 'disabled') return;

            const actionName = rule.action || status;
            const actionDisplay = 'Action: ' + formatActionName(actionName);

            customRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">${indent}${rule.description}</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">${actionDisplay}</span></p></td></tr>`;
        });
    }
    // Smart replacement: Custom Rules
    const customRulesRegex = /<tr[^>]*>(?:(?!<\/tr>)[\s\S])*?@CUSTOM_RULES_ROWS(?:(?!<\/tr>)[\s\S])*?<\/tr>/i;
    if (customRulesRegex.test(html)) {
        if (customRulesHtml) {
            // Has data: replace with new rows
            html = html.replace(customRulesRegex, customRulesHtml);
        } else {
            // Empty data: remove the entire row
            html = html.replace(customRulesRegex, '');
        }
    } else {
        // Fallback: simple replacement (no <tr> wrapper found)
        html = html.replace(/@CUSTOM_RULES_ROWS(@)?/g, customRulesHtml);
    }

    // Rate Limiting Rules - Real data from API
    let rateLimitRulesHtml = '';
    if (safeData.rateLimits && safeData.rateLimits.rules && safeData.rateLimits.rules.length > 0) {
        safeData.rateLimits.rules.forEach(rule => {
            // Use 8-space indent for the description
            const indent = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
            // SKIP if Filtered (Status Disabled)
            const status = rule.status || '';
            if (status.toLowerCase() === 'disabled') return;

            const actionName = rule.action || status;
            const actionDisplay = 'Action: ' + formatActionName(actionName);

            rateLimitRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">${indent}${rule.description}</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">${actionDisplay}</span></p></td></tr>`;
        });
    }

    // Smart replacement: Rate Limit Rules
    const rateLimitRegex = /<tr[^>]*>(?:(?!<\/tr>)[\s\S])*?@RATE_LIMITING_RULES_ROWS(?:(?!<\/tr>)[\s\S])*?<\/tr>/i;
    if (rateLimitRegex.test(html)) {
        if (rateLimitRulesHtml) {
            // Has data: replace with new rows
            html = html.replace(rateLimitRegex, rateLimitRulesHtml);
        } else {
            // Empty data: remove the entire row
            html = html.replace(rateLimitRegex, '');
        }
    } else {
        // Fallback: simple replacement (no <tr> wrapper found)
        html = html.replace(/@RATE_LIMITING_RULES_ROWS(@)?/g, rateLimitRulesHtml);
    }

    // Sort keys by length descending to prevent shorter keys from partial matching longer ones
    // Example: @ZONE_CACHE_HIT_REQ vs @ZONE_CACHE_HIT_REQ_RATIO
    const sortedKeys = Object.keys(replacements).sort((a, b) => b.length - a.length);

    // Now do simple text replacements
    for (const key of sortedKeys) {
        const val = replacements[key];
        // Support @VARIABLE and @VARIABLE@
        // Escape special regex characters in the key
        const escapedKey = escapeRegExp(key);
        const regex = new RegExp(escapedKey + '(@)?', 'g');
        html = html.replace(regex, val);
    }

    // 2. Table Generators

    // Top URLs Table
    const topUrlsHtml = generateHtmlTable(
        [
            { label: 'ลำดับ', width: '10%', align: 'center' },
            { label: 'รายการ (URL)', width: '70%' },
            { label: 'จำนวน (Count)', width: '20%', align: 'right' }
        ],
        (safeData.topUrls || []).slice(0, 3).map((item, idx) => [idx + 1, item.path, formatCompactNumber(item.count)])
    );
    html = html.replace(/@TOP_URLS_LIST(@)?/g, topUrlsHtml);

    // Top IPs Table
    const topIpsHtml = generateHtmlTable(
        [
            { label: 'Client IP', width: '70%' },
            { label: 'จำนวน (Count)', width: '30%', align: 'right' }
        ],
        (safeData.topIps || []).slice(0, 3).map(item => [item.ip, formatCompactNumber(item.count)])
    );
    html = html.replace(/@TOP_IPS_LIST(@)?/g, topIpsHtml);

    // Top Rules Table
    const topRulesHtml = generateHtmlTable(
        [
            { label: 'Rule Name (ID)', width: '70%' },
            { label: 'จำนวน (Count)', width: '30%', align: 'right' }
        ],
        (safeData.topRules || []).slice(0, 3).map(item => [item.rule, formatCompactNumber(item.count)])
    );
    html = html.replace(/@TOP_RULES_LIST(@)?/g, topRulesHtml);

    // Top Attackers Table
    const topAttackersHtml = generateHtmlTable(
        [
            { label: 'IP' },
            { label: 'ประเทศ (Country)' },
            { label: 'จำนวน (Count)', align: 'right' },
            { label: 'ประเภท (Type)' }
        ],
        (safeData.topAttackers || []).slice(0, 5).map(item => [item.ip, getCountryName(item.country), formatCompactNumber(item.count), item.type])
    );
    html = html.replace(/@TOP_ATTACKERS_LIST(@)?/g, topAttackersHtml);

    // Top Sources Table
    const topSourcesHtml = generateHtmlTable(
        [
            { label: 'Type (Security Source)', width: '70%' },
            { label: 'จำนวน (Count)', width: '30%', align: 'right' }
        ],
        (safeData.topFirewallSources || []).slice(0, 5).map(item => [item.source, item.count.toLocaleString()])
    );
    html = html.replace(/@TOP_SOURCES_LIST(@)?/g, topSourcesHtml);

    const zoneTopCountriesReqHtml = (safeData.zoneTopCountriesReq || []).length > 0
        ? '<ol style="margin: 0; padding-left: 20px;">' +
        (safeData.zoneTopCountriesReq || []).map((item, idx) =>
            `<li style="margin: 0; padding: 0;">${getCountryName(item.name)} จำนวน Request <strong>${formatCompactNumber(item.requests)}</strong></li>`
        ).join('') +
        '</ol>'
        : '-';
    html = html.replace(/@ZONE_TOP_COUNTRIES_REQ(@)?/g, zoneTopCountriesReqHtml);

    // Top Countries (Zone) - Data Transfer List
    const zoneTopCountriesBytesHtml = (safeData.zoneTopCountriesBytes || []).length > 0
        ? '<ol style="margin: 0; padding-left: 20px;">' +
        (safeData.zoneTopCountriesBytes || []).map((item, idx) =>
            `<li style="margin: 0; padding: 0;">${getCountryName(item.name)} จำนวน Transfer <strong>${(item.bytes / (1024 * 1024 * 1024)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GB</strong></li>`
        ).join('') +
        '</ol>'
        : '-';
    html = html.replace(/@ZONE_TOP_COUNTRIES_BYTES(@)?/g, zoneTopCountriesBytesHtml);

    // New Top 5 Lists as requested
    const topPathsListHtml = (safeData.topUrls || []).slice(0, 5).length > 0
        ? '<ol type="a" style="margin: 0; padding-left: 20px; list-style-type: lower-alpha;">' +
        (safeData.topUrls || []).slice(0, 5).map((item, idx) =>
            `<li style="margin: 0; padding: 0;">${item.path}</li>`
        ).join('') +
        '</ol>'
        : '-';
    html = html.replace(/@TOP_PATHS_LIST(@)?/g, topPathsListHtml);

    const topCustomRulesListHtml = (safeData.topCustomRules || []).length > 0
        ? '<ol type="a" style="margin: 0; padding-left: 20px; list-style-type: lower-alpha;">' +
        (safeData.topCustomRules || []).map((item, idx) =>
            `<li style="margin: 0; padding: 0;">${item.rule} จำนวน <strong>${formatCompactNumber(item.count)}</strong></li>`
        ).join('') +
        '</ol>'
        : '-';
    html = html.replace(/@TOP_CUSTOM_RULES_LIST(@)?/g, topCustomRulesListHtml);

    const topManagedRulesListHtml = (safeData.topManagedRules || []).length > 0
        ? '<ol type="a" style="margin: 0; padding-left: 20px; list-style-type: lower-alpha;">' +
        (safeData.topManagedRules || []).map((item, idx) =>
            `<li style="margin: 0; padding: 0;">${item.rule} จำนวน <strong>${formatCompactNumber(item.count)}</strong></li>`
        ).join('') +
        '</ol>'
        : '-';
    html = html.replace(/@TOP_MANAGED_RULES_LIST(@)?/g, topManagedRulesListHtml);

    // 3. Cleanup Empty Rows (Remove rows with no text content)
    /* Cleanup Logic Disabled to prevent content truncation
    if (typeof DOMParser !== 'undefined') {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const rows = doc.querySelectorAll('tr');
            let removedCount = 0;

            rows.forEach(row => {
                const text = row.textContent || "";
                // Keep if text is not empty or if it has media (img, etc)
                // Filter out rows that are purely whitespace/NBSP
                const hasMedia = row.querySelector('img, svg, canvas, video, hr');
                const isEmptyText = text.replace(/[\s\u00A0]/g, '') === '';

                if (isEmptyText && !hasMedia) {
                    row.remove();
                    removedCount++;
                }
            });

            if (removedCount > 0) {
                console.log(`Cleanup: Removed ${removedCount} empty rows from template.`);
                return doc.body.innerHTML;
            }
        } catch (e) {
            console.error("Error cleaning empty rows:", e);
        }
    }
    */

    return html;
};

// 1. Report Modal Component
const ReportModal = ({ isOpen, onClose, data, dashboardImage, template, onSaveTemplate, onGenerate, mode = 'report', theme, templateName, templateId, currentUserId }) => {
    // mode: 'report' | 'sub-template' | 'static-template' | 'middle-template'
    console.log('ReportModal Render:', { mode, templateType: typeof template, templateValue: template, isNull: template === null, isEmptyObj: JSON.stringify(template) === '{}' });

    // If no template passed, use default (fallback)
    // Use nullish coalescing to allow empty string (for empty templates)
    const currentTemplate = template ?? DEFAULT_TEMPLATE;

    // Default to editing in static mode, preview in report mode
    const [isEditing, setIsEditing] = useState(false);
    const [localTemplate, setLocalTemplate] = useState(currentTemplate);
    const reportContentRef = useRef(null);
    const editorRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const isTemplateMode = mode === 'static-template' || mode === 'middle-template' || mode === 'sub-template';
    const availableVariables = mode === 'static-template' ? STATIC_VARIABLES : REPORT_VARIABLES;
    const filteredVariables = availableVariables.filter(v =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.desc.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sync local template when prop changes
    useEffect(() => {
        setLocalTemplate(template ?? DEFAULT_TEMPLATE);
    }, [template, isOpen]);

    // Sync mode when opening
    useEffect(() => {
        if (isOpen) {
            setIsEditing(false);
        }
    }, [isOpen]);

    // ESC key to close modal
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    // Thai digits preference is per-template, per-user.
    // Must be declared before any early returns to keep Hooks order stable.
    const userKey = useMemo(() => (currentUserId ? String(currentUserId) : 'anonymous'), [currentUserId]);
    const thaiDigitsPrefKey = useMemo(
        () => `gdcc:templates:${userKey}:thaiDigits:${templateId ? String(templateId) : 'default'}`,
        [userKey, templateId]
    );
    const [useThaiDigits, setUseThaiDigits] = useState(true);
    const useAutoTOC = true;

    useEffect(() => {
        if (!isOpen) return;
        if (typeof window === 'undefined') return;
        try {
            const storedDigits = localStorage.getItem(thaiDigitsPrefKey);
            if (storedDigits !== null) {
                setUseThaiDigits(storedDigits === '1');
            }
        } catch (_) {
            // ignore
        }
    }, [isOpen, thaiDigitsPrefKey]);

    const toggleThaiDigits = () => {
        const next = !useThaiDigits;
        setUseThaiDigits(next);
        if (typeof window !== 'undefined') {
            try { localStorage.setItem(thaiDigitsPrefKey, next ? '1' : '0'); } catch (_) { }
        }
    };

    if (!isOpen) return null;

    // --- DATA PREPARATION ---
    // Safely handle missing data for static mode or initial load
    // Use spread to merge defaults with incoming data
    const safeData = {
        domain: '-', startDate: '', endDate: '', totalRequests: 0, avgTime: 0,
        blockedEvents: 0, logEvents: 0, topUrls: [], topIps: [],
        topRules: [], topAttackers: [], dnsRecords: [],
        ...data  // Override defaults with actual data
    };

    const sDate = safeData.startDate ? new Date(safeData.startDate + 'T00:00:00.000Z') : new Date(Date.now() - 1440 * 60 * 1000);
    const eDate = safeData.endDate ? new Date(Math.min(new Date(safeData.endDate + 'T23:59:59.999Z').getTime(), Date.now())) : new Date();
    const timeRangeStr = `${formatThaiDate(sDate)} - ${formatThaiDate(eDate)}`;
    const avgTimeSec = safeData.avgTime ? (safeData.avgTime / 1000).toFixed(3) : "0.000";
    const totalFirewall = (safeData.blockedEvents || 0) + (safeData.logEvents || 0);
    const blockPct = totalFirewall > 0 ? ((safeData.blockedEvents / totalFirewall) * 100).toFixed(2) : "0.00";
    const logPct = totalFirewall > 0 ? ((safeData.logEvents / totalFirewall) * 100).toFixed(2) : "0.00";
    const topUA = safeData.topUserAgents && safeData.topUserAgents.length > 0 ? safeData.topUserAgents[0] : { agent: '-', count: 0 };
    const domainDisplay = safeData.domain === 'ALL_SUBDOMAINS' ? `ทุก Subdomain ของ Domain ${safeData.zoneName || '...'}` : safeData.domain;

    // --- TEMPLATE PROCESSING ---
    const addAutomaticTOC = (html, isForExport = false) => {
        if (!html) return html;
        if (typeof DOMParser === 'undefined') return html;
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(String(html), 'text/html');
            
            // Query all h1, h2, h3, h4 headings (ignoring only empty ones, just like early versions)
            const headings = Array.from(doc.body.querySelectorAll('h1, h2, h3, h4')).filter(heading => {
                return heading.textContent.trim().length > 0;
            });

            if (headings.length === 0) return html;

            headings.forEach((heading, idx) => {
                if (!heading.id) {
                    heading.id = `toc-heading-${idx + 1}`;
                }
            });

            // Set colors based on preview vs export
            const textColor = isForExport ? '#000000' : '#ffffff';

            // Define page number mapper based on user example
            const getPageNumber = (text, idx) => {
                const tLower = text.toLowerCase();
                let rawPage = '';
                if (tLower.includes('การตั้งค่าระบบการป้องกัน')) {
                    rawPage = '3';
                } else if (tLower.includes('การตั้งค่าระบบป้องกันการโจมตี')) {
                    rawPage = '3';
                } else if (tLower.includes('รูปแบบการตั้งค่า')) {
                    rawPage = '4';
                } else if (tLower.includes('รายงานการใช้งาน')) {
                    rawPage = '7';
                } else {
                    // Fallback estimation
                    rawPage = String(3 + Math.floor(idx * 1.5));
                }
                return useThaiDigits ? toThaiDigits(rawPage) : rawPage;
            };

            const tocContainer = doc.createElement('div');
            tocContainer.className = 'toc-container';
            tocContainer.setAttribute('style', `margin-bottom: 30px; font-family: "TH SarabunPSK", "Sarabun", sans-serif; font-size: 16pt; color: ${textColor}; line-height: 1.35; width: 100%;`);
            
            const tocTitle = doc.createElement('p');
            tocTitle.innerHTML = '<strong>สารบัญ</strong>';
            tocTitle.setAttribute('style', `text-align: center; margin-bottom: 20px; font-size: 20pt; font-family: "TH SarabunPSK", "Sarabun", sans-serif; margin-top: 0; color: ${textColor};`);
            tocContainer.appendChild(tocTitle);

            // Simple Paragraphs with exactly 20 dots
            headings.forEach((heading, idx) => {
                const level = parseInt(heading.tagName.substring(1));
                let text = heading.textContent.replace(/\s+/g, ' ').trim();
                const pageNum = getPageNumber(text, idx);
                
                let indent = '';
                if (level === 2) {
                    indent = '&nbsp; &nbsp; &nbsp;';
                } else if (level === 3) {
                    indent = '&nbsp; &nbsp; &nbsp; &nbsp; &nbsp;';
                } else if (level === 4) {
                    indent = '&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;';
                }

                const dots = '.'.repeat(20);

                const p = doc.createElement('p');
                p.setAttribute('style', `margin-bottom: 6px; margin-top: 0; font-family: "TH SarabunPSK", "Sarabun", sans-serif; font-size: 16pt; color: ${textColor}; line-height: 1.35;`);
                p.innerHTML = `${indent}${text} ${dots} ${pageNum}`;
                tocContainer.appendChild(p);
            });

            // Check if @TOC@ placeholder exists anywhere in the body
            const bodyHtml = doc.body.innerHTML;
            if (bodyHtml.includes('@TOC@')) {
                const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
                let node;
                let targetNode = null;
                while ((node = walker.nextNode())) {
                    if (node.nodeValue && node.nodeValue.includes('@TOC@')) {
                        targetNode = node;
                        break;
                    }
                }
                
                if (targetNode) {
                    const parent = targetNode.parentNode;
                    const tempSpan = doc.createElement('span');
                    tempSpan.innerHTML = tocContainer.outerHTML;
                    parent.replaceChild(tempSpan, targetNode);
                    while (tempSpan.firstChild) {
                        parent.insertBefore(tempSpan.firstChild, tempSpan);
                    }
                    parent.removeChild(tempSpan);
                } else {
                    doc.body.innerHTML = bodyHtml.replace('@TOC@', tocContainer.outerHTML);
                }
            } else if (useAutoTOC) {
                // Default fallback: prepend TOC right after the first H1 tag, or at the very beginning
                const firstH1 = doc.body.querySelector('h1');
                if (firstH1 && firstH1.nextSibling) {
                    doc.body.insertBefore(tocContainer, firstH1.nextSibling);
                    const br = doc.createElement('br');
                    doc.body.insertBefore(br, firstH1.nextSibling);
                } else {
                    doc.body.insertBefore(tocContainer, doc.body.firstChild);
                }
            }

            return doc.body.innerHTML;
        } catch (e) {
            console.warn('Auto TOC generation failed:', e);
            return html;
        }
    };

    const getProcessedHtml = () => {
        // Even for static template, we want to process date variables
        let html = processTemplate(localTemplate, safeData, new Date(), dashboardImage);
        const hasTOCPlaceholder = html.includes('@TOC@');
        if (useAutoTOC || hasTOCPlaceholder) {
            html = addAutomaticTOC(html, false); // false = isForExport (renders white in preview!)
        }
        // Cleanup leftover @TOC@ placeholder (if headings were empty or if TOC was disabled)
        if (html.includes('@TOC@')) {
            html = html.replaceAll('@TOC@', '');
        }
        return html;
    };

    const toThaiDigits = (input) => {
        if (!input) return input;
        const thai = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
        return String(input).replace(/[0-9]/g, (d) => thai[Number(d)]);
    };

    // Convert Arabic digits to Thai digits in visible text only (text nodes), not attributes.
    const convertDigitsToThaiTextNodes = (html) => {
        if (!html) return html;
        if (typeof DOMParser === 'undefined') return html;
        try {
            const doc = new DOMParser().parseFromString(String(html), 'text/html');
            const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                if (!node.nodeValue) continue;
                if (!/[0-9]/.test(node.nodeValue)) continue;
                node.nodeValue = toThaiDigits(node.nodeValue);
            }
            return doc.body.innerHTML;
        } catch (e) {
            console.warn('Thai digit conversion failed:', e);
            return html;
        }
    };

    // --- COPY FUNCTION ---
    const handleCopy = () => {
        if (!reportContentRef.current) return;
        const range = document.createRange();
        range.selectNode(reportContentRef.current);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        document.execCommand('copy');
        window.getSelection().removeAllRanges();
        window.getSelection().removeAllRanges();
        Swal.fire({
            title: 'Copied!',
            text: 'Report copied to clipboard!',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false,
            background: '#111827',
            color: '#fff',
            iconColor: '#3b82f6'
        });
    };

    // --- DOWNLOAD WORD FUNCTION ---
    const handleDownloadWord = async () => {
        if (!reportContentRef.current) return;

        const filename = isTemplateMode ? `template.docx` : `report_${safeData.domain || 'report'}.doc`.replace('.doc', '.docx');

        const legacyHeader = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
            "xmlns:w='urn:schemas-microsoft-com:office:word' " +
            "xmlns='http://www.w3.org/TR/REC-html40'>" +
            "<head><meta charset='utf-8'><title>Export HTML to Word Document</title>" +
            "<style>" +
            "@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');" +
            "/* Define Page Size and Margins (Standard) */" +
            "@page Section1 { size: 21cm 29.7cm; margin: 2.54cm 2.54cm 2.54cm 2.54cm; mso-header-margin:35.4pt; mso-footer-margin:35.4pt; mso-paper-source:0; }" +
            "div.Section1 { page: Section1; }" +
            "body { font-family: 'TH SarabunPSK', 'Sarabun', sans-serif; font-size: 16pt; white-space: pre-wrap; }" +
            "img { max-width: 100%; height: auto; }" +
            "table { width: 100%; border-collapse: collapse; }" +
            "td, th { border: 1px solid #000; padding: 5px; }" +
            "h1 { font-size: 24pt; font-weight: bold; margin-bottom: 0.5em; }" +
            "h2 { font-size: 18pt; font-weight: bold; margin-bottom: 0.5em; }" +
            "h3 { font-size: 14pt; font-weight: bold; margin-bottom: 0.5em; }" +
            "ul { list-style-type: disc; padding-left: 20px; margin-bottom: 0px; }" +
            "ol { list-style-type: decimal; padding-left: 20px; margin-bottom: 0px; }" +
            "li { margin-bottom: 0px; }" +
            "div, table { margin-top: 0px; margin-bottom: 0px; }" +
            "</style>" +
            "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->" +
            "</head><body><div class='Section1'>";

        const cleanHeader = "<style>" +
            "body, p, div, span, td, th { font-family: 'Arial', sans-serif; font-size: 11pt; }" +
            "img { max-width: 100%; height: auto; display: block; margin: 10px auto; }" +
            "table { width: 100%; border-collapse: collapse; margin: 10px 0; border: 1px solid #000; }" +
            "td, th { border: 1px solid #000; padding: 5px; }" +
            "h1, h2, h3 { color: #1a56db; font-family: 'Arial', sans-serif; }" +
            "</style><div class='Section1'>";

        const footer = "</div>";

        let cleanHTML = "";

        if (isEditing) {
            // Stored templates stay Arabic; only convert for output.
            let baseHtml = localTemplate;
            if (useAutoTOC) {
                baseHtml = addAutomaticTOC(baseHtml, true);
            }
            cleanHTML = useThaiDigits ? convertDigitsToThaiTextNodes(baseHtml) : baseHtml;
        } else {
            const clone = reportContentRef.current.cloneNode(true);
            const previewToc = clone.querySelector('.toc-container');
            if (previewToc) {
                previewToc.remove();
            }

            let cloneHtml = clone.innerHTML;
            if (useAutoTOC) {
                cloneHtml = addAutomaticTOC(cloneHtml, true);
            }

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cloneHtml;

            const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walker.nextNode()) {
                if (node.nodeValue) {
                    node.nodeValue = node.nodeValue.replace(/ (?= )/g, '\u00A0');
                }
            }

            cleanHTML = tempDiv.innerHTML;
            cleanHTML = useThaiDigits ? convertDigitsToThaiTextNodes(cleanHTML) : cleanHTML;
            cleanHTML = cleanHTML.replace(/<p[^>]*>\s*(<div[^>]*>)/gi, '$1');
            cleanHTML = cleanHTML.replace(/(<\/div>)\s*<\/p>/gi, '$1');

            cleanHTML = cleanHTML.replace(/<img[^>]*style="[^"]*margin-left:\s*auto;[^"]*margin-right:\s*auto;[^"]*"[^>]*>/gi, (match) => {
                return `<p align="center">${match}</p>`;
            });
        }

        const sourceHTML = legacyHeader + cleanHTML + footer;

        const downloadHtmlAsDoc = (html) => {
            const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename.replace('.docx', '.doc');
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        };

        const submitExportFormToHiddenIframe = (html) => {
            const iframeName = `docx_export_${Date.now()}`;
            const iframe = document.createElement('iframe');
            iframe.name = iframeName;
            iframe.style.display = 'none';
            document.body.appendChild(iframe);

            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/api/export-docx';
            form.style.display = 'none';
            form.target = iframeName;

            const htmlField = document.createElement('textarea');
            htmlField.name = 'html';
            htmlField.value = html;
            form.appendChild(htmlField);

            const filenameField = document.createElement('input');
            filenameField.type = 'hidden';
            filenameField.name = 'filename';
            filenameField.value = filename;
            form.appendChild(filenameField);

            const titleField = document.createElement('input');
            titleField.type = 'hidden';
            titleField.name = 'title';
            titleField.value = filename.includes('template') ? 'Report Template' : 'Cloudflare Report';
            form.appendChild(titleField);

            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);

            // Remove iframe shortly after to avoid a persistent loading indicator.
            window.setTimeout(() => {
                try { document.body.removeChild(iframe); } catch (_) { }
            }, 1500);
        };

        try {
            // Template editing exports can be large (embedded base64 images).
            // Prefer fast .doc download in that case to avoid long server conversion.
            if (isTemplateMode) {
                downloadHtmlAsDoc(sourceHTML);
                return;
            }

            // Use a hidden iframe target so the browser downloads normally
            // without opening a new tab that looks like it's "loading".
            submitExportFormToHiddenIframe(cleanHeader + cleanHTML + footer);
        } catch (error) {
            console.error('Word export error:', error);
            try {
                Swal.fire({
                    title: 'Export Failed',
                    text: error?.message || 'Failed to generate Word file',
                    icon: 'error',
                    background: '#111827',
                    color: '#fff'
                });
            } catch (_) {}
            // Fallback to fast .doc download if API fails
            downloadHtmlAsDoc(sourceHTML);
        }
    };



    const handleSave = () => {
        let contentToSave = localTemplate;

        // Cleanup empty table rows logic
        if (typeof DOMParser !== 'undefined') {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(contentToSave, 'text/html');
                const tables = doc.querySelectorAll('table');
                let removedCount = 0;

                tables.forEach(table => {
                    const rows = Array.from(table.rows);
                    rows.forEach(row => {
                        const cells = row.cells;
                        let isEmptyRow = true;

                        if (!cells || cells.length === 0) {
                            isEmptyRow = true;
                        } else {
                            // Check each cell content
                            for (let i = 0; i < cells.length; i++) {
                                const cell = cells[i];
                                const hasMedia = cell.querySelector('img, svg, canvas, video, hr, iframe, input, button, select, textarea');
                                // Check text content (trim whitespace and &nbsp;)
                                const text = (cell.textContent || '').replace(/[\s\u00A0\u200B\u200C\u200D\uFEFF]/g, '');

                                if (hasMedia || text.length > 0) {
                                    isEmptyRow = false; // Found content
                                    break;
                                }
                            }
                        }

                        if (isEmptyRow) {
                            row.remove();
                            removedCount++;
                        }
                    });
                });

                if (removedCount > 0) {
                    console.log(`Cleanup: Removed ${removedCount} empty rows from tables.`);
                    contentToSave = doc.body.innerHTML;
                }
            } catch (e) {
                console.warn('Error during table cleanup:', e);
            }
        }

        if (onSaveTemplate) onSaveTemplate(contentToSave);
        setIsEditing(false);
    };

    // Default theme fallback
    const t = theme || THEMES.dark;

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${t.modalOverlay}`}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className={`${t.modalBg} ${t.modalBorder} border rounded-xl w-full max-w-[95%] shadow-2xl overflow-hidden flex flex-col h-[90vh]`}>
                {/* Header */}
                <div className={`px-6 py-4 border-b ${t.modalBorder} flex justify-between items-center ${t.modalHeaderBg} flex-shrink-0`}>
                    <div className="flex items-center gap-2">
                        <FileText className={`w-5 h-5 ${t.iconAccent || 'text-blue-500'}`} />
                        <h3 className={`text-lg font-bold ${t.modalTitle} flex items-baseline gap-2`}>
                            <span>
                                {mode === 'static-template'
                                    ? 'Domain Report'
                                    : mode === 'middle-template'
                                        ? 'Middle Report'
                                        : mode === 'sub-template'
                                            ? 'Sub Report'
                                    : (isEditing
                                        ? 'Edit Report'
                                        : 'Preview Report'
                                    )}
                            </span>
                            {templateName && <span className={`text-xs font-normal opacity-70 ${t.subText || 'text-gray-400'}`}>({templateName})</span>}
                        </h3>
                    </div>
                    <button onClick={onClose} className={`${t.modalCloseIcon} transition-colors`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden p-6 flex flex-col">
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        .report-content h1 { font-size: 2em; font-weight: bold; margin-top: 0.67em; margin-bottom: 0.67em; }
                        .report-content h2 { font-size: 1.5em; font-weight: bold; margin-top: 0.83em; margin-bottom: 0.83em; }
                        .report-content h3 { font-size: 1.17em; font-weight: bold; margin-top: 1em; margin-bottom: 1em; }
                        .report-content ul { list-style-type: disc; padding-left: 2em; }
                        .report-content ol { list-style-type: decimal; padding-left: 2em; }
                        .report-content li { display: list-item; }
                        .report-content, .report-content p, .report-content div { white-space: pre-wrap !important; }
                        .report-content .toc-container, .report-content .toc-container * { white-space: normal !important; }
                    `}} />
                    <div ref={reportContentRef} className="report-content space-y-4 text-base leading-relaxed flex-1 overflow-auto" style={{ fontFamily: '"TH SarabunPSK", "Sarabun", sans-serif' }}>

                        {isEditing ? (
                            <div className="flex gap-4 h-full">
                                {/* Editor Section - Left */}
                                <div className="flex-1 flex flex-col min-w-0">
                                    <div className="flex-1 bg-white text-black rounded-lg overflow-hidden border border-gray-300">
                                        <Editor
                                            tinymceScriptSrc='/systems/tinymce/tinymce.min.js'
                                            licenseKey='gpl'
                                            onInit={(evt, editor) => editorRef.current = editor}
                                            value={localTemplate}
                                            onEditorChange={(content) => setLocalTemplate(content)}
                                            init={{
                                                height: '100%',
                                                menubar: false,
                                                plugins: [
                                                    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                                                    'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                                                    'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount', 'nonbreaking'
                                                ],
                                                toolbar: 'undo redo | blocks fontfamily fontsize | ' +
                                                    'bold italic forecolor | alignleft aligncenter ' +
                                                    'alignright alignjustify | bullist numlist outdent indent | ' +
                                                    'image table | removeformat | help',
                                                content_style: 'body { font-family: "TH SarabunPSK", "Sarabun", sans-serif; font-size: 16pt; } h1 { font-size: 24pt; font-weight: bold; } h2 { font-size: 18pt; font-weight: bold; } h3 { font-size: 14pt; font-weight: bold; }',
                                                forced_root_block: 'p',
                                                nonbreaking_force_tab: true,
                                                image_title: true,
                                                automatic_uploads: true,
                                                file_picker_types: 'image',
                                                file_picker_callback: (cb, value, meta) => {
                                                    const input = document.createElement('input');
                                                    input.setAttribute('type', 'file');
                                                    input.setAttribute('accept', 'image/*');

                                                    input.addEventListener('change', (e) => {
                                                        const file = e.target.files[0];
                                                        if (!file) return;
                                                        const reader = new FileReader();
                                                        reader.addEventListener('load', () => {
                                                            cb(reader.result, { title: file.name });
                                                        });
                                                        reader.readAsDataURL(file);
                                                    });

                                                    input.click();
                                                },
                                                images_upload_handler: (blobInfo, progress) => new Promise((resolve, reject) => {
                                                    const reader = new FileReader();
                                                    reader.readAsDataURL(blobInfo.blob());
                                                    reader.onload = () => resolve(reader.result);
                                                    reader.onerror = (error) => reject(error);
                                                })
                                            }}
                                        />
                                    </div>
                                </div>
                                {/* Variables Section - Right */}
                                <div className={`w-[40rem] flex-shrink-0 flex flex-col ${t.rawData || 'bg-gray-50 border-gray-200'} rounded-lg p-4 border overflow-hidden`}>
                                    <div className={`text-sm font-bold ${t.text || 'text-gray-700'} mb-3 flex items-center justify-between gap-2 sticky top-0 ${t.modalHeaderBg || 'bg-gray-50'} pb-2 border-b ${t.modalBorder || 'border-gray-300'}`}>
                                        <div className="flex items-center gap-2">
                                            <span className={`${t.buttonPrimary || 'bg-blue-500 text-white'} px-2 py-1 rounded shadow-sm`}>Variables</span>
                                            <span className={`text-xs ${t.subText || 'text-gray-500'}`}>Click to insert</span>
                                        </div>
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1.5 w-3 h-3 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search variables..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className={`pl-7 pr-2 py-1 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 ${t.dropdown?.bg || 'bg-white'} ${t.dropdown?.text || 'text-gray-700'} ${t.dropdown?.border || 'border-gray-300'}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-auto border rounded-lg bg-white shadow-inner custom-scrollbar">
                                        <table className="w-full text-left text-xs border-collapse relative">
                                            <thead className={`sticky top-0 z-10 ${t.card || 'bg-gray-100'} border-b shadow-sm`}>
                                                <tr>
                                                    <th className="p-2 font-semibold w-[30%]">Variable</th>
                                                    <th className="p-2 font-semibold w-[40%]">Description</th>
                                                    <th className="p-2 font-semibold w-[30%]">Example</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {filteredVariables.length > 0 ? filteredVariables.map((v) => (
                                                    <tr
                                                        key={v.name}
                                                        onClick={() => editorRef.current?.insertContent(v.name)}
                                                        className={`cursor-pointer hover:bg-blue-50 transition-colors group ${t.text || 'text-gray-700'}`}
                                                        title={`Click to insert ${v.name}\nCategory: ${v.category}`}
                                                    >
                                                        <td className="p-2 font-mono text-blue-600 font-medium whitespace-nowrap group-hover:underline align-top">
                                                            {v.name}
                                                            <div className="text-[9px] text-gray-400 font-normal mt-0.5">{v.category}</div>
                                                        </td>
                                                        <td className="p-2 text-gray-600 align-top">
                                                            {v.desc}
                                                        </td>
                                                        <td className="p-2 font-mono text-gray-500 text-[10px] break-all align-top">
                                                            {v.example}
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan={3} className="p-4 text-center text-gray-500 italic">
                                                            No variables found matching &quot;{searchTerm}&quot;
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div dangerouslySetInnerHTML={{ __html: useThaiDigits ? convertDigitsToThaiTextNodes(getProcessedHtml()) : getProcessedHtml() }} />
                        )}

                    </div>
                </div>

                {/* Footer */}
                <div className={`px-6 py-4 border-t ${t.modalBorder} ${t.modalHeaderBg} flex justify-end gap-3 flex-shrink-0`}>
                    {/* In Edit Mode (Default for Static) */}
                    {isEditing ? (
                        <>
                            <button
                                onClick={toggleThaiDigits}
                                className={`px-4 py-2 ${t.button} text-xs font-bold rounded flex items-center gap-2 transition-colors`}
                                title="Applies to Preview + Download only"
                            >
                                {useThaiDigits ? 'Thai digits' : 'Arabic digits'}
                            </button>
                            <button onClick={() => setIsEditing(false)} className={`px-4 py-2 ${t.button} text-xs font-bold rounded`}>
                                Cancel
                            </button>
                            <button onClick={handleSave} className={`px-4 py-2 ${t.buttonSuccess} text-xs font-bold rounded flex items-center gap-2`}>
                                <Edit3 className="w-3 h-3" /> {isTemplateMode ? 'Save Template' : 'Save & Preview'}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={toggleThaiDigits}
                                className={`px-4 py-2 ${t.button} text-xs font-bold rounded flex items-center gap-2 transition-colors`}
                                title="Applies to Preview + Download only"
                            >
                                {useThaiDigits ? 'Thai digits' : 'Arabic digits'}
                            </button>
                            <button onClick={() => setIsEditing(true)} className={`px-4 py-2 ${t.button} text-xs font-bold rounded flex items-center gap-2 transition-colors`}>
                                <Edit3 className="w-3 h-3" /> Edit Template
                            </button>
                            <button onClick={handleDownloadWord} className={`px-4 py-2 ${t.buttonPrimary} text-xs font-bold rounded flex items-center gap-2 transition-colors`}>
                                <FileType className="w-3 h-3" /> Download Word
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div >
    );
};


// --- THEME CONFIG ---
// --- THEME CONFIG ---
// Moved to '@/app/utils/themes'

// Batch Report Modal Component
const BatchReportModal = ({ isOpen, onClose, hosts: dashboardHosts, onConfirm, theme, selectedZone: initialZoneId, selectedAccount: initialAccountId, accounts = [], currentUser }) => {
    const [selected, setSelected] = useState(new Set());
    const [promotedHosts, setPromotedHosts] = useState(new Set());
    const [batchStartDate, setBatchStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [batchEndDate, setBatchEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState('');
    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('default');
    const [mode, setMode] = useState('standard'); // 'standard' or 'department'
    const [departments, setDepartments] = useState([]);
    const [selectedDeptIds, setSelectedDeptIds] = useState(new Set());
    const [deptMemberHosts, setDeptMemberHosts] = useState([]);

    // Internal selection states
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [zones, setZones] = useState([]);
    const [loadingZones, setLoadingZones] = useState(false);
    const [internalZoneId, setInternalZoneId] = useState('');
    const [internalSubdomains, setInternalSubdomains] = useState([]);
    const [loadingSubdomains, setLoadingSubdomains] = useState(false);

    const callScrapeApi = async (action, bodyData = {}) => {
        try {
            const res = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    apiToken: currentUser?.cloudflare_api_token,
                    ...bodyData
                })
            });
            return await res.json();
        } catch (e) {
            return { success: false, message: e.message };
        }
    };

    useEffect(() => {
        if (isOpen) {
            // Reset selection states for fresh open
            setSelected(new Set());
            setPromotedHosts(new Set());
            setSelectedDeptIds(new Set());
            setDeptMemberHosts([]);
            setSearchTerm('');
            setMode('standard');

            // Initialize from dashboard state
            setSelectedAccountId(initialAccountId || '');
            setInternalZoneId(initialZoneId || '');
            setInternalSubdomains(dashboardHosts || []);

            listTemplates().then(list => {
                if (typeof window === 'undefined') {
                    setTemplates(list);
                    return;
                }
                const userKey = currentUser?.id ? String(currentUser.id) : 'anonymous';
                const keyDefault = `gdcc:templates:${userKey}:defaultTemplateId`;
                const keyHidden = `gdcc:templates:${userKey}:hiddenTemplateIds`;

                let hidden = [];
                try { hidden = JSON.parse(localStorage.getItem(keyHidden) || '[]'); } catch (_) { hidden = []; }
                if (!Array.isArray(hidden)) hidden = [];
                hidden = hidden.map(String);

                let filtered = list.filter(t => !hidden.includes(String(t.id)));
                if (filtered.length === 0 && list.length > 0) {
                    filtered = list;
                    try { localStorage.setItem(keyHidden, '[]'); } catch (_) {}
                }

                setTemplates(filtered);

                const storedDefault = localStorage.getItem(keyDefault) || 'default';
                const ids = new Set(filtered.map(t => String(t.id)));
                if (ids.has(String(storedDefault))) {
                    setSelectedTemplateId(String(storedDefault));
                } else if (filtered.length > 0 && !ids.has(String(selectedTemplateId))) {
                    setSelectedTemplateId(String(filtered[0].id));
                }
            });
        }
    }, [isOpen, initialZoneId, initialAccountId, dashboardHosts]);

    // Fetch departments when account or zone changes
    useEffect(() => {
        if (isOpen && (selectedAccountId || internalZoneId)) {
            const fetchDepts = async () => {
                const url = selectedAccountId ? `/api/departments?account_id=${selectedAccountId}` : `/api/departments`;
                const res = await fetch(url);
                const data = await res.json();
                if (data.departments) setDepartments(data.departments);
            };
            fetchDepts();
        }
    }, [isOpen, selectedAccountId, internalZoneId]);

    // Handle Account Change -> Fetch Zones
    useEffect(() => {
        if (!isOpen || !selectedAccountId) return;
        if (selectedAccountId === initialAccountId && zones.length > 0) return;

        let isMounted = true;
        const fetchZones = async () => {
            setLoadingZones(true);
            const result = await callScrapeApi('list-zones', { accountId: selectedAccountId });
            if (isMounted) {
                if (result.success && result.data) {
                    setZones(result.data);
                } else {
                    setZones([]);
                }
                setLoadingZones(false);
                if (selectedAccountId !== initialAccountId) {
                    setInternalZoneId('');
                    setInternalSubdomains([]);
                    setSelected(new Set());
                    setSelectedDeptIds(new Set());
                    setDeptMemberHosts([]);
                }
            }
        };
        fetchZones();
        return () => { isMounted = false; };
    }, [selectedAccountId, isOpen, initialAccountId]);

    // Handle Zone Change -> Fetch Subdomains
    useEffect(() => {
        if (!isOpen || !internalZoneId) return;
        if (internalZoneId === initialZoneId && internalSubdomains.length > 0) return;

        let isMounted = true;
        const fetchDns = async () => {
            setLoadingSubdomains(true);
            const result = await callScrapeApi('get-dns-records', { zoneId: internalZoneId });
            if (isMounted) {
                if (result.success && result.data) {
                    const hostSet = new Set(
                        result.data
                            .filter(r => ['A', 'AAAA', 'CNAME'].includes(r.type))
                            .map(r => r.name)
                            .filter(Boolean)
                    );
                    const zoneObj = zones.find(z => z.id === internalZoneId);
                    if (zoneObj && zoneObj.name) hostSet.delete(zoneObj.name);

                    setInternalSubdomains(Array.from(hostSet).filter(Boolean));
                } else {
                    setInternalSubdomains([]);
                }
                setLoadingSubdomains(false);
                setSelected(new Set());
                setSelectedDeptIds(new Set());
                setDeptMemberHosts([]);
            }
        };
        fetchDns();
        return () => { isMounted = false; };
    }, [internalZoneId, isOpen, zones, initialZoneId]);

    // Use internal subdomains if available, otherwise dashboard hosts
    const hosts = internalSubdomains.length > 0 ? internalSubdomains : dashboardHosts;

    // Handle department selection
    useEffect(() => {
        if (mode === 'department' && selectedDeptIds.size > 0) {
            const allDeptHosts = [];
            const fetchPromises = Array.from(selectedDeptIds).map(deptId => 
                fetch(`/api/department-domains?department_id=${deptId}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.domains) {
                            data.domains.forEach(d => {
                                if (!allDeptHosts.some(existing => existing.domain === d.domain && existing.zone_id === d.zone_id)) {
                                    allDeptHosts.push({ domain: d.domain, zone_id: d.zone_id });
                                }
                            });
                        }
                    })
            );

            Promise.all(fetchPromises).then(() => {
                setDeptMemberHosts(allDeptHosts);
                const newSelected = new Set();
                allDeptHosts.forEach(h => newSelected.add(h.domain));
                setSelected(newSelected);
            });
        } else if (mode === 'department' && selectedDeptIds.size === 0) {
            setDeptMemberHosts([]);
            setSelected(new Set());
        }
    }, [selectedDeptIds, mode]); // Ignore hosts dependency in department mode

    const toggleDept = (deptId) => {
        const newSet = new Set(selectedDeptIds);
        if (newSet.has(deptId)) {
            newSet.delete(deptId);
        } else {
            newSet.add(deptId);
        }
        setSelectedDeptIds(newSet);
    };

    // ESC key to close modal
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);



    // FILTER LOGIC & DEBUGGING
    const NO_SUBDOMAIN = '__NO_SUBDOMAIN__'; // Special identifier

    const filteredHosts = (mode === 'department' ? deptMemberHosts.map(dm => dm.domain) : hosts).filter(h => {
        const hStr = String(h || '');
        return hStr.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Always prepend "No Subdomain" option at the beginning (except in department mode or if no zone selected)
    const displayHosts = (mode === 'department' || !internalZoneId) ? filteredHosts : [NO_SUBDOMAIN, ...filteredHosts];

    // console.log('🔍 Modal Render:', { term: searchTerm, total: hosts.length, visible: filteredHosts.length });

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const toggleAll = () => {
        // Toggle ALL hosts (excluding NO_SUBDOMAIN)
        const allRealHostsSelected = filteredHosts.every(h => selected.has(h));

        const newSet = new Set(selected);
        // Remove NO_SUBDOMAIN if present
        newSet.delete(NO_SUBDOMAIN);

        if (allRealHostsSelected) {
            filteredHosts.forEach(h => newSet.delete(h));
        } else {
            filteredHosts.forEach(h => newSet.add(h));
        }
        setSelected(newSet);
    };

    const toggleOne = (host) => {
        const newSet = new Set(selected);

        // If selecting NO_SUBDOMAIN, clear all others
        if (host === NO_SUBDOMAIN) {
            newSet.clear();
            if (!selected.has(NO_SUBDOMAIN)) {
                newSet.add(NO_SUBDOMAIN);
            }
        } else {
            // If selecting a real host, remove NO_SUBDOMAIN
            newSet.delete(NO_SUBDOMAIN);
            if (newSet.has(host)) {
                newSet.delete(host);
                // Also remove it from promotedHosts if unchecked
                const newPromoted = new Set(promotedHosts);
                if (newPromoted.has(host)) {
                    newPromoted.delete(host);
                    setPromotedHosts(newPromoted);
                }
            } else {
                newSet.add(host);
            }
        }
        setSelected(newSet);
    };

    const togglePromoteOne = (e, host) => {
        // e.stopPropagation() prevents the click from bubbling up to the row label
        const newPromoted = new Set(promotedHosts);
        if (newPromoted.has(host)) {
            newPromoted.delete(host);
        } else {
            newPromoted.add(host);
        }
        setPromotedHosts(newPromoted);
    };

    if (!isOpen) return null;

    // Default theme fallback
    const t = theme || THEMES.dark;

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in ${t.modalOverlay}`}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className={`${t.modalBg} ${t.modalBorder} border rounded-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl`}>
                {/* Header */}
                <div className={`p-4 border-b ${t.modalBorder} ${t.modalHeaderBg} flex justify-between items-center`}>
                    <h3 className={`text-lg font-bold ${t.modalTitle} flex items-center gap-2`}>
                        <List className={`w-5 h-5 ${t.iconAccent || 'text-purple-400'}`} />
                        Create Report
                    </h3>
                    <button onClick={onClose} className={`${t.modalCloseIcon} transition-colors`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Left Column (40%) */}
                    <div className={`w-full md:w-[40%] p-6 overflow-y-auto border-r ${t.modalBorder} space-y-6`}>
                        {/* Account & Zone Selectors */}
                        <div className={`p-3 ${t.selectorContainer} rounded-lg border ${t.modalBorder} grid grid-cols-1 gap-4 bg-gray-800/20`}>
                            <SearchableDropdown
                                theme={theme}
                                icon={<Key className="w-3.5 h-3.5 text-blue-400" />}
                                label="Cloudflare Account"
                                placeholder="Choose an account..."
                                options={accounts.map(acc => ({ value: acc.id, label: acc.name, subtitle: `ID: ${acc.id}` }))}
                                value={selectedAccountId}
                                onChange={setSelectedAccountId}
                            />

                            <SearchableDropdown
                                theme={theme}
                                icon={<Server className="w-3.5 h-3.5 text-green-400" />}
                                label="Zone (Domain)"
                                placeholder={!selectedAccountId ? "Select Account first" : loadingZones ? "Loading..." : "Choose a zone..."}
                                options={zones.map(zone => ({ value: zone.id, label: zone.name, subtitle: zone.status }))}
                                value={internalZoneId}
                                onChange={setInternalZoneId}
                                loading={loadingZones}
                            />
                        </div>

                        {/* Selection Mode Selector */}
                        <div className={`p-3 ${t.selectorContainer} rounded-lg border ${t.modalBorder}`}>
                            <label className={`block text-xs font-bold ${t.subText} mb-2 uppercase tracking-wide`}>Selection Mode</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setMode('standard')}
                                    className={`flex-1 py-2 text-xs font-bold rounded border transition-all ${mode === 'standard' ? t.buttonPrimary : t.button}`}
                                >
                                    Standard
                                </button>
                                <button
                                    onClick={() => setMode('department')}
                                    className={`flex-1 py-2 text-xs font-bold rounded border transition-all ${mode === 'department' ? t.buttonPrimary : t.button}`}
                                >
                                    Department
                                </button>
                            </div>
                        </div>

                        {/* Department Selector */}
                        {mode === 'department' && (
                            <div className={`p-3 ${t.selectorContainer} rounded-lg border ${t.modalBorder} animate-fade-in-up`}>
                                <label className={`block text-xs font-bold ${t.subText} mb-2 uppercase tracking-wide flex items-center gap-2`}>
                                    <Users className="w-3.5 h-3.5" /> Select Departments
                                </label>
                                <div className={`max-h-40 overflow-y-auto space-y-1 p-2 bg-black/20 rounded border ${t.modalBorder}`}>
                                    {departments.length === 0 ? (
                                        <p className="text-xs text-gray-500 italic text-center py-2">No departments found for this zone.</p>
                                    ) : (
                                        departments.map(d => (
                                            <label key={d.id} className="flex items-center gap-3 p-2 rounded hover:bg-white/5 cursor-pointer transition-colors group">
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedDeptIds.has(d.id)}
                                                    onChange={() => toggleDept(d.id)}
                                                    className="hidden"
                                                />
                                                <div 
                                                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedDeptIds.has(d.id) ? t.dropdown.active : 'border-gray-600'}`}
                                                >
                                                    {selectedDeptIds.has(d.id) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                                <span className={`text-xs ${selectedDeptIds.has(d.id) ? 'text-white' : 'text-gray-400'}`}>{d.name}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Template Selector */}
                        <div className={`p-3 ${t.selectorContainer} rounded-lg border ${t.modalBorder}`}>
                            <label className={`block text-xs font-bold ${t.subText} mb-2 uppercase tracking-wide`}>Report Template</label>
                            <select
                                value={selectedTemplateId}
                                onChange={e => setSelectedTemplateId(e.target.value)}
                                className={`${t.dropdown.bg} ${t.dropdown.border} border ${t.dropdown.inputText} rounded p-2.5 w-full text-sm outline-none focus:border-blue-500 transition-colors appearance-none`}
                            >
                                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>

                        {/* Time Range Selector */}
                        <div className={`p-3 ${t.selectorContainer} rounded-lg border ${t.modalBorder}`}>
                            <label className={`block text-xs font-bold ${t.subText} mb-2 uppercase tracking-wide`}>Time Range</label>
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs ${t.subText} w-12`}>Start:</span>
                                    <input
                                        type="date"
                                        value={batchStartDate}
                                        max={new Date().toISOString().split('T')[0]}
                                        onChange={(e) => setBatchStartDate(e.target.value)}
                                        className={`flex-1 px-2 py-1.5 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${t.dropdown.bg} ${t.dropdown.text || 'text-white'} ${t.dropdown.border}`}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs ${t.subText} w-12`}>End:</span>
                                    <input
                                        type="date"
                                        value={batchEndDate}
                                        max={new Date().toISOString().split('T')[0]}
                                        onChange={(e) => setBatchEndDate(e.target.value)}
                                        className={`flex-1 px-2 py-1.5 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${t.dropdown.bg} ${t.dropdown.text || 'text-white'} ${t.dropdown.border}`}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column (60%) */}
                    <div className="w-full md:w-[60%] p-6 overflow-hidden flex flex-col">
                        {/* Live Search Input (New) */}
                        <div className="mb-4">
                            <div className="relative">
                                <Search className={`absolute left-3 top-2.5 w-4 h-4 ${t.subText}`} />
                                <input
                                    type="text"
                                    placeholder="Filter sub-domains..."
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    className={`w-full ${t.dropdown.bg} border ${t.dropdown.border} ${t.dropdown.inputText} rounded-lg pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-${t.dropdown.placeholder ? t.dropdown.placeholder.replace('text-', '') : 'gray-600'}`}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between mb-4">
                            <span className={`${t.subText} text-sm font-bold uppercase tracking-wider`}>Sub-domains selection:</span>
                            <button
                                onClick={() => mode === 'standard' && toggleAll()}
                                className={`text-xs ${t.iconAccent || 'text-blue-400'} ${mode === 'department' ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 font-bold transition-colors uppercase tracking-wider'}`}
                            >
                                {filteredHosts.length > 0 && filteredHosts.every(h => selected.has(h)) ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                            {displayHosts.length === 0 ? (
                                <div className={`text-center ${t.subText || 'text-gray-500'} py-12 text-sm italic`}>
                                    No sub-domains available.
                                </div>
                            ) : (
                                displayHosts.map(host => {
                                    const isNoSubdomain = host === NO_SUBDOMAIN;
                                    const displayName = isNoSubdomain ? 'No Subdomain (Full Domain Report)' : host;

                                    // Determine styles based on theme
                                    const isLight = t.id === 'pastel';

                                    // Yellow style for No Subdomain
                                    const yellowBg = isLight ? 'bg-yellow-50 hover:bg-yellow-100' : 'bg-yellow-900/20 hover:bg-yellow-900/30';
                                    const yellowBorder = isLight ? 'border-yellow-200 hover:border-yellow-300' : 'border-yellow-700/50 hover:border-yellow-600';
                                    const yellowText = isLight ? 'text-yellow-700 font-bold' : 'text-yellow-400';
                                    const yellowCheckBg = isLight ? 'bg-yellow-500 border-yellow-500' : 'bg-yellow-600 border-yellow-600';
                                    const yellowCheckBorder = isLight ? 'border-yellow-300 group-hover:border-yellow-400' : 'border-yellow-700 group-hover:border-yellow-600';

                                    // Regular host style
                                    const regularBg = t.card || (isLight ? 'bg-white' : 'bg-gray-800/50');
                                    const regularBorder = t.dropdown?.border || (isLight ? 'border-pink-200' : 'border-transparent');
                                    const regularSubText = t.subText;
                                    const regularCheckBg = t.dropdown?.active || 'bg-blue-600';
                                    const regularCheckBorder = t.dropdown?.border || 'border-gray-600';

                                    return (
                                        <div key={host} className={`flex items-center justify-between p-3 rounded-lg transition-colors border ${isNoSubdomain ? `${yellowBg} ${yellowBorder}` : `${regularBg} ${regularBorder}`} group`}>
                                            <label className={`flex flex-1 items-center gap-3 ${mode === 'department' ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selected.has(host) ? (isNoSubdomain ? yellowCheckBg : regularCheckBg) : (isNoSubdomain ? yellowCheckBorder : regularCheckBorder)}`}>
                                                    {selected.has(host) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={selected.has(host)}
                                                    disabled={mode === 'department'}
                                                    onChange={() => mode === 'standard' && toggleOne(host)}
                                                    className="hidden"
                                                />
                                                <span className={`text-sm ${selected.has(host) ? (isLight ? 'text-pink-900 font-bold' : 'text-white font-medium') : (isNoSubdomain ? yellowText : regularSubText)}`}>{displayName}</span>
                                            </label>

                                            {/* Toggle for Promoting to Domain */}
                                            {!isNoSubdomain && selected.has(host) && (
                                                <div className={`flex items-center gap-2 ${mode === 'department' ? 'opacity-50' : ''}`} onClick={(e) => e.stopPropagation()}>
                                                    <label className={`flex items-center ${mode === 'department' ? 'cursor-not-allowed' : 'cursor-pointer'} relative`} title="Use staticReportTemplate.json for this subdomain instead of the sub-report template">
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only peer"
                                                            checked={promotedHosts.has(host)}
                                                            disabled={mode === 'department'}
                                                            onChange={(e) => mode === 'standard' && togglePromoteOne(e, host)}
                                                        />
                                                        <div className={`w-9 h-5 rounded-full peer ${promotedHosts.has(host) ? 'bg-indigo-600' : 'bg-gray-600'} peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 transition-colors`}></div>
                                                        <div className={`absolute left-[2px] top-[2px] bg-white w-4 h-4 rounded-full transition-transform ${promotedHosts.has(host) ? 'translate-x-full' : ''}`}></div>
                                                    </label>
                                                    <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>Use Domain Template</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className={`p-4 border-t ${t.modalBorder} ${t.modalHeaderBg} flex justify-between items-center gap-3`}>
                    <div>
                        <a href="/tools/word-converter.zip" download className={`text-xs ${t.iconAccent || 'text-purple-400'} hover:opacity-80 underline flex items-center gap-1`}>
                            <Download className="w-3 h-3" />
                            เครื่องมือแปลงไฟล์ .docx (Mac/Win)
                        </a>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className={`px-4 py-2 rounded font-medium transition-colors text-xs ${t.button}`}>Cancel</button>

                        <button
                            title="จะแยกรายการ sub domain ที่เลือกมาออกเป็นไฟล์แยกกัน โดยแต่ละไฟล์จะมี หน้าปก + รายละเอียด zone + subdomain"
                            onClick={() => {
                                if (selected.size === 0) {
                                    Swal.fire('Error', 'Please select at least one sub-domain.', 'error');
                                    return;
                                }

                                // Separated files only makes sense for sub-domain selections
                                if (mode !== 'department' && selected.has(NO_SUBDOMAIN)) {
                                    Swal.fire('Error', 'Separated export is not available for Domain-only report.', 'error');
                                    return;
                                }

                                let hostsToGenerate;
                                if (mode === 'department') {
                                    hostsToGenerate = Array.from(selected).map(hostName => {
                                        const mapping = deptMemberHosts.find(dm => dm.domain === hostName);
                                        return { name: hostName, zoneId: mapping ? mapping.zone_id : internalZoneId };
                                    });
                                } else {
                                    hostsToGenerate = Array.from(selected).filter(h => h !== NO_SUBDOMAIN);
                                }

                                const promotedArray = Array.from(promotedHosts);
                                // extra final arg: exportSeparated
                                onConfirm(hostsToGenerate, batchStartDate, batchEndDate, selectedTemplateId, promotedArray, internalZoneId, true);
                            }}
                            disabled={selected.size === 0}
                            className={`px-4 py-2 rounded ${t.button} font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs flex items-center gap-2`}
                        >
                            Export as separated files
                        </button>

                        <button
                            onClick={() => {
                                if (selected.size === 0) {
                                    Swal.fire('Error', 'Please select at least one sub-domain.', 'error');
                                    return;
                                }
                                
                                let hostsToGenerate;
                                if (mode === 'department') {
                                    // Map selected domain names to objects with their zone IDs
                                    hostsToGenerate = Array.from(selected).map(hostName => {
                                        const mapping = deptMemberHosts.find(dm => dm.domain === hostName);
                                        return { name: hostName, zoneId: mapping ? mapping.zone_id : internalZoneId };
                                    });
                                } else {
                                    // Standard mode: If NO_SUBDOMAIN is selected, send empty array
                                    hostsToGenerate = selected.has(NO_SUBDOMAIN) ? [] : Array.from(selected).filter(h => h !== NO_SUBDOMAIN);
                                }

                                const promotedArray = Array.from(promotedHosts);
                                onConfirm(hostsToGenerate, batchStartDate, batchEndDate, selectedTemplateId, promotedArray, internalZoneId, false);
                            }}
                            disabled={selected.size === 0}
                            className={`px-4 py-2 rounded ${t.buttonSecondary || 'bg-purple-600 hover:bg-purple-700 text-white'} font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs flex items-center gap-2`}
                        >
                            <FileText className="w-3 h-3" />
                            {(mode !== 'department' && selected.has(NO_SUBDOMAIN)) ? 'Generate Domain Report' : (selected.size === 0 ? 'Generate Report' : `Generate ${selected.size} Report${selected.size > 1 ? 's' : ''}`)}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ZoneRow = ({ zoneId, zoneData, fetchSyncStatus, apiToken, isManageMode }) => {
    const [expanded, setExpanded] = useState(false);
    const handleDelete = async (domain, e, displayName = domain) => {
        e.stopPropagation();
        const confirmation = await Swal.fire({
            title: 'Delete Data?',
            text: `Remove backup data for ${displayName}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#4b5563',
            confirmButtonText: 'Yes, Delete',
            background: '#1f2937',
            color: '#fff'
        });

        if (confirmation.isConfirmed) {
            try {
                const res = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'delete-sync-data',
                        zoneId: zoneId,
                        subdomain: domain,
                        apiToken: apiToken
                    })
                });
                const body = await res.json();
                if (body.success) {
                    Swal.fire({ title: 'Deleted', icon: 'success', text: 'Data has been deleted.', background: '#1f2937', color: '#fff', timer: 1500, showConfirmButton: false });
                    fetchSyncStatus();
                } else {
                    Swal.fire({ title: 'Error', icon: 'error', text: body.message, background: '#1f2937', color: '#fff' });
                }
            } catch (err) {
                console.error(err);
            }
        }
    };
    return (
        <>
            <tr className="hover:bg-gray-800/50">
                <td className="p-2 text-center align-middle">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-gray-400 hover:text-white transition"
                    >
                        {expanded ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        )}
                    </button>
                </td>
                <td className="p-2 text-gray-300 text-xs font-semibold">
                    <div className="flex flex-col">
                        <span>{zoneData.name}</span>
                        <span className="text-[10px] text-gray-500 font-normal">{zoneData.accountName}</span>
                    </div>
                </td>
                <td className="p-2 text-gray-400 font-mono text-xs flex items-center gap-2">
                    {zoneId}
                    <button
                        onClick={() => { navigator.clipboard.writeText(zoneId); }}
                        className="opacity-50 hover:opacity-100 hover:text-blue-400"
                        title="Copy Zone ID"
                    >
                        <Copy className="w-3 h-3" />
                    </button>
                </td>
                <td className="p-2 text-blue-400 text-xs text-right whitespace-nowrap">
                    <div className="flex justify-end items-center gap-2">
                        <span className="text-right leading-tight">
                            {zoneData.earliest && zoneData.earliest !== zoneData.latest
                                ? <>{new Date(zoneData.earliest).toLocaleDateString()}<br /><span className="text-gray-500">→</span> {new Date(zoneData.latest).toLocaleDateString()}</>
                                : new Date(zoneData.latest).toLocaleDateString()
                            }
                        </span>
                        {isManageMode && (
                            <button onClick={(e) => handleDelete('ALL_DOMAINS', e, `${zoneData.name} (all synced data)`)} className="text-red-500 hover:text-red-400 p-1 flex items-center justify-center rounded hover:bg-red-900/30 transition-colors" title="Delete All Zone Data">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </td>
            </tr>
            {expanded && (
                <tr className="bg-gray-800/20">
                    <td colSpan={4} className="p-0 border-t border-gray-800">
                        <div className="pl-8 pr-4 py-2 text-xs text-gray-400 space-y-1">
                            {/* Header row */}
                            <div className="flex items-center justify-between py-1 border-b border-gray-800/60 text-gray-500 font-semibold text-[10px] uppercase tracking-wider">
                                <span className="flex-1">Subdomain</span>
                                <span className="text-right w-48">Backed Up Range</span>
                                <div className="w-8"></div>
                            </div>
                            {[...zoneData.domains]
                                .sort((a, b) => {
                                    if (a.domain === 'ALL_SUBDOMAINS') return -1;
                                    if (b.domain === 'ALL_SUBDOMAINS') return 1;
                                    return a.domain.localeCompare(b.domain);
                                })
                                .map(d => {
                                    const displayName = d.domain === 'ALL_SUBDOMAINS' ? `${zoneData.name} (zone overview)` : d.domain;
                                    const isZoneOverview = d.domain === 'ALL_SUBDOMAINS';
                                    const dateRange = d.first_date && d.first_date !== d.last_date
                                        ? `${new Date(d.first_date).toLocaleDateString()} → ${new Date(d.last_date).toLocaleDateString()}`
                                        : new Date(d.last_date).toLocaleDateString();
                                    return (
                                        <div key={d.domain} className="flex items-center justify-between hover:text-gray-200 py-0.5 group">
                                            <span className={`flex-1 flex items-center gap-1 ${isZoneOverview ? 'text-blue-400/80 italic' : ''}`}>
                                                {isZoneOverview ? '🌐' : '↳'} {displayName}
                                            </span>
                                            <span className="text-right w-48 font-mono text-[10px] text-gray-400 group-hover:text-gray-200">{dateRange}</span>
                                            <div className="w-8 flex justify-end">
                                                {isManageMode && (
                                                    <button onClick={(e) => handleDelete(d.domain, e, displayName)} className="text-red-500 hover:text-red-400 p-1 flex items-center justify-center rounded hover:bg-red-900/30 transition-colors" title="Delete Data">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

const SyncHistoryModal = ({ isOpen, onClose, accounts, theme, currentUser }) => {
    const [selectedAccounts, setSelectedAccounts] = useState(new Set());
    const [zones, setZones] = useState([]);
    const [loadingZones, setLoadingZones] = useState(false);
    const [selectedZones, setSelectedZones] = useState(new Set());
    const [syncStatusData, setSyncStatusData] = useState([]);
    const [syncJobs, setSyncJobs] = useState([]);
    const [completedSyncHistory, setCompletedSyncHistory] = useState([]);
    const [isManageMode, setIsManageMode] = useState(false);
    const [syncListScope, setSyncListScope] = useState('all');
    const [syncJobFilter, setSyncJobFilter] = useState('all');

    const [searchQuery, setSearchQuery] = useState('');
    const [accountSearchQuery, setAccountSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [nowTick, setNowTick] = useState(Date.now());
    const ITEMS_PER_PAGE = 20;
    const activeJobs = syncJobs.filter(job => ['queued', 'running', 'cancelling'].includes(job.status));
    const isSyncing = activeJobs.length > 0;
    const filteredSyncJobs = syncJobs.filter(job => {
        if (syncJobFilter === 'running') return job.status === 'running';
        if (syncJobFilter === 'queued') return job.status === 'queued';
        if (syncJobFilter === 'attention') return ['failed', 'cancelled'].includes(job.status);
        return true;
    });

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, syncListScope, selectedAccounts]);

    const paginatedSyncDataList = useMemo(() => {
        if (!syncStatusData) return { data: [], totalPages: 0 };

        const grouped = Object.entries(
            syncStatusData.reduce((acc, curr) => {
                if (!acc[curr.zone_id]) acc[curr.zone_id] = { name: curr.zone_name || 'Unknown Zone', accountName: curr.account_name || 'Unknown Account', domains: [], latest: curr.last_date, earliest: curr.first_date };
                acc[curr.zone_id].domains.push(curr);
                if (new Date(curr.last_date) > new Date(acc[curr.zone_id].latest)) {
                    acc[curr.zone_id].latest = curr.last_date;
                }
                if (curr.first_date && (!acc[curr.zone_id].earliest || new Date(curr.first_date) < new Date(acc[curr.zone_id].earliest))) {
                    acc[curr.zone_id].earliest = curr.first_date;
                }
                return acc;
            }, {})
        ).map(([zoneId, zoneData]) => ({ zoneId, ...zoneData }));

        let filtered = grouped;
        if (syncListScope === 'selected') {
            filtered = filtered.filter(item =>
                Array.from(selectedAccounts).some(accId =>
                    zones.some(zone => zone.id === item.zoneId && zone.account?.id === accId)
                )
            );
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(item =>
                item.zoneId.toLowerCase().includes(q) ||
                item.name.toLowerCase().includes(q) ||
                item.domains.some(d => d.domain.toLowerCase().includes(q))
            );
        }

        const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
        const data = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

        return { data, totalPages };
    }, [syncStatusData, searchQuery, currentPage, syncListScope, selectedAccounts, zones]);

    const t = theme?.modal || {
        overlay: 'bg-black/80',
        content: 'bg-gray-900 border-gray-700 text-gray-100',
        title: 'text-white',
        input: 'bg-gray-800 border-gray-700 text-white focus:ring-blue-500',
        button: 'bg-gray-800 hover:bg-gray-700 text-gray-300',
        buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white'
    };

    useEffect(() => {
        if (isOpen) {
            fetchSyncStatus();
            fetchSyncJobs();
            fetchCompletedSyncHistory();
            setSelectedAccounts(new Set());
            setZones([]);
            setSelectedZones(new Set());
            setSearchQuery('');
            setSyncListScope('all');
            setCurrentPage(1);
        }
    }, [isOpen]);

    const fetchSyncStatus = async () => {
        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'get-all-sync-status',
                    apiToken: currentUser?.cloudflare_api_token
                })
            });
            const res = await response.json();
            if (res.success && res.data) {
                setSyncStatusData(res.data);
            }
        } catch (e) {
            console.error('Failed to fetch sync status', e);
        }
    };

    const fetchSyncJobs = async () => {
        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'get-sync-jobs',
                    apiToken: currentUser?.cloudflare_api_token
                })
            });
            const res = await response.json();
            if (res.success && res.data) {
                setSyncJobs(res.data);
            }
        } catch (e) {
            console.error('Failed to fetch sync jobs', e);
        }
    };

    const fetchCompletedSyncHistory = async () => {
        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'get-completed-sync-history',
                    apiToken: currentUser?.cloudflare_api_token
                })
            });
            const res = await response.json();
            if (res.success && res.data) {
                setCompletedSyncHistory(res.data);
            }
        } catch (e) {
            console.error('Failed to fetch completed sync history', e);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        const timer = setInterval(() => {
            fetchSyncJobs();
            fetchSyncStatus();
            fetchCompletedSyncHistory();
        }, 5000);
        return () => clearInterval(timer);
    }, [isOpen, currentUser]);

    useEffect(() => {
        if (!isOpen) return;
        const timer = setInterval(() => setNowTick(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [isOpen]);

    const getElapsedSeconds = (startedAt) => {
        if (!startedAt) return 0;
        const elapsed = Math.floor((nowTick - new Date(startedAt).getTime()) / 1000);
        return Math.max(elapsed, 0);
    };

    const getHeartbeatSeconds = (updatedAt) => {
        if (!updatedAt) return null;
        const elapsed = Math.floor((nowTick - new Date(updatedAt).getTime()) / 1000);
        return Math.max(elapsed, 0);
    };

    const handleAccountChange = async (accId) => {
        const next = new Set(selectedAccounts);
        if (next.has(accId)) next.delete(accId);
        else next.add(accId);
        setSelectedAccounts(next);
    };

    useEffect(() => {
        const fetchZonesForAccounts = async () => {
            if (selectedAccounts.size === 0) {
                setZones([]);
                setSelectedZones(new Set());
                return;
            }

            setLoadingZones(true);
            try {
                const fetchPromises = Array.from(selectedAccounts).map(accId =>
                    fetch('/api/scrape', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'list-zones',
                            accountId: accId,
                            apiToken: currentUser?.cloudflare_api_token
                        })
                    }).then(res => res.json())
                );

                const results = await Promise.all(fetchPromises);
                let allZones = [];
                results.forEach(res => {
                    if (res.success && res.data) {
                        allZones = [...allZones, ...res.data];
                    }
                });

                setZones(allZones);
                setSelectedZones(prev => {
                    const next = new Set();
                    allZones.forEach(z => {
                        if (prev.has(z.id)) next.add(z.id);
                    });
                    return next;
                });
            } catch (e) {
                console.error('Failed to fetch zones', e);
            } finally {
                setLoadingZones(false);
            }
        };

        if (isOpen) {
            fetchZonesForAccounts();
        }
    }, [selectedAccounts, isOpen, currentUser]);

    const toggleZone = (zoneId) => {
        const next = new Set(selectedZones);
        if (next.has(zoneId)) next.delete(zoneId);
        else next.add(zoneId);
        setSelectedZones(next);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !isSyncing) onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isSyncing, onClose]);

    const handleSync = async () => {
        if (selectedZones.size === 0) return;
        const zonesArray = Array.from(selectedZones);
        const payload = zonesArray.map(zoneId => {
            const zone = zones.find(z => z.id === zoneId);
            return {
                id: zoneId,
                name: zone?.name || 'Unknown Zone',
                accountName: zone?.account?.name || accounts.find(a => selectedAccounts.has(a.id))?.name || 'Unknown Account'
            };
        });

        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start-sync-jobs',
                    zones: payload,
                    requestedBy: currentUser?.username || currentUser?.email || 'unknown',
                    apiToken: currentUser?.cloudflare_api_token
                })
            });
            const res = await response.json();
            if (!res.success) throw new Error(res.message || 'Failed to start sync jobs');

            const queued = res.data.filter(item => item.status === 'queued');
            const rejected = res.data.filter(item => item.status === 'rejected');

            setSelectedZones(new Set());
            await fetchSyncJobs();

            Swal.fire({
                title: 'Sync Jobs Started',
                html: `<div style="text-align:left;">
                    <p>Queued <b>${queued.length}</b> zone(s).</p>
                    ${rejected.length > 0 ? `<div style="margin-top:10px;"><p style="color:#fca5a5;font-weight:700;">Rejected (${rejected.length})</p><ul style="padding-left:18px;max-height:120px;overflow:auto;">${rejected.map(item => `<li>${item.zoneName || item.zoneId}: ${item.reason}</li>`).join('')}</ul></div>` : ''}
                </div>`,
                icon: rejected.length > 0 ? 'warning' : 'success',
                background: '#111827',
                color: '#fff'
            });
        } catch (e) {
            Swal.fire({ title: 'Error', text: e.message || 'Failed to start sync jobs.', icon: 'error', background: '#111827', color: '#fff' });
        }
    };

    const handleForceStopJob = async (jobId) => {
        const confirmation = await Swal.fire({
            title: 'Force Stop Sync?',
            text: 'This will stop the running sync job as soon as it reaches a safe checkpoint.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#4b5563',
            confirmButtonText: 'Force Stop',
            background: '#1f2937',
            color: '#fff'
        });
        if (!confirmation.isConfirmed) return;

        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'force-stop-sync-job', jobId, apiToken: currentUser?.cloudflare_api_token })
        });
        const res = await response.json();
        if (!res.success) {
            Swal.fire({ title: 'Error', text: res.message || 'Failed to stop sync job.', icon: 'error', background: '#111827', color: '#fff' });
            return;
        }
        await fetchSyncJobs();
    };

    const handleDeleteJob = async (jobId) => {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete-sync-job', jobId, apiToken: currentUser?.cloudflare_api_token })
        });
        const res = await response.json();
        if (!res.success) {
            Swal.fire({ title: 'Error', text: res.message || 'Failed to delete sync job.', icon: 'error', background: '#111827', color: '#fff' });
            return;
        }
        await fetchSyncJobs();
    };

    const handleRetryJob = async (jobId) => {
        const confirmation = await Swal.fire({
            title: 'Retry Job?',
            text: 'This will stop the current job safely and queue a fresh retry for the same zone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#4b5563',
            confirmButtonText: 'Retry Job',
            background: '#1f2937',
            color: '#fff'
        });
        if (!confirmation.isConfirmed) return;

        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'retry-sync-job', jobId, apiToken: currentUser?.cloudflare_api_token })
        });
        const res = await response.json();
        if (!res.success) {
            Swal.fire({ title: 'Error', text: res.message || 'Failed to retry sync job.', icon: 'error', background: '#111827', color: '#fff' });
            return;
        }
        await fetchSyncJobs();
    };

    const handleClearCompletedHistory = async () => {
        const confirmation = await Swal.fire({
            title: 'Clear Completed History?',
            text: 'This will remove the list of completed sync jobs. Synced daily data will remain intact.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#4b5563',
            confirmButtonText: 'Clear Completed',
            background: '#1f2937',
            color: '#fff'
        });
        if (!confirmation.isConfirmed) return;

        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'clear-completed-sync-history', apiToken: currentUser?.cloudflare_api_token })
        });
        const res = await response.json();
        if (!res.success) {
            Swal.fire({ title: 'Error', text: res.message || 'Failed to clear completed history.', icon: 'error', background: '#111827', color: '#fff' });
            return;
        }
        await fetchCompletedSyncHistory();
    };

    if (!isOpen) return null;

    const getLastSync = (zoneId) => {
        const match = syncStatusData.find(s => s.zone_id === zoneId && s.domain === 'ALL_SUBDOMAINS');
        if (!match || !match.last_date) return 'Never';
        const start = match.first_date ? new Date(match.first_date).toLocaleDateString() : 'Unknown';
        const end = new Date(match.last_date).toLocaleDateString();
        return `${start} - ${end}`;
    };

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center ${t.overlay} p-4 backdrop-blur-sm`}
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden border ${t.content} relative`}>

                <div className={`p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50`}>
                    <h2 className={`text-xl font-bold flex items-center gap-2 ${t.title}`}>
                        <Database className="w-5 h-5 text-green-400" />
                        Sync Historical Data
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-800 text-gray-400 hover:text-white rounded transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6 bg-gray-900 flex-1">
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-semibold uppercase text-gray-400 flex items-center gap-2">
                                    <span>Select Accounts</span>
                                    {accounts.length > 0 && selectedAccounts.size > 0 && (
                                        <span className="text-gray-500 font-normal normal-case">({selectedAccounts.size} selected)</span>
                                    )}
                                </label>
                                {/* Account Search Box */}
                                <div className="relative">
                                    <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input
                                        type="text"
                                        placeholder="Search accounts..."
                                        value={accountSearchQuery}
                                        onChange={(e) => setAccountSearchQuery(e.target.value)}
                                        className={`pl-7 pr-3 py-1 rounded w-48 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-800 border ${theme?.modal?.border || 'border-gray-700'} text-white`}
                                    />
                                </div>
                            </div>
                            <div className={`w-full max-h-48 overflow-y-auto rounded p-2 text-sm border ${t.input} bg-gray-800 flex flex-wrap gap-2`}>
                                {accounts
                                    .filter(acc => acc.name.toLowerCase().includes(accountSearchQuery.toLowerCase()))
                                    .map(acc => (
                                        <label key={acc.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-700/50 rounded cursor-pointer transition-colors border border-gray-700 bg-gray-900 w-[calc(50%-0.5rem)] md:w-[calc(33.33%-0.5rem)] lg:w-[calc(25%-0.5rem)]">
                                            <input
                                                type="checkbox"
                                                checked={selectedAccounts.has(acc.id)}
                                                onChange={() => handleAccountChange(acc.id)}
                                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 cursor-pointer"
                                            />
                                            <span className="text-gray-300 font-medium text-xs truncate" title={acc.name}>{acc.name}</span>
                                        </label>
                                    ))}
                                {accounts.filter(acc => acc.name.toLowerCase().includes(accountSearchQuery.toLowerCase())).length === 0 && (
                                    <div className="text-center w-full p-4 text-gray-500 text-xs">No accounts found matching &quot;{accountSearchQuery}&quot;</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {selectedAccounts.size > 0 && (
                        <div className="border border-gray-700 rounded-lg overflow-hidden flex flex-col max-h-[400px]">
                            <div className="p-3 bg-gray-800 border-b border-gray-700 flex justify-between items-center sticky top-0 z-10">
                                <h3 className="text-sm font-semibold text-white">Zones ({zones.length})</h3>
                                <div className="space-x-2">
                                    <button
                                        onClick={() => setSelectedZones(new Set(zones.filter(z => z.status === 'active').map(z => z.id)))}
                                        className="text-xs text-blue-400 hover:text-blue-300"
                                        disabled={zones.filter(z => z.status === 'active').length === 0}
                                    >Select All</button>
                                    <span className="text-gray-600">|</span>
                                    <button
                                        onClick={() => setSelectedZones(new Set())}
                                        className="text-xs text-gray-400 hover:text-gray-300"
                                        disabled={selectedZones.size === 0}
                                    >Clear</button>
                                </div>
                            </div>

                            <div className="overflow-y-auto flex-1 bg-gray-900/50 p-0">
                                {loadingZones ? (
                                    <div className="p-10 text-center text-gray-400 flex flex-col items-center">
                                        <Activity className="w-8 h-8 animate-spin mb-3 text-blue-400" />
                                        Fetching zones from Cloudflare...
                                    </div>
                                ) : zones.length === 0 ? (
                                    <div className="p-10 text-center text-gray-500">No zones found for this account.</div>
                                ) : (
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-900/90 text-gray-400 sticky top-0 z-10 hidden md:table-header-group">
                                            <tr>
                                                <th className="p-3 w-12 text-center"><Database className="w-3 h-3 opacity-0" /></th>
                                                <th className="p-3">Zone Name</th>
                                                <th className="p-3">Status</th>
                                                <th className="p-3 text-right">Backed Up Range</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800">
                                            {[...zones]
                                                .sort((a, b) => {
                                                    const order = s => s === 'active' ? 0 : 1;
                                                    return order(a.status) - order(b.status) || a.name.localeCompare(b.name);
                                                })
                                                .map(z => {
                                                    const isPending = z.status !== 'active';
                                                    const isSelected = selectedZones.has(z.id);
                                                    const lastSync = getLastSync(z.id);
                                                    const hasData = lastSync !== 'Never';

                                                    return (
                                                        <tr
                                                            key={z.id}
                                                            title={isPending ? `Zone is "${z.status}" — cannot be selected for sync` : ''}
                                                            className={`transition-colors ${isPending
                                                                ? 'opacity-40 cursor-not-allowed bg-gray-900/30'
                                                                : `hover:bg-gray-800/80 cursor-pointer ${isSelected ? 'bg-blue-900/10' : ''}`
                                                                }`}
                                                            onClick={() => !isPending && toggleZone(z.id)}
                                                        >
                                                            <td className="p-3 text-center align-middle">
                                                                <div className="flex items-center justify-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        readOnly
                                                                        disabled={isPending}
                                                                        className={`w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 ${isPending ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td className="p-3 font-medium text-gray-200">
                                                                <div className="flex flex-col">
                                                                    <span>{z.name}</span>
                                                                    <span className="text-[10px] text-gray-500 md:hidden mt-1">{hasData ? `Range: ${lastSync}` : 'Never synced'}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-3 hidden md:table-cell">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${z.status === 'active' ? 'bg-green-900/50 text-green-400' :
                                                                    z.status === 'pending' ? 'bg-yellow-900/50 text-yellow-500' :
                                                                        'bg-red-900/50 text-red-500'
                                                                    }`}>
                                                                    {z.status.toUpperCase()}
                                                                </span>
                                                            </td>
                                                            <td className={`p-3 text-right text-xs hidden md:table-cell ${hasData ? 'text-blue-400 font-medium' : 'text-gray-500'}`}>
                                                                {hasData ? <span className="flex items-center justify-end gap-1 text-[11px]"><Check className="w-3 h-3" /> {lastSync}</span> : 'Never'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/30 flex flex-col min-h-[140px]">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-300">
                                <Activity className="w-4 h-4 text-yellow-400" />
                                Sync Jobs ({syncJobs.length})
                            </h3>
                            <div className="flex items-center gap-2">
                                {isSyncing && (
                                    <span className="text-[11px] text-blue-300">
                                        Background sync running for {activeJobs.length} zone(s)
                                    </span>
                                )}
                                <div className="flex items-center rounded-full border border-gray-700 bg-gray-800 p-0.5">
                                    <button onClick={() => setSyncJobFilter('all')} className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${syncJobFilter === 'all' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>All</button>
                                    <button onClick={() => setSyncJobFilter('running')} className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${syncJobFilter === 'running' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Running</button>
                                    <button onClick={() => setSyncJobFilter('queued')} className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${syncJobFilter === 'queued' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Queued</button>
                                    <button onClick={() => setSyncJobFilter('attention')} className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${syncJobFilter === 'attention' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Attention</button>
                                </div>
                            </div>
                        </div>

                        {filteredSyncJobs.length === 0 ? (
                            <div className="text-sm text-gray-500">No active or attention jobs.</div>
                        ) : (
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {filteredSyncJobs.map(job => (
                                    <div key={job.id} className="border border-gray-800 rounded-lg p-3 bg-gray-950/40">
                                        {(() => {
                                            const heartbeat = getHeartbeatSeconds(job.updated_at);
                                            const isPossiblyStuck = heartbeat !== null && heartbeat > 30 && ['running', 'cancelling'].includes(job.status);
                                            return (
                                                <>
                                        <div className="flex items-center justify-between gap-3 mb-2">
                                            <div>
                                                <div className="text-sm text-gray-100 font-semibold">{job.zone_name}</div>
                                                <div className="text-[11px] text-gray-500">{job.account_name}</div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${job.status === 'running' ? 'bg-blue-900/50 text-blue-300' : job.status === 'queued' ? 'bg-yellow-900/50 text-yellow-300' : job.status === 'cancelling' ? 'bg-orange-900/50 text-orange-300' : job.status === 'failed' ? 'bg-red-900/50 text-red-300' : 'bg-gray-800 text-gray-300'}`}>
                                                {job.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2">
                                            <span>
                                                Current day running for <span className="text-gray-200">{getElapsedSeconds(job.current_date_started_at)}s</span>
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isPossiblyStuck ? 'bg-red-900/40 text-red-300' : 'bg-emerald-900/40 text-emerald-300'}`}>
                                                {isPossiblyStuck ? `Possibly stuck (${heartbeat}s)` : `Heartbeat ${heartbeat ?? '-'}s ago`}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400">
                                            <div>Phase: <span className="text-gray-200">{job.current_phase || '-'}</span></div>
                                            <div>Domain: <span className="text-gray-200">{job.current_domain || '-'}</span></div>
                                            <div>Date: <span className="text-gray-200">{job.current_date || '-'}</span></div>
                                            <div>Zone progress: <span className="text-gray-200">{job.zone_completed_steps || 0}/{job.zone_total_steps || 0}</span></div>
                                            <div>Day progress: <span className="text-gray-200">{job.subdomain_completed_days || 0}/{job.subdomain_total_days || 0}</span></div>
                                        </div>
                                        <div className="mt-3">
                                            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                                                <span>Zone Progress</span>
                                                <span>
                                                    {job.zone_total_steps > 0
                                                        ? `${Math.round(((job.zone_completed_steps || 0) / job.zone_total_steps) * 100)}%`
                                                        : '0%'}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden border border-gray-700">
                                                <div
                                                    className="bg-green-500 h-1.5 transition-all duration-300"
                                                    style={{ width: `${job.zone_total_steps > 0 ? Math.min(((job.zone_completed_steps || 0) / job.zone_total_steps) * 100, 100) : 0}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                                                <span>Day Progress</span>
                                                <span>
                                                    {job.subdomain_total_days > 0
                                                        ? `${Math.round(((job.subdomain_completed_days || 0) / job.subdomain_total_days) * 100)}%`
                                                        : '0%'}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden border border-gray-700">
                                                <div
                                                    className="bg-blue-500 h-1.5 transition-all duration-300"
                                                    style={{ width: `${job.subdomain_total_days > 0 ? Math.min(((job.subdomain_completed_days || 0) / job.subdomain_total_days) * 100, 100) : 0}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        <details className="mt-3 border border-amber-900/40 bg-amber-950/20 rounded-lg p-3">
                                            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-[11px] font-semibold text-amber-300">
                                                <span>429 Details</span>
                                                <span className="text-[10px] text-amber-200">{job.rate_limit_count || 0} event(s)</span>
                                            </summary>
                                            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400 mt-2">
                                                <div>Count: <span className="text-gray-200">{job.rate_limit_count || 0}</span></div>
                                                <div>Last date: <span className="text-gray-200">{job.last_rate_limited_date || '-'}</span></div>
                                                <div className="col-span-2">Last domain: <span className="text-gray-200">{job.last_rate_limited_domain || '-'}</span></div>
                                            </div>
                                        </details>
                                        {job.last_error && (
                                            <div className="mt-2 text-[11px] text-red-300">Last error: {job.last_error}</div>
                                        )}
                                        <div className="mt-3 flex justify-end gap-2">
                                            {isPossiblyStuck && (
                                                <button onClick={() => handleRetryJob(job.id)} className="px-3 py-1 rounded text-[11px] font-semibold bg-blue-900/40 text-blue-300 border border-blue-800/50 hover:bg-blue-900/60">
                                                    Retry Job
                                                </button>
                                            )}
                                            {(job.status === 'queued' || job.status === 'running' || job.status === 'cancelling') && (
                                                <button onClick={() => handleForceStopJob(job.id)} className="px-3 py-1 rounded text-[11px] font-semibold bg-red-900/40 text-red-300 border border-red-800/50 hover:bg-red-900/60">
                                                    {job.status === 'cancelling' ? 'Stopping...' : 'Force Stop'}
                                                </button>
                                            )}
                                            {(job.status === 'failed' || job.status === 'cancelled') && (
                                                <button onClick={() => handleDeleteJob(job.id)} className="px-3 py-1 rounded text-[11px] font-semibold bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700">
                                                    Delete Job
                                                </button>
                                            )}
                                        </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/30 flex flex-col min-h-[140px]">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-300">
                                <Check className="w-4 h-4 text-green-400" />
                                Recently Completed ({completedSyncHistory.length})
                            </h3>
                            <button onClick={handleClearCompletedHistory} disabled={completedSyncHistory.length === 0} className="px-3 py-1 rounded text-[11px] font-semibold bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                Clear Completed
                            </button>
                        </div>

                        {completedSyncHistory.length === 0 ? (
                            <div className="text-sm text-gray-500">No completed sync history yet.</div>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {completedSyncHistory.map(item => (
                                    <details key={item.id} className="border border-gray-800 rounded-lg p-3 bg-gray-950/40">
                                        <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-sm text-gray-100 font-semibold">{item.zone_name}</div>
                                                <div className="text-[11px] text-gray-500">{item.account_name}</div>
                                            </div>
                                            <div className="text-right text-[11px] text-gray-400">
                                                <div>{item.completed_at ? new Date(item.completed_at).toLocaleString() : '-'}</div>
                                                <div>{item.duration_seconds || 0}s</div>
                                            </div>
                                        </summary>
                                        <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400 mt-3">
                                            <div>Requested by: <span className="text-gray-200">{item.requested_by || '-'}</span></div>
                                            <div>Zone progress: <span className="text-gray-200">{item.zone_completed_steps || 0}/{item.zone_total_steps || 0}</span></div>
                                            <div>Duration: <span className="text-gray-200">{item.duration_seconds || 0}s</span></div>
                                        </div>
                                        <div className="mt-3">
                                            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                                                <span>Zone Progress</span>
                                                <span>
                                                    {item.zone_total_steps > 0
                                                        ? `${Math.round(((item.zone_completed_steps || 0) / item.zone_total_steps) * 100)}%`
                                                        : '0%'}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden border border-gray-700">
                                                <div
                                                    className="bg-green-500 h-1.5 transition-all duration-300"
                                                    style={{ width: `${item.zone_total_steps > 0 ? Math.min(((item.zone_completed_steps || 0) / item.zone_total_steps) * 100, 100) : 0}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        <details className="mt-3 border border-amber-900/40 bg-amber-950/20 rounded-lg p-3">
                                            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-[11px] font-semibold text-amber-300">
                                                <span>429 Details</span>
                                                <span className="text-[10px] text-amber-200">{item.rate_limit_count || 0} event(s)</span>
                                            </summary>
                                            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400 mt-2">
                                                <div>Count: <span className="text-gray-200">{item.rate_limit_count || 0}</span></div>
                                                <div>Last date: <span className="text-gray-200">{item.last_rate_limited_date || '-'}</span></div>
                                                <div className="col-span-2">Last domain: <span className="text-gray-200">{item.last_rate_limited_domain || '-'}</span></div>
                                            </div>
                                        </details>
                                    </details>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/30 flex flex-col min-h-[200px]">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-300">
                                <Database className="w-4 h-4 text-blue-400" />
                                Currently Backed Up Zones ({syncStatusData.length > 0 ? Object.keys(syncStatusData.reduce((acc, curr) => { acc[curr.zone_id] = true; return acc; }, {})).length : 0} total)
                            </h3>
                            {/* Search & Manage Toggle */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center rounded-full border border-gray-700 bg-gray-800 p-0.5">
                                    <button
                                        onClick={() => setSyncListScope('all')}
                                        className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${syncListScope === 'all' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        All Synced
                                    </button>
                                    <button
                                        onClick={() => setSyncListScope('selected')}
                                        className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${syncListScope === 'selected' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Selected Only
                                    </button>
                                </div>
                                <button
                                    onClick={() => setIsManageMode(!isManageMode)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1 border ${isManageMode ? 'bg-red-900/40 text-red-400 border-red-800/50' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white hover:bg-gray-700'}`}
                                    title="Toggle Manage Mode to delete data"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    Manage zones
                                </button>
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input
                                        type="text"
                                        placeholder="Search zones..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className={`pl-9 pr-4 py-1.5 rounded-full text-xs w-64 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-800 border ${theme?.modal?.border || 'border-gray-700'} text-white`}
                                    />
                                    {searchQuery && (
                                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white pb-1">×</button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="overflow-hidden rounded border border-gray-800 flex-1">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-800 text-gray-400 text-xs">
                                    <tr>
                                        <th className="p-2 w-10 text-center"></th>
                                        <th className="p-2 flex-1">Zone / Account Name</th>
                                        <th className="p-2 w-2/5">Zone ID</th>
                                        <th className="p-2 w-1/4 text-right">Backed Up Range</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800 bg-gray-900 block w-full table-fixed overflow-y-auto" style={{ display: 'table-row-group' }}>
                                    {paginatedSyncDataList.data.length > 0 ? paginatedSyncDataList.data.map((zone) => (
                                        <ZoneRow key={zone.zoneId} zoneId={zone.zoneId} zoneData={zone} fetchSyncStatus={fetchSyncStatus} apiToken={currentUser?.cloudflare_api_token} isManageMode={isManageMode} />
                                    )) : (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-gray-500 text-sm">
                                                {syncListScope === 'selected' && selectedAccounts.size === 0
                                                    ? 'No selected accounts. Choose one or more accounts above to filter this list.'
                                                    : searchQuery
                                                    ? `No zones found matching "${searchQuery}"`
                                                    : 'No synced data yet. Select accounts and zones above, then click Sync to begin.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination Controls */}
                        {paginatedSyncDataList.totalPages > 1 && (
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-800 text-xs text-gray-400">
                                <span>
                                    Showing page <span className="text-gray-200 font-semibold">{currentPage}</span> of <span className="text-gray-200 font-semibold">{paginatedSyncDataList.totalPages}</span>
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Prev
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(paginatedSyncDataList.totalPages, p + 1))}
                                        disabled={currentPage === paginatedSyncDataList.totalPages}
                                        className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                <div className="p-4 border-t border-gray-800 bg-gray-900 shadow-[0_-4px_10px_rgba(0,0,0,0.3)]">
                    <div className="flex justify-end gap-3">
                        <button onClick={onClose} className={`px-4 py-2 rounded text-xs font-medium transition-colors ${t.button}`}>Close</button>
                        <button
                            onClick={handleSync}
                            disabled={selectedZones.size === 0}
                            className={`px-4 py-2 rounded text-xs font-bold transition-all flex items-center gap-2
                                ${selectedZones.size === 0
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'}`}
                        >
                            <Database className="w-4 h-4" />
                            {`Sync ${selectedZones.size} Zone${selectedZones.size > 1 ? 's' : ''}`}
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
};



const Card = ({ title, children, className = '', theme }) => {
    // Default to dark theme styles if theme prop isn't provided (backward compatibility)
    const cardClass = theme ? theme.card : 'bg-gray-900 border-gray-800';
    const headerClass = theme ? theme.cardHeader : 'bg-gray-900/50 border-gray-800';
    const titleClass = theme ? theme.subText : 'text-gray-400';
    const iconClass = theme ? theme.icon : 'text-gray-500 hover:text-white';

    return (
        <div className={`border rounded-lg overflow-hidden ${cardClass} ${className} pdf-card`}>
            <div className={`${headerClass} p-3 border-b flex justify-between items-center px-4 py-2`}>
                <h3 className={`${titleClass} text-xs font-semibold uppercase tracking-wider`}>{title}</h3>
            </div>
            <div className="p-4">
                {children}
            </div>
        </div>
    );
};

// Icon removed


const HorizontalBarList = ({ data, labelKey, valueKey, color = "bg-blue-600", theme }) => {
    const maxValue = Math.max(...data.map(d => d[valueKey] || 0), 1);
    const total = data.length;

    const isCorporate = theme?.id === 'corporate';
    const headerText = isCorporate ? 'text-slate-600' : 'text-gray-500';
    const headerBorder = isCorporate ? 'border-slate-200' : 'border-gray-800';
    const labelText = isCorporate ? 'text-slate-900' : 'text-gray-300';
    const valueText = isCorporate ? 'text-slate-700' : 'text-gray-400';
    const rowBg = isCorporate ? 'bg-slate-200/60' : 'bg-gray-800/50';

    if (total === 0) {
        return <div className="text-gray-500 text-xs italic py-2">No data available</div>;
    }

    return (
        <div className="space-y-3 font-mono text-xs">
            <div className={`flex justify-between ${headerText} border-b ${headerBorder} pb-1 mb-2`}>
                <span>{labelKey}</span>
                <span>Count</span>
            </div>
            {data.map((item, idx) => (
                <div key={idx} className="relative group">
                    <div className="flex justify-between items-center relative z-10 py-1">
                        <span className={`${labelText} truncate w-2/3 pr-2 pl-2`}>{item[labelKey] || item.name}</span>
                        <span className={valueText}>{item[valueKey]?.toLocaleString() || 0}</span>
                    </div>
                    <div className={`absolute top-0 left-0 h-full ${rowBg} w-full rounded-sm`}>
                        <div
                            className={`h-full ${color} opacity-40 rounded-sm transition-all duration-1000`}
                            style={{ width: `${((item[valueKey] || 0) / maxValue) * 100}%` }}
                        ></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- DEFAULT CONFIG FOR AUTO-SELECT ---
const DEFAULT_CONFIG = {
    accountName: "",
    zoneName: "",
    subDomain: ""
};

// --- MAIN COMPONENT ---

export default function GDCCPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState(null);

    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isReportMenuOpen, setIsReportMenuOpen] = useState(false); // Dropdown State
    const [isTemplateSubmenuOpen, setIsTemplateSubmenuOpen] = useState(false); // Submenu State
    const [isThemeSubmenuOpen, setIsThemeSubmenuOpen] = useState(false); // Submenu State

    const [dashboardImage, setDashboardImage] = useState(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [reportTemplate, setReportTemplate] = useState(DEFAULT_TEMPLATE);
    const [staticReportTemplate, setStaticReportTemplate] = useState(''); // Will be loaded from JSON file only
    const [middleReportTemplate, setMiddleReportTemplate] = useState('');
    const [reportModalMode, setReportModalMode] = useState('preview'); // 'preview' (report) | 'static-template' | 'middle-template'
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false); // NEW: Batch Modal State
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [isAutoReportModalOpen, setIsAutoReportModalOpen] = useState(false);
    const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
    const dashboardRef = useRef(null);

    // Theme State
    const [currentTheme, setCurrentTheme] = useState('dark');
    const theme = THEMES[currentTheme] || THEMES.dark;

    // Theme Persist & Broadcast
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('gdcc_theme');
            if (stored && THEMES[stored]) {
                setCurrentTheme(stored);
                // Dispatch initial event just in case
                window.dispatchEvent(new CustomEvent('theme-change', { detail: stored }));
            }
        }
    }, []);

    // Force scroll to top on mount/refresh
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Disable browser's automatic scroll restoration
            if ('scrollRestoration' in window.history) {
                window.history.scrollRestoration = 'manual';
            }

            // Scroll to top immediately
            window.scrollTo(0, 0);

            // Also scroll after a short delay to ensure and override any other logic
            const timer = setTimeout(() => {
                window.scrollTo(0, 0);
            }, 100);

            return () => clearTimeout(timer);
        }
    }, []);

    const changeTheme = (newThemeId) => {
        setCurrentTheme(newThemeId);
        if (typeof window !== 'undefined') {
            localStorage.setItem('gdcc_theme', newThemeId);
            window.dispatchEvent(new CustomEvent('theme-change', { detail: newThemeId }));
        }
    };

    // Selector States
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [zones, setZones] = useState([]);
    const [subDomains, setSubDomains] = useState([]);

    const [topRules, setTopRules] = useState([]);
    const [topAttackers, setTopAttackers] = useState([]);
    const [topFirewallSources, setTopFirewallSources] = useState([]);
    const [customRulesList, setCustomRulesList] = useState([]);
    const [managedRulesList, setManagedRulesList] = useState([]);
    const [zoneSettings, setZoneSettings] = useState(null);
    const [dnsRecords, setDnsRecords] = useState([]);

    const [selectedAccount, setSelectedAccount] = useState('');
    const [selectedZone, setSelectedZone] = useState('');
    const [selectedSubDomain, setSelectedSubDomain] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [lastSyncDate, setLastSyncDate] = useState(null);
    const [syncing, setSyncing] = useState(false);

    // Additional Traffic Stats (Current View)
    const [totalDataTransfer, setTotalDataTransfer] = useState(0);
    const [cacheHitRequests, setCacheHitRequests] = useState(0);
    const [cacheHitDataTransfer, setCacheHitDataTransfer] = useState(0);

    // Zone-wide Stats (Always Root Domain)
    const [zoneWideRequests, setZoneWideRequests] = useState(0);
    const [zoneWideDataTransfer, setZoneWideDataTransfer] = useState(0);
    const [zoneWideCacheRequests, setZoneWideCacheRequests] = useState(0);
    const [zoneWideCacheDataTransfer, setZoneWideCacheDataTransfer] = useState(0);
    const [zoneWideTopCountriesReq, setZoneWideTopCountriesReq] = useState([]);
    const [zoneWideTopCountriesBytes, setZoneWideTopCountriesBytes] = useState([]);
    const [fwEvents, setFwEvents] = useState({ total: 0, managed: 0, custom: 0, bic: 0, access: 0 });

    const loadLastSyncDate = async (zoneId, subdomain) => {
        try {
            const res = await callAPI('get-sync-status', { zoneId, subdomain });
            if (res && res.data) {
                setLastSyncDate(res.data.lastSync);
            } else {
                setLastSyncDate(null);
            }
        } catch (err) {
            console.error('Failed to load sync date', err);
            setLastSyncDate(null);
        }
    };

    const handleSyncHistoricalData = async () => {
        if (!selectedZone) {
            Swal.fire('Error', 'Please select a zone first.', 'error');
            return;
        }
        if (!selectedSubDomain) {
            Swal.fire('Error', 'Please select a subdomain.', 'error');
            return;
        }

        setSyncing(true);
        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'sync-gdcc-history',
                    zoneId: selectedZone,
                    zoneName: zones.find(z => z.id === selectedZone)?.name || '',
                    accountName: accounts.find(a => a.id === selectedAccount)?.name || '',
                    subdomain: selectedSubDomain,
                    apiToken: currentUser?.cloudflare_api_token
                })
            });

            if (!response.ok) {
                throw new Error(`Sync request failed with status ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('Sync stream is unavailable');

            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let warningMessages = [];
            let success = false;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        if (data.type === 'done') success = true;
                        if (data.type === 'warning' && data.message) warningMessages.push(data.message);
                        if (data.type === 'error' && data.message) throw new Error(data.message);
                    } catch (parseErr) {
                        if (parseErr instanceof SyntaxError) {
                            console.warn('Failed to parse sync stream line:', line);
                        } else {
                            throw parseErr;
                        }
                    }
                }
            }

            if (success) {
                await loadLastSyncDate(selectedZone, selectedSubDomain);
                Swal.fire({
                    title: 'Success',
                    html: `<div style="text-align:left;">
                        <p>Historical data synced successfully for <b>${selectedSubDomain}</b>.</p>
                        ${warningMessages.length > 0 ? `<p style="margin-top:8px; color:#fbbf24;">Warnings:</p><ul style="margin-top:4px; padding-left:18px;">${warningMessages.map(msg => `<li>${msg}</li>`).join('')}</ul>` : ''}
                    </div>`,
                    icon: warningMessages.length > 0 ? 'warning' : 'success'
                });
            } else {
                Swal.fire('Info', 'Sync finished without new data.', 'info');
            }
        } catch (err) {
            Swal.fire('Error', err.message || 'Failed to sync historical data.', 'error');
        } finally {
            setSyncing(false);
        }
    };

    const fetchAndApplyTrafficData = async (subdomain, zoneId, p_startDate, p_endDate) => {
        if (!zoneId) {
            console.error('❌ Missing zoneId in fetchAndApplyTrafficData');
            return null;
        }
        setLoadingStats(true); // Start manual generation spinner
        const isAllSubdomains = subdomain === 'ALL_SUBDOMAINS';
        console.log(`🔍 Fetching traffic for: ${isAllSubdomains ? 'ALL ZONES' : subdomain} (${p_startDate} to ${p_endDate})`);

        let zReq = 0, zBytes = 0, zCacheReq = 0, zCacheBytes = 0;
        let zTopReq = [], zTopBytes = [];

        const result = await callAPI('get-traffic-analytics', {
            zoneId: zoneId,
            startDate: p_startDate,
            endDate: p_endDate,
            subdomain: isAllSubdomains ? null : subdomain,
            apiToken: currentUser?.cloudflare_api_token // Pass user token
        });

        let filteredData = [];
        let totalReq = 0;
        let weightedAvgTime = 0;
        let hostRequestTotal = 0;

        let blockedCount = 0;
        let logCount = 0;
        let topActions = [];
        let processedRules = [];
        let sortedAttackers = [];
        let firewallSourcesData = [];
        let customList = [];
        let managedList = [];

        if (result && result.success) {
            // console.log('✅ Traffic Data Received:', result.data); // Debug Header
            filteredData = result.data?.httpRequestsAdaptiveGroups || [];
            hostRequestTotal = result.data?.hostRequestTotal || 0;
            // console.log('   - Adaptive Groups:', filteredData.length);

            const firewallActivity = result.data?.firewallActivity || [];
            const firewallRulesData = result.data?.firewallRules || [];
            // console.log('   - Firewall Rules:', firewallRulesData.length);
            const firewallIPsData = result.data?.firewallIPs || [];
            firewallSourcesData = result.data?.firewallSources || [];

            // --- 1. FIREWALL SUMMARY (From Activity: Minute x Action) ---
            blockedCount = firewallActivity
                .filter(g => g.dimensions?.action !== 'log' && g.dimensions?.action !== 'skip' && g.dimensions?.action !== 'allow')
                .reduce((acc, g) => acc + g.count, 0);

            logCount = firewallActivity
                .filter(g => g.dimensions?.action === 'log')
                .reduce((acc, g) => acc + g.count, 0);

            setBlockedEvents(blockedCount);
            setLogEvents(logCount);

            // --- Action Distribution (Pie Chart) ---
            const actionCounts = {};
            firewallActivity.forEach(g => {
                const act = g.dimensions?.action || 'Unknown';
                actionCounts[act] = (actionCounts[act] || 0) + g.count;
            });
            topActions = Object.entries(actionCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
            setTopFirewallActions(topActions);


            // --- 2. TOP RULES (From Rules: Desc x ID) ---
            // Already aggregated correctly by API
            processedRules = firewallRulesData.map(g => ({
                rule: `${g.dimensions.description} (${g.dimensions.ruleId})`,
                count: g.count
            })).sort((a, b) => b.count - a.count).slice(0, 5);
            setTopRules(processedRules);

            // Extract Custom Rules
            customList = firewallRulesData
                .filter(g => {
                    const src = (g.dimensions?.source || '').toLowerCase();
                    const isCustom = src.includes('custom');
                    if (isCustom) console.log('🔴 FOUND CUSTOM RULE:', g.dimensions?.description, '| Source:', src, '| Count:', g.count);
                    return isCustom;
                })
                .map(g => ({
                    rule: `${g.dimensions.description} (${g.dimensions.ruleId})`,
                    count: g.count
                })).sort((a, b) => b.count - a.count).slice(0, 5);

            setCustomRulesList(customList);

            // Extract Managed Rules
            managedList = firewallRulesData
                .filter(g => {
                    const src = (g.dimensions?.source || '').toLowerCase();
                    return src.includes('managed') || src.includes('waf') || src === 'bic' || src === 'owasp';
                })
                .map(g => ({
                    rule: `${g.dimensions.description} (${g.dimensions.ruleId})`,
                    count: g.count
                })).sort((a, b) => b.count - a.count).slice(0, 5);
            setManagedRulesList(managedList);


            // --- 3. TOP ATTACKERS (From IPs: IP x Country) ---
            // Filter only mitigation actions if desired.
            const attackerMap = {};
            firewallIPsData.forEach(g => {
                const act = g.dimensions?.action;
                const isAttack = act !== 'log' && act !== 'skip' && act !== 'allow';

                if (isAttack) {
                    const ip = g.dimensions?.clientIP;
                    if (!attackerMap[ip]) {
                        attackerMap[ip] = {
                            ip: ip,
                            country: g.dimensions?.clientCountryName,
                            count: 0,
                            types: new Set()
                        };
                    }
                    attackerMap[ip].count += g.count;
                    attackerMap[ip].types.add(act);
                }
            });
            sortedAttackers = Object.values(attackerMap)
                .sort((a, b) => b.count - a.count)
                .map(a => ({ ...a, type: Array.from(a.types).join(', ') }));
            setTopAttackers(sortedAttackers);

            // --- 4. TOP SOURCES ---
            const sourcesList = firewallSourcesData.map(s => ({
                source: s.dimensions?.source || 'Unknown',
                count: s.count
            })).sort((a, b) => b.count - a.count).slice(0, 5);
            setTopFirewallSources(sourcesList);


            // --- AVG TTFB ---
            let totalReqLogs = 0;
            let totalTimeSum = 0;
            filteredData.forEach(item => {
                if (item.isSummary) {
                    const req = item.totals?.requests || 0;
                    totalReqLogs += req;
                    totalTimeSum += (item.totals?.avgResponseTime || 0) * req;
                    return;
                }
                const count = item.count;
                const avgTime = item.avg?.edgeTimeToFirstByteMs || 0;
                totalReqLogs += count;
                totalTimeSum += (avgTime * count);
            });
            if (totalReqLogs > 0) weightedAvgTime = Math.round(totalTimeSum / totalReqLogs);

            // --- TOTAL REQUESTS & DATA TRANSFER (ACCURATE) ---
            // --- ZONE-WIDE STATS (ACCURATE 1d SUMMARY) ---
            // --- TOTAL REQUESTS & DATA TRANSFER (ACCURATE) ---
            // --- ZONE-WIDE STATS (ACCURATE 1d SUMMARY) ---
            // --- ZONE-WIDE STATS (ACCURATE 1d SUMMARY) ---
            const zoneSummary = result.data?.zoneSummary || [];

            if (zoneSummary.length > 0) {
                zReq = zoneSummary.reduce((acc, day) => acc + (day.sum?.requests || 0), 0);
                zBytes = zoneSummary.reduce((acc, day) => acc + (day.sum?.bytes || 0), 0);
                zCacheReq = zoneSummary.reduce((acc, day) => acc + (day.sum?.cachedRequests || 0), 0);
                zCacheBytes = zoneSummary.reduce((acc, day) => acc + (day.sum?.cachedBytes || 0), 0);

                setZoneWideRequests(zReq);
                setZoneWideDataTransfer(zBytes);
                setZoneWideCacheRequests(zCacheReq);
                setZoneWideCacheDataTransfer(zCacheBytes);

                // Aggregate Countries from Summary (Accurate Zone-wide)
                const agg = {};
                zoneSummary.forEach(day => {
                    (day.sum?.countryMap || []).forEach(c => {
                        const name = c.clientCountryName || 'Unknown';
                        if (!agg[name]) agg[name] = { name, requests: 0, bytes: 0 };
                        agg[name].requests += (c.requests || 0);
                        agg[name].bytes += (c.bytes || 0);
                    });
                });
                zTopReq = Object.values(agg).sort((a, b) => b.requests - a.requests).slice(0, 5);
                zTopBytes = Object.values(agg).sort((a, b) => b.bytes - a.bytes).slice(0, 5);
                setZoneWideTopCountriesReq(zTopReq);
                setZoneWideTopCountriesBytes(zTopBytes);

                // If currently viewing ALL_SUBDOMAINS, also update display states
                if (isAllSubdomains) {
                    totalReq = zReq;
                    setTotalDataTransfer(zBytes);
                    setCacheHitRequests(zCacheReq);
                    setCacheHitDataTransfer(zCacheBytes);
                }
            }

            if (!isAllSubdomains) {
                totalReq = hostRequestTotal > 0 ? hostRequestTotal : totalReqLogs;
                setTotalDataTransfer(0);
                setCacheHitRequests(0);
                setCacheHitDataTransfer(0);
            }
        } else {
            setBlockedEvents(0); setLogEvents(0); setTopFirewallActions([]);
            setTopRules([]); setTopAttackers([]);
            setTotalDataTransfer(0); setCacheHitRequests(0); setCacheHitDataTransfer(0);
            setZoneWideRequests(0); setZoneWideDataTransfer(0); setZoneWideCacheRequests(0); setZoneWideCacheDataTransfer(0);
            setZoneWideTopCountriesReq([]); setZoneWideTopCountriesBytes([]);
            setCustomRulesList([]); setManagedRulesList([]);
        }

        if (!isGeneratingReport) {
            const liveRawResult = await callAPI('get-traffic-raw-live', {
                zoneId: zoneId,
                startDate: p_startDate,
                endDate: p_endDate,
                subdomain: isAllSubdomains ? null : subdomain,
                apiToken: currentUser?.cloudflare_api_token
            });
            if (liveRawResult && liveRawResult.success) {
                setRawData(liveRawResult.data?.httpRequestsAdaptiveGroups || []);
            } else {
                setRawData(filteredData.filter(item => !item?.isSummary));
            }
        } else {
            setRawData(filteredData.filter(item => !item?.isSummary));
        }
        setTotalRequests(totalReq);
        setAvgResponseTime(weightedAvgTime);

        // --- DATA PROCESSING FOR CHARTS ---
        const urlCounts = {}; const ipCounts = {}; const countryCounts = {}; const uaCounts = {}; const hostCounts = {};
        const statusTotals = {};

        // 1. Time Buckets Generation (4 Hours for 24h view)
        const now = new Date();
        const stDate = p_startDate ? new Date(p_startDate + 'T00:00:00.000Z') : new Date(now.getTime() - 1440 * 60 * 1000);
        let enDate = p_endDate ? new Date(p_endDate + 'T23:59:59.999Z') : now;
        if (enDate > now) enDate = now;

        const diffMinutes = (enDate.getTime() - stDate.getTime()) / (60 * 1000);

        let bucketSizeMs = 60 * 60 * 1000;
        if (diffMinutes <= 60) bucketSizeMs = 1 * 60 * 1000;
        else if (diffMinutes <= 360) bucketSizeMs = 15 * 60 * 1000;
        else if (diffMinutes <= 720) bucketSizeMs = 30 * 60 * 1000;
        else bucketSizeMs = 240 * 60 * 1000; // 4 Hours for 24h+

        const startTime = stDate;

        const alignedStart = new Date(Math.floor(startTime.getTime() / bucketSizeMs) * bucketSizeMs);
        const alignedEnd = new Date(Math.ceil(enDate.getTime() / bucketSizeMs) * bucketSizeMs);

        // Helpers
        const createBuckets = () => {
            const map = new Map();
            let current = new Date(alignedStart);
            while (current <= alignedEnd) {
                map.set(current.getTime(), { timestamp: new Date(current), count: 0, series: {} });
                current = new Date(current.getTime() + bucketSizeMs);
            }
            return map;
        };

        const throughputBuckets = createBuckets();
        const attackBuckets = createBuckets();
        const httpCodeBuckets = createBuckets();

        // 2. FILL DATA & CALC PEAK
        const allCodes = new Set();
        let currentPeak = { count: 0, time: null };

        // HTTP DATA
        filteredData.forEach(item => {
            if (item.isSummary) {
                // If it's a pre-aggregated summary, just add the tops
                (item.topUrls || []).forEach(u => urlCounts[u.key] = (urlCounts[u.key] || 0) + u.count);
                (item.topIps || []).forEach(i => ipCounts[i.key] = (ipCounts[i.key] || 0) + i.count);
                (item.totals?.countries || []).forEach(c => countryCounts[c.clientCountryName || 'Unknown'] = (countryCounts[c.clientCountryName || 'Unknown'] || 0) + c.requests);
                (item.topUAs || []).forEach(ua => uaCounts[ua.key] = (uaCounts[ua.key] || 0) + ua.count);
                (item.topHosts || []).forEach(h => hostCounts[h.key] = (hostCounts[h.key] || 0) + h.count);

                Object.entries(item.statusDistribution || {}).forEach(([rawStatus, count]) => {
                    const status = String(rawStatus);
                    statusTotals[status] = (statusTotals[status] || 0) + count;
                    allCodes.add(status);
                });

                // Populate Timeline from summary buckets
                (item.hourlyTimeline || []).forEach(bucket => {
                    const hTime = new Date(item.report_date).setUTCHours(bucket.hour, 0, 0, 0);
                    const bTime = Math.floor(hTime / bucketSizeMs) * bucketSizeMs;
                    if (throughputBuckets.has(bTime)) {
                        throughputBuckets.get(bTime).count += bucket.count;
                    }
                });
                return;
            }

            const count = item.count;
            const dims = item.dimensions;

            // Top Lists (Same as before)
            const path = dims.clientRequestPath || 'Unknown';
            const ip = dims.clientIP || 'Unknown';
            const country = dims.clientCountryName || 'Unknown';
            const host = dims.clientRequestHTTPHost || 'Unknown';
            const ua = dims.userAgent || 'Unknown';

            urlCounts[path] = (urlCounts[path] || 0) + count;
            ipCounts[ip] = (ipCounts[ip] || 0) + count;
            countryCounts[country] = (countryCounts[country] || 0) + count;
            uaCounts[ua] = (uaCounts[ua] || 0) + count;
            hostCounts[host] = (hostCounts[host] || 0) + count;

            // Time Series
            if (dims.datetimeMinute) {
                const itemTime = new Date(dims.datetimeMinute).getTime();
                const bucketTime = Math.floor(itemTime / bucketSizeMs) * bucketSizeMs;

                if (throughputBuckets.has(bucketTime)) {
                    const b = throughputBuckets.get(bucketTime);
                    b.count += count;
                }

                const status = item.dimensions.edgeResponseStatus ? String(item.dimensions.edgeResponseStatus) : null;
                if (status) { // Always track status for chart
                    const bucket = httpCodeBuckets.get(bucketTime);
                    if (bucket) {
                        bucket.series[status] = (bucket.series[status] || 0) + count;
                        statusTotals[status] = (statusTotals[status] || 0) + count;
                        allCodes.add(status);
                    }
                }
            }
        });

        // Find Peak Traffic from Bucket
        for (let [_, b] of throughputBuckets) {
            if (b.count > currentPeak.count) {
                currentPeak = { count: b.count, time: b.timestamp };
            }
        }
        // Format Peak Time (Thai format)
        const peakTimeStr = currentPeak.time ? currentPeak.time.toLocaleString('th-TH', {
            year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
        }) : '-';
        setPeakTraffic({ time: peakTimeStr, count: currentPeak.count });


        // Find Peak HTTP Status (Non-200) - NEW
        let currentHttpPeak = { count: 0, time: null };
        for (let [_, b] of httpCodeBuckets) {
            // Sum all non-200 codes in this bucket
            let non200Count = 0;
            Object.entries(b.series).forEach(([code, count]) => {
                if (parseInt(code) !== 200) non200Count += count;
            });

            if (non200Count > currentHttpPeak.count) {
                currentHttpPeak = { count: non200Count, time: b.timestamp };
            }
        }
        const peakHttpTimeStr = currentHttpPeak.time ? currentHttpPeak.time.toLocaleString('th-TH', {
            year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
        }).replace(':', '.') : '-';
        setPeakHttpStatus({ time: peakHttpTimeStr, count: currentHttpPeak.count });


        // FIREWALL DATA
        // Use the same dataset we already fetch for firewall summaries.
        // (Previously this read from result.firewallData, which is not part of the API response.)
        const firewallGroups = result?.data?.firewallActivity || [];
        const realAttackEvents = [];
        const targetActions = new Set([
            'block',
            'challenge',
            'js_challenge',
            'jschallenge',
            'managed_challenge',
            'managedchallenge'
        ]);

        firewallGroups.forEach(g => {
            const actionRaw = g.dimensions?.action || 'unknown';
            const action = String(actionRaw).toLowerCase();
            if (!targetActions.has(action)) return;

            const dt = g.dimensions?.datetimeMinute;
            if (!dt) return;

            const itemTime = new Date(dt).getTime();
            const bucketTime = Math.floor(itemTime / bucketSizeMs) * bucketSizeMs;
            if (attackBuckets.has(bucketTime)) {
                attackBuckets.get(bucketTime).count += (g.count || 0);
            }

            realAttackEvents.push({
                time: new Date(dt),
                action,
                count: (g.count || 0)
            });
        });

        realAttackEvents.sort((a, b) => b.time - a.time);
        setDetailedAttackList(realAttackEvents);

        // Find Peak Attack (NEW)
        let currentAttackPeak = { count: 0, time: null };
        for (let [_, b] of attackBuckets) {
            if (b.count > currentAttackPeak.count) {
                currentAttackPeak = { count: b.count, time: b.timestamp };
            }
        }
        const peakAttackTimeStr = currentAttackPeak.time ? currentAttackPeak.time.toLocaleString('th-TH', {
            year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
        }).replace(':', '.') : '-';
        setPeakAttack({ time: peakAttackTimeStr, count: currentAttackPeak.count });


        // 3. CONVERT TO ARRAY FOR CHARTS
        const formatTime = (d) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

        setThroughputData(Array.from(throughputBuckets.values()).map(b => ({
            time: formatTime(b.timestamp),
            requests: b.count
        })));

        setAttackSeriesData(Array.from(attackBuckets.values()).map(b => ({
            time: formatTime(b.timestamp),
            attacks: b.count
        })));

        // Extract unique status codes found
        const httpStatusChartData = Array.from(httpCodeBuckets.values()).map(b => {
            const entry = { time: formatTime(b.timestamp) };
            allCodes.forEach(code => {
                entry[code] = b.series[code] || 0;
            });
            return entry;
        });

        const sortedKeys = Array.from(allCodes).sort((a, b) => (statusTotals[b] || 0) - (statusTotals[a] || 0));
        setHttpStatusSeriesData({ data: httpStatusChartData, keys: sortedKeys });


        // 4. TOP LISTS
        const toArray = (obj, keyName) => Object.entries(obj).map(([name, count]) => ({ [keyName]: name, count })).sort((a, b) => b.count - a.count).slice(0, 5);

        setTopUrls(toArray(urlCounts, 'path'));
        setTopIps(toArray(ipCounts, 'ip'));
        setTopCountries(toArray(countryCounts, 'name'));
        setTopUserAgents(toArray(uaCounts, 'agent'));
        setTopHosts(toArray(hostCounts, 'host'));

        // Process Firewall Rules (Separate Managed and Custom)
        // 8. Top Firewall Sources (Categories like WAF, Security Level)
        const sourceMap = new Map();
        let fwTotal = 0, fwManaged = 0, fwCustom = 0, fwBic = 0, fwAccess = 0;

        (firewallSourcesData || []).forEach(item => {
            const source = item.dimensions.source || 'Unknown';
            const count = item.count;
            fwTotal += count;

            const lowerSource = source.toLowerCase();
            // Expanded mapping based on Cloudflare firewall event sources
            if (lowerSource === 'waf' || lowerSource === 'firewallmanaged' || lowerSource.includes('managed_rules') || lowerSource === 'managedrules') {
                fwManaged += count;
            } else if (lowerSource === 'firewallrules' || lowerSource === 'filterbasedfirewall' || lowerSource.includes('custom_rules') || lowerSource === 'firewallcustom' || lowerSource === 'firewall_rules' || lowerSource === 'customrules') {
                fwCustom += count;
            } else if (lowerSource === 'bic' || lowerSource === 'browser_integrity_check') {
                fwBic += count;
            } else if (lowerSource === 'accessrules' || lowerSource === 'ip_access_rules' || lowerSource === 'ip' || lowerSource === 'asn' || lowerSource === 'ipaddress' || lowerSource === 'ip_access_rule') {
                fwAccess += count;
            }

            sourceMap.set(source, (sourceMap.get(source) || 0) + count);
        });

        setFwEvents({ total: fwTotal, managed: fwManaged, custom: fwCustom, bic: fwBic, access: fwAccess });
        const topSourcesSorted = Array.from(sourceMap.entries())
            .map(([source, count]) => ({ source, count }))
            .sort((a, b) => b.count - a.count);

        setTopFirewallSources(topSourcesSorted);

        const stats = {
            filteredData,
            totalRequests: totalReq,
            avgResponseTime: weightedAvgTime,
            blockedEvents: blockedCount,
            logEvents: logCount,
            topFirewallActions: topActions,
            topRules: processedRules, // already sorted slice(0,5)
            topAttackers: sortedAttackers,
            peakTraffic: { time: peakTimeStr, count: currentPeak.count },
            peakAttack: { time: peakAttackTimeStr, count: currentAttackPeak.count },
            peakHttpStatus: { time: peakHttpTimeStr, count: currentHttpPeak.count },
            topUrls: toArray(urlCounts, 'path'),
            topIps: toArray(ipCounts, 'ip'),
            topCountries: toArray(countryCounts, 'name'),
            topUserAgents: toArray(uaCounts, 'agent'),
            topHosts: toArray(hostCounts, 'host'),
            topCustomRules: customList,
            topManagedRules: managedList,
            // Zone-wide Stats
            zoneWideRequests: zReq,
            zoneWideDataTransfer: zBytes,
            zoneWideCacheRequests: zCacheReq,
            zoneWideCacheDataTransfer: zCacheBytes,
            zoneWideTopCountriesReq: zTopReq,
            zoneWideTopCountriesBytes: zTopBytes,
            fwEvents: { total: fwTotal, managed: fwManaged, custom: fwCustom, bic: fwBic, access: fwAccess }
        };

        setLoadingStats(false);
        setHasGenerated(true); // Mark generation as complete
        return stats;
    };

    const handleBatchReport = async (selectedHosts, batchStartDate, batchEndDate, templateId = 'default', promotedHosts = [], zoneId = null, exportSeparated = false) => {
        setIsGeneratingReport(true);
        setIsBatchModalOpen(false);

        const zoneDataCache = new Map();
        const getZoneData = async (zId) => {
            if (!zId) return { dns: [], settings: {} };
            if (zoneDataCache.has(zId)) return zoneDataCache.get(zId);
            try {
                const [dnsRes, settingsRes] = await Promise.all([
                    callAPI('get-dns-records', { zoneId: zId }),
                    callAPI('get-zone-settings', { zoneId: zId })
                ]);
                const data = {
                    dns: dnsRes?.data || [],
                    settings: settingsRes?.data || {}
                };
                zoneDataCache.set(zId, data);
                return data;
            } catch (err) {
                console.error(`Error fetching data for zone ${zId}:`, err);
                return { dns: [], settings: {} };
            }
        };

        let defaultZoneId = zoneId || selectedZone;
        if (!defaultZoneId && Array.isArray(selectedHosts) && selectedHosts.length > 0) {
            const firstHost = selectedHosts[0];
            if (typeof firstHost === 'object' && firstHost.zoneId) {
                defaultZoneId = firstHost.zoneId;
            }
        }
        let processedCount = 0;
        let failedHosts = [];
        let screenshotWarnings = [];
        let currentStep = 'Initializing...';
        let currentProgress = 0;

        const getInactiveCaptureReason = () => {
            if (typeof document === 'undefined') return null;
            if (document.visibilityState !== 'visible') {
                return 'Cannot capture dashboard snapshot because this tab is not visible. Please keep this page open and do not switch tabs or minimize/fold the screen during export.';
            }
            if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
                return 'Cannot capture dashboard snapshot because this page is not active. Please keep this page focused and do not switch tabs during export.';
            }
            return null;
        };

        const recordScreenshotWarning = (hostName, error) => {
            const message = error?.message || 'Dashboard snapshot could not be captured.';
            console.warn(`⚠️ Screenshot warning for ${hostName}: ${message}`);
            screenshotWarnings.push({ host: hostName, message });
        };

        // Overlay element handling via Swal
        const updateOverlay = (hostName, index, total, progress, statusMsg) => {
            const percentage = Math.round(progress);
            Swal.update({
                html: `
                    <div style="font-family: inherit;">
                        <div style="margin-bottom: 24px;">
                            <h3 style="font-size: 24px; font-weight: bold; color: white; margin-bottom: 8px;">Generating Batch Reports...</h3>
                            <p style="color: #9CA3AF; font-size: 14px;">
                                Processing domain <span style="font-weight: 600; color: #E5E7EB;">${index}</span> of <span style="font-weight: 600; color: #E5E7EB;">${total}</span>
                            </p>
                        </div>
                        
                        <div style="background: rgba(31, 41, 55, 0.8); border: 1px solid rgba(55, 65, 81, 0.5); border-radius: 12px; padding: 20px; max-width: 400px; margin: 0 auto 32px auto; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
                            <div style="font-size: 12px; color: #60A5FA; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <span>🌐</span> Currently Generating
                            </div>
                            <div style="font-size: 18px; color: white; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${hostName}">
                                ${hostName || 'Preparing...'}
                            </div>
                             <div style="font-size: 12px; color: #9CA3AF; margin-top: 8px; font-style: italic;">
                                 ${statusMsg}
                             </div>
                         </div>

                         <div style="max-width: 400px; margin: 0 auto 20px auto; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 12px; padding: 12px 14px; text-align: left;">
                             <div style="font-size: 12px; font-weight: 700; color: #FBBF24; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em;">
                                 Important During Export
                             </div>
                             <div style="font-size: 13px; color: #FDE68A; line-height: 1.45;">
                                 Do not switch tabs, minimize the browser, or fold/turn off the screen while exporting. Otherwise the dashboard screenshot may fail.
                             </div>
                         </div>

                         <div style="width: 100%; max-width: 400px; margin: 0 auto;">
                             <div style="display: flex; justify-content: space-between; font-size: 12px; color: #9CA3AF; margin-bottom: 8px; font-family: monospace;">
                                 <span>PROGRESS</span>
                                <span>${percentage}%</span>
                            </div>
                            <div style="width: 100%; background: #1F2937; border-radius: 9999px; height: 10px; overflow: hidden; border: 1px solid #374151; box-shadow: inset 0 2px 4px rgba(0,0,0,0.6);">
                                <div style="background: #3B82F6; height: 10px; transition: width 0.3s ease; width: ${percentage}%; box-shadow: 0 0 10px rgba(59,130,246,0.6);"></div>
                            </div>
                        </div>
                    </div>
                `
            });
        };

        // Show the initial full-screen-like Swal overlay
        Swal.fire({
            title: '',
            html: 'Initializing...', // Will be replaced by updateOverlay immediately
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            background: 'rgba(17, 24, 39, 0.95)',
            backdrop: 'rgba(0,0,0,0.8)',
            color: '#fff',
            customClass: {
                popup: 'rounded-2xl border border-gray-700 shadow-2xl',
                htmlContainer: 'p-4'
            },
            didOpen: () => {
                Swal.showLoading();
                updateOverlay('Preparing Document...', 0, selectedHosts.length, 0, 'Loading templates and settings...');
            }
        });

        const legacyHeader = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
            "xmlns:w='urn:schemas-microsoft-com:office:word' " +
            "xmlns='http://www.w3.org/TR/REC-html40'>" +
            "<head><meta charset='utf-8'><title>Batch Report</title>" +
            "<style>" +
            "@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');" +
            "@page Section1 { size: 21cm 29.7cm; margin: 2.54cm 2.54cm 2.54cm 2.54cm; mso-header-margin:35.4pt; mso-footer-margin:35.4pt; mso-paper-source:0; }" +
            "div.Section1 { page: Section1; }" +
            "body { font-family: 'TH SarabunPSK', 'Sarabun', sans-serif; font-size: 16pt; }" +
            "table { width: 100%; border-collapse: collapse; }" +
            "td, th { border: 1px solid #000; padding: 5px; }" +
            ".page-break { page-break-after: always; }" +
            "</style>" +
            "</head><body><div class='Section1'>";

        const cleanHeader = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
            "xmlns:w='urn:schemas-microsoft-com:office:word' " +
            "xmlns='http://www.w3.org/TR/REC-html40'>" +
            "<head><meta charset='utf-8'><title>Batch Report</title>" +
            "<style>" +
            "@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');" +
            "@page Section1 { size: 21cm 29.7cm; margin: 2.54cm 2.54cm 2.54cm 2.54cm; mso-header-margin:35.4pt; mso-footer-margin:35.4pt; mso-paper-source:0; }" +
            "div.Section1 { page: Section1; }" +
            "body { font-family: 'TH SarabunPSK', 'Sarabun', sans-serif; font-size: 16pt; }" +
            "table { width: 100%; border-collapse: collapse; }" +
            "td, th { border: 1px solid #000; padding: 5px; }" +
            ".page-break { page-break-after: always; }" +
            "</style>" +
            "</head><body><div class='Section1'>";

        const footer = "</div></body></html>";


        let combinedHtml = "";

        const sanitizeFilePart = (value) => {
            return String(value || '')
                .trim()
                .replace(/\s+/g, '_')
                .replace(/[^a-zA-Z0-9._-]/g, '_')
                .slice(0, 140);
        };

        try {
            // 0. Generate Domain Report (First Page)
            updateOverlay('Preparing Document...', 0, selectedHosts.length, 0, 'Step 1: Creating Document Structure');
            console.log('Creating Document Structure from staticReportTemplate.json...');

            // ALWAYS load from JSON file - no fallback
            let domainTemplateContent, middleReportTemplateContent, subReportTemplateContent;
            try {
                const tid = templateId || 'default';
                domainTemplateContent = await loadStaticTemplate(tid);
                middleReportTemplateContent = await loadMiddleTemplate(tid);
                subReportTemplateContent = await loadTemplate(tid);

                if (!domainTemplateContent || !subReportTemplateContent || middleReportTemplateContent === null) {
                    throw new Error('Template file is empty or invalid (ID: ' + tid + ')');
                }
                updateOverlay('Preparing Document...', 0, selectedHosts.length, 2, 'Loaded Report Templates');
            } catch (e) {
                const errorMsg = e?.message || 'Unknown error loading template';
                console.error("Failed to load domain template from JSON file:", e);
                Swal.fire({
                    title: 'Template Load Error',
                    html: `<div style="text-align: left;">
                        <p><strong>Error:</strong> ${errorMsg}</p>
                        <p class="text-sm text-gray-400 mt-2">Please check staticReportTemplate.json file.</p>
                    </div>`,
                    icon: 'error',
                    confirmButtonColor: '#ef4444',
                    background: '#111827',
                    color: '#fff'
                });
                throw new Error(`Template Load Failed: ${errorMsg}`);
            }

            // Generate Cover Page if we have a defaultZoneId
            if (defaultZoneId) {
                // Prepare basic data for Domain Report using current state/props + zoneSettings if available
                updateOverlay('Preparing Document...', 0, selectedHosts.length, 5, 'Fetching zone configurations...');

                // --- PRE-STEP: ENSURE DATA IS LOADED ---
                // Ensure Zone Data is loaded (DNS & Settings) for both Domain Report (Cover) and Batch Reports
                const defaultZoneData = await getZoneData(defaultZoneId);
                const localDnsRecords = defaultZoneData.dns;
                const localZoneSettings = defaultZoneData.settings;

                // Use verified LOCAL data
                // Fetch Zone-Wide Stats FIRST (Fix: stats is not defined)
                updateOverlay('Preparing Document...', 0, selectedHosts.length, 8, 'Fetching Zone-wide Statistics...');
                const zoneStats = await fetchAndApplyTrafficData('ALL_SUBDOMAINS', defaultZoneId, batchStartDate, batchEndDate) || {
                    zoneWideRequests: 0,
                    zoneWideCacheRequests: 0,
                    zoneWideDataTransfer: 0,
                    zoneWideCacheDataTransfer: 0,
                    zoneWideTopCountriesReq: [],
                    zoneWideTopCountriesBytes: [],
                    fwEvents: { total: 0, managed: 0, custom: 0, bic: 0, access: 0 }
                };

                const domainReportData = {
                    domain: zones.find(z => z.id === defaultZoneId)?.name,
                    totalRequests: totalRequests,
                    blockedEvents: blockedEvents,
                    logEvents: logEvents,
                    avgTime: avgResponseTime,
                    topUrls: topUrls,
                    topIps: topIps,
                    topCountries: topCountries,
                    topUserAgents: topUserAgents,
                    peakTime: peakTraffic.time,
                    peakCount: peakTraffic.count,
                    peakAttack: peakAttack,
                    peakHttpStatus: peakHttpStatus,
                    topRules: topRules,
                    topAttackers: topAttackers,
                    topHosts: topHosts,
                    topCustomRules: customRulesList,
                    topManagedRules: managedRulesList,
                    topFirewallSources: topFirewallSources,
                    zoneName: zones.find(z => z.id === selectedZone)?.name || '-',
                    accountName: accounts.find(a => a.id === selectedAccount)?.name || '-',
                    startDate: batchStartDate,
                    endDate: batchEndDate,
                    dnsRecords: localDnsRecords,
                    // Add zone settings (using localZoneSettings)
                    botManagementEnabled: localZoneSettings?.botManagement?.enabled ? 'Enabled' : 'Disabled',
                    blockAiBots: localZoneSettings?.botManagement?.blockAiBots || 'unknown',
                    definitelyAutomated: localZoneSettings?.botManagement?.definitelyAutomated || 'unknown',
                    likelyAutomated: localZoneSettings?.botManagement?.likelyAutomated || 'unknown',
                    verifiedBots: localZoneSettings?.botManagement?.verifiedBots || 'unknown',
                    // SSL/TLS Settings
                    sslMode: localZoneSettings?.sslMode || 'unknown',
                    minTlsVersion: localZoneSettings?.minTlsVersion || 'unknown',
                    tls13: (localZoneSettings?.tls13 === 'on' || localZoneSettings?.tls13 === 'zrt') ? 'Enabled' : 'Disabled',
                    // DNS
                    dnsRecordsStatus: localZoneSettings?.dnsRecordsCount > 0 ? 'Enabled' : 'Disabled',
                    // Additional Security
                    leakedCredentials: localZoneSettings?.leakedCredentials === 'on' ? 'Enabled' : 'Disabled',
                    browserIntegrityCheck: localZoneSettings?.browserIntegrityCheck === 'on' ? 'Enabled' : 'Disabled',
                    hotlinkProtection: localZoneSettings?.hotlinkProtection === 'on' ? 'Enabled' : 'Disabled',
                    zoneLockdownRules: localZoneSettings?.zoneLockdownRules || '0',
                    // DDoS Protection
                    ddosProtection: localZoneSettings?.ddosProtection?.enabled === 'on' ? 'Enabled' : 'Disabled',
                    httpDdosProtection: 'Always On',
                    sslTlsDdosProtection: 'Always On',
                    networkDdosProtection: 'Always On',
                    // WAF Managed Rules
                    cloudflareManaged: localZoneSettings?.wafManagedRules?.cloudflareManaged === 'enabled' ? 'Enabled' : 'Disabled',
                    owaspCore: localZoneSettings?.wafManagedRules?.owaspCore === 'enabled' ? 'Enabled' : 'Disabled',
                    exposedCredsRuleset: localZoneSettings?.wafManagedRules?.exposedCredentials === 'enabled' ? 'Enabled' : 'Disabled',
                    ddosL7Ruleset: localZoneSettings?.wafManagedRules?.ddosL7Ruleset === 'enabled' ? 'Enabled' : 'Disabled',
                    managedRulesCount: localZoneSettings?.wafManagedRules?.managedRulesCount || '0',
                    rulesetActions: localZoneSettings?.wafManagedRules?.rulesetActions || 'unknown',
                    // IP Access Rules
                    ipAccessRules: localZoneSettings?.ipAccessRules || '0',
                    // Custom Rules & Rate Limiting (New)
                    customRules: localZoneSettings?.customRules,
                    rateLimits: localZoneSettings?.rateLimits,

                    // --- New Traffic & Cache Stats (Always Zone-Wide) ---
                    zoneTotalRequests: zoneStats.zoneWideRequests.toLocaleString(),
                    zoneCacheHitRequests: zoneStats.zoneWideCacheRequests.toLocaleString(),
                    zoneCacheHitRequestsRatio: zoneStats.zoneWideRequests > 0 ? ((zoneStats.zoneWideCacheRequests / zoneStats.zoneWideRequests) * 100).toFixed(2) + '%' : '0.00%',
                    zoneTotalDataTransfer: (zoneStats.zoneWideRequests > 0 ? (zoneStats.zoneWideDataTransfer / (1024 * 1024 * 1024)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00') + ' GB',
                    zoneCacheHitDataTransfer: (zoneStats.zoneWideRequests > 0 ? (zoneStats.zoneWideCacheDataTransfer / (1024 * 1024 * 1024)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00') + ' GB',
                    zoneCacheHitDataTransferRatio: zoneStats.zoneWideDataTransfer > 0 ? ((zoneStats.zoneWideCacheDataTransfer / zoneStats.zoneWideDataTransfer) * 100).toFixed(2) + '%' : '0.00%',
                    zoneTopCountriesReq: zoneStats.zoneWideTopCountriesReq,
                    zoneTopCountriesBytes: zoneStats.zoneWideTopCountriesBytes,
                    fwEvents: zoneStats.fwEvents
                };

                let domainReportHtml = processTemplate(domainTemplateContent, domainReportData, new Date(), null);

                // Add Middle Report to the Domain Report section (once)
                if (middleReportTemplateContent) {
                    const middleHtml = processTemplate(middleReportTemplateContent, domainReportData, new Date(), null);
                    domainReportHtml = `${domainReportHtml}${middleHtml}`;
                }


                // Add to combined HTML only if they don't have promoted subdomains, or if there's no selection (NO_SUBDOMAIN checked)
                let shouldGenerateCover = true;
                if (selectedHosts.length > 0 && promotedHosts.length > 0) {
                    shouldGenerateCover = false;
                }

                if (shouldGenerateCover) {
                    combinedHtml += `<div class="page-break">${domainReportHtml}</div>`;
                }

                // If exporting separated files, we always need the zone section per file.
                if (exportSeparated) {
                    // NOTE: the domain template usually includes cover + zone details.
                    // We keep it as the "zone section" for each subdomain file.
                    // The subdomain section will be appended afterward.
                    combinedHtml = domainReportHtml;
                }
            }


            // Separated export: build one .doc (HTML Word) per host and zip them.
            if (exportSeparated) {
                if (!selectedHosts || selectedHosts.length === 0) {
                    throw new Error('Separated export requires at least one sub-domain.');
                }

                if (!defaultZoneId) {
                    throw new Error('Separated export requires a selected Zone (Domain).');
                }

                // Lazy-load JSZip only when needed.
                const { default: JSZip } = await import('jszip');
                const zip = new JSZip();

                const zoneSectionCache = new Map();
                const getZoneSectionHtml = async (zId) => {
                    if (zoneSectionCache.has(zId)) return zoneSectionCache.get(zId);

                    const zData = await getZoneData(zId);
                    const localDnsRecords = zData.dns;
                    const localZoneSettings = zData.settings;

                    // Zone-wide stats (cached per zone) for placeholders on cover/zone sections
                    const zoneStatsCacheKey = `zoneStats:${zId}:${batchStartDate}:${batchEndDate}`;
                    if (!zoneDataCache.has(zoneStatsCacheKey)) {
                        const zStats = await fetchAndApplyTrafficData('ALL_SUBDOMAINS', zId, batchStartDate, batchEndDate) || {
                            zoneWideRequests: 0,
                            zoneWideCacheRequests: 0,
                            zoneWideDataTransfer: 0,
                            zoneWideCacheDataTransfer: 0,
                            zoneWideTopCountriesReq: [],
                            zoneWideTopCountriesBytes: [],
                            fwEvents: { total: 0, managed: 0, custom: 0, bic: 0, access: 0 }
                        };
                        zoneDataCache.set(zoneStatsCacheKey, zStats);
                    }
                    const zoneStats = zoneDataCache.get(zoneStatsCacheKey);

                    const domainReportData = {
                        domain: zones.find(z => z.id === zId)?.name,
                        totalRequests: totalRequests,
                        blockedEvents: blockedEvents,
                        logEvents: logEvents,
                        avgTime: avgResponseTime,
                        topUrls: topUrls,
                        topIps: topIps,
                        topCountries: topCountries,
                        topUserAgents: topUserAgents,
                        peakTime: peakTraffic.time,
                        peakCount: peakTraffic.count,
                        peakAttack: peakAttack,
                        peakHttpStatus: peakHttpStatus,
                        topRules: topRules,
                        topAttackers: topAttackers,
                        topHosts: topHosts,
                        topCustomRules: customRulesList,
                        topManagedRules: managedRulesList,
                        topFirewallSources: topFirewallSources,
                        zoneName: zones.find(z => z.id === zId)?.name || '-',
                        accountName: accounts.find(a => a.id === selectedAccount)?.name || '-',
                        startDate: batchStartDate,
                        endDate: batchEndDate,
                        dnsRecords: localDnsRecords,
                        botManagementEnabled: localZoneSettings?.botManagement?.enabled ? 'Enabled' : 'Disabled',
                        blockAiBots: localZoneSettings?.botManagement?.blockAiBots || 'unknown',
                        definitelyAutomated: localZoneSettings?.botManagement?.definitelyAutomated || 'unknown',
                        likelyAutomated: localZoneSettings?.botManagement?.likelyAutomated || 'unknown',
                        verifiedBots: localZoneSettings?.botManagement?.verifiedBots || 'unknown',
                        sslMode: localZoneSettings?.sslMode || 'unknown',
                        minTlsVersion: localZoneSettings?.minTlsVersion || 'unknown',
                        tls13: (localZoneSettings?.tls13 === 'on' || localZoneSettings?.tls13 === 'zrt') ? 'Enabled' : 'Disabled',
                        dnsRecordsStatus: localZoneSettings?.dnsRecordsCount > 0 ? 'Enabled' : 'Disabled',
                        leakedCredentials: localZoneSettings?.leakedCredentials === 'on' ? 'Enabled' : 'Disabled',
                        browserIntegrityCheck: localZoneSettings?.browserIntegrityCheck === 'on' ? 'Enabled' : 'Disabled',
                        hotlinkProtection: localZoneSettings?.hotlinkProtection === 'on' ? 'Enabled' : 'Disabled',
                        zoneLockdownRules: localZoneSettings?.zoneLockdownRules || '0',
                        ddosProtection: localZoneSettings?.ddosProtection?.enabled === 'on' ? 'Enabled' : 'Disabled',
                        httpDdosProtection: 'Always On',
                        sslTlsDdosProtection: 'Always On',
                        networkDdosProtection: 'Always On',
                        cloudflareManaged: localZoneSettings?.wafManagedRules?.cloudflareManaged === 'enabled' ? 'Enabled' : 'Disabled',
                        owaspCore: localZoneSettings?.wafManagedRules?.owaspCore === 'enabled' ? 'Enabled' : 'Disabled',
                        exposedCredsRuleset: localZoneSettings?.wafManagedRules?.exposedCredentials === 'enabled' ? 'Enabled' : 'Disabled',
                        ddosL7Ruleset: localZoneSettings?.wafManagedRules?.ddosL7Ruleset === 'enabled' ? 'Enabled' : 'Disabled',
                        managedRulesCount: localZoneSettings?.wafManagedRules?.managedRulesCount || '0',
                        rulesetActions: localZoneSettings?.wafManagedRules?.rulesetActions || 'unknown',
                        ipAccessRules: localZoneSettings?.ipAccessRules || '0',
                        customRules: localZoneSettings?.customRules,
                        rateLimits: localZoneSettings?.rateLimits,
                        zoneTotalRequests: zoneStats.zoneWideRequests.toLocaleString(),
                        zoneCacheHitRequests: zoneStats.zoneWideCacheRequests.toLocaleString(),
                        zoneCacheHitRequestsRatio: zoneStats.zoneWideRequests > 0 ? ((zoneStats.zoneWideCacheRequests / zoneStats.zoneWideRequests) * 100).toFixed(2) + '%' : '0.00%',
                        zoneTotalDataTransfer: (zoneStats.zoneWideRequests > 0 ? (zoneStats.zoneWideDataTransfer / (1024 * 1024 * 1024)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00') + ' GB',
                        zoneCacheHitDataTransfer: (zoneStats.zoneWideRequests > 0 ? (zoneStats.zoneWideCacheDataTransfer / (1024 * 1024 * 1024)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00') + ' GB',
                        zoneCacheHitDataTransferRatio: zoneStats.zoneWideDataTransfer > 0 ? ((zoneStats.zoneWideCacheDataTransfer / zoneStats.zoneWideDataTransfer) * 100).toFixed(2) + '%' : '0.00%',
                        zoneTopCountriesReq: zoneStats.zoneWideTopCountriesReq,
                        zoneTopCountriesBytes: zoneStats.zoneWideTopCountriesBytes,
                        fwEvents: zoneStats.fwEvents
                    };

                    let zoneHtml = processTemplate(domainTemplateContent, domainReportData, new Date(), null);
                    if (middleReportTemplateContent) {
                        const middleHtml = processTemplate(middleReportTemplateContent, domainReportData, new Date(), null);
                        zoneHtml = `${zoneHtml}${middleHtml}`;
                    }

                    zoneSectionCache.set(zId, zoneHtml);
                    return zoneHtml;
                };

                for (let i = 0; i < selectedHosts.length; i++) {
                    const hostItem = selectedHosts[i];
                    const host = typeof hostItem === 'string' ? hostItem : hostItem.name;
                    const currentZoneId = (typeof hostItem === 'object' && hostItem.zoneId) ? hostItem.zoneId : defaultZoneId;

                    if (!currentZoneId) {
                        console.error(`❌ Skip host: ${host} - Missing zoneId`);
                        failedHosts.push(host);
                        continue;
                    }

                    const currentZoneData = await getZoneData(currentZoneId);
                    const baseProgress = ((i) / selectedHosts.length) * 100;
                    updateOverlay(host, i + 1, selectedHosts.length, baseProgress, 'Preparing separated file...');

                    try {
                        // 1) Fetch subdomain stats
                        updateOverlay(host, i + 1, selectedHosts.length, baseProgress + 15, 'Fetching Traffic Data from Cloudflare...');
                        setSelectedSubDomain(host);
                        const stats = await fetchAndApplyTrafficData(host, currentZoneId, batchStartDate, batchEndDate);
                        const safeStats = stats || {
                            totalRequests: 0,
                            blockedEvents: 0,
                            logEvents: 0,
                            avgResponseTime: 0,
                            topUrls: [],
                            topIps: [],
                            topCountries: [],
                            topUserAgents: [],
                            peakTraffic: { time: '-', count: 0 },
                            peakAttack: { time: '-', count: 0 },
                            peakHttpStatus: { time: '-', count: 0 },
                            topRules: [],
                            topAttackers: [],
                            topFirewallSources: []
                        };

                        // 2) Render settle + capture
                        updateOverlay(host, i + 1, selectedHosts.length, baseProgress + 45, 'Capturing Dashboard Snapshot...');
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        let imgData = null;
                        if (dashboardRef.current) {
                            try {
                                const inactiveReason = getInactiveCaptureReason();
                                if (inactiveReason) {
                                    throw new Error(inactiveReason);
                                }
                                const captureWidth = dashboardRef.current.scrollWidth;
                                const captureHeight = dashboardRef.current.scrollHeight;
                                imgData = await Promise.race([
                                    htmlToImage.toJpeg(dashboardRef.current, {
                                        quality: 0.6,
                                        backgroundColor: '#000000',
                                        pixelRatio: 1.0,
                                        width: captureWidth,
                                        height: captureHeight,
                                        cacheBust: true,
                                        skipAutoScale: true,
                                        style: {
                                            width: `${captureWidth}px`,
                                            height: `${captureHeight}px`
                                        }
                                    }),
                                    new Promise((_, reject) => setTimeout(() => reject(new Error('Screenshot timeout (45s)')), 45000))
                                ]);
                            } catch (imgError) {
                                const inactiveReason = getInactiveCaptureReason();
                                if (inactiveReason) {
                                    recordScreenshotWarning(host, new Error(inactiveReason));
                                } else if ((imgError?.message || '').includes('Screenshot timeout (45s)')) {
                                    recordScreenshotWarning(host, new Error('Dashboard snapshot timed out after 45s. Please keep this page open, focused, and do not switch tabs or fold/minimize the screen during export.'));
                                } else {
                                    recordScreenshotWarning(host, imgError);
                                }
                            }
                        }

                        // 3) Prepare data for sub template
                        const currentReportData = {
                            domain: host,
                            startDate: batchStartDate,
                            endDate: batchEndDate,
                            totalRequests: safeStats.totalRequests,
                            blockedEvents: safeStats.blockedEvents,
                            logEvents: safeStats.logEvents,
                            avgTime: safeStats.avgResponseTime,
                            topUrls: safeStats.topUrls,
                            topIps: safeStats.topIps,
                            topCountries: safeStats.topCountries,
                            topUserAgents: safeStats.topUserAgents,
                            peakTime: safeStats.peakTraffic.time,
                            peakCount: safeStats.peakTraffic.count,
                            peakAttack: safeStats.peakAttack,
                            peakHttpStatus: safeStats.peakHttpStatus,
                            topRules: safeStats.topRules,
                            topAttackers: safeStats.topAttackers,
                            topHosts: safeStats.topHosts,
                            topCustomRules: safeStats.topCustomRules,
                            topManagedRules: safeStats.topManagedRules,
                            zoneName: zones.find(z => z.id === currentZoneId)?.name,
                            dnsRecords: currentZoneData.dns,
                            ipAccessRules: currentZoneData.settings?.ipAccessRules,
                            customRules: currentZoneData.settings?.customRules,
                            rateLimits: currentZoneData.settings?.rateLimits
                        };

                        // Separated export always uses the sub-report template for the subdomain section.
                        // This keeps: "Cover + Zone details" (domain template) + "Subdomain" (sub template).
                        const reportHtml = processTemplate(subReportTemplateContent, currentReportData, new Date(), imgData);

                        // 4) Add .doc (HTML Word) to zip
                        updateOverlay(host, i + 1, selectedHosts.length, baseProgress + 85, 'Packing .doc and adding to .zip...');

                        const zoneSectionHtml = await getZoneSectionHtml(currentZoneId);
                        const docHtml = cleanHeader + `${zoneSectionHtml}<div class="page-break"></div>${reportHtml}` + footer;
                        const safeHost = sanitizeFilePart(host);
                        const safeZone = sanitizeFilePart(zones.find(z => z.id === currentZoneId)?.name || 'zone');
                        const fileName = `report_${safeZone}_${safeHost}_${batchStartDate}_${batchEndDate}.doc`;

                        zip.file(fileName, docHtml);
                        processedCount++;
                    } catch (hostError) {
                        console.error(`❌ Error processing ${host}:`, hostError);
                        failedHosts.push(host);
                        continue;
                    }
                }

                updateOverlay('Finalizing...', selectedHosts.length, selectedHosts.length, 100, 'Generating .zip file...');
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const zipName = `batch_reports_separated_${new Date().getTime()}.zip`;

                const url = window.URL.createObjectURL(zipBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = zipName;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                Swal.fire({
                    title: 'Export Completed!',
                    icon: failedHosts.length === 0 && screenshotWarnings.length === 0 ? 'success' : 'warning',
                    background: '#111827',
                    color: '#fff',
                    html: `<div style="text-align:center;">
                        <p style="font-size: 16px; margin-bottom: 12px;">Generated <b>${processedCount}</b> out of ${selectedHosts.length} files.</p>
                        ${failedHosts.length > 0 ? `<p style="color:#FCA5A5; font-size: 13px;">Failed: ${failedHosts.join(', ')}</p>` : ''}
                        ${screenshotWarnings.length > 0 ? `<div style="margin-top:12px; text-align:left; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 10px;"><p style="color:#FBBF24; font-size: 13px; font-weight: 700; margin-bottom: 6px;">Screenshot warnings (${screenshotWarnings.length})</p><ul style="color:#FDE68A; font-size: 12px; padding-left: 18px; max-height: 120px; overflow-y: auto;">${screenshotWarnings.map(item => `<li><b>${item.host}</b>: ${item.message}</li>`).join('')}</ul></div>` : ''}
                    </div>`,
                    confirmButtonText: 'Great!',
                    confirmButtonColor: '#3B82F6'
                });

                return;
            }

            for (let i = 0; i < selectedHosts.length; i++) {
                const hostItem = selectedHosts[i];
                const host = typeof hostItem === 'string' ? hostItem : hostItem.name;
                const currentZoneId = (typeof hostItem === 'object' && hostItem.zoneId) ? hostItem.zoneId : defaultZoneId;

                if (!currentZoneId) {
                    console.error(`❌ Skip host: ${host} - Missing zoneId`);
                    failedHosts.push(host);
                    continue;
                }

                const currentZoneData = await getZoneData(currentZoneId);
                const baseProgress = ((i) / selectedHosts.length) * 100;

                updateOverlay(host, i + 1, selectedHosts.length, baseProgress, 'Starting generation...');
                console.log(`${'='.repeat(60)}`);

                try {
                    const hostStartTime = performance.now();

                    // 1. Switch Domain and Fetch Data
                    updateOverlay(host, i + 1, selectedHosts.length, baseProgress + 10, 'Fetching Traffic Data from Cloudflare...');
                    const apiStart = performance.now();
                    setSelectedSubDomain(host);
                    // USE batchTimeRange HERE
                    const stats = await fetchAndApplyTrafficData(host, currentZoneId, batchStartDate, batchEndDate);
                    const apiEnd = performance.now();

                    // Use data even if empty (show zeros instead of skipping)
                    const safeStats = stats || {
                        totalRequests: 0,
                        blockedEvents: 0,
                        logEvents: 0,
                        avgResponseTime: 0,
                        topUrls: [],
                        topIps: [],
                        topCountries: [],
                        topUserAgents: [],
                        peakTraffic: { time: '-', count: 0 },
                        peakAttack: { time: '-', count: 0 },
                        peakHttpStatus: { time: '-', count: 0 },
                        topRules: [],
                        topAttackers: [],
                        topFirewallSources: []
                    };

                    // 2. Wait for animations and rendering
                    updateOverlay(host, i + 1, selectedHosts.length, baseProgress + 40, 'Rendering Dashboard UI...');
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // 3. Capture Screenshot
                    updateOverlay(host, i + 1, selectedHosts.length, baseProgress + 60, 'Capturing Dashboard Snapshot...');
                    let imgData = null;
                    if (dashboardRef.current) {
                        try {
                            const inactiveReason = getInactiveCaptureReason();
                            if (inactiveReason) {
                                throw new Error(inactiveReason);
                            }
                            const captureWidth = dashboardRef.current.scrollWidth;
                            const captureHeight = dashboardRef.current.scrollHeight;

                            // Race between screenshot and 45s timeout
                            imgData = await Promise.race([
                                htmlToImage.toJpeg(dashboardRef.current, {
                                    quality: 0.6,
                                    backgroundColor: '#000000',
                                    pixelRatio: 1.0,
                                    width: captureWidth,
                                    height: captureHeight,
                                    cacheBust: true,
                                    skipAutoScale: true,
                                    style: {
                                        width: `${captureWidth}px`,
                                        height: `${captureHeight}px`
                                    }
                                }),
                                new Promise((_, reject) => setTimeout(() => reject(new Error('Screenshot timeout (45s)')), 45000))
                            ]);

                            const screenEnd = performance.now();
                        } catch (imgError) {
                            const inactiveReason = getInactiveCaptureReason();
                            if (inactiveReason) {
                                recordScreenshotWarning(host, new Error(inactiveReason));
                            } else if ((imgError?.message || '').includes('Screenshot timeout (45s)')) {
                                recordScreenshotWarning(host, new Error('Dashboard snapshot timed out after 45s. Please keep this page open, focused, and do not switch tabs or fold/minimize the screen during export.'));
                            } else {
                                recordScreenshotWarning(host, imgError);
                            }
                        }
                    }

                    // 4. Prepare Data for Template
                    updateOverlay(host, i + 1, selectedHosts.length, baseProgress + 80, 'Preparing final document template...');
                    const currentReportData = {
                        domain: host,
                        startDate: batchStartDate,
                        endDate: batchEndDate,
                        totalRequests: safeStats.totalRequests,
                        blockedEvents: safeStats.blockedEvents,
                        logEvents: safeStats.logEvents,
                        avgTime: safeStats.avgResponseTime,
                        topUrls: safeStats.topUrls,
                        topIps: safeStats.topIps,
                        topCountries: safeStats.topCountries,
                        topUserAgents: safeStats.topUserAgents,
                        peakTime: safeStats.peakTraffic.time,
                        peakCount: safeStats.peakTraffic.count,
                        peakAttack: safeStats.peakAttack,
                        peakHttpStatus: safeStats.peakHttpStatus,
                        topRules: safeStats.topRules,
                        topAttackers: safeStats.topAttackers,
                        topHosts: safeStats.topHosts,
                        topCustomRules: safeStats.topCustomRules,
                        topManagedRules: safeStats.topManagedRules,
                        zoneName: zones.find(z => z.id === currentZoneId)?.name,

                        // Added missing fields for Batch Report Template placeholders (using Verified Local Data)
                        dnsRecords: currentZoneData.dns,
                        ipAccessRules: currentZoneData.settings?.ipAccessRules,
                        customRules: currentZoneData.settings?.customRules,
                        rateLimits: currentZoneData.settings?.rateLimits
                    };

                    // 5. Generate HTML
                    updateOverlay(host, i + 1, selectedHosts.length, baseProgress + 90, 'Writing data into Word Document...');

                    const isPromoted = promotedHosts.includes(host);
                    const templateContentToUse = isPromoted ? domainTemplateContent : subReportTemplateContent;

                    let dataToUse = currentReportData;
                    if (isPromoted) {
                        dataToUse = {
                            ...domainReportData,
                            ...currentReportData,
                            domain: host,
                            zoneName: host,

                            // Map subdomain-specific traffic stats to the zone-wide variables expected by domain template
                            zoneTotalRequests: (safeStats.totalRequests || 0).toLocaleString(),
                            zoneCacheHitRequests: 'N/A',
                            zoneCacheHitRequestsRatio: 'N/A',
                            zoneTotalDataTransfer: 'N/A',
                            zoneCacheHitDataTransfer: 'N/A',
                            zoneCacheHitDataTransferRatio: 'N/A',

                            // Map subdomain firewall events
                            fwEvents: {
                                total: (safeStats.blockedEvents || 0) + (safeStats.logEvents || 0),
                                managed: (safeStats.topManagedRules || []).reduce((acc, r) => acc + r.count, 0) || 0,
                                custom: (safeStats.topCustomRules || []).reduce((acc, r) => acc + r.count, 0) || 0,
                                bic: 0,
                                access: 0
                            }
                        };
                    }

                    const reportHtml = processTemplate(templateContentToUse, dataToUse, new Date(), imgData);

                    const hostTotalTime = ((performance.now() - hostStartTime) / 1000).toFixed(2);
                    console.log(`✅ Host [${i + 1}/${selectedHosts.length}] completed in ${hostTotalTime}s`);

                    // Add to combined HTML with page break
                    combinedHtml += `<div class="${i === selectedHosts.length - 1 ? '' : 'page-break'}">${reportHtml}</div>`;
                    processedCount++;

                } catch (hostError) {
                    console.error(`❌ Error processing ${host}:`, hostError);
                    failedHosts.push(host);
                    continue;
                }
            }

            // Let it hit 100% just to be smooth
            updateOverlay('Finalizing...', selectedHosts.length, selectedHosts.length, 100, 'Packing final Word Document (.doc)...');
            await new Promise(r => setTimeout(r, 800)); // Small delay for effect

            // 6. Download the final Word document
            const sourceHTML = cleanHeader + combinedHtml + footer;
            const filename = `batch_report_${new Date().getTime()}.doc`;

            try {
                // EXPOSE TO E2E RUNNER DIRECTLY
                if (typeof window !== 'undefined') {
                    window.__lastBatchReportHTML = sourceHTML;
                    window.__lastBatchReportReady = true;
                }

                const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
                const a = document.createElement("a");
                a.href = source;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } catch (error) {
                console.error('Batch Word export error:', error);
                throw error;
            }

            // Final Summary Modal
            Swal.fire({
                title: 'Batch Report Completed!',
                icon: failedHosts.length === 0 && screenshotWarnings.length === 0 ? 'success' : 'warning',
                background: '#111827',
                color: '#fff',
                html: `
                    <div style="text-align: center; margin-top: 10px;">
                        <p style="font-size: 16px; margin-bottom: 12px;">Successfully generated reports for <b>${processedCount}</b> out of ${selectedHosts.length} domains.</p>
                        ${failedHosts.length > 0 ? `
                            <div style="background: rgba(2ef, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 10px; border-radius: 8px; margin-top: 15px; text-align: left;">
                                <p style="color: #F87171; font-weight: bold; margin-bottom: 5px; font-size: 14px;">Failed Domains (${failedHosts.length}):</p>
                                <ul style="color: #FCA5A5; font-size: 13px; padding-left: 20px; list-style-type: disc; max-height: 100px; overflow-y: auto;">
                                    ${failedHosts.map(h => `<li>${h}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${screenshotWarnings.length > 0 ? `
                            <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); padding: 10px; border-radius: 8px; margin-top: 15px; text-align: left;">
                                <p style="color: #FBBF24; font-weight: bold; margin-bottom: 5px; font-size: 14px;">Screenshot Warnings (${screenshotWarnings.length}):</p>
                                <ul style="color: #FDE68A; font-size: 13px; padding-left: 20px; list-style-type: disc; max-height: 120px; overflow-y: auto;">
                                    ${screenshotWarnings.map(item => `<li><b>${item.host}</b>: ${item.message}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                `,
                confirmButtonText: 'Great!',
                confirmButtonColor: '#3B82F6',
                customClass: {
                    popup: 'rounded-xl border border-gray-700 shadow-xl'
                }
            });

        } catch (error) {
            console.error('Batch Report Failed:', error);

            // Handle different error types
            const errorMsg = error?.message || error?.toString() || 'An unexpected error occurred during batch report generation';
            const errorStack = error?.stack ? error.stack.split('\n').slice(0, 3).join('\n') : 'No stack trace available';

            console.log('Error details:', { message: errorMsg, stack: errorStack, fullError: error });

            Swal.fire({
                title: 'Batch Report Error',
                html: `<div style="text-align: left;">
                    <p><strong>Error:</strong> ${errorMsg}</p>
                    <p class="text-sm text-gray-400 mt-2">Stack trace logged to console.</p>
                </div>`,
                icon: 'error',
                confirmButtonColor: '#ef4444',
                background: '#111827',
                color: '#fff'
            });
            // Re-enable the button if an error occurs
            setIsGeneratingReport(false);
        } finally {
            setIsGeneratingReport(false);
        }
    };

    // Helper to get unique hosts for Batch Modal (filter out the "ALL_SUBDOMAINS" option if needed, or keep it)
    const getBatchHosts = () => {
        return subDomains
            .filter(opt => opt.value !== 'ALL_SUBDOMAINS')
            .map(opt => opt.value);
    };

    const [loadingZones, setLoadingZones] = useState(false);
    const [loadingStats, setLoadingStats] = useState(false); // Dashboard Generation Loading
    const [loadingDNS, setLoadingDNS] = useState(false); // DNS Loading (Subdomain List)
    const [hasGenerated, setHasGenerated] = useState(false); // Flag for manual generation

    // --- DYNAMIC DASHBOARD DATA STATES ---
    const [rawData, setRawData] = useState([]);
    const [totalRequests, setTotalRequests] = useState(0);
    const [avgResponseTime, setAvgResponseTime] = useState(0);
    const [blockedEvents, setBlockedEvents] = useState(0);
    const [logEvents, setLogEvents] = useState(0);
    const [peakTraffic, setPeakTraffic] = useState({ time: '-', count: 0 }); // State for Peak Traffic
    const [peakAttack, setPeakAttack] = useState({ time: '-', count: 0 }); // State for Peak Attack (NEW)
    const [peakHttpStatus, setPeakHttpStatus] = useState({ time: '-', count: 0 }); // State for Peak HTTP Status

    const [throughputData, setThroughputData] = useState([]);
    const [attackSeriesData, setAttackSeriesData] = useState([]);
    const [detailedAttackList, setDetailedAttackList] = useState([]);
    const [httpStatusSeriesData, setHttpStatusSeriesData] = useState({ data: [], keys: [] });

    const [topUrls, setTopUrls] = useState([]);
    const [topIps, setTopIps] = useState([]);
    const [topCountries, setTopCountries] = useState([]);
    const [topUserAgents, setTopUserAgents] = useState([]);
    const [topHosts, setTopHosts] = useState([]);
    // topCustomRules moved to top
    // topManagedRules moved to top
    const [topFirewallActions, setTopFirewallActions] = useState([]);

    // New Data for Report


    // --- API ---
    const callAPI = async (action, params = {}, explicitToken = null) => {
        setLoading(true);
        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    ...params,
                    apiToken: explicitToken || currentUser?.cloudflare_api_token || auth.getCurrentUser()?.cloudflare_api_token
                }),
            });
            const result = await response.json();

            if (!result.success) {
                console.warn(`⚠️ API Result Failed [${action}]:`, result.message);

                // Show error on webpage only if NOT in the middle of generating a report
                // This prevents "API Error" Swals from being hijacked by the Batch Progress overlay
                if (!isGeneratingReport) {
                    Swal.fire({
                        title: 'API Error',
                        html: `<div style="text-align: left;">
                            <p><strong>Action:</strong> ${action}</p>
                            <p><strong>Message:</strong> ${result.message || 'Unknown error occurred'}</p>
                            ${result.error ? `<p><strong>Details:</strong> ${result.error}</p>` : ''}
                        </div>`,
                        icon: 'error',
                        confirmButtonColor: '#ef4444',
                        background: '#111827',
                        color: '#fff'
                    });
                }
                return null;
            }

            return result;
        } catch (err) {
            console.error('API Error:', err);
            if (!isGeneratingReport) {
                Swal.fire({
                    title: 'Network Error',
                    html: `<div style="text-align: left;">
                        <p><strong>Action:</strong> ${action}</p>
                        <p><strong>Error:</strong> ${err.message || 'Failed to connect to server'}</p>
                        <p class="text-sm text-gray-400 mt-2">Please check your connection and try again.</p>
                    </div>`,
                    icon: 'error',
                    confirmButtonColor: '#ef4444',
                    background: '#111827',
                    color: '#fff'
                });
            }
            return null;
        } finally {
            setLoading(false);
        }
    };

    // 1. Initial Load
    const loadAccounts = async (tokenOverride = null) => {
        console.log('🚀 Loading Accounts...');
        const result = await callAPI('get-account-info', {}, tokenOverride);
        if (result && result.data) {
            setAccounts(result.data);
            const defaultAcc = result.data.find(a => (a.name || '').trim().toLowerCase() === DEFAULT_CONFIG.accountName.trim().toLowerCase());
            if (defaultAcc && DEFAULT_CONFIG.accountName) {
                console.log('✅ Auto-selecting Account (Config Match):', defaultAcc.name);
                handleAccountChange(defaultAcc.id, true, tokenOverride);
            }
        }
    };

    // 2. Account Change -> Load Zones
    const handleAccountChange = async (accountId, isAuto = false, tokenOverride = null) => {
        setSelectedAccount(accountId);
        if (!isAuto) {
            setSelectedZone(''); setZones([]); setSelectedSubDomain(''); setSubDomains([]); resetDashboardData();
        }

        if (!accountId) return;

        setLoadingZones(true);
        const result = await callAPI('list-zones', { accountId }, tokenOverride);
        if (result && result.data) {
            setZones(result.data);
            if (isAuto && result.data.length > 0) {
                const defaultZone = result.data.find(z => (z.name || '').trim().toLowerCase() === DEFAULT_CONFIG.zoneName.trim().toLowerCase());
                if (defaultZone && DEFAULT_CONFIG.zoneName) {
                    console.log('✅ Auto-selecting Zone (Config Match):', defaultZone.name);
                    setSelectedZone(defaultZone.id);
                }
            }
        }
        setLoadingZones(false);
    };

    const resetDashboardData = () => {
        setHasGenerated(false); // Reset generation flag
        setRawData([]); setTotalRequests(0); setAvgResponseTime(0); setBlockedEvents(0); setLogEvents(0);
        setThroughputData([]); setAttackSeriesData([]); setDetailedAttackList([]);
        setHttpStatusSeriesData({ data: [], keys: [] });
        setTopUrls([]); setTopIps([]); setTopCountries([]); setTopUserAgents([]); setTopFirewallActions([]);
        setPeakTraffic({ time: '-', count: 0 });
        setPeakAttack({ time: '-', count: 0 });
        setPeakHttpStatus({ time: '-', count: 0 });
        setTopRules([]);
        setTopAttackers([]);
    };

    // 3. Zone Selected -> Load DNS
    useEffect(() => {
        if (!selectedZone) { resetDashboardData(); setSubDomains([]); return; }

        const loadDNSAndSettings = async () => {
            setLoadingDNS(true); setSelectedSubDomain(''); setSubDomains([]);

            // 1. Fetch DNS Records (used for both subdomain list and report data)
            const dnsRes = await callAPI('get-dns-records', { zoneId: selectedZone });
            const allHosts = new Set();
            if (dnsRes && dnsRes.data) {
                setDnsRecords(dnsRes.data);
                console.log('✅ DNS Records Count:', dnsRes.data.length);
                dnsRes.data.forEach(rec => {
                    if (['A', 'AAAA', 'CNAME'].includes(rec.type)) allHosts.add(rec.name);
                });
            }

            const hostOptions = Array.from(allHosts).sort().map(h => ({ value: h, label: h }));

            // Get root domain (zone name)
            const currentZone = zones.find(z => z.id === selectedZone);
            const rootDomain = currentZone?.name;

            // Remove root domain from the subdomain list if it exists
            if (rootDomain) {
                const idx = hostOptions.findIndex(h => h.value === rootDomain);
                if (idx !== -1) hostOptions.splice(idx, 1);
            }
            // Add "All Subdomains" option
            hostOptions.unshift({ value: 'ALL_SUBDOMAINS', label: '🌐 Zone Overview (All)' });

            setSubDomains(hostOptions);

            const defaultSub = hostOptions.find(h => (h.value || '').trim().toLowerCase() === DEFAULT_CONFIG.subDomain.trim().toLowerCase());
            if (defaultSub) {
                console.log('✅ Auto-selecting Subdomain:', defaultSub.value);
                setSelectedSubDomain(defaultSub.value);
            } else {
                setSelectedSubDomain('ALL_SUBDOMAINS');
            }

            setLoadingDNS(false);

            // 2. Fetch Zone Settings
            const settingsResult = await callAPI('get-zone-settings', { zoneId: selectedZone });
            if (settingsResult && settingsResult.data) {
                setZoneSettings(settingsResult.data);
                console.log('✅ Zone Settings Loaded');
            }
        };

        loadDNSAndSettings();
    }, [selectedZone]);



    // 4. Subdomain Selected -> Fetch Traffic
    useEffect(() => {
        if (!selectedSubDomain) { resetDashboardData(); return; }
        // Manual Generation Requested: Do not auto-fetch on selection change
        // Only reset data to avoid showing stale data for wrong domain
        resetDashboardData();
        loadLastSyncDate(selectedZone, selectedSubDomain);
    }, [selectedSubDomain, selectedZone]); // Removed timeRange/token dependency to prevent auto-fetch

    useEffect(() => {
        const init = async () => {
            const user = auth.requireAuth(router);
            if (user) {
                setCurrentUser(user);

                // Try to get fresh profile but don't block initial load if possible
                getUserProfileAction(user.id).then(res => {
                    if (res.success) {
                        setCurrentUser(res.user);
                        localStorage.setItem('sdb_session', JSON.stringify(res.user));
                        // If token changed, we might need to reload, but usually it's the same
                        if (res.user.cloudflare_api_token !== user.cloudflare_api_token) {
                            loadAccounts(res.user.cloudflare_api_token);
                        }
                    }
                });

                if (user.cloudflare_api_token) {
                    loadAccounts(user.cloudflare_api_token);
                } else {
                    console.log('⚠️ No API Token found in session, waiting for profile refresh...');
                }
            }
        };
        init();

        // Load Templates
        loadTemplate().then(tmpl => {
            if (tmpl) setReportTemplate(tmpl);
        });
        loadStaticTemplate().then(tmpl => {
            if (tmpl) setStaticReportTemplate(tmpl);
        });
        loadMiddleTemplate().then(tmpl => {
            if (tmpl !== null) setMiddleReportTemplate(tmpl);
        });
    }, []);

    // -- TEMPLATE MANAGEMENT STATE --
    const [isManageTemplateModalOpen, setIsManageTemplateModalOpen] = useState(false);
    const [templateToEditId, setTemplateToEditId] = useState('default');
    const [templateToEditName, setTemplateToEditName] = useState('Default Template');

    const handleSaveTemplate = async (newTemplate) => {
        setReportTemplate(newTemplate);
        await saveTemplate(newTemplate, templateToEditId);
        Swal.fire({ title: 'Saved!', icon: 'success', timer: 1500, showConfirmButton: false });
    };

    const handleSaveStaticTemplate = async (newTemplate) => {
        setStaticReportTemplate(newTemplate);
        await saveStaticTemplate(newTemplate, templateToEditId);
        Swal.fire({ title: 'Saved!', icon: 'success', timer: 1500, showConfirmButton: false });
    };

    const handleSaveMiddleTemplate = async (newTemplate) => {
        setMiddleReportTemplate(newTemplate);
        await saveMiddleTemplate(newTemplate, templateToEditId);
        Swal.fire({ title: 'Saved!', icon: 'success', timer: 1500, showConfirmButton: false });
    };

    // -- TEMPLATE EDIT HANDLERS --
    const onEditSub = async (id, name = 'Report Template') => {
        // Keep manage modal open in background
        setTemplateToEditId(id);
        setTemplateToEditName(name);
        const content = await loadTemplate(id);
        if (content !== null) setReportTemplate(content);
        setReportModalMode('sub-template');
        setIsReportModalOpen(true);
    };

    const onEditDomain = async (id, name = 'Domain Report Template') => {
        // Keep manage modal open in background
        setTemplateToEditId(id);
        setTemplateToEditName(name);
        const content = await loadStaticTemplate(id);
        if (content !== null) setStaticReportTemplate(content);
        setReportModalMode('static-template');
        setIsReportModalOpen(true);
    };

    const onEditMiddle = async (id, name = 'Middle Report Template') => {
        setTemplateToEditId(id);
        setTemplateToEditName(name);
        const content = await loadMiddleTemplate(id);
        if (content !== null) setMiddleReportTemplate(content);
        setReportModalMode('middle-template');
        setIsReportModalOpen(true);
    };

    const handleOpenReportWithImage = () => {
        setDashboardImage(null); // Clear previous image
        setReportModalMode('report');
        setIsReportModalOpen(true);
    };

    const captureAndGenerateReport = async () => {
        if (!dashboardRef.current) return;
        setIsGeneratingReport(true);

        // Show blocked loading popup
        Swal.fire({
            title: 'Generating Report...',
            html: 'Please wait while we capture the dashboard and generate your report.<br/><span class="text-sm text-gray-400">Do not close this window.</span>',
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                Swal.showLoading();
            },
            background: '#111827',
            color: '#fff'
        });

        try {
            setIsReportModalOpen(false); // Hide the report modal to capture
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for close animation + Swal render

            window.scrollTo(0, 0);
            await new Promise(resolve => setTimeout(resolve, 800)); // Wait for scroll/render

            const element = dashboardRef.current;
            const captureWidth = element.scrollWidth;
            const captureHeight = element.scrollHeight;
            const imgData = await htmlToImage.toJpeg(element, {
                quality: 0.8,
                backgroundColor: '#000000',
                pixelRatio: 1.5,
                width: captureWidth,
                height: captureHeight,
                cacheBust: true,
                skipAutoScale: true,
                style: {
                    width: `${captureWidth}px`,
                    height: `${captureHeight}px`
                }
            });

            setDashboardImage(imgData);

            // Close the loading popup
            Swal.close();

            setIsReportModalOpen(true); // Re-open with image
        } catch (error) {
            console.error('Report Gen Failed:', error);
            Swal.fire({
                title: 'Report Generation Error',
                html: `<div style="text-align: left;">
                    <p><strong>Error:</strong> ${error.message || 'Unknown error occurred'}</p>
                    <p class="text-sm text-gray-400 mt-2">Please try again or check console for details.</p>
                </div>`,
                icon: 'error',
                confirmButtonColor: '#ef4444',
                background: '#111827',
                color: '#fff'
            });
            setIsReportModalOpen(true); // Re-open on error
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleOpenTemplateManager = async () => {
        // Reload template to ensure we have the latest file version
        try {
            const latest = await loadStaticTemplate();
            if (latest) setStaticReportTemplate(latest);
        } catch (e) {
            console.error("Error reloading static template:", e);
        }
        setReportModalMode('static-template');
        setIsReportModalOpen(true);
    };



    if (!currentUser) return null;

    // Data for Report Modal
    const reportData = {
        domain: selectedSubDomain || 'No Domain Selected',
        startDate: startDate,
        endDate: endDate,
        totalRequests: totalRequests,
        blockedEvents: blockedEvents,
        logEvents: logEvents,
        avgTime: avgResponseTime,
        topUrls: topUrls,
        topIps: topIps,
        topCountries: topCountries,
        topUserAgents: topUserAgents,
        topHosts: topHosts,
        peakTime: peakTraffic.time,
        peakCount: peakTraffic.count,
        peakAttack: peakAttack,
        peakHttpStatus: peakHttpStatus,
        topRules: topRules,
        topCustomRules: customRulesList,
        topManagedRules: managedRulesList,
        topAttackers: topAttackers,
        topFirewallSources: topFirewallSources,
        // Added New Traffic & Cache Stats (Always Zone-Wide)
        zoneTotalRequests: zoneWideRequests.toLocaleString(),
        zoneCacheHitRequests: zoneWideCacheRequests.toLocaleString(),
        zoneCacheHitRequestsRatio: zoneWideRequests > 0 ? ((zoneWideCacheRequests / zoneWideRequests) * 100).toFixed(2) + '%' : '0.00%',
        zoneTotalDataTransfer: (zoneWideRequests > 0 ? (zoneWideDataTransfer / (1024 * 1024 * 1024)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00') + ' GB',
        zoneCacheHitDataTransfer: (zoneWideRequests > 0 ? (zoneWideCacheDataTransfer / (1024 * 1024 * 1024)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00') + ' GB',
        zoneCacheHitDataTransferRatio: zoneWideDataTransfer > 0 ? ((zoneWideCacheDataTransfer / zoneWideDataTransfer) * 100).toFixed(2) + '%' : '0.00%',
        zoneTopCountriesReq: zoneWideTopCountriesReq,
        zoneTopCountriesBytes: zoneWideTopCountriesBytes,
        fwEvents: fwEvents
    };

    const isActionDisabled = !selectedSubDomain || loadingStats;

    const getRawInspectorRow = (item) => {
        if (!item?.isSummary) {
            return {
                host: item.dimensions?.clientRequestHTTPHost || '-',
                ip: item.dimensions?.clientIP || '-',
                country: item.dimensions?.clientCountryName || '-',
                status: item.dimensions?.edgeResponseStatus || '-',
                device: item.dimensions?.clientDeviceType || '-',
                count: item.count || 0,
            };
        }

        const topHost = item.topHosts?.[0]?.key || item.zoneName || '-';
        const topIp = item.topIps?.[0]?.key || '-';
        const topCountry = item.totals?.countries?.[0]?.clientCountryName || '-';
        const topStatus = Object.entries(item.statusDistribution || {})
            .sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] || 'summary';

        return {
            host: topHost,
            ip: topIp,
            country: topCountry,
            status: topStatus,
            device: 'daily-summary',
            count: item.totals?.requests || 0,
        };
    };

    const rawInspectorRows = rawData.reduce((acc, item) => {
        const row = getRawInspectorRow(item);
        const key = [row.host, row.ip, row.country, row.status, row.device].join('|');
        const existing = acc.find((entry) => entry.key === key);

        if (existing) {
            existing.count += Number(row.count || 0);
        } else {
            acc.push({ key, ...row, count: Number(row.count || 0) });
        }

        return acc;
    }, []).sort((a, b) => b.count - a.count);

    return (
        <div className={`min-h-screen font-sans ${theme.bg} ${theme.text}`}>
            <nav className={`border-b ${theme.nav === 'bg-[#0f1115]' ? 'border-gray-800' : ''} ${theme.nav} sticky top-0 z-50`}>
                <div className="w-full px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
                            <LayoutDashboard className={`w-5 h-5 ${theme.accent}`} />
                            <h1 className={`text-sm font-bold ${theme.text}`}>Cloudflare <span className={theme.subText}>Report</span></h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">

                        {/* CREATE REPORT BUTTON */}
                        <button
                            onClick={() => setIsBatchModalOpen(true)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors ${theme.buttonSecondary || 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg'}`}
                        >
                            <List className="w-3 h-3" /> Create Report
                        </button>

                        {/* GENERATE DASHBOARD BUTTON */}
                        <button
                            onClick={() => {
                                if (!selectedSubDomain) {
                                    Swal.fire({
                                        title: 'Selection Required',
                                        text: 'Please select a Sub-domain first.',
                                        icon: 'warning',
                                        background: theme.modalBg,
                                        color: theme.text,
                                        confirmButtonColor: '#3b82f6'
                                    });
                                    return;
                                }
                                fetchAndApplyTrafficData(selectedSubDomain, selectedZone, startDate, endDate);
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${!selectedSubDomain || loadingStats
                                ? (theme.buttonDisabled || 'bg-gray-700 text-gray-500 cursor-not-allowed')
                                : (theme.buttonSuccess || 'bg-green-600 hover:bg-green-700 text-white shadow-lg')
                                }`}
                        >
                            {loadingStats ? <Activity className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                            {loadingStats ? 'Generating...' : 'Generate Dashboard'}
                        </button>

                        {/* SETTINGS DROPDOWN (with Report Template submenu) */}
                        <div className="relative">
                            <button
                                onClick={() => setIsReportMenuOpen(!isReportMenuOpen)}
                                className={`flex items-center gap-2 ${theme.button} px-3 py-1.5 rounded text-xs transition-colors`}
                            >
                                <Settings className="w-3 h-3" />
                                <svg className={`w-3 h-3 transition-transform ${isReportMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {isReportMenuOpen && (
                                <div className={`absolute right-0 mt-2 w-56 ${theme.dropdown?.menuBg || 'bg-gray-800'} rounded-lg shadow-xl border ${theme.dropdown?.border || 'border-gray-700'} z-[60] animate-fade-in-up`}>
                                    {/* Manage Template Button (Replaces Submenu) */}
                                    <div className={`border-t ${theme.dropdown?.menuBorder || 'border-gray-700/50'} pt-1 mt-1`}>
                                        <button
                                            onClick={() => { setIsReportMenuOpen(false); setIsTemplateSubmenuOpen(false); setIsManageTemplateModalOpen(true); }}
                                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 border border-transparent ${theme.text || 'text-gray-300'} ${theme.id === 'corporate' ? 'hover:bg-blue-600 hover:border-blue-500 hover:text-white' : (theme.dropdown?.hover || 'hover:bg-gray-700') + ' hover:text-white'}`}
                                        >
                                            <FileText className="w-3 h-3" /> Manage Template
                                        </button>
                                        <button
                                            onClick={() => { setIsReportMenuOpen(false); setIsTemplateSubmenuOpen(false); setIsSyncModalOpen(true); }}
                                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 border border-transparent ${theme.text || 'text-gray-300'} ${theme.id === 'corporate' ? 'hover:bg-blue-600 hover:border-blue-500 hover:text-white' : (theme.dropdown?.hover || 'hover:bg-gray-700') + ' hover:text-white'}`}
                                        >
                                            <Database className="w-3 h-3" /> Sync History
                                        </button>
                                        <button
                                            onClick={() => { setIsReportMenuOpen(false); setIsTemplateSubmenuOpen(false); setIsAutoReportModalOpen(true); }}
                                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 border border-transparent ${theme.text || 'text-gray-300'} ${theme.id === 'corporate' ? 'hover:bg-blue-600 hover:border-blue-500 hover:text-white' : (theme.dropdown?.hover || 'hover:bg-gray-700') + ' hover:text-white'}`}
                                        >
                                            <Calendar className="w-3 h-3" /> Auto Gen Report
                                        </button>
                                        <button
                                            onClick={() => { 
                                                setIsReportMenuOpen(false); 
                                                setIsTemplateSubmenuOpen(false); 
                                                setIsDepartmentModalOpen(true); 
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 border border-transparent ${theme.text || 'text-gray-300'} ${theme.id === 'corporate' ? 'hover:bg-blue-600 hover:border-blue-500 hover:text-white' : (theme.dropdown?.hover || 'hover:bg-gray-700') + ' hover:text-white'}`}
                                        >
                                            <Users className="w-3 h-3" /> Department
                                        </button>
                                        </div>
                                    {/* Theme Settings (Refactored to Submenu) */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsThemeSubmenuOpen(!isThemeSubmenuOpen)}
                                            className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between border border-transparent ${theme.text || 'text-gray-300'} ${theme.id === 'corporate' ? 'hover:bg-blue-600 hover:border-blue-500 hover:text-white' : (theme.dropdown?.hover || 'hover:bg-gray-700') + ' hover:text-white'}`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Activity className="w-3 h-3" /> Theme {/* Using Activity as placeholder icon */}
                                            </span>
                                            <svg className={`w-3 h-3 transition-transform ${isThemeSubmenuOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </button>

                                        {/* Submenu */}
                                        {isThemeSubmenuOpen && (
                                            <div className={`${theme.dropdown?.bg || 'bg-gray-900'} border-t ${theme.dropdown?.border || 'border-gray-700'} shadow-inner`}>
                                                {Object.values(THEMES).map(t => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => { changeTheme(t.id); setIsReportMenuOpen(false); setIsThemeSubmenuOpen(false); }}
                                                        className={`w-full text-left px-8 py-2 text-xs flex items-center gap-2 border border-transparent ${currentTheme === t.id ? 'text-blue-400 font-bold' : (theme.subText || 'text-gray-400')} ${theme.id === 'corporate' ? 'hover:bg-blue-600 hover:border-blue-500 hover:text-white' : 'hover:bg-gray-800 hover:text-white'}`}
                                                    >
                                                        {currentTheme === t.id && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                                        {t.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-orange-600/20 text-orange-500 w-8 h-8 rounded flex items-center justify-center">
                            <span className="font-bold text-xs">{currentUser?.ownerName?.charAt(0) || 'U'}</span>
                        </div>
                    </div>
                </div>
            </nav>

            <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                data={{
                    ...reportData,
                    zoneName: zones.find(z => z.id === selectedZone)?.name,
                    accountName: accounts.find(a => a.id === selectedAccount)?.name,
                    // Add zone settings (Security Level removed)
                    botManagementEnabled: zoneSettings?.botManagement?.enabled ? 'Enabled' : 'Disabled',
                    blockAiBots: zoneSettings?.botManagement?.blockAiBots || 'unknown',
                    definitelyAutomated: zoneSettings?.botManagement?.definitelyAutomated || 'unknown',
                    likelyAutomated: zoneSettings?.botManagement?.likelyAutomated || 'unknown',
                    verifiedBots: zoneSettings?.botManagement?.verifiedBots || 'unknown',
                    // SSL/TLS Settings
                    sslMode: zoneSettings?.sslMode || 'unknown',
                    minTlsVersion: zoneSettings?.minTlsVersion || 'unknown',
                    tls13: (zoneSettings?.tls13 === 'on' || zoneSettings?.tls13 === 'zrt') ? 'Enabled' : 'Disabled',
                    // DNS
                    dnsRecordsStatus: zoneSettings?.dnsRecordsCount > 0 ? 'Enabled' : 'Disabled',
                    // Additional Security
                    leakedCredentials: zoneSettings?.leakedCredentials === 'on' ? 'Enabled' : 'Disabled',
                    browserIntegrityCheck: zoneSettings?.browserIntegrityCheck === 'on' ? 'Enabled' : 'Disabled',
                    hotlinkProtection: zoneSettings?.hotlinkProtection === 'on' ? 'Enabled' : 'Disabled',
                    zoneLockdownRules: zoneSettings?.zoneLockdownRules || '0',
                    // DDoS Protection
                    ddosProtection: zoneSettings?.ddosProtection?.enabled === 'on' ? 'Enabled' : 'Disabled',
                    httpDdosProtection: 'Always On',
                    sslTlsDdosProtection: 'Always On',
                    networkDdosProtection: 'Always On',
                    // WAF Managed Rules
                    cloudflareManaged: zoneSettings?.wafManagedRules?.cloudflareManaged === 'enabled' ? 'Enabled' : 'Disabled',
                    owaspCore: zoneSettings?.wafManagedRules?.owaspCore === 'enabled' ? 'Enabled' : 'Disabled',
                    exposedCredsRuleset: zoneSettings?.wafManagedRules?.exposedCredentials === 'enabled' ? 'Enabled' : 'Disabled',
                    ddosL7Ruleset: zoneSettings?.wafManagedRules?.ddosL7Ruleset === 'enabled' ? 'Enabled' : 'Disabled',
                    managedRulesCount: zoneSettings?.wafManagedRules?.managedRulesCount || '0',
                    rulesetActions: zoneSettings?.wafManagedRules?.rulesetActions || 'unknown',
                    // IP Access Rules
                    ipAccessRules: zoneSettings?.ipAccessRules || '0',
                    // Custom Rules & Rate Limiting (New)
                    customRules: zoneSettings?.customRules,
                    rateLimits: zoneSettings?.rateLimits,
                    // DNS Records
                    dnsRecords: dnsRecords || []
                }}
                dashboardImage={dashboardImage}
                template={reportModalMode === 'static-template' ? staticReportTemplate : reportModalMode === 'middle-template' ? middleReportTemplate : reportTemplate}
                onSaveTemplate={reportModalMode === 'static-template' ? handleSaveStaticTemplate : reportModalMode === 'middle-template' ? handleSaveMiddleTemplate : handleSaveTemplate}
                onGenerate={captureAndGenerateReport} // NEW PROP
                mode={reportModalMode}
                theme={theme}
                templateName={templateToEditName}
                templateId={templateToEditId}
                currentUserId={currentUser?.id}
            />

            <ManageTemplateModal
                isOpen={isManageTemplateModalOpen}
                onClose={() => setIsManageTemplateModalOpen(false)}
                onEditSub={onEditSub}
                onEditMiddle={onEditMiddle}
                onEditDomain={onEditDomain}
                theme={theme}
                userRole={currentUser?.role}
                currentUserId={currentUser?.id}
            />

            <BatchReportModal
                key={isBatchModalOpen ? 'batch-open' : 'batch-closed'}
                isOpen={isBatchModalOpen}
                onClose={() => setIsBatchModalOpen(false)}
                hosts={getBatchHosts()}
                onConfirm={handleBatchReport}
                theme={theme}
                selectedZone={selectedZone}
                selectedAccount={selectedAccount}
                accounts={accounts}
                currentUser={currentUser}
            />

            <AutoReportModal
                isOpen={isAutoReportModalOpen}
                onClose={() => setIsAutoReportModalOpen(false)}
                accounts={accounts}
                theme={theme}
                currentUser={currentUser}
            />

            <DepartmentModal
                isOpen={isDepartmentModalOpen}
                onClose={() => setIsDepartmentModalOpen(false)}
                theme={theme}
                selectedZoneId={selectedZone}
                zoneName={zones.find(z => z.id === selectedZone)?.name}
                selectedAccountId={selectedAccount}
                subdomains={subDomains.map(s => s.value)}
                accounts={accounts}
                currentUser={currentUser}
            />

            <SyncHistoryModal
                isOpen={isSyncModalOpen}
                onClose={() => setIsSyncModalOpen(false)}
                accounts={accounts}
                theme={theme}
                currentUser={currentUser}
            />

            <main className="p-4 min-h-screen">

                {/* SELECTORS */}
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4 p-5 rounded-xl border border-dashed ${theme.selectorContainer}`}>
                    <SearchableDropdown theme={theme} icon={<Key className="w-4 h-4 text-blue-400" />} label="Select Account" placeholder={loading ? "Loading..." : "Choose an account..."} options={accounts.map(acc => ({ value: acc.id, label: acc.name, subtitle: `ID: ${acc.id}` }))} value={selectedAccount} onChange={(val) => handleAccountChange(val, false)} loading={loading && accounts.length === 0} />
                    <SearchableDropdown theme={theme} icon={<Server className="w-4 h-4 text-green-400" />} label="Select Zone (Domain)" placeholder={!selectedAccount ? "Select Account first" : loadingZones ? "Loading..." : "Choose a zone..."} options={zones.map(zone => ({ value: zone.id, label: zone.name, subtitle: zone.status }))} value={selectedZone} onChange={setSelectedZone} loading={loadingZones} />
                    <SearchableDropdown theme={theme} icon={<Globe className="w-4 h-4 text-purple-400" />} label="Select Subdomain" placeholder={!selectedZone ? "Select Zone first" : "Choose Subdomain..."} options={subDomains} value={selectedSubDomain} onChange={setSelectedSubDomain} loading={loadingDNS && subDomains.length === 0} />
                </div>


                {/* TIME RANGE SELECTOR */}
                <div className="flex justify-end items-center mb-4">
                    <div className={`${theme.dropdown?.bg || 'bg-gray-900'} border ${theme.dropdown?.border || 'border-gray-800'} rounded-lg p-1 flex gap-1`}>
                        {/* Date Picker Start */}
                        <div className="flex items-center gap-1">
                            <span className={`text-xs ${theme.subText || 'text-gray-400'}`}>Start:</span>
                            <input
                                type="date"
                                value={startDate}
                                max={new Date().toISOString().split('T')[0]} // Prevents future dates
                                onChange={(e) => setStartDate(e.target.value)}
                                className={`px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500
                                ${theme.dropdown?.bg || 'bg-gray-800'} ${theme.dropdown?.text || 'text-white'} ${theme.dropdown?.border || 'border-gray-700'}`}
                            />
                        </div>

                        {/* Date Picker End */}
                        <div className="flex items-center gap-1">
                            <span className={`text-xs ml-2 ${theme.subText || 'text-gray-400'}`}>End:</span>
                            <input
                                type="date"
                                value={endDate}
                                max={new Date().toISOString().split('T')[0]} // Prevents future dates
                                onChange={(e) => setEndDate(e.target.value)}
                                className={`px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500
                                ${theme.dropdown?.bg || 'bg-gray-800'} ${theme.dropdown?.text || 'text-white'} ${theme.dropdown?.border || 'border-gray-700'}`}
                            />
                        </div>

                    </div>
                </div>

                {/* DASHBOARD */}
                <div
                    ref={dashboardRef}
                    className={`space-y-4 transition-all duration-500 ${selectedSubDomain && hasGenerated && !loadingStats ? 'opacity-100 filter-none' : 'opacity-40 grayscale blur-sm'}`}
                >

                    {/* STATS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card theme={theme} title="Total Requests"><div className="flex items-baseline gap-2"><span className="text-6xl font-bold text-blue-400">{totalRequests.toLocaleString()}</span><span className="text-xl font-thai opacity-60">Req</span></div></Card>
                        <Card theme={theme} title="Avg Response Time (TTFB)"><div className="flex items-baseline gap-2"><span className="text-6xl font-bold text-purple-400">{avgResponseTime}</span><span className="text-xl opacity-60">ms</span></div></Card>
                        <Card theme={theme} title="Blocked Events"><div className="flex items-baseline gap-2"><span className="text-6xl font-bold text-orange-400">{blockedEvents.toLocaleString()}</span><span className="text-xl font-thai opacity-60">Events</span></div></Card>
                    </div>

                    {/* CHARTS ROW 1 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card theme={theme} title="Traffic Volume">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={throughputData}>
                                        <defs><linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
                                        <XAxis dataKey="time" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }} itemStyle={{ color: '#60a5fa' }} />
                                        <Area type="monotone" dataKey="requests" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRequests)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                        <Card theme={theme} title="Top URLs"><HorizontalBarList data={topUrls} labelKey="path" valueKey="count" theme={theme} /></Card>
                        <Card theme={theme} title="Top Firewall Actions">
                            <div className="h-64 flex flex-col justify-between">
                                {topFirewallActions.length === 0 ? (<div className="text-gray-500 text-xs italic flex-grow flex items-center justify-center">No firewall events</div>) : (
                                    <>
                                        <ResponsiveContainer width="100%" height="70%">
                                            <PieChart>
                                                <Pie data={topFirewallActions} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="count">
                                                    {topFirewallActions.map((entry, index) => (<Cell key={`cell-${index}`} fill={['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6'][index % 5]} />))}
                                                </Pie>
                                                <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff', fontSize: '12px' }} itemStyle={{ color: '#fff' }} />
                                                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="flex justify-around text-xs border-t border-gray-800 pt-2 mt-1">
                                            <div className="text-center"><div className="text-gray-500 uppercase">Log</div><div className="text-blue-400 font-bold">{logEvents.toLocaleString()}</div></div>
                                            <div className="text-center"><div className="text-gray-500 uppercase">Block</div><div className="text-red-400 font-bold">{blockedEvents.toLocaleString()}</div></div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </Card>
                    </div>

                    {/* CHARTS ROW 2 (Swapped IPs and User Agents) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card theme={theme} title="Top Client IPs"><HorizontalBarList data={topIps} labelKey="ip" valueKey="count" color="bg-cyan-600" theme={theme} /></Card>
                        <Card theme={theme} title="Top User Agents"><HorizontalBarList data={topUserAgents} labelKey="agent" valueKey="count" color="bg-indigo-600" theme={theme} /></Card>
                        <Card theme={theme} title="Top Countries"><HorizontalBarList data={topCountries} labelKey="name" valueKey="count" color="bg-blue-800" theme={theme} /></Card>
                    </div>

                    {/* CHARTS ROW 3: NEW SECURITY & HTTP CHARTS */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card theme={theme} title="Attack Prevention History (Block/Challenge)">
                            <div className="h-64 flex flex-col">
                                <div className="flex-grow">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={attackSeriesData}>
                                            <defs><linearGradient id="colorAttacks" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient></defs>
                                            <XAxis dataKey="time" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                                            <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }} itemStyle={{ color: '#ef4444' }} />
                                            <Area type="monotone" dataKey="attacks" stroke="#ef4444" fillOpacity={1} fill="url(#colorAttacks)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className={`h-20 overflow-y-auto mt-2 border-t pt-2 rounded ${theme.rawData ? theme.rawData.replace('text-', '') : 'bg-gray-950/50 border-gray-800'}`}>
                                    {detailedAttackList.length === 0 ? (
                                        <div className={`${theme.subText || 'text-gray-500'} text-[10px] text-center italic py-2`}>No attack events in this period</div>
                                    ) : (
                                        <table className={`w-full text-xs ${theme.subText || 'text-gray-400'}`}>
                                            <tbody>
                                                {detailedAttackList.map((d, i) => (
                                                    <tr key={i} className={`border-b ${theme.dropdown?.border || 'border-gray-900/50'} ${theme.tableRowHover || 'hover:bg-gray-900'}`}>
                                                        <td className={`py-1 pl-2 font-mono ${theme.subText || 'text-gray-500'}`}>
                                                            {d.time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className={`py-1 ${theme.accent || 'text-orange-400'}`}>{formatActionName(d.action)}</td>
                                                        <td className={`py-1 pr-2 text-right ${theme.text || 'text-gray-300'}`}>{d.count}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </Card>

                        <Card theme={theme} title="Non-200 HTTP Status Codes">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={httpStatusSeriesData.data}>
                                        <XAxis dataKey="time" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }} />
                                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                                        {httpStatusSeriesData.keys && httpStatusSeriesData.keys.map((code, index) => (
                                            <Area
                                                key={`status-area-${code}-${index}`}
                                                type="monotone"
                                                dataKey={code}
                                                name={String(code)}
                                                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                                                fillOpacity={0.6}
                                            />
                                        ))}
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>

                    {/* NEW CHARTS ROW 4 (Security Details) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card theme={theme} title="Top WAF Rules">
                            <div className="overflow-y-auto max-h-64">
                                <HorizontalBarList data={topRules} labelKey="rule" valueKey="count" color="bg-orange-600" theme={theme} />
                            </div>
                        </Card>
                        <Card theme={theme} title="Top 5 Attackers">
                            <div className="overflow-x-auto">
                                <table className={`w-full text-xs text-left ${theme.id === 'corporate' ? 'text-slate-700' : 'text-gray-400'}`}>
                                    <thead className={`uppercase font-bold border-b ${theme.id === 'corporate' ? 'text-slate-600 border-slate-200' : 'text-gray-500 border-gray-800'}`}>
                                        <tr>
                                            <th className="py-2 pl-2">IP</th>
                                            <th className="py-2">Country</th>
                                            <th className="py-2 text-right">Count</th>
                                            <th className="py-2 pr-2 text-right">Type</th>
                                        </tr>
                                    </thead>
                                    <tbody className={theme.id === 'corporate' ? 'divide-y divide-slate-200' : 'divide-y divide-gray-800/50'}>
                                        {topAttackers.length === 0 ? (
                                            <tr><td colSpan="4" className="text-center py-4 italic">No attackers found</td></tr>
                                        ) : (
                                            topAttackers.slice(0, 5).map((attacker, i) => (
                                                <tr key={i} className={`${theme.tableRowHover} transition-colors`}>
                                                    <td className="py-2 pl-2 font-mono text-blue-400">{attacker.ip}</td>
                                                    <td className={`py-2 ${theme.id === 'corporate' ? 'text-slate-800' : 'text-gray-300'}`}>{attacker.country}</td>
                                                    <td className="py-2 text-right text-red-500 font-bold">{attacker.count.toLocaleString()}</td>
                                                    <td className="py-2 pr-2 text-right text-xs opacity-70">{attacker.type}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>

                    {/* RAW DATA INSPECTOR */}
                    <div className="grid grid-cols-1 gap-4">
                        <Card theme={theme} title={`Raw API Data for ${selectedSubDomain}`}>
                            <div className={`overflow-x-auto max-h-48 overflow-y-auto font-mono text-xs p-4 rounded border ${theme.rawData}`}>
                                {rawData.some(item => item?.isSummary) && (
                                    <div className={`mb-3 text-[11px] ${theme.subText || 'text-gray-400'}`}>
                                        Showing synced daily summary rows from Sync History for this range.
                                    </div>
                                )}
                                <div className={`grid grid-cols-7 gap-2 border-b ${theme.id === 'corporate' ? 'border-slate-300 text-slate-900' : 'border-gray-800 text-gray-300'} pb-2 mb-2 font-bold min-w-[900px]`}>
                                    <div className="col-span-2">Host</div><div className="col-span-1">IP</div><div className="col-span-1">Country</div>
                                    <div className="col-span-1">Status</div><div className="col-span-1">Device</div><div className="col-span-1 text-right">Count</div>
                                </div>
                                {rawInspectorRows.slice(0, 10).map((row, i) => {
                                    return (
                                        <div key={row.key || i} className={`grid grid-cols-7 gap-2 ${theme.tableRowHover} transition-colors py-1 border-b ${theme.id === 'corporate' ? 'border-slate-200/70' : 'border-gray-900/50'} min-w-[900px] items-center`}>
                                            <div className={`col-span-2 truncate pr-2 ${theme.id === 'corporate' ? 'text-slate-900 font-semibold' : 'text-green-400'}`}>{row.host}</div>
                                            <div className={`col-span-1 truncate ${theme.id === 'corporate' ? 'text-blue-700' : 'text-blue-400'}`}>{row.ip}</div>
                                            <div className={`col-span-1 truncate ${theme.id === 'corporate' ? 'text-slate-700' : 'text-gray-500'}`}>{row.country}</div>
                                            <div className={`col-span-1 truncate ${theme.id === 'corporate' ? 'text-amber-700' : 'text-yellow-400'}`}>{row.status}</div>
                                            <div className={`col-span-1 truncate ${theme.id === 'corporate' ? 'text-indigo-700' : 'text-purple-400'}`}>{row.device}</div>
                                            <div className={`col-span-1 font-bold text-right ${theme.id === 'corporate' ? 'text-slate-900' : 'text-white'}`}>{Number(row.count || 0).toLocaleString()}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    </div>

                </div>
            </main >
        </div >
    );
}
