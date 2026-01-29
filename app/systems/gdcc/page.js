'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/app/utils/auth';
import { loadTemplate, saveTemplate, loadStaticTemplate, saveStaticTemplate } from '@/app/utils/templateApi';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
    ShieldAlert, Activity, Clock, Globe,
    AlertTriangle, FileText, LayoutDashboard, Database,
    Search, Bell, Menu, Download, Server, Key, List, X, Edit3, Copy, FileType
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

    html = html.replace(/@DNS_TOTAL_ROWS/g, dnsRowsHtml);

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
            accountRules.forEach(rule => {
                const actionDisplay = rule.action.charAt(0).toUpperCase() + rule.action.slice(1); // Capitalize first letter
                ipAccessRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${rule.ip}</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">${actionDisplay}</span></p></td></tr>`;
            });

            console.log(`Generated ${accountRules.length} IP Access Rule rows (account-level) for domain report`);
        }

        if (zoneRules.length > 0) {
            // Header for Zone rules
            ipAccessRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">Applies to: This website</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';"> </span></p></td></tr>`;

            // Zone rules rows
            zoneRules.forEach(rule => {
                const actionDisplay = rule.action.charAt(0).toUpperCase() + rule.action.slice(1);
                ipAccessRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${rule.ip}</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">${actionDisplay}</span></p></td></tr>`;
            });
            console.log(`Generated ${zoneRules.length} IP Access Rule rows (zone-level) for domain report`);
        }
    } else {
        console.log('No IP Access Rules found for domain report');
    }

    html = html.replace(/@IP_ACCESS_RULES_ROWS/g, ipAccessRulesHtml);

    // Custom Rules - Real data from API
    let customRulesHtml = '';
    if (safeData.customRules && safeData.customRules.rules && safeData.customRules.rules.length > 0) {
        safeData.customRules.rules.forEach(rule => {
            // Use 8-space indent for the description
            const indent = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
            // Show Action if Enabled, otherwise Disabled
            const actionRaw = rule.status === 'Disabled' ? 'Disabled' : (rule.action || rule.status);
            const actionDisplay = actionRaw.charAt(0).toUpperCase() + actionRaw.slice(1);

            customRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">${indent}${rule.description}</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">${actionDisplay}</span></p></td></tr>`;
        });
    }
    html = html.replace(/@CUSTOM_RULES_ROWS/g, customRulesHtml);

    // Rate Limiting Rules - Real data from API
    let rateLimitRulesHtml = '';
    if (safeData.rateLimits && safeData.rateLimits.rules && safeData.rateLimits.rules.length > 0) {
        safeData.rateLimits.rules.forEach(rule => {
            // Use 8-space indent for the description
            const indent = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
            // Show Action if Enabled, otherwise Disabled
            const actionRaw = rule.status === 'Disabled' ? 'Disabled' : (rule.action || rule.status);
            const actionDisplay = actionRaw.charAt(0).toUpperCase() + actionRaw.slice(1);

            rateLimitRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">${indent}${rule.description}</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK',sans-serif; mso-fareast-font-family: 'Times New Roman';">${actionDisplay}</span></p></td></tr>`;
        });
    }
    html = html.replace(/@RATE_LIMITING_RULES_ROWS/g, rateLimitRulesHtml);

    // Now do simple text replacements
    for (const [key, val] of Object.entries(replacements)) {
        html = html.split(key).join(val);
    }

    // 2. Table Generators

    // Top URLs Table
    const topUrlsHtml = generateHtmlTable(
        [
            { label: 'ลำดับ', width: '10%', align: 'center' },
            { label: 'รายการ (URL)', width: '70%' },
            { label: 'จำนวน (Count)', width: '20%', align: 'right' }
        ],
        (safeData.topUrls || []).slice(0, 3).map((item, idx) => [idx + 1, item.path, item.count.toLocaleString()])
    );
    html = html.replace('@TOP_URLS_LIST', topUrlsHtml);

    // Top IPs Table
    const topIpsHtml = generateHtmlTable(
        [
            { label: 'Client IP', width: '70%' },
            { label: 'จำนวน (Count)', width: '30%', align: 'right' }
        ],
        (safeData.topIps || []).slice(0, 3).map(item => [item.ip, item.count.toLocaleString()])
    );
    html = html.replace('@TOP_IPS_LIST', topIpsHtml);

    // Top Rules Table
    const topRulesHtml = generateHtmlTable(
        [
            { label: 'Rule Name (ID)', width: '70%' },
            { label: 'จำนวน (Count)', width: '30%', align: 'right' }
        ],
        (safeData.topRules || []).slice(0, 3).map(item => [item.rule, item.count.toLocaleString()])
    );
    html = html.replace('@TOP_RULES_LIST', topRulesHtml);

    // Top Attackers Table
    const topAttackersHtml = generateHtmlTable(
        [
            { label: 'IP' },
            { label: 'ประเทศ (Country)' },
            { label: 'จำนวน (Count)', align: 'right' },
            { label: 'ประเภท (Type)' }
        ],
        (safeData.topAttackers || []).slice(0, 5).map(item => [item.ip, item.country, item.count.toLocaleString(), item.type])
    );
    html = html.replace('@TOP_ATTACKERS_LIST', topAttackersHtml);

    // Top Sources Table
    const topSourcesHtml = generateHtmlTable(
        [
            { label: 'Type (Security Source)', width: '70%' },
            { label: 'จำนวน (Count)', width: '30%', align: 'right' }
        ],
        (safeData.topFirewallSources || []).slice(0, 5).map(item => [item.source, item.count.toLocaleString()])
    );
    html = html.replace('@TOP_SOURCES_LIST', topSourcesHtml);

    // 3. Cleanup Empty Rows (Remove rows with no text content)
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

    return html;
};

// 1. Report Modal Component
const ReportModal = ({ isOpen, onClose, data, dashboardImage, template, onSaveTemplate, onGenerate, mode = 'report' }) => {
    // mode: 'report' | 'static-template'

    // If no template passed, use default (fallback)
    const currentTemplate = template || DEFAULT_TEMPLATE;

    // Default to editing in static mode, preview in report mode
    const [isEditing, setIsEditing] = useState(false);
    const [localTemplate, setLocalTemplate] = useState(currentTemplate);
    const reportContentRef = useRef(null);
    const editorRef = useRef(null);

    // Sync local template when prop changes
    useEffect(() => {
        setLocalTemplate(template || DEFAULT_TEMPLATE);
    }, [template, isOpen]);

    // Sync mode when opening
    useEffect(() => {
        if (isOpen) {
            setIsEditing(false);
        }
    }, [isOpen]);

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
            "ul, ol { list-style-type: disc; padding-left: 20px; margin-bottom: 0px; }" +
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
            cleanHTML = cleanHTML.replace(/(<\/ul>|<\/ol>)[\s\S]*?(<table|<div)/gi, '$1$2');

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
        if (onSaveTemplate) onSaveTemplate(localTemplate);
        setIsEditing(false);
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-7xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-950/50 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <h3 className="text-lg font-bold text-gray-100">
                            {mode === 'static-template'
                                ? 'แบบฟอร์มรายงาน (Report Template Source)'
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
                                <div className="w-80 flex-shrink-0 flex flex-col bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <div className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2 sticky top-0 bg-gray-50 pb-2 border-b border-gray-300">
                                        <span className="bg-blue-500 text-white px-2 py-1 rounded">Variables</span>
                                        <span className="text-xs text-gray-500">Click to insert</span>
                                    </div>
                                    <div className="overflow-y-auto pr-2 space-y-4">
                                        {mode === 'report' ? (
                                            // Report Mode Variables
                                            <>
                                                {['@DAY', '@MONTH', '@YEAR', '@FULL_DATE', '@time_range', '@DOMAIN', '@ACCOUNT_NAME', '@ZONE_NAME', '@TOTAL_REQ', '@AVG_TIME', '@BLOCK_PCT', '@LOG_PCT',
                                                    '@PEAK_TIME', '@PEAK_COUNT', '@PEAK_ATTACK_TIME', '@PEAK_ATTACK_COUNT', '@PEAK_HTTP_TIME', '@PEAK_HTTP_COUNT',
                                                    '@TOP_UA_AGENT', '@TOP_UA_COUNT',
                                                    '@TOP_URLS_LIST', '@TOP_IPS_LIST',
                                                    '@TOP_RULES_LIST', '@TOP_ATTACKERS_LIST', '@TOP_SOURCES_LIST'].map(v => (
                                                        <button
                                                            key={v}
                                                            onClick={() => editorRef.current?.insertContent(v)}
                                                            className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-400 transition-all shadow-sm active:scale-95 mr-2 mb-2"
                                                            title={`Insert ${v}`}
                                                        >
                                                            {v}
                                                        </button>
                                                    ))}
                                            </>
                                        ) : (
                                            // Static Template Mode - Grouped by Category
                                            <>
                                                {/* ข้อมูลพื้นฐาน */}
                                                <div>
                                                    <div className="text-xs font-semibold text-gray-600 mb-2 pb-1 border-b border-gray-300">
                                                        ข้อมูลพื้นฐาน
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {['@DAY', '@MONTH', '@YEAR', '@FULL_DATE', '@ACCOUNT_NAME', '@ZONE_NAME', '@DNS_RECORDS'].map(v => (
                                                            <button
                                                                key={v}
                                                                onClick={() => editorRef.current?.insertContent(v)}
                                                                className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-400 transition-all shadow-sm active:scale-95"
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
                                                    <div className="flex flex-wrap gap-2">
                                                        {['@SECURITY_LEVEL', '@BOT_MANAGEMENT_STATUS', '@BLOCK_AI_BOTS',
                                                            '@DEFINITELY_AUTOMATED', '@LIKELY_AUTOMATED', '@VERIFIED_BOTS',
                                                            '@CLOUDFLARE_MANAGED_RULESET', '@OWASP_CORE_RULESET',
                                                            '@MANAGED_RULES_COUNT'].map(v => (
                                                                <button
                                                                    key={v}
                                                                    onClick={() => editorRef.current?.insertContent(v)}
                                                                    className="px-2 py-1 bg-white border border-blue-200 rounded text-xs font-mono text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-all shadow-sm active:scale-95"
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
                                                    <div className="flex flex-wrap gap-2">
                                                        {['@SSL_MODE', '@MIN_TLS_VERSION', '@TLS_1_3',
                                                            '@LEAKED_CREDENTIALS', '@BROWSER_INTEGRITY_CHECK', '@HOTLINK_PROTECTION'].map(v => (
                                                                <button
                                                                    key={v}
                                                                    onClick={() => editorRef.current?.insertContent(v)}
                                                                    className="px-2 py-1 bg-white border border-green-200 rounded text-xs font-mono text-green-700 hover:bg-green-50 hover:border-green-400 transition-all shadow-sm active:scale-95"
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
                                                    <div className="flex flex-wrap gap-2">
                                                        {['@DDOS_PROTECTION', '@HTTP_DDOS_PROTECTION', '@SSL_TLS_DDOS_PROTECTION', '@NETWORK_DDOS_PROTECTION',
                                                        ].map(v => (
                                                            <button
                                                                key={v}
                                                                onClick={() => editorRef.current?.insertContent(v)}
                                                                className="px-2 py-1 bg-white border border-red-200 rounded text-xs font-mono text-red-700 hover:bg-red-50 hover:border-red-400 transition-all shadow-sm active:scale-95"
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
                                                    <div className="flex flex-wrap gap-2">
                                                        {['@CUSTOM_RULES_STATUS', '@RULE_BYPASSWAF', '@RULE_BYPASS_EMAIL', '@RULE_BLOCK_URL',
                                                            '@RATE_LIMIT_RULES_STATUS', '@RULE_LOG_1000_REQ'].map(v => (
                                                                <button
                                                                    key={v}
                                                                    onClick={() => editorRef.current?.insertContent(v)}
                                                                    className="px-2 py-1 bg-white border border-purple-200 rounded text-xs font-mono text-purple-700 hover:bg-purple-50 hover:border-purple-400 transition-all shadow-sm active:scale-95"
                                                                    title={`Insert ${v}`}
                                                                >
                                                                    {v}
                                                                </button>
                                                            ))}
                                                    </div>
                                                </div>

                                                {/* 5. Table Variables */}
                                                <div>
                                                    <div className="text-xs font-semibold text-teal-700 mb-2 pb-1 border-b border-teal-300">
                                                        5. Table Variables
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {['@IP_ACCESS_RULES_ROWS', '@DNS_TOTAL_ROWS'].map(v => (
                                                            <button
                                                                key={v}
                                                                onClick={() => editorRef.current?.insertContent(v)}
                                                                className="px-2 py-1 bg-white border border-teal-200 rounded text-xs font-mono text-teal-700 hover:bg-teal-50 hover:border-teal-400 transition-all shadow-sm active:scale-95"
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


// Batch Report Modal Component
const BatchReportModal = ({ isOpen, onClose, hosts, onConfirm }) => {
    const [selected, setSelected] = useState(new Set());

    useEffect(() => {
        if (isOpen) {
            setSelected(new Set()); // Reset on open
        }
    }, [isOpen]);

    const toggleAll = () => {
        if (selected.size === hosts.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(hosts));
        }
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
                        Batch Report Selection
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 overflow-y-auto flex-1">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-400 text-sm">Select Sub-domains to include:</span>
                        <button onClick={toggleAll} className="text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors uppercase tracking-wider">
                            {selected.size === hosts.length && hosts.length > 0 ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                    {hosts.length === 0 ? (
                        <div className="text-center text-gray-500 py-8 text-sm italic">No sub-domains available.</div>
                    ) : (
                        <div className="space-y-2">
                            {hosts.map(host => (
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
                        onClick={() => onConfirm(Array.from(selected))}
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



function SearchableDropdown({ options, value, onChange, placeholder, label, loading, icon }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (option.subtitle && option.subtitle.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className="space-y-2 relative" ref={dropdownRef}>
            <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 mb-1">
                {icon}
                {label}
            </label>

            <div className="relative">
                <div
                    onClick={() => !loading && setIsOpen(!isOpen)}
                    className={`
             w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg cursor-pointer transition-all 
             flex items-center justify-between
             ${isOpen ? 'ring-2 ring-blue-500/50 border-blue-500' : 'hover:border-gray-500'}
          `}
                >
                    {isOpen ? (
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                            placeholder="Search..."
                            className="w-full bg-transparent outline-none text-sm text-white placeholder-gray-500"
                            autoFocus
                        />
                    ) : (
                        <span className={`text-sm ${selectedOption ? 'text-white' : 'text-gray-500'}`}>
                            {selectedOption ? selectedOption.label : placeholder}
                        </span>
                    )}
                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                {isOpen && (
                    <div className="absolute z-[100] w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {loading ? (
                            <div className="p-3 text-center text-xs text-gray-400">Loading...</div>
                        ) : filteredOptions.length === 0 ? (
                            <div className="p-3 text-center text-xs text-gray-400">No results found</div>
                        ) : (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.value}
                                    onMouseDown={() => handleSelect(option.value)}
                                    className={`
                    px-4 py-2 cursor-pointer transition-colors text-sm
                    ${value === option.value ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-300'}
                  `}
                                >
                                    <div className="font-medium">{option.label}</div>
                                    {option.subtitle && <div className="text-xs opacity-60">{option.subtitle}</div>}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

const Card = ({ title, children, className = '' }) => (
    <div className={`bg-gray-900 border border-gray-800 rounded-lg overflow-hidden ${className} pdf-card`}>
        <div className="bg-gray-900/50 p-3 border-b border-gray-800 flex justify-between items-center px-4 py-2">
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{title}</h3>
            <div className="flex gap-2">
                <Search className="w-3 h-3 text-gray-500 cursor-pointer hover:text-white" />
                <MoreMenuIcon />
            </div>
        </div>
        <div className="p-4">
            {children}
        </div>
    </div>
);

const MoreMenuIcon = () => (
    <svg className="w-3 h-3 text-gray-500 cursor-pointer hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
);

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

// --- MAIN COMPONENT ---

export default function GDCCPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState(null);

    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isReportMenuOpen, setIsReportMenuOpen] = useState(false); // NEW: Dropdown State
    const [dashboardImage, setDashboardImage] = useState(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [reportTemplate, setReportTemplate] = useState(DEFAULT_TEMPLATE);
    const [staticReportTemplate, setStaticReportTemplate] = useState(''); // Will be loaded from JSON file only
    const [reportModalMode, setReportModalMode] = useState('preview'); // 'preview' (report) or 'static-template'
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false); // NEW: Batch Modal State
    const dashboardRef = useRef(null);

    // --- DEFAULT CONFIG ---
    const DEFAULT_CONFIG = {
        accountName: "Cloudflare Training2",
        zoneName: "skeepmenot2.online",
        subDomain: "skeepmenot2.online"
    };

    // Selector States
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [zones, setZones] = useState([]);
    const [subDomains, setSubDomains] = useState([]);

    const [topRules, setTopRules] = useState([]);
    const [topAttackers, setTopAttackers] = useState([]);
    const [topFirewallSources, setTopFirewallSources] = useState([]);
    const [zoneSettings, setZoneSettings] = useState(null);
    const [dnsRecords, setDnsRecords] = useState([]);

    const [selectedAccount, setSelectedAccount] = useState('');
    const [selectedZone, setSelectedZone] = useState('');
    const [selectedSubDomain, setSelectedSubDomain] = useState('');
    const [timeRange, setTimeRange] = useState(1440); // Default 1d

    const fetchAndApplyTrafficData = async (subdomain, zoneId, timeRange) => {
        setLoadingStats(true);
        const isAllSubdomains = subdomain === 'ALL_SUBDOMAINS';
        console.log(`🔍 Fetching traffic for: ${isAllSubdomains ? 'ALL ZONES' : subdomain} (Range: ${timeRange}m)`);

        const result = await callAPI('get-traffic-analytics', {
            zoneId: zoneId,
            timeRange: timeRange,
            subdomain: isAllSubdomains ? null : subdomain
        });

        let filteredData = [];
        let totalReq = 0;
        let weightedAvgTime = 0;

        let blockedCount = 0;
        let logCount = 0;
        let topActions = [];
        let processedRules = [];
        let sortedAttackers = [];

        if (result && result.data) {
            filteredData = result.data;
            const firewallActivity = result.firewallActivity || [];
            const firewallRulesData = result.firewallRules || [];
            const firewallIPsData = result.firewallIPs || [];

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


            // --- AVG TTFB ---
            let totalTimeSum = 0;
            filteredData.forEach(item => {
                const count = item.count;
                const avgTime = item.avg?.edgeTimeToFirstByteMs || 0;
                totalReq += count;
                totalTimeSum += (avgTime * count);
            });
            if (totalReq > 0) weightedAvgTime = Math.round(totalTimeSum / totalReq);
        } else {
            setBlockedEvents(0); setLogEvents(0); setTopFirewallActions([]);
            setTopRules([]); setTopAttackers([]);
        }

        setRawData(filteredData);
        setTotalRequests(totalReq);
        setAvgResponseTime(weightedAvgTime);

        // --- DATA PROCESSING FOR CHARTS ---
        const urlCounts = {}; const ipCounts = {}; const countryCounts = {}; const uaCounts = {};
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
            const ua = dims.userAgent || 'Unknown';

            urlCounts[path] = (urlCounts[path] || 0) + count;
            ipCounts[ip] = (ipCounts[ip] || 0) + count;
            countryCounts[country] = (countryCounts[country] || 0) + count;
            uaCounts[ua] = (uaCounts[ua] || 0) + count;

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
        setTopUrls(toArray(urlCounts, 'path'));
        setTopIps(toArray(ipCounts, 'ip'));
        setTopCountries(toArray(countryCounts, 'name'));
        setTopUserAgents(toArray(uaCounts, 'agent'));

        // 8. Top Firewall Sources (Categories like WAF, Security Level)
        const sourceMap = new Map();
        (result.firewallSources || []).forEach(item => {
            const source = item.dimensions.source || 'Unknown';
            sourceMap.set(source, (sourceMap.get(source) || 0) + item.count);
        });
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
            // raw: result // optional
        };

        setLoadingStats(false);
        return stats;
    };

    // Handle Batch Report Logic
    const handleBatchReport = async (selectedHosts) => {
        setIsGeneratingReport(true);
        setIsBatchModalOpen(false);

        // Show blocked loading popup
        Swal.fire({
            title: 'Generating Batch Reports...',
            html: 'Please wait while we generate reports for multiple domains.<br/><span class="text-sm text-gray-400">Do not close this window.</span>',
            allowOutsideClick: false,
            allowEscapeKey: false,
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
            // Requirement: Use "static-template" (Domain Template) from JSON file ONLY
            console.log('Generating Domain Report (Template)...');

            // ALWAYS load from JSON file - no fallback
            let domainTemplateContent;
            try {
                const loaded = await loadStaticTemplate();
                if (!loaded) {
                    throw new Error('Static template file is empty or invalid');
                }
                domainTemplateContent = loaded;
                console.log('✓ Loaded static template from JSON file');
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
            // Note: zoneSettings might need to be fetched if not available in current scope, 
            // but user said "Call Domain Report function".
            // Since we are inside handleBatchReport, we might need to fetch settings fast or use what we have.
            // User instruction: "get-zone-settings for Config values" IS allowed/implied to get "Config status"
            // BUT "No get-traffic-analytics ALL_SUBDOMAINS".

            // We'll quickly fetch zone settings to ensure variables like @CUSTOM_RULES_STATUS work.
            const zoneSettingsResponse = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get-zone-settings', zoneId: selectedZone })
            });
            const zoneSettings = (await zoneSettingsResponse.json()).data || {};

            // Also fetch DNS records for @DNS_TOTAL_ROWS
            const dnsResponse = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get-dns-records', zoneId: selectedZone })
            });
            const dnsRecords = (await dnsResponse.json()).data || [];

            const domainReportData = {
                domain: zones.find(z => z.id === selectedZone)?.name || 'Unknown Zone',
                zoneName: zones.find(z => z.id === selectedZone)?.name || '-',
                accountName: accounts.find(a => a.id === selectedAccount)?.name || '-',
                timeRange: timeRange, // Pass timeRange if template uses it
                dnsRecords: dnsRecords,
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
                rateLimits: zoneSettings?.rateLimits
            };

            // Process HTML
            const domainReportHtml = processTemplate(domainTemplateContent, domainReportData, new Date());

            // Add to combined HTML
            combinedHtml += `<div class="page-break">${domainReportHtml}</div>`;


            let processedCount = 0;
            let failedHosts = [];

            for (let i = 0; i < selectedHosts.length; i++) {
                const host = selectedHosts[i];
                console.log(`Processing report ${i + 1}/${selectedHosts.length}: ${host}`);

                try {
                    // 1. Switch Domain and Fetch Data
                    setSelectedSubDomain(host);
                    const stats = await fetchAndApplyTrafficData(host, selectedZone, timeRange);

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
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // 3. Capture Screenshot
                    let imgData = null;
                    if (dashboardRef.current) {
                        try {
                            imgData = await htmlToImage.toJpeg(dashboardRef.current, {
                                quality: 0.8, backgroundColor: '#000000', pixelRatio: 1.5
                            });
                        } catch (imgError) {
                            console.warn(`⚠️ Screenshot failed for ${host}:`, imgError);
                            // Continue without screenshot
                        }
                    }

                    // 4. Prepare Data for Template
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
                        zoneName: zones.find(z => z.id === selectedZone)?.name
                    };

                    // 5. Generate HTML
                    let reportHtml = processTemplate(reportTemplate, currentReportData, new Date());

                    // Insert Image at the top if captured
                    if (imgData) {
                        reportHtml = `<img src="${imgData}" width="600" style="width: 500px; height: auto; display: block; margin: 0 auto 20px auto;" />` + reportHtml;
                    }

                    // Add to combined HTML with page break
                    combinedHtml += `<div class="${i === selectedHosts.length - 1 ? '' : 'page-break'}">${reportHtml}</div>`;
                    processedCount++;

                } catch (hostError) {
                    console.error(`❌ Error processing ${host}:`, hostError);
                    failedHosts.push(host);
                    // Continue with next host instead of failing entire batch
                    continue;
                }
            }

            // 6. Download the final Word document
            const sourceHTML = header + combinedHtml + footer;
            const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
            const fileDownload = document.createElement("a");
            document.body.appendChild(fileDownload);
            fileDownload.href = source;
            fileDownload.download = `batch_report_${new Date().getTime()}.doc`;
            fileDownload.click();
            document.body.removeChild(fileDownload);



            // Build success message with statistics
            let successMessage = `Successfully processed ${processedCount} out of ${selectedHosts.length} domains.`;
            if (failedHosts.length > 0) {
                successMessage += `\n\nFailed ${failedHosts.length} domain(s) due to errors:\n${failedHosts.join(', ')}`;
            }

            Swal.fire({
                title: processedCount === selectedHosts.length ? 'Success!' : 'Partially Completed',
                html: `<div style="text-align: left; white-space: pre-line;">${successMessage}</div>`,
                icon: processedCount > 0 ? 'success' : 'error',
                confirmButtonColor: '#9333ea',
                background: '#111827',
                color: '#fff'
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
    const [loadingStats, setLoadingStats] = useState(false);

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
    const [topFirewallActions, setTopFirewallActions] = useState([]);

    // New Data for Report


    // --- API ---
    const callAPI = async (action, params = {}) => {
        setLoading(true);
        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...params }),
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
    const loadAccounts = async () => {
        console.log('🚀 Loading Accounts...');
        const result = await callAPI('get-account-info');
        if (result && result.data) {
            setAccounts(result.data);
            const defaultAcc = result.data.find(a => a.name.toLowerCase() === DEFAULT_CONFIG.accountName.toLowerCase());
            if (defaultAcc) {
                handleAccountChange(defaultAcc.id, true);
            }
        }
    };

    // 2. Account Change -> Load Zones
    const handleAccountChange = async (accountId, isAuto = false) => {
        setSelectedAccount(accountId);
        if (!isAuto) {
            setSelectedZone(''); setZones([]); setSelectedSubDomain(''); setSubDomains([]); resetDashboardData();
        }

        if (!accountId) return;

        setLoadingZones(true);
        const result = await callAPI('list-zones', { accountId });
        if (result && result.data) {
            setZones(result.data);
            if (isAuto) {
                const defaultZone = result.data.find(z => z.name.toLowerCase() === DEFAULT_CONFIG.zoneName.toLowerCase());
                if (defaultZone) {
                    setSelectedZone(defaultZone.id);
                }
            }
        }
        setLoadingZones(false);
    };

    const resetDashboardData = () => {
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
            setLoadingStats(true); setSelectedSubDomain(''); setSubDomains([]);
            const dnsRes = await callAPI('get-dns-records', { zoneId: selectedZone });
            const allHosts = new Set();
            if (dnsRes && dnsRes.data) {
                dnsRes.data.forEach(rec => { if (['A', 'AAAA', 'CNAME'].includes(rec.type)) allHosts.add(rec.name); });
            }
            const hostOptions = Array.from(allHosts).sort().map(h => ({ value: h, label: h }));

            // Get root domain (zone name)
            const currentZone = zones.find(z => z.id === selectedZone);
            const rootDomain = currentZone?.name;

            // Remove root domain from the list if it exists (to avoid duplicate)
            if (rootDomain) {
                const idx = hostOptions.findIndex(h => h.value === rootDomain);
                if (idx !== -1) hostOptions.splice(idx, 1);

                // Add root domain at the top with label
                hostOptions.unshift({ value: rootDomain, label: `${rootDomain} (Root Domain)` });
            }

            // Add "All Subdomains" option
            hostOptions.unshift({ value: 'ALL_SUBDOMAINS', label: '--- All Subdomains (Zone Overview) ---' });

            setSubDomains(hostOptions);

            const defaultSub = hostOptions.find(h => h.value.toLowerCase() === DEFAULT_CONFIG.subDomain.toLowerCase());
            // Default to 'ALL_SUBDOMAINS' if no config match, or keep the config match
            if (defaultSub) setSelectedSubDomain(defaultSub.value);
            else setSelectedSubDomain('ALL_SUBDOMAINS');

            setLoadingStats(false);
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
        fetchAndApplyTrafficData(selectedSubDomain, selectedZone, timeRange);
    }, [selectedSubDomain, selectedZone, timeRange]);

    useEffect(() => {
        const user = auth.requireAuth(router);
        if (user) { setCurrentUser(user); loadAccounts(); }

        // Load Templates
        loadTemplate().then(tmpl => {
            if (tmpl) setReportTemplate(tmpl);
        });
        loadStaticTemplate().then(tmpl => {
            if (tmpl) setStaticReportTemplate(tmpl);
        });
    }, []);

    const handleSaveTemplate = async (newTemplate) => {
        setReportTemplate(newTemplate);
        await saveTemplate(newTemplate);
    };

    const handleSaveStaticTemplate = async (newTemplate) => {
        setStaticReportTemplate(newTemplate);
        await saveStaticTemplate(newTemplate);
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
        peakTime: peakTraffic.time,
        peakCount: peakTraffic.count,
        peakAttack: peakAttack,
        peakHttpStatus: peakHttpStatus,
        topRules: topRules,
        peakHttpStatus: peakHttpStatus,
        topRules: topRules,
        topAttackers: topAttackers,
        topFirewallSources: topFirewallSources
    };

    const isActionDisabled = !selectedSubDomain || loadingStats;

    return (
        <div className="min-h-screen bg-black font-sans text-white">
            <nav className="border-b border-gray-800 bg-[#0f1115] sticky top-0 z-50">
                <div className="w-full px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
                            <LayoutDashboard className="w-5 h-5 text-orange-500" />
                            <h1 className="text-sm font-bold text-gray-200">GDCC <span className="text-gray-500">Analytics</span></h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">

                        <div className="relative">
                            <button
                                onClick={() => !isActionDisabled && setIsReportMenuOpen(!isReportMenuOpen)}
                                disabled={isActionDisabled}
                                className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 hover:text-white text-gray-300 px-3 py-1.5 rounded text-xs transition-colors border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FileText className="w-3 h-3" /> Report
                                <svg className={`w-3 h-3 transition-transform ${isReportMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {isReportMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-[60] overflow-hidden animate-fade-in-up">
                                    <button
                                        onClick={() => { setIsReportMenuOpen(false); handleOpenReportWithImage(); }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2"
                                    >
                                        <Edit3 className="w-3 h-3" /> Sub Report
                                    </button>
                                    <button
                                        onClick={() => { setIsReportMenuOpen(false); handleOpenTemplateManager(); }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2"
                                    >
                                        <FileText className="w-3 h-3" /> Domain Report
                                    </button>
                                    <button
                                        onClick={() => { setIsReportMenuOpen(false); setIsBatchModalOpen(true); }}
                                        disabled={subDomains.length <= 1}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <List className="w-3 h-3" /> Batch Report
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="bg-orange-600/20 text-orange-500 w-8 h-8 rounded flex items-center justify-center">
                            <span className="font-bold text-xs">{currentUser.ownerName?.charAt(0) || 'U'}</span>
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

            <BatchReportModal
                isOpen={isBatchModalOpen}
                onClose={() => setIsBatchModalOpen(false)}
                hosts={getBatchHosts()}
                onConfirm={handleBatchReport}
            />

            <main ref={dashboardRef} className="p-4 bg-black min-h-screen">

                {/* SELECTORS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4 bg-gray-900/40 p-5 rounded-xl border border-dashed border-gray-800">
                    <SearchableDropdown icon={<Key className="w-4 h-4 text-blue-400" />} label="Select Account" placeholder={loading ? "Loading..." : "Choose an account..."} options={accounts.map(acc => ({ value: acc.id, label: acc.name, subtitle: `ID: ${acc.id}` }))} value={selectedAccount} onChange={(val) => handleAccountChange(val, false)} loading={loading && accounts.length === 0} />
                    <SearchableDropdown icon={<Server className="w-4 h-4 text-green-400" />} label="Select Zone (Domain)" placeholder={!selectedAccount ? "Select Account first" : loadingZones ? "Loading..." : "Choose a zone..."} options={zones.map(zone => ({ value: zone.id, label: zone.name, subtitle: zone.status }))} value={selectedZone} onChange={setSelectedZone} loading={loadingZones} />
                    <SearchableDropdown icon={<Globe className="w-4 h-4 text-purple-400" />} label="Select Subdomain" placeholder={!selectedZone ? "Select Zone first" : "Choose Subdomain..."} options={subDomains} value={selectedSubDomain} onChange={setSelectedSubDomain} loading={loadingStats && subDomains.length === 0} />
                </div>

                {/* TIME RANGE */}
                <div className="flex justify-end mb-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-1 flex gap-1">
                        {[{ label: '1d', val: 1440 }, { label: '7d', val: 10080 }, { label: '30d', val: 43200 }].map(t => (
                            <button key={t.val} onClick={() => setTimeRange(t.val)} className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${timeRange === t.val ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>{t.label}</button>
                        ))}
                    </div>
                </div>

                {/* DASHBOARD */}
                <div className={`space-y-4 transition-all duration-500 ${selectedSubDomain && !loadingStats ? 'opacity-100 filter-none' : 'opacity-40 grayscale blur-sm'}`}>

                    {/* STATS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card title="Total Requests"><div className="flex items-baseline gap-2"><span className="text-6xl font-bold text-blue-400">{totalRequests.toLocaleString()}</span><span className="text-xl text-gray-500 font-thai">Req</span></div></Card>
                        <Card title="Avg Response Time (TTFB)"><div className="flex items-baseline gap-2"><span className="text-6xl font-bold text-purple-400">{avgResponseTime}</span><span className="text-xl text-gray-500">ms</span></div></Card>
                        <Card title="Blocked Events"><div className="flex items-baseline gap-2"><span className="text-6xl font-bold text-orange-400">{blockedEvents}</span><span className="text-xl text-gray-500 font-thai">Events</span></div></Card>
                    </div>

                    {/* CHARTS ROW 1 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card title="Traffic Volume">
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
                        <Card title="Top URLs"><HorizontalBarList data={topUrls} labelKey="path" valueKey="count" /></Card>
                        <Card title="Top Firewall Actions">
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
                        <Card title="Top Client IPs"><HorizontalBarList data={topIps} labelKey="ip" valueKey="count" color="bg-cyan-600" /></Card>
                        <Card title="Top User Agents"><HorizontalBarList data={topUserAgents} labelKey="agent" valueKey="count" color="bg-indigo-600" /></Card>
                        <Card title="Top Countries"><HorizontalBarList data={topCountries} labelKey="name" valueKey="count" color="bg-blue-800" /></Card>
                    </div>

                    {/* CHARTS ROW 3: NEW SECURITY & HTTP CHARTS */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card title="Attack Prevention History (Block/Challenge)">
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
                                                        <td className="py-1 px-2 text-orange-400 uppercase text-[10px]">{d.action}</td>
                                                        <td className="py-1 pr-2 text-right text-red-400 font-bold">{d.count}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </Card>

                        <Card title="Non-200 HTTP Status Codes">
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
                        <Card title="Top WAF Rules">
                            <div className="overflow-y-auto max-h-64">
                                <HorizontalBarList data={topRules} labelKey="rule" valueKey="count" color="bg-orange-600" />
                            </div>
                        </Card>
                        <Card title="Top 5 Attackers">
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
                                                <tr key={i} className="hover:bg-gray-900/50 transition-colors">
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
                        <Card title={`Raw API Data for ${selectedSubDomain}`}>
                            <div className="overflow-x-auto max-h-48 overflow-y-auto font-mono text-xs text-gray-400 bg-gray-950 p-4 rounded border border-gray-800">
                                <div className="grid grid-cols-8 gap-2 border-b border-gray-800 pb-2 mb-2 font-bold text-gray-300 min-w-[900px]">
                                    <div className="col-span-1">Time</div>
                                    <div className="col-span-2">Host</div><div className="col-span-1">IP</div><div className="col-span-1">Country</div>
                                    <div className="col-span-1">Status</div><div className="col-span-1">Device</div><div className="col-span-1 text-right">Count</div>
                                </div>
                                {rawData.map((item, i) => (
                                    <div key={i} className="grid grid-cols-8 gap-2 hover:bg-gray-900 transition-colors py-1 border-b border-gray-900/50 min-w-[900px] items-center">
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
