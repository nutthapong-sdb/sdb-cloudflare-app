'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/app/utils/auth';
import { getUserProfileAction } from '@/app/actions/authActions';
import { loadTemplate, saveTemplate, loadStaticTemplate, saveStaticTemplate, listTemplates } from '@/app/utils/templateApi';
import ManageTemplateModal from './ManageTemplateModal';
import { saveCloudflareTokenAction } from '@/app/actions/authActions';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
    ShieldAlert, Activity, Clock, Globe,
    AlertTriangle, FileText, LayoutDashboard, Database,
    Search, Bell, Menu, Download, Server, Key, List, X, Edit3, Copy, FileType, Settings
} from 'lucide-react';
import jsPDF from 'jspdf';
import * as htmlToImage from 'html-to-image';
import Swal from 'sweetalert2';
import { Editor } from '@tinymce/tinymce-react';

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

const processTemplate = (tmpl, safeData, now = new Date()) => {
    // If static template mode, return raw HTML (no replacement)
    // Mode check removed here as we pass safeData specifically for processing
    let html = tmpl;

    const startDate = new Date(now.getTime() - (safeData.timeRange || 1440) * 60 * 1000);
    const endDate = now;
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
        const regex = new RegExp(key + '(@)?', 'g');
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
const ReportModal = ({ isOpen, onClose, data, dashboardImage, template, onSaveTemplate, onGenerate, mode = 'report' }) => {
    // mode: 'report' | 'static-template'
    console.log('ReportModal Render:', { mode, templateType: typeof template, templateValue: template, isNull: template === null, isEmptyObj: JSON.stringify(template) === '{}' });

    // If no template passed, use default (fallback)
    // Use nullish coalescing to allow empty string (for empty templates)
    const currentTemplate = template ?? DEFAULT_TEMPLATE;

    // Default to editing in static mode, preview in report mode
    const [isEditing, setIsEditing] = useState(false);
    const [localTemplate, setLocalTemplate] = useState(currentTemplate);
    const reportContentRef = useRef(null);
    const editorRef = useRef(null);

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

    if (!isOpen) return null;

    // --- DATA PREPARATION ---
    // Safely handle missing data for static mode or initial load
    // Use spread to merge defaults with incoming data
    const safeData = {
        domain: '-', timeRange: 0, totalRequests: 0, avgTime: 0,
        blockedEvents: 0, logEvents: 0, topUrls: [], topIps: [],
        topRules: [], topAttackers: [], dnsRecords: [],
        ...data  // Override defaults with actual data
    };

    const startDate = new Date(Date.now() - (safeData.timeRange || 1440) * 60 * 1000);
    const endDate = new Date();
    const timeRangeStr = `${formatThaiDate(startDate)} - ${formatThaiDate(endDate)}`;
    const avgTimeSec = safeData.avgTime ? (safeData.avgTime / 1000).toFixed(3) : "0.000";
    const totalFirewall = (safeData.blockedEvents || 0) + (safeData.logEvents || 0);
    const blockPct = totalFirewall > 0 ? ((safeData.blockedEvents / totalFirewall) * 100).toFixed(2) : "0.00";
    const logPct = totalFirewall > 0 ? ((safeData.logEvents / totalFirewall) * 100).toFixed(2) : "0.00";
    const topUA = safeData.topUserAgents && safeData.topUserAgents.length > 0 ? safeData.topUserAgents[0] : { agent: '-', count: 0 };
    const domainDisplay = safeData.domain === 'ALL_SUBDOMAINS' ? `ทุก Subdomain ของ Domain ${safeData.zoneName || '...'}` : safeData.domain;

    // --- TEMPLATE PROCESSING ---
    const getProcessedHtml = () => {
        // Even for static template, we want to process date variables
        return processTemplate(localTemplate, safeData, new Date());
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
    const handleDownloadWord = () => {
        if (!reportContentRef.current) return;

        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
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
        const footer = "</div></body></html>";

        let cleanHTML = "";

        if (isEditing) {
            cleanHTML = localTemplate;
        } else {
            // Clone the node to manipulate text without affecting the UI
            const clone = reportContentRef.current.cloneNode(true);

            // Traverse text nodes and replace consecutive spaces with non-breaking spaces
            // This ensures Word respects multiple spaces which it otherwise collapses
            const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walker.nextNode()) {
                if (node.nodeValue) {
                    // Replace any space that is followed by another space with a non-breaking space
                    // This preserves the whitespace width while keeping the last space as a breaking point if needed
                    node.nodeValue = node.nodeValue.replace(/ (?= )/g, '\u00A0');
                }
            }

            cleanHTML = clone.innerHTML;

            // 1. Unwrap divs that are inside paragraphs (TinyMCE often creates <p><div>...</div></p>)
            // This is invalid HTML and causes extra margins in Word.
            cleanHTML = cleanHTML.replace(/<p[^>]*>\s*(<div[^>]*>)/gi, '$1');
            cleanHTML = cleanHTML.replace(/(<\/div>)\s*<\/p>/gi, '$1');

            // 2. Remove any gap between lists and tables (Aggressive)
            // Matches </ul> or </ol>, followed by ANYTHING (non-greedy), followed by <table or <div
            // AND specifically target the table start
            // cleanHTML = cleanHTML.replace(/(<\/ul>|<\/ol>)[\s\S]*?(<table|<div)/gi, '$1$2');

            // 3. Fix Image alignment
            // TinyMCE uses `style="display: block; margin-left: auto; margin-right: auto;"` for center.
            // Word prefers <p align="center"> or <div align="center">
            cleanHTML = cleanHTML.replace(/<img[^>]*style="[^"]*margin-left:\s*auto;[^"]*margin-right:\s*auto;[^"]*"[^>]*>/gi, (match) => {
                return `<p align="center">${match}</p>`;
            });

            cleanHTML = cleanHTML.replace(/style="[^"]*width[^"]*"/g, '');
        }

        const sourceHTML = header + cleanHTML + footer;
        const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
        const fileDownload = document.createElement("a");
        document.body.appendChild(fileDownload);
        fileDownload.href = source;
        fileDownload.download = mode === 'static-template' ? `template.doc` : `report_${safeData.domain || 'report'}.doc`;
        fileDownload.click();
        document.body.removeChild(fileDownload);
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

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-[95%] shadow-2xl overflow-hidden flex flex-col h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-950/50 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <h3 className="text-lg font-bold text-gray-100">
                            {mode === 'static-template'
                                ? 'Domain Report'
                                : (isEditing
                                    ? 'Edit Report'
                                    : 'Preview Report'
                                )}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
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
                    `}} />
                    <div ref={reportContentRef} className="report-content space-y-4 text-base leading-relaxed flex-1 overflow-auto" style={{ fontFamily: '"TH SarabunPSK", "Sarabun", sans-serif' }}>

                        {/* Image only in Preview (Report Mode) */}
                        {mode === 'report' && !isEditing && dashboardImage && (
                            <div className="mb-6 flex justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={dashboardImage}
                                    alt="Dashboard Snapshot"
                                    width={600}
                                    style={{ height: 'auto', display: 'block', margin: '0 auto' }}
                                />
                            </div>
                        )}

                        {isEditing ? (
                            <div className="flex gap-4 h-full">
                                {/* Editor Section - Left */}
                                <div className="flex-1 flex flex-col min-w-0">
                                    <div className="flex-1 bg-white text-black rounded-lg overflow-hidden border border-gray-300">
                                        <Editor
                                            tinymceScriptSrc='/tinymce/tinymce.min.js'
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
                                                toolbar: 'undo redo | blocks | ' +
                                                    'bold italic forecolor | alignleft aligncenter ' +
                                                    'alignright alignjustify | bullist numlist outdent indent | ' +
                                                    'image table | removeformat | help',
                                                content_style: 'body { font-family: "TH SarabunPSK", "Sarabun", sans-serif; font-size: 16pt; } h1 { font-size: 24pt; font-weight: bold; } h2 { font-size: 18pt; font-weight: bold; } h3 { font-size: 14pt; font-weight: bold; }',
                                                forced_root_block: 'p',
                                                nonbreaking_force_tab: true,
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
                                <div className="w-[28rem] flex-shrink-0 flex flex-col bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <div className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2 sticky top-0 bg-gray-50 pb-2 border-b border-gray-300">
                                        <span className="bg-blue-500 text-white px-2 py-1 rounded">Variables</span>
                                        <span className="text-xs text-gray-500">Click to insert</span>
                                    </div>
                                    <div className="overflow-y-auto pr-2 space-y-4">
                                        {mode === 'report' ? (
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    '@DAY', '@MONTH', '@YEAR', '@FULL_DATE', '@time_range', '@DOMAIN', '@ACCOUNT_NAME', '@ZONE_NAME', '@TOTAL_REQ', '@AVG_TIME', '@BLOCK_PCT', '@LOG_PCT',
                                                    '@PEAK_TIME', '@PEAK_COUNT', '@PEAK_ATTACK_TIME', '@PEAK_ATTACK_COUNT', '@PEAK_HTTP_TIME', '@PEAK_HTTP_COUNT',
                                                    '@TOP_UA_AGENT', '@TOP_UA_COUNT',
                                                    '@TOP_URLS_LIST', '@TOP_IPS_LIST',
                                                    '@TOP_RULES_LIST', '@TOP_ATTACKERS_LIST', '@TOP_SOURCES_LIST',
                                                    '@ZONE_TOTAL_REQ', '@ZONE_CACHE_HIT_REQ', '@ZONE_CACHE_HIT_REQ_RATIO',
                                                    '@ZONE_TOTAL_BANDWIDTH', '@ZONE_CACHE_HIT_BANDWIDTH', '@ZONE_CACHE_HIT_BANDWIDTH_RATIO',
                                                    '@ZONE_TOP_COUNTRIES_REQ', '@ZONE_TOP_COUNTRIES_BYTES',
                                                    '@FW_TOTAL_EVENTS', '@FW_MANAGED_EVENTS', '@FW_CUSTOM_EVENTS', '@FW_BIC_EVENTS', '@FW_ACCESS_EVENTS',
                                                    '@TOP_IP_VAL', '@TOP_UA_VAL', '@TOP_COUNTRY_VAL', '@TOP_HOST_VAL',
                                                    '@TOP_PATHS_LIST', '@TOP_CUSTOM_RULES_LIST', '@TOP_MANAGED_RULES_LIST'
                                                ].map(v => (
                                                    <button
                                                        key={v}
                                                        onClick={() => editorRef.current?.insertContent(v)}
                                                        className="px-2 py-1 bg-white border border-gray-300 rounded text-[10px] font-mono text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-400 transition-all shadow-sm active:scale-95 text-left truncate w-full"
                                                        title={`Insert ${v}`}
                                                    >
                                                        {v}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            // Static Template Mode - Grouped by Category
                                            <>
                                                {/* ข้อมูลพื้นฐาน */}
                                                <div>
                                                    <div className="text-xs font-semibold text-gray-600 mb-2 pb-1 border-b border-gray-300">
                                                        ข้อมูลพื้นฐาน
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {['@DAY', '@MONTH', '@YEAR', '@FULL_DATE', '@ACCOUNT_NAME', '@ZONE_NAME', '@DNS_RECORDS'
                                                            , '@ZONE_TOTAL_REQ', '@ZONE_CACHE_HIT_REQ', '@ZONE_CACHE_HIT_REQ_RATIO'
                                                            , '@ZONE_TOTAL_BANDWIDTH', '@ZONE_CACHE_HIT_BANDWIDTH', '@ZONE_CACHE_HIT_BANDWIDTH_RATIO'
                                                            , '@TOP_IP_VAL', '@TOP_UA_VAL', '@TOP_COUNTRY_VAL', '@TOP_HOST_VAL'
                                                        ].map(v => (
                                                            <button
                                                                key={v}
                                                                onClick={() => editorRef.current?.insertContent(v)}
                                                                className="px-2 py-1 bg-white border border-gray-300 rounded text-[10px] font-mono text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-400 transition-all shadow-sm active:scale-95 text-left truncate"
                                                                title={`Insert ${v}`}
                                                            >
                                                                {v}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* 1. ป้องกันการโจมตีด้วยกลไกอัตโนมัติ */}
                                                <div>
                                                    <div className="text-xs font-semibold text-blue-700 mb-2 pb-1 border-b border-blue-300">
                                                        1. ป้องกันการโจมตีด้วยกลไกอัตโนมัติ
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {['@SECURITY_LEVEL', '@BOT_MANAGEMENT_STATUS', '@BLOCK_AI_BOTS',
                                                            '@DEFINITELY_AUTOMATED', '@LIKELY_AUTOMATED', '@VERIFIED_BOTS',
                                                            '@CLOUDFLARE_MANAGED_RULESET', '@OWASP_CORE_RULESET',
                                                            '@MANAGED_RULES_COUNT'].map(v => (
                                                                <button
                                                                    key={v}
                                                                    onClick={() => editorRef.current?.insertContent(v)}
                                                                    className="px-2 py-1 bg-white border border-blue-200 rounded text-[10px] font-mono text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-all shadow-sm active:scale-95 text-left truncate"
                                                                    title={`Insert ${v}`}
                                                                >
                                                                    {v}
                                                                </button>
                                                            ))}
                                                    </div>
                                                </div>

                                                {/* 2. ลดความเสี่ยงช่องโหว่ทางเทคนิค */}
                                                <div>
                                                    <div className="text-xs font-semibold text-green-700 mb-2 pb-1 border-b border-green-300">
                                                        2. ลดความเสี่ยงช่องโหว่ทางเทคนิค
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {['@SSL_MODE', '@MIN_TLS_VERSION', '@TLS_1_3',
                                                            '@LEAKED_CREDENTIALS', '@BROWSER_INTEGRITY_CHECK', '@HOTLINK_PROTECTION'].map(v => (
                                                                <button
                                                                    key={v}
                                                                    onClick={() => editorRef.current?.insertContent(v)}
                                                                    className="px-2 py-1 bg-white border border-green-200 rounded text-[10px] font-mono text-green-700 hover:bg-green-50 hover:border-green-400 transition-all shadow-sm active:scale-95 text-left truncate"
                                                                    title={`Insert ${v}`}
                                                                >
                                                                    {v}
                                                                </button>
                                                            ))}
                                                    </div>
                                                </div>

                                                {/* 3. ป้องกัน DDoS และการโจมตีอื่นๆ */}
                                                <div>
                                                    <div className="text-xs font-semibold text-red-700 mb-2 pb-1 border-b border-red-300">
                                                        3. ป้องกัน DDoS และการโจมตีอื่นๆ
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {['@DDOS_PROTECTION', '@HTTP_DDOS_PROTECTION', '@SSL_TLS_DDOS_PROTECTION', '@NETWORK_DDOS_PROTECTION',
                                                        ].map(v => (
                                                            <button
                                                                key={v}
                                                                onClick={() => editorRef.current?.insertContent(v)}
                                                                className="px-2 py-1 bg-white border border-red-200 rounded text-[10px] font-mono text-red-700 hover:bg-red-50 hover:border-red-400 transition-all shadow-sm active:scale-95 text-left truncate"
                                                                title={`Insert ${v}`}
                                                            >
                                                                {v}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* 4. Custom Rules & Rulesets */}
                                                <div>
                                                    <div className="text-xs font-semibold text-purple-700 mb-2 pb-1 border-b border-purple-300">
                                                        4. Custom Rules & Rulesets
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {['@CUSTOM_RULES_STATUS', '@RULE_BYPASSWAF', '@RULE_BYPASS_EMAIL', '@RULE_BLOCK_URL',
                                                            '@RATE_LIMIT_RULES_STATUS', '@RULE_LOG_1000_REQ'].map(v => (
                                                                <button
                                                                    key={v}
                                                                    onClick={() => editorRef.current?.insertContent(v)}
                                                                    className="px-2 py-1 bg-white border border-purple-200 rounded text-[10px] font-mono text-purple-700 hover:bg-purple-50 hover:border-purple-400 transition-all shadow-sm active:scale-95 text-left truncate"
                                                                    title={`Insert ${v}`}
                                                                >
                                                                    {v}
                                                                </button>
                                                            ))}
                                                    </div>
                                                </div>

                                                {/* 5. สถิติความปลอดภัย (Firewall Stats) */}
                                                <div>
                                                    <div className="text-xs font-semibold text-orange-700 mb-2 pb-1 border-b border-orange-300">
                                                        5. สถิติความปลอดภัย (Firewall Stats)
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {['@FW_TOTAL_EVENTS', '@FW_MANAGED_EVENTS', '@FW_CUSTOM_EVENTS', '@FW_BIC_EVENTS', '@FW_ACCESS_EVENTS'].map(v => (
                                                            <button
                                                                key={v}
                                                                onClick={() => editorRef.current?.insertContent(v)}
                                                                className="px-2 py-1 bg-white border border-orange-200 rounded text-[10px] font-mono text-orange-700 hover:bg-orange-50 hover:border-orange-400 transition-all shadow-sm active:scale-95 text-left truncate"
                                                                title={`Insert ${v}`}
                                                            >
                                                                {v}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* 6. Table Variables */}
                                                <div>
                                                    <div className="text-xs font-semibold text-teal-700 mb-2 pb-1 border-b border-teal-300">
                                                        6. Table Variables
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {['@IP_ACCESS_RULES_ROWS', '@DNS_TOTAL_ROWS', '@ZONE_TOP_COUNTRIES_REQ', '@ZONE_TOP_COUNTRIES_BYTES',
                                                            '@TOP_PATHS_LIST', '@TOP_CUSTOM_RULES_LIST', '@TOP_MANAGED_RULES_LIST'].map(v => (
                                                                <button
                                                                    key={v}
                                                                    onClick={() => editorRef.current?.insertContent(v)}
                                                                    className="px-2 py-1 bg-white border border-teal-200 rounded text-[10px] font-mono text-teal-700 hover:bg-teal-50 hover:border-teal-400 transition-all shadow-sm active:scale-95 text-left truncate"
                                                                    title={`Insert ${v}`}
                                                                >
                                                                    {v}
                                                                </button>
                                                            ))}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div dangerouslySetInnerHTML={{ __html: getProcessedHtml() }} />
                        )}

                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-800 bg-gray-950/50 flex justify-end gap-3 flex-shrink-0">
                    {/* In Edit Mode (Default for Static) */}
                    {isEditing ? (
                        <>
                            <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded">
                                Cancel
                            </button>
                            <button onClick={handleSave} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded flex items-center gap-2">
                                <Edit3 className="w-3 h-3" /> {mode === 'static-template' ? 'Save Template' : 'Save & Preview'}
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors">
                                <Edit3 className="w-3 h-3" /> Edit Template
                            </button>
                            <button onClick={handleDownloadWord} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors">
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
const THEMES = {
    dark: {
        id: 'dark',
        name: 'Dark (Default)',
        bg: 'bg-black',
        nav: 'bg-[#0f1115]',
        card: 'bg-gray-900 border-gray-800',
        cardHeader: 'bg-gray-900/50 border-gray-800',
        text: 'text-white',
        subText: 'text-gray-400',
        accent: 'text-orange-500',
        button: 'bg-gray-800 hover:bg-gray-700 text-gray-300',
        icon: 'text-gray-500 hover:text-white',
        selectorContainer: 'bg-gray-900/40 border-gray-800',
        rawData: 'bg-gray-950 border-gray-800 text-gray-400',
        tableRowHover: 'hover:bg-gray-900',
        dropdown: {
            bg: 'bg-gray-900',
            border: 'border-gray-700',
            menuBg: 'bg-gray-800',
            menuBorder: 'border-gray-700',
            hover: 'hover:bg-gray-700',
            text: 'text-gray-300',
            active: 'bg-blue-600 text-white',
            label: 'text-gray-400',
            placeholder: 'text-gray-500',
            inputText: 'text-white'
        }
    },
    pastel: {
        id: 'pastel',
        name: 'Pink Pastel',
        bg: 'bg-pink-50',
        nav: 'bg-pink-200 border-pink-300',
        card: 'bg-white border-pink-300 shadow-md',
        cardHeader: 'bg-pink-100/50 border-pink-200',
        text: 'text-pink-900',
        subText: 'text-pink-500',
        accent: 'text-pink-600',
        button: 'bg-white hover:bg-pink-100 text-pink-600 border border-pink-300',
        icon: 'text-pink-400 hover:text-pink-600',
        selectorContainer: 'bg-white/60 border-pink-300 shadow-sm',
        rawData: 'bg-white border-pink-200 text-gray-600',
        tableRowHover: 'hover:bg-pink-50',
        dropdown: {
            bg: 'bg-white',
            border: 'border-pink-300',
            menuBg: 'bg-white',
            menuBorder: 'border-pink-200 font-medium',
            hover: 'hover:bg-pink-50',
            text: 'text-gray-600',
            active: 'bg-pink-400 text-white',
            label: 'text-pink-500',
            placeholder: 'text-gray-400',
            inputText: 'text-gray-800'
        }
    }
};

// Batch Report Modal Component
const BatchReportModal = ({ isOpen, onClose, hosts, onConfirm }) => {
    const [selected, setSelected] = useState(new Set());
    const [batchTimeRange, setBatchTimeRange] = useState(1440);
    const [searchTerm, setSearchTerm] = useState('');
    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('default');

    useEffect(() => {
        if (isOpen) {
            listTemplates().then(list => {
                setTemplates(list);
                if (list.length > 0 && !list.find(t => t.id === selectedTemplateId)) {
                    setSelectedTemplateId('default'); // Fallback
                }
            });
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


    // FILTER LOGIC & DEBUGGING
    const filteredHosts = hosts.filter(h => {
        const hStr = String(h || '');
        const match = hStr.toLowerCase().includes(searchTerm.toLowerCase());
        return match;
    });

    // console.log('🔍 Modal Render:', { term: searchTerm, total: hosts.length, visible: filteredHosts.length });

    useEffect(() => {
        if (isOpen) {
            setSelected(new Set()); // Reset on open
            setSearchTerm(''); // Reset search
        }
    }, [isOpen]);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const toggleAll = () => {
        // Toggle based on filtered hosts if search is active, or all hosts?
        // Let's toggle ALL visible hosts
        const allVisibleSelected = filteredHosts.every(h => selected.has(h));

        const newSet = new Set(selected);
        if (allVisibleSelected) {
            filteredHosts.forEach(h => newSet.delete(h));
        } else {
            filteredHosts.forEach(h => newSet.add(h));
        }
        setSelected(newSet);
    };

    const toggleOne = (host) => {
        const newSet = new Set(selected);
        if (newSet.has(host)) newSet.delete(host);
        else newSet.add(host);
        setSelected(newSet);
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-gray-800 bg-gray-950/50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <List className="w-5 h-5 text-purple-400" />
                        Create Report
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 overflow-y-auto flex-1">
                    {/* Template Selector */}
                    <div className="mb-6 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Report Template</label>
                        <select
                            value={selectedTemplateId}
                            onChange={e => setSelectedTemplateId(e.target.value)}
                            className="bg-gray-800 border border-gray-600 text-white rounded p-2.5 w-full text-sm outline-none focus:border-blue-500 transition-colors appearance-none"
                        >
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    {/* Time Range Selector */}
                    <div className="mb-6 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Time Range</label>
                        <div className="flex gap-2">
                            {[{ label: '1 Day', val: 1440 }, { label: '7 Days', val: 10080 }, { label: '30 Days', val: 43200 }].map(t => (
                                <button
                                    key={t.val}
                                    onClick={() => setBatchTimeRange(t.val)}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors border ${batchTimeRange === t.val ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-200'}`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Live Search Input (New) */}
                    <div className="mb-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Filter sub-domains..."
                                value={searchTerm}
                                onChange={handleSearchChange}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-gray-600"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-400 text-sm">Select Sub-domains to include:</span>
                        <button onClick={toggleAll} className="text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors uppercase tracking-wider">
                            {filteredHosts.length > 0 && filteredHosts.every(h => selected.has(h)) ? 'Deselect Visible' : 'Select Visible'}
                        </button>
                    </div>
                    {filteredHosts.length === 0 ? (
                        <div className="text-center text-gray-500 py-8 text-sm italic">
                            {hosts.length === 0 ? "No sub-domains available." : "No matching sub-domains found."}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredHosts.map(host => (
                                <label key={host} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 cursor-pointer transition-colors border border-transparent hover:border-gray-700 group">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selected.has(host) ? 'bg-blue-600 border-blue-600' : 'border-gray-600 group-hover:border-gray-500'}`}>
                                        {selected.has(host) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={selected.has(host)}
                                        onChange={() => toggleOne(host)}
                                        className="hidden"
                                    />
                                    <span className={`text-sm ${selected.has(host) ? 'text-white font-medium' : 'text-gray-400'}`}>{host}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 bg-gray-950/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded text-gray-400 hover:text-white hover:bg-gray-800 font-medium transition-colors text-xs">Cancel</button>
                    <button
                        onClick={() => onConfirm(Array.from(selected), batchTimeRange, selectedTemplateId)}
                        disabled={selected.size === 0}
                        className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs flex items-center gap-2"
                    >
                        <FileText className="w-3 h-3" />
                        Generate {selected.size > 0 ? `(${selected.size})` : ''} Reports
                    </button>
                </div>
            </div>
        </div>
    );
};



function SearchableDropdown({ options, value, onChange, placeholder, label, loading, icon, theme }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const dropdownRef = useRef(null);
    const listRef = useRef(null);

    // Default theme fallback
    const t = theme ? theme.dropdown : {
        bg: 'bg-gray-900',
        border: 'border-gray-700',
        menuBg: 'bg-gray-800',
        menuBorder: 'border-gray-700',
        hover: 'hover:bg-gray-700',
        text: 'text-gray-300',
        active: 'bg-blue-600 text-white',
        label: 'text-gray-400',
        placeholder: 'text-gray-500',
        inputText: 'text-white',
        focused: 'bg-gray-700 text-white' // Helper for keyboard focus
    };

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (option.subtitle && option.subtitle.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
        setFocusedIndex(-1);
    };

    // Reset focus when options change or open
    useEffect(() => {
        setFocusedIndex(-1);
    }, [isOpen, searchTerm]);

    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
                // Scroll logic could go here
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
                break;
            case 'Enter':
                e.preventDefault();
                if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
                    handleSelect(filteredOptions[focusedIndex].value);
                } else if (filteredOptions.length === 1) {
                    // Auto select single result if enter pressed? Optional but nice.
                    handleSelect(filteredOptions[0].value);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                break;
            case 'Tab':
                setIsOpen(false);
                break;
        }
    };

    // Scroll focused item into view
    useEffect(() => {
        if (isOpen && focusedIndex >= 0 && listRef.current) {
            const focusedItem = listRef.current.children[focusedIndex];
            if (focusedItem) {
                focusedItem.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [focusedIndex, isOpen]);

    return (
        <div className="space-y-2 relative" ref={dropdownRef}>
            <label className={`${t.label} text-xs font-semibold uppercase tracking-wider flex items-center gap-2 mb-1`}>
                {icon}
                {label}
            </label>

            <div className="relative" onKeyDown={handleKeyDown}>
                <div
                    onClick={() => !loading && setIsOpen(!isOpen)}
                    className={`
             w-full px-4 py-2.5 rounded-lg cursor-pointer transition-all 
             flex items-center justify-between
             ${t.bg} border ${t.border}
             ${isOpen ? 'ring-2 ring-blue-500/50 border-blue-500' : 'hover:opacity-80'}
          `}
                    tabIndex={0} // Make accessible/focusable
                >
                    {isOpen ? (
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                            placeholder="Search..."
                            className={`w-full bg-transparent outline-none text-sm ${t.inputText} placeholder-gray-500`}
                            autoFocus
                        />
                    ) : (
                        <span className={`text-sm ${selectedOption ? t.inputText : t.placeholder}`}>
                            {selectedOption ? selectedOption.label : placeholder}
                        </span>
                    )}
                    <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''} ${t.placeholder}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                {isOpen && (
                    <div ref={listRef} className={`absolute z-[100] w-full mt-1 ${t.menuBg} border ${t.menuBorder} rounded-lg shadow-xl max-h-60 overflow-y-auto`}>
                        {loading ? (
                            <div className="p-3 text-center text-xs text-gray-400">Loading...</div>
                        ) : filteredOptions.length === 0 ? (
                            <div className="p-3 text-center text-xs text-gray-400">No results found</div>
                        ) : (
                            filteredOptions.map((option, index) => {
                                const isFocused = index === focusedIndex;
                                return (
                                    <div
                                        key={option.value}
                                        onMouseDown={() => handleSelect(option.value)}
                                        onMouseEnter={() => setFocusedIndex(index)} // Mouse hover updates focus too
                                        className={`
                    px-4 py-2 cursor-pointer transition-colors text-sm
                    ${value === option.value ? t.active : isFocused ? (t.focused || 'bg-gray-700 text-white') : `${t.hover} ${t.text}`}
                  `}
                                    >
                                        <div className="font-medium">{option.label}</div>
                                        {option.subtitle && <div className="text-xs opacity-60">{option.subtitle}</div>}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

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


const HorizontalBarList = ({ data, labelKey, valueKey, color = "bg-blue-600" }) => {
    const maxValue = Math.max(...data.map(d => d[valueKey] || 0), 1);
    const total = data.length;

    if (total === 0) {
        return <div className="text-gray-500 text-xs italic py-2">No data available</div>;
    }

    return (
        <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between text-gray-500 border-b border-gray-800 pb-1 mb-2">
                <span>{labelKey}</span>
                <span>Count</span>
            </div>
            {data.map((item, idx) => (
                <div key={idx} className="relative group">
                    <div className="flex justify-between items-center relative z-10 py-1">
                        <span className="text-gray-300 truncate w-2/3 pr-2">{item[labelKey] || item.name}</span>
                        <span className="text-gray-400">{item[valueKey]?.toLocaleString() || 0}</span>
                    </div>
                    <div className="absolute top-0 left-0 h-full bg-gray-800/50 w-full rounded-sm">
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
    accountName: "BDMS Group1",
    zoneName: "bdms.co.th",
    subDomain: "ALL_SUBDOMAINS"
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
    const [reportModalMode, setReportModalMode] = useState('preview'); // 'preview' (report) or 'static-template'
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false); // NEW: Batch Modal State
    const dashboardRef = useRef(null);

    // Theme State
    const [currentTheme, setCurrentTheme] = useState('dark');
    const theme = THEMES[currentTheme] || THEMES.dark;

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
    const [timeRange, setTimeRange] = useState(1440); // Default 1d

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

    const fetchAndApplyTrafficData = async (subdomain, zoneId, timeRange) => {
        setLoadingStats(true); // Start manual generation spinner
        const isAllSubdomains = subdomain === 'ALL_SUBDOMAINS';
        console.log(`🔍 Fetching traffic for: ${isAllSubdomains ? 'ALL ZONES' : subdomain} (Range: ${timeRange}m)`);

        let zReq = 0, zBytes = 0, zCacheReq = 0, zCacheBytes = 0;
        let zTopReq = [], zTopBytes = [];

        const result = await callAPI('get-traffic-analytics', {
            zoneId: zoneId,
            timeRange: timeRange,
            subdomain: isAllSubdomains ? null : subdomain,
            apiToken: currentUser?.cloudflare_api_token // Pass user token
        });

        let filteredData = [];
        let totalReq = 0;
        let weightedAvgTime = 0;

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
                totalReq = totalReqLogs;
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

        setRawData(filteredData);
        setTotalRequests(totalReq);
        setAvgResponseTime(weightedAvgTime);

        // --- DATA PROCESSING FOR CHARTS ---
        const urlCounts = {}; const ipCounts = {}; const countryCounts = {}; const uaCounts = {}; const hostCounts = {};
        const statusTotals = {};

        // 1. Time Buckets Generation (4 Hours for 24h view)
        let bucketSizeMs = 60 * 60 * 1000;
        if (timeRange <= 60) bucketSizeMs = 1 * 60 * 1000;
        else if (timeRange <= 360) bucketSizeMs = 15 * 60 * 1000;
        else if (timeRange <= 720) bucketSizeMs = 30 * 60 * 1000;
        else if (timeRange <= 1440) bucketSizeMs = 240 * 60 * 1000; // 4 Hours for 24h

        const now = new Date();
        const startTime = new Date(now.getTime() - timeRange * 60 * 1000);

        const alignedStart = new Date(Math.floor(startTime.getTime() / bucketSizeMs) * bucketSizeMs);
        const alignedEnd = new Date(Math.ceil(now.getTime() / bucketSizeMs) * bucketSizeMs);

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

                const status = dims.edgeResponseStatus;
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
        const firewallGroups = result?.firewallData || [];
        const realAttackEvents = [];

        firewallGroups.forEach(g => {
            const action = g.dimensions?.action;
            const targetActions = new Set(['block', 'challenge', 'js_challenge', 'jschallenge', 'managed_challenge']);

            if (targetActions.has(action)) {
                if (g.dimensions?.datetimeMinute) {
                    const itemTime = new Date(g.dimensions.datetimeMinute).getTime();
                    const bucketTime = Math.floor(itemTime / bucketSizeMs) * bucketSizeMs;
                    if (attackBuckets.has(bucketTime)) {
                        attackBuckets.get(bucketTime).count += g.count;
                    }

                    realAttackEvents.push({
                        time: new Date(g.dimensions.datetimeMinute),
                        action: action,
                        count: g.count
                    });
                }
            }
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
            } else if (lowerSource === 'accessrules' || lowerSource === 'ip_access_rules' || lowerSource === 'ip' || lowerSource === 'country' || lowerSource === 'asn' || lowerSource === 'ipaddress' || lowerSource === 'ip_access_rule') {
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

    // Updated handleBatchReport to accept timeRange and templateId
    const handleBatchReport = async (selectedHosts, batchTimeRange, templateId = 'default') => {
        setIsGeneratingReport(true);
        setIsBatchModalOpen(false);

        // Progress tracking
        // Progress tracking
        let progressLogs = []; // Full history for final summary
        let displayLogs = [];  // Current display state for modal

        const updateProgress = (message, type = 'info', isReplace = false, showSpinner = true) => {
            const icons = { info: '📝', success: '✅', warning: '⚠️', error: '❌', step: '🔄' };
            const icon = icons[type] || '📝';
            const logEntry = `${icon} ${message}`;

            // Always add to full history
            progressLogs.push(logEntry);

            // Update display logs
            if (isReplace && displayLogs.length > 0) {
                displayLogs[displayLogs.length - 1] = logEntry;
            } else {
                displayLogs.push(logEntry);
            }

            if (message.includes('Processing:')) {
                displayLogs = [logEntry];
            }

            // Update modal content
            const logHtml = displayLogs.join('<br/>');
            Swal.update({
                html: `
                    <div style="text-align: left; font-family: monospace; font-size: 14px; min-height: 100px; display: flex; flex-direction: column; justify-content: center;">
                        ${logHtml}
                    </div>
                `
            });
            // Conditionally show spinner
            if (showSpinner) {
                Swal.showLoading();
            } else {
                Swal.hideLoading();
            }
        };

        // Show blocked loading popup
        Swal.fire({
            title: 'Generating Batch Reports...',
            html: `
                <div style="text-align: left; font-family: monospace; font-size: 12px; max-height: 400px; overflow-y: auto;">
                    📝 Initializing batch report generation...
                </div>
                <div class="text-sm text-gray-400 mt-4">Do not close this window.</div>
            `,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            },
            background: '#111827',
            color: '#fff'
        });

        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
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

        try {
            // 0. Generate Domain Report (First Page)
            updateProgress('Step 0: Creating Document Structure...', 'step');
            console.log('Creating Document Structure from staticReportTemplate.json...');

            // ALWAYS load from JSON file - no fallback
            let domainTemplateContent, subReportTemplateContent;
            try {
                const tid = templateId || 'default';
                domainTemplateContent = await loadStaticTemplate(tid);
                subReportTemplateContent = await loadTemplate(tid);

                if (!domainTemplateContent || !subReportTemplateContent) {
                    throw new Error('Template file is empty or invalid (ID: ' + tid + ')');
                }
                updateProgress('✓ Loaded Report Templates (Domain & Sub-reports)', 'success');
                console.log('✓ Loaded Report Templates');
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

            // Prepare basic data for Domain Report using current state/props + zoneSettings if available
            updateProgress('Fetching zone configurations...', 'step');

            // --- PRE-STEP: ENSURE DATA IS LOADED ---
            // Ensure Zone Data is loaded (DNS & Settings) for both Domain Report (Cover) and Batch Reports
            let localDnsRecords = dnsRecords;
            let localZoneSettings = zoneSettings;

            try {
                if (!localDnsRecords || localDnsRecords.length === 0) {
                    console.log('⚠️ DNS Records missing in state, fetching for report...');
                    updateProgress('Fetching DNS Records...', 'step');
                    const dnsRes = await callAPI('get-dns-records', { zoneId: selectedZone });
                    if (dnsRes && dnsRes.data) {
                        localDnsRecords = dnsRes.data;
                    }
                }

                if (!localZoneSettings || !localZoneSettings.ipAccessRules || !localZoneSettings.customRules) {
                    console.log('⚠️ Zone Settings missing/incomplete in state, fetching for report...');
                    updateProgress('Fetching Zone Settings...', 'step');
                    const settingsRes = await callAPI('get-zone-settings', { zoneId: selectedZone });
                    if (settingsRes && settingsRes.data) {
                        localZoneSettings = settingsRes.data;
                    }
                }
            } catch (fetchErr) {
                console.error('Error fetching report prerequisites:', fetchErr);
            }

            // Use verified LOCAL data
            // Fetch Zone-Wide Stats FIRST (Fix: stats is not defined)
            updateProgress('Fetching Zone-wide Statistics...', 'step');
            const zoneStats = await fetchAndApplyTrafficData('ALL_SUBDOMAINS', selectedZone, batchTimeRange) || {
                zoneWideRequests: 0,
                zoneWideCacheRequests: 0,
                zoneWideDataTransfer: 0,
                zoneWideCacheDataTransfer: 0,
                zoneWideTopCountriesReq: [],
                zoneWideTopCountriesBytes: [],
                fwEvents: { total: 0, managed: 0, custom: 0, bic: 0, access: 0 }
            };

            const domainReportData = {
                domain: zones.find(z => z.id === selectedZone)?.name,
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
                timeRange: timeRange,
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


            // Process HTML
            updateProgress('Filling the Document Template using zone configurations...', 'step');
            const domainReportHtml = processTemplate(domainTemplateContent, domainReportData, new Date());


            // Add to combined HTML
            combinedHtml += `<div class="page-break">${domainReportHtml}</div>`;
            updateProgress('✓ Filled the Document Template using zone configurations', 'success');





            let processedCount = 0;
            let failedHosts = [];

            updateProgress(`Starting to process ${selectedHosts.length} hosts...`, 'info');

            for (let i = 0; i < selectedHosts.length; i++) {
                const host = selectedHosts[i];
                updateProgress(`[${i + 1}/${selectedHosts.length}] Processing: ${host}`, 'info');
                console.log(`\n${'='.repeat(60)}`);
                console.log(`📊 [${i + 1}/${selectedHosts.length}] Processing: ${host}`);
                console.log(`${'='.repeat(60)}`);

                try {
                    const hostStartTime = performance.now();

                    // 1. Switch Domain and Fetch Data
                    updateProgress(`Step 1/5: Fetching traffic data...`, 'step');
                    console.log(`🔄 Step 1/5: Switching to domain and fetching traffic data...`);

                    const apiStart = performance.now();
                    setSelectedSubDomain(host);
                    // USE batchTimeRange HERE
                    const stats = await fetchAndApplyTrafficData(host, selectedZone, batchTimeRange);
                    const apiEnd = performance.now();
                    const apiDuration = ((apiEnd - apiStart) / 1000).toFixed(2);

                    updateProgress(`Step 1/5: Data fetched (${apiDuration}s)`, 'step', true); // Replace previous line
                    console.log(`✅ Data fetched in ${apiDuration}s`);

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
                    const renderStart = performance.now();
                    updateProgress(`Step 2/5: Waiting for render (2s)...`, 'step', true); // Replace previous line
                    console.log(`⏳ Step 2/5: Waiting for dashboard render (2s)...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const renderEnd = performance.now();
                    const renderDuration = ((renderEnd - renderStart) / 1000).toFixed(2);
                    updateProgress(`Step 2/5: Render wait complete (${renderDuration}s)`, 'success', true);
                    console.log(`✅ Render complete in ${renderDuration}s`);

                    // 3. Capture Screenshot
                    const screenStart = performance.now();
                    updateProgress(`Step 3/5: Capturing screenshot...`, 'step', true); // Replace previous line
                    console.log(`📸 Step 3/5: Capturing screenshot...`);
                    let imgData = null;
                    if (dashboardRef.current) {
                        try {
                            // Race between screenshot and 15s timeout
                            imgData = await Promise.race([
                                htmlToImage.toJpeg(dashboardRef.current, {
                                    quality: 0.6, // Reduce quality slightly for speed
                                    backgroundColor: '#000000',
                                    pixelRatio: 1.0 // Reduce pixel ratio for speed (was 1.5)
                                }),
                                new Promise((_, reject) => setTimeout(() => reject(new Error('Screenshot timeout (15s)')), 15000))
                            ]);

                            const screenEnd = performance.now();
                            const screenDuration = ((screenEnd - screenStart) / 1000).toFixed(2);
                            updateProgress(`Step 3/5: Screenshot captured (${screenDuration}s)`, 'success', true);
                            console.log(`✅ Screenshot captured in ${screenDuration}s`);
                        } catch (imgError) {
                            console.warn(`⚠️ Screenshot failed for ${host}:`, imgError);
                            updateProgress(`Step 3/5: Screenshot failed (Timeout), continuing...`, 'warning', true);
                            console.log(`⚠️ Continuing without screenshot`);
                        }
                    } else {
                        updateProgress(`Step 3/5: Skipped screenshot (No ref)`, 'warning', true);
                        console.log(`⚠️ Dashboard ref not available, skipping screenshot`);
                    }

                    // 4. Prepare Data for Template
                    updateProgress(`Step 4/5: Preparing template data...`, 'step', true);
                    console.log(`📋 Step 4/5: Preparing template data...`);
                    const currentReportData = {
                        domain: host,
                        timeRange: timeRange,
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
                        zoneName: zones.find(z => z.id === selectedZone)?.name,

                        // Added missing fields for Batch Report Template placeholders (using Verified Local Data)
                        dnsRecords: localDnsRecords,
                        ipAccessRules: localZoneSettings?.ipAccessRules,
                        customRules: localZoneSettings?.customRules,
                        rateLimits: localZoneSettings?.rateLimits
                    };
                    updateProgress(`Step 4/5: Data prepared`, 'success', true);
                    console.log(`✅ Data prepared`);

                    // 5. Generate HTML
                    const htmlStart = performance.now();
                    updateProgress(`Step 5/5: Generating HTML...`, 'step', true);
                    console.log(`🔨 Step 5/5: Generating HTML report using template: ${templateId}...`);
                    let reportHtml = processTemplate(subReportTemplateContent, currentReportData, new Date());

                    // Insert Image at the top if captured
                    if (imgData) {
                        reportHtml = `<img src="${imgData}" width="600" style="width: 500px; height: auto; display: block; margin: 0 auto 20px auto;" />` + reportHtml;
                    }

                    const htmlEnd = performance.now();
                    const htmlDuration = ((htmlEnd - htmlStart) / 1000).toFixed(2);

                    const hostTotalTime = ((performance.now() - hostStartTime) / 1000).toFixed(2);
                    updateProgress(`Step 5/5: Completed in ${hostTotalTime}s`, 'success', true);
                    console.log(`✅ Host [${i + 1}/${selectedHosts.length}] completed in ${hostTotalTime}s`);

                    // Add to combined HTML with page break
                    combinedHtml += `<div class="${i === selectedHosts.length - 1 ? '' : 'page-break'}">${reportHtml}</div>`;
                    processedCount++;

                } catch (hostError) {
                    console.error(`❌ Error processing ${host}:`, hostError);
                    updateProgress(`❌ Error processing ${host}: ${hostError.message}`, 'error');
                    failedHosts.push(host);
                    // Continue with next host instead of failing entire batch
                    continue;
                }
            }

            // 6. Download the final Word document
            updateProgress(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'info');
            updateProgress(`Generating final Word document...`, 'step');
            console.log(`\n${'='.repeat(60)}`);
            console.log(`📥 Generating final Word document...`);
            const sourceHTML = header + combinedHtml + footer;
            const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
            const fileDownload = document.createElement("a");
            document.body.appendChild(fileDownload);
            fileDownload.href = source;
            fileDownload.download = `batch_report_${new Date().getTime()}.doc`;
            fileDownload.click();
            document.body.removeChild(fileDownload);
            updateProgress(`✓ File download initiated`, 'success', true);
            console.log(`✅ File download initiated`);



            // Final Update to the EXISTING modal (keep logs visible)
            updateProgress(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'info');
            updateProgress(`Summary: ${processedCount}/${selectedHosts.length} completed`, 'success', false, false);

            // Show OK button and update title
            Swal.update({
                title: 'Batch Report Completed',
                icon: processedCount > 0 ? 'success' : 'warning',
                showConfirmButton: true,
                confirmButtonText: 'OK, Close',
                allowOutsideClick: true,
                didOpen: () => {
                    Swal.hideLoading(); // FORCE HIDE SPINNER
                },
                html: `
                    <div style="text-align: left;">
                        <p class="mb-2">✅ Generated: <b>${processedCount}</b> / ${selectedHosts.length} hosts.</p>
                        ${failedHosts.length > 0 ? `<p class="text-red-400 mb-2">❌ Failed: ${failedHosts.join(', ')}</p>` : ''}
                        
                        <div style="font-family: monospace; font-size: 12px; max-height: 400px; overflow-y: auto; background: #0f172a; padding: 10px; rounded: 4px; border: 1px solid #334155;">
                            ${progressLogs.join('<br/>')}
                        </div>
                        <div class="text-sm text-green-400 mt-4 text-center">Batch process finished. You can close this window.</div>
                    </div>
                `
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
                // Show error on webpage
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
                return null;
            }

            return result;
        } catch (err) {
            console.error('API Error:', err);
            // Show network error on webpage
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
            if (defaultAcc) {
                console.log('✅ Auto-selecting Account (Config Match):', defaultAcc.name);
                handleAccountChange(defaultAcc.id, true, tokenOverride);
            } else if (result.data.length > 0) {
                console.log('⚠️ Default account not found, falling back to first available account:', result.data[0].name);
                handleAccountChange(result.data[0].id, true, tokenOverride);
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
                if (defaultZone) {
                    console.log('✅ Auto-selecting Zone (Config Match):', defaultZone.name);
                    setSelectedZone(defaultZone.id);
                } else {
                    console.log('⚠️ Default zone not found, falling back to first available zone:', result.data[0].name);
                    setSelectedZone(result.data[0].id);
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

        const loadDNS = async () => {
            setLoadingDNS(true); setSelectedSubDomain(''); setSubDomains([]);
            const dnsRes = await callAPI('get-dns-records', { zoneId: selectedZone });
            const allHosts = new Set();
            if (dnsRes && dnsRes.data) {
                dnsRes.data.forEach(rec => { if (['A', 'AAAA', 'CNAME'].includes(rec.type)) allHosts.add(rec.name); });
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

            // Add "All Subdomains" option (Rename as requested)
            hostOptions.unshift({ value: 'ALL_SUBDOMAINS', label: '--- All Subdomains (Root Domain) ---' });

            setSubDomains(hostOptions);

            const defaultSub = hostOptions.find(h => (h.value || '').trim().toLowerCase() === DEFAULT_CONFIG.subDomain.trim().toLowerCase());
            if (defaultSub) {
                console.log('✅ Auto-selecting Subdomain:', defaultSub.value);
                setSelectedSubDomain(defaultSub.value);
            } else {
                setSelectedSubDomain('ALL_SUBDOMAINS');
            }

            setLoadingDNS(false);
        };
        loadDNS();

        // Fetch Zone Settings
        const fetchSettings = async () => {
            const result = await callAPI('get-zone-settings', { zoneId: selectedZone });
            if (result && result.data) {
                setZoneSettings(result.data);
                console.log('✅ Zone Settings:', result.data);
            }
        };
        fetchSettings();

        // Fetch DNS Records
        const fetchDNS = async () => {
            const result = await callAPI('get-dns-records', { zoneId: selectedZone });
            if (result && result.data) {
                setDnsRecords(result.data);
                console.log('✅ DNS Records Count:', result.data.length);
            }
        };
        fetchDNS();
    }, [selectedZone]);



    // 4. Subdomain Selected -> Fetch Traffic
    useEffect(() => {
        if (!selectedSubDomain) { resetDashboardData(); return; }
        // Manual Generation Requested: Do not auto-fetch on selection change
        // Only reset data to avoid showing stale data for wrong domain
        resetDashboardData();
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
    }, []);

    // -- TEMPLATE MANAGEMENT STATE --
    const [isManageTemplateModalOpen, setIsManageTemplateModalOpen] = useState(false);
    const [templateToEditId, setTemplateToEditId] = useState('default');

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

    // -- TEMPLATE EDIT HANDLERS --
    const onEditSub = async (id) => {
        // Keep manage modal open in background
        setTemplateToEditId(id);
        const content = await loadTemplate(id);
        if (content !== null) setReportTemplate(content);
        setReportModalMode('report');
        setIsReportModalOpen(true);
    };

    const onEditDomain = async (id) => {
        // Keep manage modal open in background
        setTemplateToEditId(id);
        const content = await loadStaticTemplate(id);
        if (content !== null) setStaticReportTemplate(content);
        setReportModalMode('static-template');
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
            const imgData = await htmlToImage.toJpeg(element, {
                quality: 0.8, backgroundColor: '#000000', pixelRatio: 1.5
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
        timeRange: timeRange,
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

    return (
        <div className={`min-h-screen font-sans ${theme.bg} ${theme.text}`}>
            <nav className={`border-b ${theme.nav === 'bg-[#0f1115]' ? 'border-gray-800' : ''} ${theme.nav} sticky top-0 z-50`}>
                <div className="w-full px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
                            <LayoutDashboard className={`w-5 h-5 ${theme.accent}`} />
                            <h1 className={`text-sm font-bold ${theme.text}`}>GDCC <span className={theme.subText}>Analytics</span></h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">

                        {/* CREATE REPORT BUTTON */}
                        <button
                            onClick={() => setIsBatchModalOpen(true)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs transition-colors"
                        >
                            <List className="w-3 h-3" /> Create Report
                        </button>

                        {/* SETTINGS DROPDOWN (with Report Template submenu) */}
                        <div className="relative">
                            <button
                                onClick={() => setIsReportMenuOpen(!isReportMenuOpen)}
                                className={`flex items-center gap-2 ${theme.button} px-3 py-1.5 rounded text-xs transition-colors border border-gray-700`}
                            >
                                <Settings className="w-3 h-3" />
                                <svg className={`w-3 h-3 transition-transform ${isReportMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {isReportMenuOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-[60] animate-fade-in-up">
                                    {/* Manage Template Button (Replaces Submenu) */}
                                    <div className="border-t border-gray-700/50 pt-1 mt-1">
                                        <button
                                            onClick={() => { setIsReportMenuOpen(false); setIsTemplateSubmenuOpen(false); setIsManageTemplateModalOpen(true); }}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2"
                                        >
                                            <FileText className="w-3 h-3" /> Manage Template
                                        </button>
                                    </div>

                                    {/* Theme Settings (Refactored to Submenu) */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsThemeSubmenuOpen(!isThemeSubmenuOpen)}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center justify-between"
                                        >
                                            <span className="flex items-center gap-2">
                                                <Activity className="w-3 h-3" /> Theme {/* Using Activity as placeholder icon */}
                                            </span>
                                            <svg className={`w-3 h-3 transition-transform ${isThemeSubmenuOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </button>

                                        {/* Submenu */}
                                        {isThemeSubmenuOpen && (
                                            <div className="bg-gray-900 border-t border-gray-700 shadow-inner">
                                                {Object.values(THEMES).map(t => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => { setCurrentTheme(t.id); setIsReportMenuOpen(false); setIsThemeSubmenuOpen(false); }}
                                                        className={`w-full text-left px-8 py-2 text-xs flex items-center gap-2 hover:bg-gray-800 ${currentTheme === t.id ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'}`}
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
                template={reportModalMode === 'static-template' ? staticReportTemplate : reportTemplate}
                onSaveTemplate={reportModalMode === 'static-template' ? handleSaveStaticTemplate : handleSaveTemplate}
                onGenerate={captureAndGenerateReport} // NEW PROP
                mode={reportModalMode}
            />

            <ManageTemplateModal
                isOpen={isManageTemplateModalOpen}
                onClose={() => setIsManageTemplateModalOpen(false)}
                onEditSub={onEditSub}
                onEditDomain={onEditDomain}
            />

            <BatchReportModal
                isOpen={isBatchModalOpen}
                onClose={() => setIsBatchModalOpen(false)}
                hosts={getBatchHosts()}
                onConfirm={handleBatchReport}
            />

            <main ref={dashboardRef} className="p-4 min-h-screen">

                {/* SELECTORS */}
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4 p-5 rounded-xl border border-dashed ${theme.selectorContainer}`}>
                    <SearchableDropdown theme={theme} icon={<Key className="w-4 h-4 text-blue-400" />} label="Select Account" placeholder={loading ? "Loading..." : "Choose an account..."} options={accounts.map(acc => ({ value: acc.id, label: acc.name, subtitle: `ID: ${acc.id}` }))} value={selectedAccount} onChange={(val) => handleAccountChange(val, false)} loading={loading && accounts.length === 0} />
                    <SearchableDropdown theme={theme} icon={<Server className="w-4 h-4 text-green-400" />} label="Select Zone (Domain)" placeholder={!selectedAccount ? "Select Account first" : loadingZones ? "Loading..." : "Choose a zone..."} options={zones.map(zone => ({ value: zone.id, label: zone.name, subtitle: zone.status }))} value={selectedZone} onChange={setSelectedZone} loading={loadingZones} />
                    <SearchableDropdown theme={theme} icon={<Globe className="w-4 h-4 text-purple-400" />} label="Select Subdomain" placeholder={!selectedZone ? "Select Zone first" : "Choose Subdomain..."} options={subDomains} value={selectedSubDomain} onChange={setSelectedSubDomain} loading={loadingDNS && subDomains.length === 0} />
                </div>

                {/* ACTIONS & TIME RANGE */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                    {/* Manual Generate Button */}
                    <button
                        onClick={() => fetchAndApplyTrafficData(selectedSubDomain, selectedZone, timeRange)}
                        disabled={!selectedSubDomain || loadingStats}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold shadow-lg transition-all border ${!selectedSubDomain || loadingStats
                            ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 border-blue-500 hover:bg-blue-500 text-white hover:shadow-blue-500/20 active:scale-95'
                            }`}
                    >
                        {loadingStats ? <Activity className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                        {loadingStats ? 'GENERATING...' : 'GENERATE DASHBOARD'}
                    </button>

                    <div className="flex justify-end">
                        <div className="bg-gray-900 border border-gray-800 rounded-lg p-1 flex gap-1">
                            {[{ label: '1d', val: 1440 }, { label: '7d', val: 10080 }, { label: '30d', val: 43200 }].map(t => (
                                <button key={t.val} onClick={() => setTimeRange(t.val)} className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${timeRange === t.val ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>{t.label}</button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* DASHBOARD */}
                <div className={`space-y-4 transition-all duration-500 ${selectedSubDomain && hasGenerated && !loadingStats ? 'opacity-100 filter-none' : 'opacity-40 grayscale blur-sm'}`}>

                    {/* STATS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card theme={theme} title="Total Requests"><div className="flex items-baseline gap-2"><span className="text-6xl font-bold text-blue-400">{totalRequests.toLocaleString()}</span><span className="text-xl font-thai opacity-60">Req</span></div></Card>
                        <Card theme={theme} title="Avg Response Time (TTFB)"><div className="flex items-baseline gap-2"><span className="text-6xl font-bold text-purple-400">{avgResponseTime}</span><span className="text-xl opacity-60">ms</span></div></Card>
                        <Card theme={theme} title="Blocked Events"><div className="flex items-baseline gap-2"><span className="text-6xl font-bold text-orange-400">{blockedEvents}</span><span className="text-xl font-thai opacity-60">Events</span></div></Card>
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
                        <Card theme={theme} title="Top URLs"><HorizontalBarList data={topUrls} labelKey="path" valueKey="count" /></Card>
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
                        <Card theme={theme} title="Top Client IPs"><HorizontalBarList data={topIps} labelKey="ip" valueKey="count" color="bg-cyan-600" /></Card>
                        <Card theme={theme} title="Top User Agents"><HorizontalBarList data={topUserAgents} labelKey="agent" valueKey="count" color="bg-indigo-600" /></Card>
                        <Card theme={theme} title="Top Countries"><HorizontalBarList data={topCountries} labelKey="name" valueKey="count" color="bg-blue-800" /></Card>
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
                                <div className="h-20 overflow-y-auto mt-2 border-t border-gray-800 pt-2 bg-gray-950/50 rounded">
                                    {detailedAttackList.length === 0 ? (
                                        <div className="text-gray-500 text-[10px] text-center italic py-2">No attack events in this period</div>
                                    ) : (
                                        <table className="w-full text-xs text-gray-400">
                                            <tbody>
                                                {detailedAttackList.map((d, i) => (
                                                    <tr key={i} className="border-b border-gray-900/50 hover:bg-gray-900">
                                                        <td className="py-1 pl-2 text-gray-500 font-mono">
                                                            {d.time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="py-1 px-2 text-orange-400 font-semibold text-[10px]">{formatActionName(d.action)}</td>
                                                        <td className="py-1 pr-2 text-right text-red-400 font-bold">{d.count}</td>
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
                                                key={code}
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
                                <HorizontalBarList data={topRules} labelKey="rule" valueKey="count" color="bg-orange-600" />
                            </div>
                        </Card>
                        <Card theme={theme} title="Top 5 Attackers">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left text-gray-400">
                                    <thead className="text-gray-500 uppercase font-bold border-b border-gray-800">
                                        <tr>
                                            <th className="py-2 pl-2">IP</th>
                                            <th className="py-2">Country</th>
                                            <th className="py-2 text-right">Count</th>
                                            <th className="py-2 pr-2 text-right">Type</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800/50">
                                        {topAttackers.length === 0 ? (
                                            <tr><td colSpan="4" className="text-center py-4 italic">No attackers found</td></tr>
                                        ) : (
                                            topAttackers.slice(0, 5).map((attacker, i) => (
                                                <tr key={i} className={`${theme.tableRowHover} transition-colors`}>
                                                    <td className="py-2 pl-2 font-mono text-blue-400">{attacker.ip}</td>
                                                    <td className="py-2 text-gray-300">{attacker.country}</td>
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
                                <div className="grid grid-cols-8 gap-2 border-b border-gray-800 pb-2 mb-2 font-bold text-gray-300 min-w-[900px]">
                                    <div className="col-span-1">Time</div>
                                    <div className="col-span-2">Host</div><div className="col-span-1">IP</div><div className="col-span-1">Country</div>
                                    <div className="col-span-1">Status</div><div className="col-span-1">Device</div><div className="col-span-1 text-right">Count</div>
                                </div>
                                {rawData.slice(0, 10).map((item, i) => (
                                    <div key={i} className={`grid grid-cols-8 gap-2 ${theme.tableRowHover} transition-colors py-1 border-b border-gray-900/50 min-w-[900px] items-center`}>
                                        <div className="col-span-1 text-gray-500">
                                            {item.dimensions?.datetimeMinute ? new Date(item.dimensions.datetimeMinute).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </div>
                                        <div className="col-span-2 text-green-400 truncate pr-2">{item.dimensions?.clientRequestHTTPHost}</div>
                                        <div className="col-span-1 text-blue-400 truncate">{item.dimensions?.clientIP}</div>
                                        <div className="col-span-1 text-gray-500 truncate">{item.dimensions?.clientCountryName}</div>
                                        <div className="col-span-1 text-yellow-400 truncate">{item.dimensions?.edgeResponseStatus}</div>
                                        <div className="col-span-1 text-purple-400 truncate">{item.dimensions?.clientDeviceType}</div>
                                        <div className="col-span-1 text-white font-bold text-right">{item.count}</div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>

                </div>
            </main>
        </div>
    );
}
