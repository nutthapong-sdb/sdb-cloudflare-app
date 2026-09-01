'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/app/utils/auth';
import { getUserProfileAction } from '@/app/actions/authActions';
import { loadTemplate, saveTemplate, loadStaticTemplate, saveStaticTemplate, loadMiddleTemplate, saveMiddleTemplate, listTemplates } from '@/app/utils/ntbcTemplateApi';
import ManageTemplateModal from './ManageTemplateModal';
import ImageSettingsModal from './ImageSettingsModal';
import TableSettingsModal, { DEFAULT_TABLE_COLUMN_WIDTHS } from './TableSettingsModal';
import PageMarginSettingsModal from './PageMarginSettingsModal';
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
    Search, Bell, Menu, Download, Server, Key, List, X, Edit3, Copy, FileType, Settings, Check, Trash2, Calendar, Users, Camera, Image, Terminal, Monitor, Table, Layout,
    ChevronLeft, ChevronRight, Sparkles, Zap, Award, BarChart2, Shield, Lock, Sliders, Image as ImageIcon, Info, Plus, Tag, CheckCheck, TrendingUp, RefreshCw, ExternalLink
} from 'lucide-react';
import jsPDF from 'jspdf';
import * as htmlToImage from 'html-to-image';
import Swal from './utils/alert';
import { THEMES } from '@/app/utils/themes';
import { Editor } from '@tinymce/tinymce-react';
import { REPORT_VARIABLES, STATIC_VARIABLES, CATEGORY_META } from './variableDefinitions';
import { DELAY_CONFIG } from '@/lib/delay-config';

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
    const thStyle = "border: 1px solid black; padding: 6px 8px; background-color: #f3f4f6; font-weight: bold; font-family: 'TH SarabunPSK'; font-size: 16pt; word-break: break-all; overflow-wrap: anywhere;";
    const tdStyle = "border: 1px solid black; padding: 6px 8px; font-family: 'TH SarabunPSK'; font-size: 16pt; word-break: break-all; overflow-wrap: anywhere;";

    let html = `<table width="100%" style="width: 100%; border-collapse: collapse; border: 1px solid black; margin-top: 0; margin-bottom: 0; table-layout: fixed; ${styles.table || ''}">
        <thead><tr>`;

    headers.forEach(h => {
        const widthAttr = h.width ? ` width="${h.width}"` : '';
        const widthStyle = h.width ? ` width: ${h.width};` : '';
        html += `<th${widthAttr} style="${thStyle}${widthStyle} text-align: ${h.align || 'left'};">${h.label}</th>`;
    });

    html += `</tr></thead><tbody>`;

    rows.forEach(row => {
        html += `<tr>`;
        row.forEach((cell, idx) => {
            const align = headers[idx]?.align || 'left';
            const width = headers[idx]?.width;
            const widthAttr = width ? ` width="${width}"` : '';
            const widthStyle = width ? ` width: ${width};` : '';
            html += `<td${widthAttr} style="${tdStyle}${widthStyle} text-align: ${align};">${cell}</td>`;
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

const parseDateInLocalTime = (dateStr, isEnd = false) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return isEnd ? new Date(y, m, d, 23, 59, 59, 999) : new Date(y, m, d, 0, 0, 0, 0);
};

const toThaiDigits = (input) => {
    if (!input) return input;
    const thai = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
    return String(input).replace(/[0-9]/g, (d) => thai[Number(d)]);
};

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

const addAutomaticTOC = (html, isForExport = false, useThaiDigits = true, useAutoTOC = true) => {
    if (!html) return html;
    if (!html.includes('@TOC@') && !html.includes('@TOC')) {
        return html;
    }
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
        tocContainer.setAttribute('style', `margin-bottom: 30px; font-family: "TH SarabunPSK"; font-size: 16pt; color: ${textColor}; line-height: 1.35; width: 100%;`);
        
        const tocTitle = doc.createElement('p');
        tocTitle.innerHTML = '<strong>สารบัญ</strong>';
        tocTitle.setAttribute('style', `text-align: center; margin-bottom: 20px; font-size: 20pt; font-family: "TH SarabunPSK"; margin-top: 0; color: ${textColor};`);
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
            p.setAttribute('style', `margin-bottom: 6px; margin-top: 0; font-family: "TH SarabunPSK"; font-size: 16pt; color: ${textColor}; line-height: 1.35;`);
            p.innerHTML = `${indent}${text} ${dots} ${pageNum}`;
            tocContainer.appendChild(p);
        });

        // Check if @TOC@ or @TOC placeholder exists anywhere in the body
        const bodyHtml = doc.body.innerHTML;
        const tocPlaceholder = bodyHtml.includes('@TOC@') ? '@TOC@' : (bodyHtml.includes('@TOC') ? '@TOC' : null);
        if (tocPlaceholder) {
            const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
            let node;
            let targetNode = null;
            while ((node = walker.nextNode())) {
                if (node.nodeValue && (node.nodeValue.includes('@TOC@') || node.nodeValue.includes('@TOC'))) {
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
                doc.body.innerHTML = bodyHtml.replace(tocPlaceholder, tocContainer.outerHTML);
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

const getZoneName = (zoneId, zones = []) => {
    if (!zoneId) return '-';
    if (zoneId.includes('.')) return zoneId; // It's already the domain name!
    const zoneObj = zones.find(z => z.id === zoneId);
    if (zoneObj?.name) return zoneObj.name;
    if (typeof window !== 'undefined') {
        const savedName = localStorage.getItem(`gdcc:zoneName:${zoneId}`) || localStorage.getItem(`ntbc:zoneName:${zoneId}`);
        if (savedName) return savedName;
    }
    return '-';
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

const formatDataSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0.00 GB';
    const tb = bytes / (1024 * 1024 * 1024 * 1024);
    if (tb >= 1) return tb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TB';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' GB';
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

    let imageWidths = {
        '@DASHBOARD_IMAGE': 504
    };
    if (typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem('ntbc:cropped-image-widths');
            if (stored) {
                const parsed = JSON.parse(stored);
                imageWidths = { ...imageWidths, ...parsed };
            }
        } catch (e) {
            console.error('Failed to load image widths:', e);
        }
    }

    const cleanImageSrc = (val, fallback) => {
        if (!val || val === 'null' || val === 'undefined') return fallback;
        return val;
    };

    const startDate = parseDateInLocalTime(safeData.startDate, false) || new Date(now.getTime() - 1440 * 60 * 1000);
    const rawEndDate = parseDateInLocalTime(safeData.endDate, true);
    const endDate = rawEndDate ? new Date(Math.min(rawEndDate.getTime(), now.getTime())) : now;
    const timeRangeStr = `${formatThaiDate(startDate)} - ${formatThaiDate(endDate)}`;
    const avgTimeSec = safeData.avgTime ? (safeData.avgTime / 1000).toFixed(3) : "0.000";
    const totalFirewall = (safeData.blockedEvents || 0) + (safeData.logEvents || 0);
    const blockPct = totalFirewall > 0 ? ((safeData.blockedEvents / totalFirewall) * 100).toFixed(2) : "0.00";
    const logPct = totalFirewall > 0 ? ((safeData.logEvents / totalFirewall) * 100).toFixed(2) : "0.00";
    const topUA = safeData.topUserAgents && safeData.topUserAgents.length > 0 ? safeData.topUserAgents[0] : { agent: '-', count: 0 };
    const domainDisplay = safeData.domain === 'ALL_SUBDOMAINS' ? `ทุก Subdomain ของ Domain ${safeData.zoneName || '...'}` : safeData.domain;

    const getActionCount = (actionName) => {
        if (safeData.firewallActivity) {
            const match = safeData.firewallActivity.filter(g => {
                const act = (g.dimensions?.action || '').toLowerCase();
                if (actionName === 'challenge') {
                    return act.includes('challenge');
                }
                return act === actionName;
            });
            return match.reduce((acc, g) => acc + g.count, 0);
        }
        if (safeData.topFirewallActions) {
            const match = safeData.topFirewallActions.find(item => {
                const name = (item.name || '').toLowerCase();
                if (actionName === 'challenge') {
                    return name.includes('challenge');
                }
                return name === actionName;
            });
            return match ? match.count : 0;
        }
        return 0;
    };

    const getRuleCount = (keyword) => {
        if (safeData.firewallRules) {
            const match = safeData.firewallRules.find(g => 
                (g.dimensions?.description || '').toLowerCase().includes(keyword.toLowerCase())
            );
            return match ? match.count : 0;
        }
        const allRules = [
            ...(safeData.topCustomRules || []),
            ...(safeData.topManagedRules || []),
            ...(safeData.topRules || [])
        ];
        const match = allRules.find(item => 
            (item.rule || '').toLowerCase().includes(keyword.toLowerCase())
        );
        return match ? match.count : 0;
    };

    // 1. Simple Replacements
    const replacements = {
        '@TIME_RANGE': timeRangeStr,
        '@DOMAIN': domainDisplay,
        '@TOTAL_REQ': (safeData.totalRequests || 0).toLocaleString(),
        '@SUBDOMAIN_TOTAL_REQ_M': (Number(safeData.totalRequests || 0) / 1000000).toFixed(2) + 'M',
        '@ZONE_TOTAL_REQ_M': (Number(safeData.zoneWideRequests || safeData.totalRequests || 0) / 1000000).toFixed(2) + 'M',
        '@PAGE_VIEWS_M': (Number(safeData.pageViews || 0) / 1000000).toFixed(2) + 'M',
        '@TRAFFIC_CHANGE_TEXT': safeData.trafficChangeText || 'เพิ่มขึ้น',
        '@TRAFFIC_CHANGE_PCT': safeData.trafficChangePct || '1.79%',
        '@DATA_TRANSFER_CHANGE_TEXT': safeData.dataTransferChangeText || 'ลดลง',
        '@DATA_TRANSFER_CHANGE_PCT': safeData.dataTransferChangePct || '17.43%',
        '@ARGO_IMPROVEMENT_PCT': safeData.argoImprovementPct || '29.84%',
        '@ARGO_RT_BEFORE': safeData.argoResponseTimeBefore || '1.15 s',
        '@ARGO_RT_AFTER': safeData.argoResponseTimeAfter || '804 ms',
        '@SPEED_TTI': safeData.speedTimeToInteractive || '1,221 ms',
        '@SPEED_INDEX': safeData.speedIndex || '1,165 ms',
        '@SPEED_SCORE': safeData.speedScorePct || '97%',
        '@SPEED_LEVEL': safeData.speedLevel || 'ดีเยี่ยม',
        '@SPEED_MOBILE_TTI': safeData.speedMobileTimeToInteractive || '5,924 ms',
        '@SPEED_MOBILE_INDEX': safeData.speedMobileIndex || '3,259 ms',
        '@SPEED_MOBILE_SCORE': safeData.speedMobileScorePct || '67%',
        '@SPEED_MOBILE_LEVEL': safeData.speedMobileLevel || 'กลาง',
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
        '@TOTAL_BANDWIDTH': formatDataSize(safeData.totalDataTransfer || 0),
        '@TOTAL_DATA_TRANSFER': formatDataSize(safeData.totalDataTransfer || 0),
        '@VISITS': (safeData.visits || 0).toLocaleString(),
        '@PAGE_VIEWS': (safeData.pageViews || 0).toLocaleString(),
        '@REQ_PER_PAGEVIEW_PCT': (safeData.pageViews || 0) > 0 ? ((safeData.totalRequests || 0) / (safeData.pageViews || 0) * 100).toFixed(2) + '%' : '0.00%',
        '@TOP_COUNTRY_REQ': safeData.topCountries && safeData.topCountries.length > 0 ? getCountryName(safeData.topCountries[0].name) : '-',
        '@TOP_COUNTRY_REQ_COUNT': safeData.topCountries && safeData.topCountries.length > 0 ? (safeData.topCountries[0].count || 0).toLocaleString() : '0',
        '@DAY': now.getDate().toString(),
        '@MONTH': now.toLocaleString('th-TH', { month: 'long' }),
        '@YEAR': (now.getFullYear() + 543).toString(),
        '@FULL_DATE': now.toLocaleString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
        '@ACCOUNT_NAME': safeData.accountName || '-',
        '@ZONE_NAME': safeData.zoneName || '-',
        '@DOMAIN_COUNT': (safeData.domainCount || '0').toString(),
        '@SUBDOMAIN_COUNT': (safeData.dnsRecords ? safeData.dnsRecords.length : 0).toString(),
        '@PROXIED_COUNT': (safeData.dnsRecords ? safeData.dnsRecords.filter(r => r.proxied === true).length : 0).toString(),
        // Firewall Action Counts
        '@FW_LOG_COUNT': formatEventCount(getActionCount('log')),
        '@FW_SKIP_COUNT': formatEventCount(getActionCount('skip')),
        '@FW_CHALLENGE_COUNT': formatEventCount(getActionCount('challenge') || getActionCount('managed_challenge') || getActionCount('jschallenge')),
        '@FW_BLOCK_COUNT': formatEventCount(getActionCount('block') || getActionCount('connectionclose')),
        // Firewall Rule Counts
        '@FW_RULE_KNOWN_BOTS_COUNT': formatEventCount(getRuleCount('known bots')),
        '@FW_RULE_DTT_COUNT': formatEventCount(getRuleCount('dtt skip') || getRuleCount('dtt_skip')),
        '@FW_RULE_GIS_COUNT': formatEventCount(getRuleCount('gis skip') || getRuleCount('gis_skip')),
        '@FW_RULE_NOT_THAI_COUNT': formatEventCount(getRuleCount('not thailand') || getRuleCount('not_thailand')),
        '@FW_RULE_ALL_LOG_COUNT': formatEventCount(getRuleCount('all log') || getRuleCount('all_log')),
        '@FW_RULE_SKIP_REGISTER_LOGIN_COUNT': formatEventCount(getRuleCount('skip register') || getRuleCount('skip_register')),
        '@FW_RULE_SKIP_RATELIMIT_COUNT': formatEventCount(getRuleCount('skip ratelimit') || getRuleCount('skip_ratelimit')),
        '@FW_RULE_SKIP_ATTACHMENT_COUNT': formatEventCount(getRuleCount('attachment') || getRuleCount('post /api/attachment')),
        '@FW_RULE_SKIP_LICENSEFEE_COUNT': formatEventCount(getRuleCount('licensefee') || getRuleCount('upload licensefee')),
        '@FW_RULE_RATELIMIT_300_COUNT': formatEventCount(getRuleCount('300req') || getRuleCount('300 req')),
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
        '@captured_domain_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedDomainImage || safeData.captured_domains_page, '/captured-domains.png')}" alt="Captured Domain Page" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_dns_page': (() => {
            const pages = safeData.capturedDnsPages || [];
            if (pages.length > 0) {
                return pages.map((pageSrc, idx) => 
                    `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(pageSrc, '/captured-dns.png')}" alt="Captured DNS Records Page ${idx + 1}" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`
                ).join('<br/>');
            }
            const fallbackSrc = cleanImageSrc(safeData.capturedDnsImage || safeData.captured_dns_page, '/captured-dns.png');
            return `<div class="mb-6" style="text-align: center;"><img src="${fallbackSrc}" alt="Captured DNS Records" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`;
        })(),
        '@captured_request_traffic_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedTrafficImageSub1 || safeData.captured_request_traffic_page, '/captured-traffic-sub1.png')}" alt="Captured HTTP Traffic Requests" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_data_transfer_traffic_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedTrafficImageSub2 || safeData.captured_data_transfer_traffic_page, '/captured-traffic-sub2.png')}" alt="Captured HTTP Traffic Data Transfer" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_page_views_traffic_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedTrafficImageSub3 || safeData.captured_page_views_traffic_page, '/captured-traffic-sub3.png')}" alt="Captured HTTP Traffic Page Views" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_visits_traffic_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedTrafficImageSub4 || safeData.captured_visits_traffic_page, '/captured-traffic-sub4.png')}" alt="Captured HTTP Traffic Visits" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_api_requests_traffic_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedTrafficImageSub5 || safeData.captured_api_requests_traffic_page, '/captured-traffic-sub5.png')}" alt="Captured HTTP Traffic API Requests" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_firewall_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedFirewallImage || safeData.captured_firewall_page, '/captured-firewall.png')}" alt="Captured Firewall Overview" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_security_rules_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedSecurityRulesImage || safeData.captured_security_rules_page, '/captured-security-rules.png')}" alt="Captured Security Rules" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_argo_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedArgoImage || safeData.captured_argo_page, '/captured-argo.png')}" alt="Captured Argo Smart Routing" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_speed_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedSpeedImage || safeData.captured_speed_page, '/captured-speed.png')}" alt="Captured Speed Test" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_speed_mobile_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedSpeedMobileImage || safeData.captured_speed_mobile_page, '/captured-speed-mobile.png')}" alt="Captured Speed Test (Mobile)" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_traffic_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedTrafficImage || safeData.captured_traffic_page, '/captured-traffic.png')}" alt="Captured HTTP Traffic" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_bot_management': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedBotManagementImage || safeData.captured_bot_management, '/captured-bot-management.png')}" alt="Captured Bot Management" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_security_level': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedSecurityLevelImage || safeData.captured_security_level, '/captured-security-level.png')}" alt="Captured Security Level" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_ssl_overview': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedSslOverviewImage || safeData.captured_ssl_overview, '/captured-ssl-overview.png')}" alt="Captured SSL/TLS Encryption" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_ssl_edge': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedSslEdgeImage || safeData.captured_ssl_edge, '/captured-ssl-edge.png')}" alt="Captured Edge Certificates" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_rate_limiting_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedRateLimitingImage || safeData.captured_rate_limiting_page, '/captured-rate-limiting.png')}" alt="Captured Rate Limiting Rules" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_managed_rules_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedManagedRulesImage || safeData.captured_managed_rules_page, '/captured-managed-rules.png')}" alt="Captured Managed WAF Rules" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_ip_access_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedIpAccessImage || safeData.captured_ip_access_page, '/captured-ip-access.png')}" alt="Captured IP Access Rules" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_zone_lockdown_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedZoneLockdownImage || safeData.captured_zone_lockdown_page, '/captured-zone-lockdown.png')}" alt="Captured Zone Lockdown Rules" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_traffic_countries_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedTrafficCountriesImage || safeData.captured_traffic_countries_page, '/captured-traffic-countries.png')}" alt="Captured Traffic by Country" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,
        '@captured_top_events_source_page': `<div class="mb-6" style="text-align: center;"><img src="${cleanImageSrc(safeData.capturedTopEventsSourceImage || safeData.captured_top_events_source_page, '/captured-top-events-source.png')}" alt="Captured Top Events by Source" width="504" style="height: auto; display: block; margin: 0 auto; border: 1px solid #ddd;" /></div>`,


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
        '@DASHBOARD_IMAGE': dashboardImage ? `<div class="mb-6" style="text-align: center;"><img src="${dashboardImage}" alt="Dashboard Snapshot" width="${imageWidths['@DASHBOARD_IMAGE']}" style="height: auto; display: block; margin: 0 auto;" /></div>` : '',
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
            dnsRowsHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';">${indent}Type:${record.type} ${record.name}</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';">Proxied</span></p></td></tr>`;
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
            ipAccessRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';">Applies to: All websites in account</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';"> </span></p></td></tr>`;

            // Row 2+: IP rules
            accountRules.forEach(rule => {
                if (rule.mode === 'disable' || rule.mode === 'disabled') return;
                const actionName = rule.mode || rule.action;
                const actionDisplay = 'Action: ' + formatActionName(actionName);
                ipAccessRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${rule.ip}</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';">${actionDisplay}</span></p></td></tr>`;
            });

            console.log(`Generated ${accountRules.length} IP Access Rule rows (account-level) for domain report`);
        }

        if (zoneRules.length > 0) {
            // Header for Zone rules
            ipAccessRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';">Applies to: This website</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';"> </span></p></td></tr>`;

            // Zone rules rows
            zoneRules.forEach(rule => {
                if (rule.mode === 'disable' || rule.mode === 'disabled') return;
                const actionName = rule.mode || rule.action;
                const actionDisplay = 'Action: ' + formatActionName(actionName);
                ipAccessRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${rule.ip}</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';">${actionDisplay}</span></p></td></tr>`;
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

            customRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';">${indent}${rule.description}</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';">${actionDisplay}</span></p></td></tr>`;
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

            rateLimitRulesHtml += `<tr><td style="width: 5.98335%; border-style: none solid solid; border-color: #000000; border-width: 1px; padding: 0cm 5.4pt;" nowrap="nowrap" width="6%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';"> </span></p></td><td style="width: 72.2553%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" width="71%"><p class="MsoNormal" style="margin-bottom: 0cm; line-height: normal;"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';">${indent}${rule.description}</span></p></td><td style="width: 21.7613%; border-style: none solid solid none; border-color: #000000; padding: 0cm 5.4pt; border-width: 1px;" nowrap="nowrap" width="21%"><p class="MsoNormal" style="margin-bottom: 0cm; text-align: center; line-height: normal;" align="center"><span lang="EN-US" style="font-size: 16.0pt; font-family: 'TH SarabunPSK'; mso-fareast-font-family: 'Times New Roman';">${actionDisplay}</span></p></td></tr>`;
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
    let customTableWidths = DEFAULT_TABLE_COLUMN_WIDTHS;
    if (typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem('ntbc:table-column-widths');
            if (stored) {
                customTableWidths = { ...DEFAULT_TABLE_COLUMN_WIDTHS, ...JSON.parse(stored) };
            }
        } catch (e) {}
    }

    const getColWidth = (tableKey, colId, defaultPct) => {
        const val = customTableWidths[tableKey]?.[colId];
        return (val !== undefined && val !== null && !isNaN(val) && val > 0) ? (val + '%') : (defaultPct + '%');
    };

    // Top URLs Table
    const topUrlsHtml = generateHtmlTable(
        [
            { label: 'ลำดับ', width: getColWidth('@TOP_URLS_LIST', 'col1', 10), align: 'center' },
            { label: 'รายการ (URL)', width: getColWidth('@TOP_URLS_LIST', 'col2', 70) },
            { label: 'จำนวน (Count)', width: getColWidth('@TOP_URLS_LIST', 'col3', 20), align: 'right' }
        ],
        (safeData.topUrls || []).slice(0, 3).map((item, idx) => [idx + 1, item.path, formatCompactNumber(item.count)])
    );
    html = html.replace(/@TOP_URLS_LIST(@)?/g, topUrlsHtml);

    // Top IPs Table
    const topIpsHtml = generateHtmlTable(
        [
            { label: 'Client IP', width: getColWidth('@TOP_IPS_LIST', 'col1', 70) },
            { label: 'จำนวน (Count)', width: getColWidth('@TOP_IPS_LIST', 'col2', 30), align: 'right' }
        ],
        (safeData.topIps || []).slice(0, 3).map(item => [item.ip, formatCompactNumber(item.count)])
    );
    html = html.replace(/@TOP_IPS_LIST(@)?/g, topIpsHtml);

    // Top Rules Table
    const topRulesHtml = generateHtmlTable(
        [
            { label: 'Rule Name (ID)', width: getColWidth('@TOP_RULES_LIST', 'col1', 70) },
            { label: 'จำนวน (Count)', width: getColWidth('@TOP_RULES_LIST', 'col2', 30), align: 'right' }
        ],
        (safeData.topRules || []).slice(0, 3).map(item => [item.rule, formatCompactNumber(item.count)])
    );
    html = html.replace(/@TOP_RULES_LIST(@)?/g, topRulesHtml);

    // Top Attackers Table
    const topAttackersHtml = generateHtmlTable(
        [
            { label: 'IP', width: getColWidth('@TOP_ATTACKERS_LIST', 'col1', 30) },
            { label: 'ประเทศ (Country)', width: getColWidth('@TOP_ATTACKERS_LIST', 'col2', 25) },
            { label: 'จำนวน (Count)', width: getColWidth('@TOP_ATTACKERS_LIST', 'col3', 25), align: 'right' },
            { label: 'ประเภท (Type)', width: getColWidth('@TOP_ATTACKERS_LIST', 'col4', 20) }
        ],
        (safeData.topAttackers || []).slice(0, 5).map(item => [item.ip, getCountryName(item.country), formatCompactNumber(item.count), item.type])
    );
    html = html.replace(/@TOP_ATTACKERS_LIST(@)?/g, topAttackersHtml);

    // Top Sources Table
    const topSourcesHtml = generateHtmlTable(
        [
            { label: 'Type (Security Source)', width: getColWidth('@TOP_SOURCES_LIST', 'col1', 70) },
            { label: 'จำนวน (Count)', width: getColWidth('@TOP_SOURCES_LIST', 'col2', 30), align: 'right' }
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

// Screenshot Preview Modal Component
const ScreenshotPreviewModal = ({ isOpen, onClose, imgUrl, theme }) => {
    if (!isOpen) return null;
    const t = theme || {};
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className={`${t.modalBg || 'bg-gray-900'} border ${t.modalBorder || 'border-gray-800'} rounded-xl w-full max-w-2xl shadow-2xl p-6 relative flex flex-col animate-scale-up`}>
                <h3 className="text-lg font-bold text-white mb-4">Captured Screenshot Preview</h3>
                <div className="flex-1 overflow-auto rounded border border-gray-700/60 bg-black flex items-center justify-center p-2">
                    {imgUrl ? (
                        <img src={imgUrl} className="max-w-full max-h-[50vh] object-contain rounded" alt="Preview" />
                    ) : (
                        <span className="text-gray-500 italic text-sm">No screenshot captured</span>
                    )}
                </div>
                <div className="flex justify-end gap-3 mt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition-colors shadow-lg">
                        Close Preview
                    </button>
                </div>
            </div>
        </div>
    );
};

// Control Steps Modal Component (10 Step Mockups)
const ControlStepsModal = ({ isOpen, onClose, theme }) => {
    if (!isOpen) return null;
    const t = theme || {};

    const steps = [
        "Step 1: Check Domain Availability",
        "Step 2: Authenticate User Session",
        "Step 3: Fetch DNS Records",
        "Step 4: Load Security Settings",
        "Step 5: Load WAF Event Logs",
        "Step 6: Render Dashboard Charts",
        "Step 7: Replace Template Placeholders",
        "Step 8: Generate PDF Draft",
        "Step 9: Compile Word Document",
        "Step 10: Finalize and Email Report"
    ];

    const handleStepClick = (step, index) => {
        Swal.fire({
            title: 'Notification',
            html: `<div class="text-center font-bold text-lg text-white">Already done[ step ${index + 1} ]</div>`,
            icon: 'success',
            position: 'center',
            timer: 2000,
            showConfirmButton: false,
            background: t.modalBg || '#1f2937',
            color: '#fff',
            customClass: {
                popup: 'rounded-2xl border border-purple-500/30 shadow-2xl'
            }
        });
    };

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className={`${t.modalBg || 'bg-gray-900'} border ${t.modalBorder || 'border-gray-800'} rounded-xl w-full max-w-xl shadow-2xl p-6 relative flex flex-col animate-scale-up`}>
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-white mb-2">Report Generation Steps</h3>
                    <p className="text-gray-400 text-xs">Execute or verify each step to control the mockup report generation.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
                    {steps.map((step, index) => (
                        <button
                            key={index}
                            onClick={() => handleStepClick(step, index)}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/50 hover:bg-purple-900/30 border border-gray-700/50 hover:border-purple-500/50 text-left text-xs font-semibold text-gray-200 hover:text-white transition-all duration-200"
                        >
                            <span className="w-6 h-6 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] shrink-0 font-bold">
                                {index + 1}
                            </span>
                            <span className="truncate">{step.split(': ')[1]}</span>
                        </button>
                    ))}
                </div>
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-bold text-white transition-all"
                    >
                        Close Control
                    </button>
                </div>
            </div>
        </div>
    );
};

// VNC Viewer Modal Component
const VncModal = ({ isOpen, onClose, theme }) => {
    const [vncUrl, setVncUrl] = useState('');
    
    useEffect(() => {
        if (isOpen && typeof window !== 'undefined') {
            setVncUrl(`${window.location.origin}/vnc/?autoconnect=1&resize=scale&path=vnc/websockify`);
        }
    }, [isOpen]);

    if (!isOpen) return null;
    const t = theme || {};

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className={`${t.modalBg || 'bg-gray-900'} border ${t.modalBorder || 'border-gray-800'} rounded-xl w-full max-w-5xl shadow-2xl p-6 relative flex flex-col animate-scale-up`} style={{ height: '80vh' }}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-blue-500" />
                        Live Debug Browser (VNC)
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-hidden relative">
                    <div className="grid grid-cols-1 gap-3 h-full">
                        {/* Live Browser Monitor */}
                        <div className="rounded border border-gray-700/60 bg-black relative flex flex-col h-full">
                            <div className="absolute top-0 left-0 bg-rose-600 text-white text-[10px] px-2 py-0.5 z-10 rounded-br-lg font-bold">Live Browser Monitor</div>
                            {vncUrl ? (
                                <iframe src={`${window.location.origin}/vnc/?autoconnect=1&resize=scale&path=websockify`} className="w-full flex-1 border-none" title="Live Browser Monitor" />
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-gray-500 italic text-sm">Loading Browser...</div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end items-center mt-4 gap-2">
                    <button onClick={() => {
                        const current = vncUrl;
                        setVncUrl('');
                        setTimeout(() => setVncUrl(current), 500);
                    }} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold rounded transition-colors shadow-lg">
                        Restart Monitor
                    </button>
                    <button onClick={onClose} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition-colors shadow-lg">
                        Close Monitor
                    </button>
                </div>
            </div>
        </div>
    );
};

// 1. Report Modal Component
const ReportModal = ({ isOpen, onClose, data, dashboardImage, template, onSaveTemplate, onGenerate, mode = 'report', theme, templateName, templateId, currentUserId, capturedDomainImage, onCaptureScreenshot, autoDownloadWord = false, onAutoDownloadComplete, useThaiDigits, setUseThaiDigits }) => {
    // mode: 'report' | 'sub-template' | 'static-template' | 'middle-template'
    console.log('ReportModal Render:', { mode, templateType: typeof template, templateValue: template, isNull: template === null, isEmptyObj: JSON.stringify(template) === '{}' });

    // If no template passed, use default (fallback)
    const currentTemplate = (typeof template === 'string') ? template : '';

    // Default to editing in static mode, preview in report mode
    const [isEditing, setIsEditing] = useState(false);
    const [localTemplate, setLocalTemplate] = useState(currentTemplate);
    const reportContentRef = useRef(null);
    const editorRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showUnusedOnly, setShowUnusedOnly] = useState(false);
    const [isVariablesCollapsed, setIsVariablesCollapsed] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [trafficChangeText, setTrafficChangeText] = useState('เพิ่มขึ้น');
    const [trafficChangePct, setTrafficChangePct] = useState('1.79%');
    const [dataTransferChangeText, setDataTransferChangeText] = useState('ลดลง');
    const [dataTransferChangePct, setDataTransferChangePct] = useState('17.43%');
    const [argoImprovementPct, setArgoImprovementPct] = useState('29.84%');
    const [argoResponseTimeBefore, setArgoResponseTimeBefore] = useState('1.15 s');
    const [argoResponseTimeAfter, setArgoResponseTimeAfter] = useState('804 ms');
    const [speedTimeToInteractive, setSpeedTimeToInteractive] = useState('1,221 ms');
    const [speedIndex, setSpeedIndex] = useState('1,165 ms');
    const [speedScorePct, setSpeedScorePct] = useState('97%');
    const [speedLevel, setSpeedLevel] = useState('ดีเยี่ยม');
    const [speedMobileTimeToInteractive, setSpeedMobileTimeToInteractive] = useState('5,924 ms');
    const [speedMobileIndex, setSpeedMobileIndex] = useState('3,259 ms');
    const [speedMobileScorePct, setSpeedMobileScorePct] = useState('67%');
    const [speedMobileLevel, setSpeedMobileLevel] = useState('กลาง');
    // Local states and handleCaptureScreenshot removed (lifted to parent NTBCCFReportPage)

    const downloadWordRef = useRef(null);
    useEffect(() => {
        downloadWordRef.current = handleDownloadWord;
    });

    const [pageMargins, setPageMargins] = useState({ top: 2.54, bottom: 2.54, left: 2.54, right: 2.54, presetId: 'normal' });

    useEffect(() => {
        setMounted(true);
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem('ntbc:page-margins');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setPageMargins(prev => ({ ...prev, ...parsed }));
                }
            } catch (e) {}
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && autoDownloadWord && mounted) {
            console.log('⚡ Triggering automatic Word document download...');
            const timer = setTimeout(() => {
                if (downloadWordRef.current) {
                    downloadWordRef.current();
                }
                if (onAutoDownloadComplete) {
                    onAutoDownloadComplete();
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isOpen, autoDownloadWord, mounted]);

    const [selectedCategory, setSelectedCategory] = useState('All');
    const [copiedVarName, setCopiedVarName] = useState(null);
    const [isConfigExpanded, setIsConfigExpanded] = useState(false);

    const isTemplateMode = mode === 'static-template' || mode === 'middle-template' || mode === 'sub-template';
    const availableVariables = mode === 'static-template' ? STATIC_VARIABLES : REPORT_VARIABLES;

    // Available categories for current mode
    const categories = useMemo(() => {
        const cats = ['All'];
        availableVariables.forEach(v => {
            if (!cats.includes(v.category)) cats.push(v.category);
        });
        return cats;
    }, [availableVariables]);

    // Variable count per category
    const categoryCounts = useMemo(() => {
        const counts = { 'All': 0 };
        availableVariables.forEach(v => {
            counts[v.category] = (counts[v.category] || 0) + 1;
            counts['All'] += 1;
        });
        return counts;
    }, [availableVariables]);

    // Unused variables count
    const unusedCount = useMemo(() => {
        if (typeof localTemplate !== 'string') return 0;
        return availableVariables.filter(v => !localTemplate.includes(v.name)).length;
    }, [availableVariables, localTemplate]);

    // Filtered variables
    const filteredVariables = useMemo(() => {
        return availableVariables.filter(v => {
            if (selectedCategory !== 'All' && v.category !== selectedCategory) return false;
            if (showUnusedOnly && typeof localTemplate === 'string' && localTemplate.includes(v.name)) return false;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const catMeta = CATEGORY_META[v.category] || {};
                const catLabel = (catMeta.label || '').toLowerCase();
                return v.name.toLowerCase().includes(term) ||
                       (v.desc || '').toLowerCase().includes(term) ||
                       (v.example || '').toLowerCase().includes(term) ||
                       v.category.toLowerCase().includes(term) ||
                       catLabel.includes(term);
            }
            return true;
        });
    }, [availableVariables, selectedCategory, showUnusedOnly, localTemplate, searchTerm]);

    // Grouped variables for organized rendering
    const groupedVariables = useMemo(() => {
        if (selectedCategory !== 'All' || searchTerm.trim()) {
            return [{ category: selectedCategory === 'All' ? 'ผลการค้นหา' : selectedCategory, items: filteredVariables }];
        }
        const map = {};
        filteredVariables.forEach(v => {
            if (!map[v.category]) map[v.category] = [];
            map[v.category].push(v);
        });
        return Object.keys(map).map(cat => ({
            category: cat,
            items: map[cat]
        }));
    }, [filteredVariables, selectedCategory, searchTerm]);

    const insertVariable = (varName) => {
        if (editorRef.current) {
            editorRef.current.insertContent(varName);
            setCopiedVarName(varName);
            setTimeout(() => setCopiedVarName(null), 1500);
        }
    };

    const renderCategoryIcon = (category, className = "w-3.5 h-3.5") => {
        switch (category) {
            case 'All': return <Sparkles className={className} />;
            case 'Time': return <Clock className={className} />;
            case 'Info':
            case 'Basic': return <Info className={className} />;
            case 'Stats': return <BarChart2 className={className} />;
            case 'Peak': return <Zap className={className} />;
            case 'Top': return <Award className={className} />;
            case 'Table': return <Table className={className} />;
            case 'List': return <List className={className} />;
            case 'Zone Cache': return <Activity className={className} />;
            case 'Firewall': return <ShieldAlert className={className} />;
            case 'Firewall Rules':
            case 'WAF': return <Shield className={className} />;
            case 'Security': return <ShieldAlert className={className} />;
            case 'DDoS': return <Shield className={className} />;
            case 'DNS': return <Globe className={className} />;
            case 'Rules': return <Sliders className={className} />;
            case 'SSL': return <Lock className={className} />;
            case 'Argo': return <Zap className={className} />;
            case 'Speed': return <Activity className={className} />;
            case 'Screenshots': return <Camera className={className} />;
            case 'Traffic Screenshots': return <TrendingUp className={className} />;
            case 'Format': return <ImageIcon className={className} />;
            default: return <Tag className={className} />;
        }
    };

    // Sync local template when prop changes
    useEffect(() => {
        setLocalTemplate((typeof template === 'string') ? template : '');
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
        () => `ntbc:templates:${userKey}:thaiDigits:${templateId ? String(templateId) : 'default'}`,
        [userKey, templateId]
    );
    const useAutoTOC = true;

    useEffect(() => {
        if (!isOpen) return;
        if (typeof window === 'undefined') return;
        try {
            const storedDigits = localStorage.getItem(thaiDigitsPrefKey);
            if (storedDigits !== null) {
                setUseThaiDigits(storedDigits === '1');
            } else {
                setUseThaiDigits(false);
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

    const sDate = parseDateInLocalTime(safeData.startDate, false) || new Date(Date.now() - 1440 * 60 * 1000);
    const rawEDate = parseDateInLocalTime(safeData.endDate, true);
    const eDate = rawEDate ? new Date(Math.min(rawEDate.getTime(), Date.now())) : new Date();
    const timeRangeStr = `${formatThaiDate(sDate)} - ${formatThaiDate(eDate)}`;
    const avgTimeSec = safeData.avgTime ? (safeData.avgTime / 1000).toFixed(3) : "0.000";
    const totalFirewall = (safeData.blockedEvents || 0) + (safeData.logEvents || 0);
    const blockPct = totalFirewall > 0 ? ((safeData.blockedEvents / totalFirewall) * 100).toFixed(2) : "0.00";
    const logPct = totalFirewall > 0 ? ((safeData.logEvents / totalFirewall) * 100).toFixed(2) : "0.00";
    const topUA = safeData.topUserAgents && safeData.topUserAgents.length > 0 ? safeData.topUserAgents[0] : { agent: '-', count: 0 };
    const domainDisplay = safeData.domain === 'ALL_SUBDOMAINS' ? `ทุก Subdomain ของ Domain ${safeData.zoneName || '...'}` : safeData.domain;

    // --- TEMPLATE PROCESSING ---
    const getProcessedHtml = (isForExport = false) => {
        const baseTmpl = isEditing ? localTemplate : (template ?? '');
        console.log('DEBUG getProcessedHtml: baseTmpl length =', baseTmpl?.length, 'localTemplate length =', localTemplate?.length, 'template length =', template?.length);
        // Even for static template, we want to process date variables
        let html = processTemplate(baseTmpl, { 
            ...safeData, 
            capturedDomainImage,
            trafficChangeText,
            trafficChangePct,
            dataTransferChangeText,
            dataTransferChangePct,
            argoImprovementPct,
            argoResponseTimeBefore,
            argoResponseTimeAfter,
            speedTimeToInteractive,
            speedIndex,
            speedScorePct,
            speedLevel,
            speedMobileTimeToInteractive,
            speedMobileIndex,
            speedMobileScorePct,
            speedMobileLevel
        }, new Date(), dashboardImage);
        console.log('DEBUG getProcessedHtml: processed html length =', html?.length);
        const hasTOCPlaceholder = html.includes('@TOC@') || html.includes('@TOC');
        if (useAutoTOC || hasTOCPlaceholder) {
            html = addAutomaticTOC(html, isForExport, useThaiDigits, useAutoTOC);
        }
        // Cleanup leftover placeholders (if headings were empty or if TOC was disabled)
        html = html.replaceAll('@TOC@', '').replaceAll('@TOC', '');
        return html;
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
    async function handleDownloadWord() {
        if (!reportContentRef.current) return;

        const filename = isTemplateMode ? `template.docx` : `report_${safeData.domain || 'report'}.doc`.replace('.doc', '.docx');

        const legacyHeader = "<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
            "xmlns:w='urn:schemas-microsoft-com:office:word' " +
            "xmlns='http://www.w3.org/TR/REC-html40'>" +
            "<head><meta charset='utf-8'><title>Export HTML to Word Document</title>" +
            "<style>" +
            "@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');" +
            "/* Define Page Size and Margins (Standard) */" +
            "@page Section1 { size: 21cm 29.7cm; margin: " + (pageMargins.top !== undefined && pageMargins.top !== '' ? pageMargins.top : 2.54) + "cm " + (pageMargins.right !== undefined && pageMargins.right !== '' ? pageMargins.right : 2.54) + "cm " + (pageMargins.bottom !== undefined && pageMargins.bottom !== '' ? pageMargins.bottom : 2.54) + "cm " + (pageMargins.left !== undefined && pageMargins.left !== '' ? pageMargins.left : 2.54) + "cm; mso-header-margin:0pt; mso-footer-margin:0pt; mso-paper-source:0; }" +
            "@page { margin-top: " + (pageMargins.top !== undefined && pageMargins.top !== '' ? pageMargins.top : 2.54) + "cm; margin-bottom: " + (pageMargins.bottom !== undefined && pageMargins.bottom !== '' ? pageMargins.bottom : 2.54) + "cm; margin-left: " + (pageMargins.left !== undefined && pageMargins.left !== '' ? pageMargins.left : 2.54) + "cm; margin-right: " + (pageMargins.right !== undefined && pageMargins.right !== '' ? pageMargins.right : 2.54) + "cm; }" +
            "div.Section1 { page: Section1; }" +
            "body { font-family: 'TH SarabunPSK'; font-size: 16pt; white-space: pre-wrap; margin: 0 !important; padding: 0 !important; }" +
            "i, em { font-style: italic !important; }" +
            "b, strong { font-weight: bold !important; }" +
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
            "</head><body style='margin:0;padding:0;'><div class='Section1'>";

        const cleanHeader = "<style>" +
            "@page Section1 { size: 21cm 29.7cm; margin: " + (pageMargins.top !== undefined && pageMargins.top !== '' ? pageMargins.top : 2.54) + "cm " + (pageMargins.right !== undefined && pageMargins.right !== '' ? pageMargins.right : 2.54) + "cm " + (pageMargins.bottom !== undefined && pageMargins.bottom !== '' ? pageMargins.bottom : 2.54) + "cm " + (pageMargins.left !== undefined && pageMargins.left !== '' ? pageMargins.left : 2.54) + "cm; }" +
            "@page { margin-top: " + (pageMargins.top !== undefined && pageMargins.top !== '' ? pageMargins.top : 2.54) + "cm; margin-bottom: " + (pageMargins.bottom !== undefined && pageMargins.bottom !== '' ? pageMargins.bottom : 2.54) + "cm; margin-left: " + (pageMargins.left !== undefined && pageMargins.left !== '' ? pageMargins.left : 2.54) + "cm; margin-right: " + (pageMargins.right !== undefined && pageMargins.right !== '' ? pageMargins.right : 2.54) + "cm; }" +
            "body, p, div, span, td, th { font-family: 'Arial', sans-serif; font-size: 11pt; }" +
            "img { max-width: 100%; height: auto; display: block; margin: 10px auto; }" +
            "table { width: 100%; border-collapse: collapse; margin: 10px 0; border: 1px solid #000; }" +
            "td, th { border: 1px solid #000; padding: 5px; }" +
            "h1, h2, h3 { color: #1a56db; font-family: 'Arial', sans-serif; }" +
            "</style><div class='Section1'>";

        const footer = "</div>";

        let cleanHTML = "";

        const tempDiv = document.createElement('div');
        if (isEditing) {
            let baseHtml = localTemplate;
            if (useAutoTOC) {
                baseHtml = addAutomaticTOC(baseHtml, true, useThaiDigits, useAutoTOC);
            }
            tempDiv.innerHTML = baseHtml;
        } else {
            let cloneHtml = getProcessedHtml(true); // Generates processed template with the black TOC at the correct @TOC@ placeholder location!
            tempDiv.innerHTML = cloneHtml;
        }

        // Process non-breaking spaces
        const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            if (node.nodeValue) {
                node.nodeValue = node.nodeValue.replace(/ (?= )/g, '\u00A0');
            }
        }

        // Inline relative images to ensure fallback/offline screenshots render correctly in Word
        try {
            const imgs = Array.from(tempDiv.querySelectorAll('img'));
            console.log(`🔍 handleDownloadWord: Found ${imgs.length} images for potential client-side inlining.`);
            for (const img of imgs) {
                const src = img.getAttribute('src');
                if (src && !src.startsWith('data:') && !src.startsWith('http:') && !src.startsWith('https:')) {
                    console.log(`   Inlining relative image: "${src}"`);
                    try {
                        const cleanSrc = src.startsWith('/') ? src : '/' + src;
                        const res = await fetch(cleanSrc);
                        if (res.ok) {
                            const blob = await res.blob();
                            const base64 = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });
                            img.setAttribute('src', base64);
                            console.log(`   ✅ Inlined successfully: "${src}"`);
                        } else {
                            console.warn(`   ❌ Failed to fetch: "${src}", status: ${res.status}`);
                        }
                    } catch (err) {
                        console.warn(`   ❌ Error fetching relative image: "${src}"`, err);
                    }
                }
            }
        } catch (inlineErr) {
            console.error('Failed to inline images client-side:', inlineErr);
        }

        // Helper to process images for Word centering compatibility
        const processImagesForWord = (container) => {
            const imgs = container.querySelectorAll('img');
            imgs.forEach(img => {
                const imgStyle = img.getAttribute('style') || '';
                const imgAlign = img.getAttribute('align') || '';
                const imgClass = img.getAttribute('class') || '';
                
                let isCentered = false;
                
                if (imgAlign.toLowerCase() === 'center' || imgClass.includes('aligncenter')) {
                    isCentered = true;
                } else if (/margin-left:\s*auto/i.test(imgStyle) && /margin-right:\s*auto/i.test(imgStyle)) {
                    isCentered = true;
                } else if (/margin:\s*[^;]*auto/i.test(imgStyle)) {
                    isCentered = true;
                }
                
                let parent = img.parentElement;
                while (parent && parent !== container) {
                    const parentTagName = parent.tagName.toLowerCase();
                    const parentStyle = parent.getAttribute('style') || '';
                    const parentAlign = parent.getAttribute('align') || '';
                    
                    if (parentAlign.toLowerCase() === 'center' || /text-align:\s*center/i.test(parentStyle)) {
                        isCentered = true;
                        break;
                    }
                    if (['p', 'div', 'td', 'th', 'table', 'body'].includes(parentTagName)) {
                        break;
                    }
                    parent = parent.parentElement;
                }
                
                if (isCentered) {
                    let targetBlock = img.parentElement;
                    while (targetBlock && targetBlock !== container) {
                        const tag = targetBlock.tagName.toLowerCase();
                        if (['p', 'div', 'td', 'th'].includes(tag)) {
                            break;
                        }
                        targetBlock = targetBlock.parentElement;
                    }
                    
                    if (targetBlock && targetBlock !== container && ['p', 'div'].includes(targetBlock.tagName.toLowerCase())) {
                        targetBlock.setAttribute('align', 'center');
                        let style = targetBlock.getAttribute('style') || '';
                        if (!/text-align:\s*center/i.test(style)) {
                            style = (style.trim() && !style.trim().endsWith(';') ? style + ';' : style) + ' text-align: center;';
                            targetBlock.setAttribute('style', style);
                        }
                    } else {
                        const p = document.createElement('p');
                        p.setAttribute('align', 'center');
                        p.setAttribute('style', 'text-align: center;');
                        img.parentNode.insertBefore(p, img);
                        p.appendChild(img);
                    }
                    
                    let cleanImgStyle = imgStyle
                        .replace(/margin-left:\s*auto;?/gi, '')
                        .replace(/margin-right:\s*auto;?/gi, '')
                        .replace(/margin:\s*[^;]*auto;?/gi, '')
                        .replace(/float:\s*[^;]+;?/gi, '');
                    img.setAttribute('style', cleanImgStyle);
                }
            });
        };

        processImagesForWord(tempDiv);

        cleanHTML = tempDiv.innerHTML;
        cleanHTML = useThaiDigits ? convertDigitsToThaiTextNodes(cleanHTML) : cleanHTML;

        if (!isEditing) {
            cleanHTML = cleanHTML.replace(/<p[^>]*>\s*(<div[^>]*>)/gi, '$1');
            cleanHTML = cleanHTML.replace(/(<\/div>)\s*<\/p>/gi, '$1');
        }

        let sourceHTML = legacyHeader + cleanHTML + footer;
        sourceHTML = sourceHTML.replace(/<(\/?)strong\b([^>]*)>/gi, '<$1b$2>');
        sourceHTML = sourceHTML.replace(/<(\/?)em\b([^>]*)>/gi, '<$1i$2>');
        sourceHTML = sourceHTML.replace(/font-size:\s*(\d+(?:\.\d+)?)px/gi, 'font-size: $1pt');

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

            const marginsField = document.createElement('input');
            marginsField.type = 'hidden';
            marginsField.name = 'margins';
            try {
                const storedMargins = localStorage.getItem('ntbc:page-margins');
                if (storedMargins) {
                    marginsField.value = storedMargins;
                    form.appendChild(marginsField);
                }
            } catch (e) {}

            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);

            // Remove iframe shortly after to avoid a persistent loading indicator.
            window.setTimeout(() => {
                try { document.body.removeChild(iframe); } catch (_) { }
            }, 1500);
        };

        try {
            // Use a hidden iframe target so the browser downloads .docx with exact margins
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



    const handleSave = async () => {
        let contentToSave = localTemplate;

        // Convert any TinyMCE blob images to Base64 before saving
        if (editorRef.current) {
            try {
                await editorRef.current.uploadImages();
                contentToSave = editorRef.current.getContent();
            } catch (uploadError) {
                console.error('Error uploading/inlining images in TinyMCE:', uploadError);
            }
        }

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
                    <div ref={reportContentRef} className="report-content space-y-4 text-base leading-relaxed flex-1 overflow-auto bg-white text-black rounded-lg shadow-sm" style={{ fontFamily: '"TH SarabunPSK"', padding: isEditing ? '0' : `${pageMargins.top !== undefined && pageMargins.top !== '' ? pageMargins.top : 2.54}cm ${pageMargins.right !== undefined && pageMargins.right !== '' ? pageMargins.right : 2.54}cm ${pageMargins.bottom !== undefined && pageMargins.bottom !== '' ? pageMargins.bottom : 2.54}cm ${pageMargins.left !== undefined && pageMargins.left !== '' ? pageMargins.left : 2.54}cm`, boxSizing: 'border-box' }}>

                        {isEditing ? (
                            <div className="flex gap-4 h-full relative">
                                {/* If collapsed, show a floating vertical strip or button on the right edge */}
                                {isVariablesCollapsed && (
                                    <button
                                        type="button"
                                        onClick={() => setIsVariablesCollapsed(false)}
                                        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-l-md shadow-md flex flex-col items-center gap-1.5 transition-all py-3"
                                        title="Expand Variables Panel"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider [writing-mode:vertical-lr] rotate-180">Variables</span>
                                    </button>
                                )}
                                {/* Editor Section - Left */}
                                <div className="flex-1 flex flex-col min-w-0">
                                    <div className="flex-1 bg-white text-black rounded-lg overflow-hidden border border-gray-300">
                                        <Editor
                                            key="ntbc-template-editor"
                                            tinymceScriptSrc='/systems/tinymce/tinymce.min.js'
                                            licenseKey='gpl'
                                            onInit={(evt, editor) => editorRef.current = editor}
                                            value={localTemplate}
                                            onEditorChange={(content) => setLocalTemplate(content)}
                                            init={{
                                                height: '100%',
                                                menubar: false,
                                                content_style: `@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap'); body { font-family: "TH SarabunPSK"; font-size: 16pt; padding: 16px 20px; margin: 0; box-sizing: border-box; } h1 { font-size: 24pt; font-weight: bold; } h2 { font-size: 18pt; font-weight: bold; } h3 { font-size: 14pt; font-weight: bold; }`,
                                                font_size_formats: '8pt 10pt 12pt 14pt 16pt 18pt 20pt 22pt 24pt 26pt 28pt 30pt 32pt 34pt 36pt 38pt 40pt 42pt 44pt 46pt 48pt',
                                                plugins: [
                                                    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                                                    'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                                                    'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount', 'nonbreaking'
                                                ],
                                                toolbar: 'undo redo | blocks fontfamily fontsize lineheight | ' +
                                                    'bold italic forecolor | alignleft aligncenter ' +
                                                    'alignright alignjustify | bullist numlist outdent indent | ' +
                                                    'image table | removeformat | help',
                                                line_height_formats: '1 1.15 1.5 2 2.5 3',
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
                                <div
                                    className={`flex-shrink-0 flex flex-col ${t.rawData || 'bg-gray-50 border-gray-200'} rounded-lg border overflow-hidden transition-all duration-300 shadow-sm ${
                                        isVariablesCollapsed ? 'p-0 border-0 opacity-0' : 'p-3.5 opacity-100'
                                    }`}
                                    style={{
                                        width: isVariablesCollapsed ? '0px' : '580px',
                                        minWidth: isVariablesCollapsed ? '0px' : '580px'
                                    }}
                                >
                                    {/* Top Bar: Title & Search & Unused Toggle */}
                                    <div className={`flex flex-col gap-2.5 sticky top-0 ${t.modalHeaderBg || 'bg-gray-50'} pb-2.5 border-b ${t.modalBorder || 'border-gray-200'} flex-shrink-0 ${isVariablesCollapsed ? 'hidden' : ''}`}>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsVariablesCollapsed(true)}
                                                    className="p-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded transition-colors cursor-pointer flex items-center justify-center"
                                                    title="ซ่อนแถบตัวแปร"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                                <div className="flex items-center gap-1.5">
                                                    <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                    <span className={`font-bold text-sm ${t.text || 'text-gray-800'}`}>ตัวแปรเทมเพลต</span>
                                                </div>
                                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                    {filteredVariables.length} ตัวแปร
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsConfigExpanded(!isConfigExpanded)}
                                                    className={`px-2 py-1 text-xs font-semibold rounded-md border flex items-center gap-1 transition-colors ${
                                                        isConfigExpanded
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100'
                                                    }`}
                                                    title="เปิด/ปิดการตั้งค่าตัวแปรเชิงตัวเลข"
                                                >
                                                    <Settings className="w-3 h-3" />
                                                    <span>Config</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setShowUnusedOnly(!showUnusedOnly)}
                                                    className={`px-2.5 py-1 text-xs font-semibold rounded-md border flex items-center gap-1.5 transition-all shadow-2xs ${
                                                        showUnusedOnly
                                                            ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-400/30'
                                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100'
                                                    }`}
                                                    title="แสดงเฉพาะตัวแปรที่ยังไม่ได้ใส่ในเทมเพลต"
                                                >
                                                    <span className={`w-2 h-2 rounded-full ${showUnusedOnly ? 'bg-white animate-pulse' : 'bg-amber-500'}`}></span>
                                                    <span>ยังไม่ใช้ ({unusedCount})</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Search Input */}
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="ค้นหาตัวแปร, คำอธิบาย, หรือหมวดหมู่..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className={`w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${t.dropdown?.bg || 'bg-white'} ${t.dropdown?.text || 'text-gray-800'} ${t.dropdown?.border || 'border-gray-300'}`}
                                            />
                                            {searchTerm && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSearchTerm('')}
                                                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Category Filter Chips */}
                                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
                                            {categories.map(cat => {
                                                const meta = CATEGORY_META[cat] || { label: cat };
                                                const isActive = selectedCategory === cat;
                                                const count = categoryCounts[cat] || 0;
                                                return (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        onClick={() => setSelectedCategory(cat)}
                                                        className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                                                            isActive
                                                                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/30'
                                                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                        }`}
                                                    >
                                                        {renderCategoryIcon(cat, "w-3 h-3")}
                                                        <span>{meta.label}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                                            isActive
                                                                ? 'bg-blue-700 text-blue-100'
                                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                                        }`}>
                                                            {count}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Scrollable Container for all sections below header */}
                                    <div className={`flex-1 overflow-y-auto space-y-3.5 pr-1 custom-scrollbar ${isVariablesCollapsed ? 'hidden' : ''}`}>
                                        {/* Collapsible Traffic Comparison Config Panel */}
                                        {isConfigExpanded && (
                                            <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg shadow-2xs animate-fade-in">
                                                <div className="text-[11px] font-bold text-orange-700 dark:text-orange-300 mb-2 uppercase tracking-wider flex items-center justify-between">
                                                    <span>Report Text Variables Config</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsConfigExpanded(false)}
                                                        className="text-gray-400 hover:text-gray-600 text-[10px]"
                                                    >
                                                        ย่อเก็บ ✕
                                                    </button>
                                                </div>
                                                
                                                {/* Row 1: Requests */}
                                                <div className="mb-2 pb-2 border-b border-orange-100 dark:border-orange-900/50">
                                                    <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1 font-mono">Requests Trend (@TRAFFIC_CHANGE_TEXT & @TRAFFIC_CHANGE_PCT)</div>
                                                    <div className="flex gap-3">
                                                        <div className="flex-1">
                                                            <select
                                                                value={trafficChangeText}
                                                                onChange={(e) => setTrafficChangeText(e.target.value)}
                                                                className="w-full text-xs p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-200 font-medium"
                                                            >
                                                                <option value="เพิ่มขึ้น">เพิ่มขึ้น (Increase)</option>
                                                                <option value="ลดลง">ลดลง (Decrease)</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex-1">
                                                            <input
                                                                type="text"
                                                                value={trafficChangePct}
                                                                onChange={(e) => setTrafficChangePct(e.target.value)}
                                                                className="w-full text-xs p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-200 font-medium"
                                                                placeholder="เช่น 1.79%"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Row 2: Data Transfer */}
                                                <div className="mb-2 pb-2 border-b border-orange-100 dark:border-orange-900/50">
                                                    <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1 font-mono">Data Transfer Trend (@DATA_TRANSFER_CHANGE_TEXT & @DATA_TRANSFER_CHANGE_PCT)</div>
                                                    <div className="flex gap-3">
                                                        <div className="flex-1">
                                                            <select
                                                                value={dataTransferChangeText}
                                                                onChange={(e) => setDataTransferChangeText(e.target.value)}
                                                                className="w-full text-xs p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-200 font-medium"
                                                            >
                                                                <option value="เพิ่มขึ้น">เพิ่มขึ้น (Increase)</option>
                                                                <option value="ลดลง">ลดลง (Decrease)</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex-1">
                                                            <input
                                                                type="text"
                                                                value={dataTransferChangePct}
                                                                onChange={(e) => setDataTransferChangePct(e.target.value)}
                                                                className="w-full text-xs p-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-200 font-medium"
                                                                placeholder="เช่น 17.43%"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Row 3: Argo Performance */}
                                                <div className="mb-2 pb-2 border-b border-orange-100 dark:border-orange-900/50">
                                                    <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1 font-mono">Argo Performance (@ARGO_IMPROVEMENT_PCT & RT before/after)</div>
                                                    <div className="flex gap-2">
                                                        <div className="flex-[4] relative">
                                                            <span className="absolute left-1.5 top-2.5 text-[8px] text-gray-400 font-bold uppercase pointer-events-none">Imp</span>
                                                            <input
                                                                type="text"
                                                                value={argoImprovementPct}
                                                                onChange={(e) => setArgoImprovementPct(e.target.value)}
                                                                className="w-full text-xs p-1.5 pl-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-200 font-medium"
                                                                placeholder="29.84%"
                                                                title="Argo Response Time Improvement %"
                                                            />
                                                        </div>
                                                        <div className="flex-[4] relative">
                                                            <span className="absolute left-1.5 top-2.5 text-[8px] text-gray-400 font-bold uppercase pointer-events-none">Bf</span>
                                                            <input
                                                                type="text"
                                                                value={argoResponseTimeBefore}
                                                                onChange={(e) => setArgoResponseTimeBefore(e.target.value)}
                                                                className="w-full text-xs p-1.5 pl-5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-200 font-medium"
                                                                placeholder="1.15 s"
                                                                title="Response Time before Argo"
                                                            />
                                                        </div>
                                                        <div className="flex-[4] relative">
                                                            <span className="absolute left-1.5 top-2.5 text-[8px] text-gray-400 font-bold uppercase pointer-events-none">Af</span>
                                                            <input
                                                                type="text"
                                                                value={argoResponseTimeAfter}
                                                                onChange={(e) => setArgoResponseTimeAfter(e.target.value)}
                                                                className="w-full text-xs p-1.5 pl-5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-200 font-medium"
                                                                placeholder="804 ms"
                                                                title="Response Time after Argo"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Row 4: Speed Test Desktop */}
                                                <div className="mb-2 pb-2 border-b border-orange-100 dark:border-orange-900/50">
                                                    <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1 font-mono">Speed Desktop (@SPEED_TTI, @SPEED_INDEX, @SPEED_SCORE, @SPEED_LEVEL)</div>
                                                    <div className="flex gap-2 mb-1.5">
                                                        <div className="flex-1 relative">
                                                            <span className="absolute left-1.5 top-2.5 text-[8px] text-gray-400 font-bold uppercase pointer-events-none">TTI</span>
                                                            <input
                                                                type="text"
                                                                value={speedTimeToInteractive}
                                                                onChange={(e) => setSpeedTimeToInteractive(e.target.value)}
                                                                className="w-full text-[11px] p-1.5 pl-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-200 font-medium"
                                                                placeholder="1,221 ms"
                                                                title="Desktop Time to Interactive"
                                                            />
                                                        </div>
                                                        <div className="flex-1 relative">
                                                            <span className="absolute left-1.5 top-2.5 text-[8px] text-gray-400 font-bold uppercase pointer-events-none">Idx</span>
                                                            <input
                                                                type="text"
                                                                value={speedIndex}
                                                                onChange={(e) => setSpeedIndex(e.target.value)}
                                                                className="w-full text-[11px] p-1.5 pl-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-200 font-medium"
                                                                placeholder="1,165 ms"
                                                                title="Desktop Speed Index"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <div className="flex-1 relative">
                                                            <span className="absolute left-1.5 top-2.5 text-[8px] text-gray-400 font-bold uppercase pointer-events-none">Scr</span>
                                                            <input
                                                                type="text"
                                                                value={speedScorePct}
                                                                onChange={(e) => setSpeedScorePct(e.target.value)}
                                                                className="w-full text-[11px] p-1.5 pl-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-200 font-medium"
                                                                placeholder="97%"
                                                                title="Desktop Performance Score %"
                                                            />
                                                        </div>
                                                        <div className="flex-1 relative">
                                                            <span className="absolute left-1.5 top-2.5 text-[8px] text-gray-400 font-bold uppercase pointer-events-none">Lvl</span>
                                                            <input
                                                                type="text"
                                                                value={speedLevel}
                                                                onChange={(e) => setSpeedLevel(e.target.value)}
                                                                className="w-full text-[11px] p-1.5 pl-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-200 font-medium"
                                                                placeholder="ดีเยี่ยม"
                                                                title="Desktop Performance Level"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Row 5: Speed Test Mobile */}
                                                <div>
                                                    <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1 font-mono">Speed Mobile (@SPEED_MOBILE_TTI, @SPEED_MOBILE_INDEX, @SPEED_MOBILE_SCORE, @SPEED_MOBILE_LEVEL)</div>
                                                    <div className="flex gap-2 mb-1.5">
                                                        <div className="flex-1 relative">
                                                            <span className="absolute left-1.5 top-2.5 text-[8px] text-gray-400 font-bold uppercase pointer-events-none">TTI</span>
                                                            <input
                                                                type="text"
                                                                value={speedMobileTimeToInteractive}
                                                                onChange={(e) => setSpeedMobileTimeToInteractive(e.target.value)}
                                                                className="w-full text-[11px] p-1.5 pl-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-200 font-medium"
                                                                placeholder="5,924 ms"
                                                                title="Mobile Time to Interactive"
                                                            />
                                                        </div>
                                                        <div className="flex-1 relative">
                                                            <span className="absolute left-1.5 top-2.5 text-[8px] text-gray-400 font-bold uppercase pointer-events-none">Idx</span>
                                                            <input
                                                                type="text"
                                                                value={speedMobileIndex}
                                                                onChange={(e) => setSpeedMobileIndex(e.target.value)}
                                                                className="w-full text-[11px] p-1.5 pl-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-200 font-medium"
                                                                placeholder="3,259 ms"
                                                                title="Mobile Speed Index"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <div className="flex-1 relative">
                                                            <span className="absolute left-1.5 top-2.5 text-[8px] text-gray-400 font-bold uppercase pointer-events-none">Scr</span>
                                                            <input
                                                                type="text"
                                                                value={speedMobileScorePct}
                                                                onChange={(e) => setSpeedMobileScorePct(e.target.value)}
                                                                className="w-full text-[11px] p-1.5 pl-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-200 font-medium"
                                                                placeholder="67%"
                                                                title="Mobile Performance Score %"
                                                            />
                                                        </div>
                                                        <div className="flex-1 relative">
                                                            <span className="absolute left-1.5 top-2.5 text-[8px] text-gray-400 font-bold uppercase pointer-events-none">Lvl</span>
                                                            <input
                                                                type="text"
                                                                value={speedMobileLevel}
                                                                onChange={(e) => setSpeedMobileLevel(e.target.value)}
                                                                className="w-full text-[11px] p-1.5 pl-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700 dark:text-gray-200 font-medium"
                                                                placeholder="กลาง"
                                                                title="Mobile Performance Level"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Variable Cards List */}
                                        {groupedVariables.length > 0 && groupedVariables.some(g => g.items.length > 0) ? (
                                            groupedVariables.map(group => {
                                                if (!group.items || group.items.length === 0) return null;
                                                const meta = CATEGORY_META[group.category] || { label: group.category };
                                                return (
                                                    <div key={group.category} className="space-y-1.5">
                                                        {/* Category Section Header */}
                                                        <div className="flex items-center justify-between px-2 py-1 sticky top-0 bg-gray-100/90 dark:bg-gray-800/90 backdrop-blur-xs rounded-md z-5 border border-gray-200/60 dark:border-gray-700/60 shadow-2xs">
                                                            <div className="flex items-center gap-1.5">
                                                                {renderCategoryIcon(group.category, "w-3.5 h-3.5 text-blue-600 dark:text-blue-400")}
                                                                <span className="font-bold text-xs text-gray-800 dark:text-gray-200">
                                                                    {meta.label}
                                                                </span>
                                                                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                                                                    ({group.category})
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                                {group.items.length} รายการ
                                                            </span>
                                                        </div>

                                                        {/* Variable Item Cards */}
                                                        <div className="grid grid-cols-1 gap-1.5">
                                                            {group.items.map(v => {
                                                                const isUsed = typeof localTemplate === 'string' && localTemplate.includes(v.name);
                                                                const isCopied = copiedVarName === v.name;
                                                                const isScreenshot = v.category === 'Screenshots' || v.category === 'Traffic Screenshots';
                                                                return (
                                                                    <div
                                                                        key={v.name}
                                                                        onClick={() => insertVariable(v.name)}
                                                                        className={`group p-2.5 rounded-lg border transition-all cursor-pointer flex items-start justify-between gap-3 relative ${
                                                                            isCopied
                                                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 shadow-md ring-2 ring-emerald-400/30'
                                                                                : isScreenshot
                                                                                    ? 'bg-white dark:bg-gray-800 border-orange-200 dark:border-orange-900/50 hover:border-orange-400 hover:shadow-sm'
                                                                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm'
                                                                        }`}
                                                                        title={`คลิกเพื่อแทรก ${v.name} ลงในเทมเพลต`}
                                                                    >
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                                <code className={`font-mono text-xs font-bold px-2 py-0.5 rounded border transition-colors ${
                                                                                    isScreenshot
                                                                                        ? 'bg-orange-50 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800 group-hover:bg-orange-100'
                                                                                        : 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 group-hover:bg-blue-100 group-hover:text-blue-800'
                                                                                }`}>
                                                                                    {v.name}
                                                                                </code>
                                                                                {isUsed ? (
                                                                                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 flex items-center gap-0.5">
                                                                                        <Check className="w-2.5 h-2.5" /> ใช้แล้ว
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                                                                        ยังไม่ใช้
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug">
                                                                                {v.desc}
                                                                            </p>
                                                                            {v.example && (
                                                                                <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 font-mono truncate">
                                                                                    <span>ตัวอย่าง:</span>
                                                                                    <span className="text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-1 py-0.2 rounded truncate max-w-[280px]">
                                                                                        {v.example}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Insert Action Button */}
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                insertVariable(v.name);
                                                                            }}
                                                                            className={`flex-shrink-0 px-2 py-1 text-xs font-semibold rounded-md border flex items-center gap-1 transition-all ${
                                                                                isCopied
                                                                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                                                                    : isScreenshot
                                                                                        ? 'bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-200 border-orange-300 dark:border-orange-700 group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600'
                                                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600'
                                                                            }`}
                                                                        >
                                                                            {isCopied ? (
                                                                                <>
                                                                                    <CheckCheck className="w-3 h-3 animate-bounce" />
                                                                                    <span>แทรกแล้ว</span>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <Plus className="w-3 h-3" />
                                                                                    <span>แทรก</span>
                                                                                </>
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="p-8 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center gap-2">
                                                <Search className="w-8 h-8 opacity-40" />
                                                <p className="text-sm font-medium">ไม่พบตัวแปรที่ตรงกับ &quot;{searchTerm}&quot;</p>
                                                <p className="text-xs text-gray-400">ลองค้นหาด้วยคำอื่น หรือเลือกหมวดหมู่อื่น</p>
                                            </div>
                                        )}
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
                            {mode !== 'report' && (
                                <button onClick={() => setIsEditing(true)} className={`px-4 py-2 ${t.button} text-xs font-bold rounded flex items-center gap-2 transition-colors`}>
                                    <Edit3 className="w-3 h-3" /> Edit Template
                                </button>
                            )}
                            <button onClick={handleDownloadWord} className={`px-4 py-2 ${t.buttonPrimary} text-xs font-bold rounded flex items-center gap-2 transition-colors`}>
                                <FileType className="w-3 h-3" /> Download Word
                            </button>
                        </>
                    )}
                </div>
            </div>
            {/* ScreenshotPreviewModal moved to main page to be rendered correctly overlaying everything */}
        </div >
    );
};


// --- THEME CONFIG ---
// --- THEME CONFIG ---
// Moved to '@/app/utils/themes'

// Batch Report Modal Component
const BatchReportModal = ({ isOpen, onClose, hosts: dashboardHosts, onConfirm, theme, selectedZone: initialZoneId, selectedAccount: initialAccountId, accounts = [], currentUser, loading }) => {
    const [batchStartDate, setBatchStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [batchEndDate, setBatchEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('default');
    const [exportThaiDigits, setExportThaiDigits] = useState(false);
    
    // Global Queue State
    const [batchQueue, setBatchQueue] = useState([]);
    
    // Internal selection states
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [zones, setZones] = useState([]);
    const [loadingZones, setLoadingZones] = useState(false);
    const [selectedZones, setSelectedZones] = useState(new Set()); // Used for selecting multiple zones in UI
    
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
            setBatchQueue([]);
            setSelectedZones(new Set());
            const savedAccount = typeof window !== 'undefined' ? localStorage.getItem('ntbc:default:accountId') : '';

            setSelectedAccountId(initialAccountId || savedAccount || '');

            listTemplates().then(list => {
                if (typeof window === 'undefined') { setTemplates(list); return; }
                const userKey = currentUser?.id ? String(currentUser.id) : 'anonymous';
                const keyDefault = `ntbc:templates:${userKey}:defaultTemplateId`;
                const keyHidden = `ntbc:templates:${userKey}:hiddenTemplateIds`;
                
                let hidden = [];
                try { hidden = JSON.parse(localStorage.getItem(keyHidden) || '[]'); } catch (_) {}
                hidden = hidden.map(String);
                let filtered = list.filter(t => !hidden.includes(String(t.id)));
                if (filtered.length === 0 && list.length > 0) filtered = list;
                setTemplates(filtered);

                const storedDefault = localStorage.getItem('ntbc:default:templateId') || localStorage.getItem(keyDefault) || 'default';
                if (filtered.find(t => String(t.id) === String(storedDefault))) {
                    setSelectedTemplateId(String(storedDefault));
                } else if (filtered.length > 0) {
                    setSelectedTemplateId(String(filtered[0].id));
                }
            });
        }
    }, [isOpen, initialAccountId]);

    useEffect(() => {
        if (!isOpen || !selectedAccountId) return;
        let isMounted = true;
        const fetchZones = async () => {
            setLoadingZones(true);
            const result = await callScrapeApi('list-zones', { accountId: selectedAccountId });
            if (isMounted) {
                if (result.success && result.data) setZones(result.data);
                else setZones([]);
                setLoadingZones(false);
                setSelectedZones(new Set()); // Reset selected zones when account changes
            }
        };
        fetchZones();
        return () => { isMounted = false; };
    }, [selectedAccountId, isOpen]);

    const handleSetDefaultAccount = (e) => {
        console.log('--- handleSetDefaultAccount CALLED ---, selectedAccountId:', selectedAccountId);
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (selectedAccountId) {
            localStorage.setItem('ntbc:default:accountId', selectedAccountId);
            Swal.fire({
                title: 'Default Account Set',
                text: 'This account will be loaded by default in the future.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                background: theme?.modalBg || '#111827',
                color: theme?.text || '#fff'
            });
        } else {
            Swal.fire({
                title: 'No Account Selected',
                text: 'Please select an account first.',
                icon: 'warning',
                timer: 1500,
                showConfirmButton: false,
                background: theme?.modalBg || '#111827',
                color: theme?.text || '#fff'
            });
        }
    };

    const toggleZone = (zoneId) => {
        const next = new Set(selectedZones);
        if (next.has(zoneId)) next.delete(zoneId);
        else next.add(zoneId);
        setSelectedZones(next);
    };

    const toggleAllZones = () => {
        if (selectedZones.size === zones.length) {
            setSelectedZones(new Set());
        } else {
            setSelectedZones(new Set(zones.map(z => z.id)));
        }
    };

    const addToQueue = () => {
        if (!selectedAccountId || selectedZones.size === 0) return;
        const accountObj = accounts.find(a => a.id === selectedAccountId);
        
        const newItems = Array.from(selectedZones).map(zoneId => {
            return {
                accountId: selectedAccountId,
                accountName: accountObj ? accountObj.name : selectedAccountId,
                zoneId: zoneId,
                zoneName: getZoneName(zoneId, zones),
                domain: '__ALL_SUBDOMAINS__'
            };
        });
        
        setBatchQueue(prev => {
            const next = [...prev];
            newItems.forEach(item => {
                if (!next.find(i => i.zoneId === item.zoneId)) {
                    next.push(item);
                }
            });
            return next;
        });
        setSelectedZones(new Set());
    };

    const removeFromQueue = (index) => {
        setBatchQueue(prev => prev.filter((_, i) => i !== index));
    };

    if (!isOpen) return null;
    const t = theme || THEMES.dark;

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in ${t.modalOverlay}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={`${t.modalBg} ${t.modalBorder} border rounded-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl`}>
                <div className={`p-4 border-b ${t.modalBorder} ${t.modalHeaderBg} flex justify-between items-center`}>
                    <h3 className={`text-lg font-bold ${t.modalTitle} flex items-center gap-2`}>
                        <List className={`w-5 h-5 ${t.iconAccent || 'text-purple-400'}`} />
                        Batch Generate Reports (Zone Level)
                    </h3>
                    <button onClick={onClose} className={`${t.modalCloseIcon} transition-colors`}><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: Selection */}
                    <div className="space-y-4">
                        <div className={`p-3 ${t.selectorContainer} rounded-lg border ${t.modalBorder} grid grid-cols-1 gap-4`}>
                            <SearchableDropdown theme={theme} icon={<Key className="w-3.5 h-3.5 text-blue-400" />} label="1. Select Account" placeholder={loading ? "Loading..." : "Choose an account..."} options={accounts.map(acc => ({ value: acc.id, label: acc.name }))} value={selectedAccountId} onChange={setSelectedAccountId} rightAction={<button type="button" onClick={handleSetDefaultAccount} className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer uppercase transition-colors">Set Default</button>} loading={loading && accounts.length === 0} />
                        </div>
                        
                        {/* Zones List */}
                        <div className={`p-3 ${t.selectorContainer} rounded-lg border ${t.modalBorder} flex flex-col max-h-80`}>
                            <div className="flex justify-between items-center mb-2">
                                <label className={`block text-xs font-bold ${t.subText} uppercase tracking-wide`}>2. Select Zones</label>
                                <button onClick={toggleAllZones} className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold uppercase tracking-wide transition-colors">Select All</button>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-1 mt-2 pr-2">
                                {loadingZones && <div className="text-xs text-gray-500 py-2">Loading zones...</div>}
                                {!loadingZones && zones.length === 0 && <div className="text-xs text-gray-500 py-2">No zones found or select an account first.</div>}
                                {!loadingZones && zones.map(zone => (
                                    <div key={zone.id} onClick={() => toggleZone(zone.id)} className={`cursor-pointer flex items-center justify-between p-2 rounded text-xs transition-colors ${selectedZones.has(zone.id) ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-gray-800 text-gray-300'}`}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedZones.has(zone.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-600'}`}>
                                                {selectedZones.has(zone.id) && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <span>{zone.name}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={addToQueue} disabled={selectedZones.size === 0} className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded">
                                Add to Batch Queue
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Queue & Settings */}
                    <div className="space-y-4">
                        <div className={`p-3 ${t.selectorContainer} rounded-lg border ${t.modalBorder}`}>
                            <label className={`block text-xs font-bold ${t.subText} uppercase tracking-wide mb-2`}>Settings</label>
                            <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} className={`mb-3 ${t.dropdown.bg} ${t.dropdown.border} border ${t.dropdown.inputText} rounded p-2.5 w-full text-sm outline-none`}>
                                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs ${t.subText} w-10`}>Start:</span>
                                <input type="date" value={batchStartDate} max={new Date().toISOString().split('T')[0]} onChange={e => setBatchStartDate(e.target.value)} className={`flex-1 px-2 py-1 text-xs rounded border ${t.dropdown.bg} ${t.dropdown.text} ${t.dropdown.border}`} />
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs ${t.subText} w-10`}>End:</span>
                                <input type="date" value={batchEndDate} max={new Date().toISOString().split('T')[0]} onChange={e => setBatchEndDate(e.target.value)} className={`flex-1 px-2 py-1 text-xs rounded border ${t.dropdown.bg} ${t.dropdown.text} ${t.dropdown.border}`} />
                            </div>
                            <div className="flex items-center gap-2 mt-3 mb-1">
                                <label className={`flex items-center gap-2 cursor-pointer text-xs ${t.subText}`}>
                                    <input 
                                        type="checkbox" 
                                        id="batch-thai-digits-toggle"
                                        checked={exportThaiDigits} 
                                        onChange={e => setExportThaiDigits(e.target.checked)} 
                                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 h-3.5 w-3.5"
                                    />
                                    <span>Export using Thai Digits (เลขไทย)</span>
                                </label>
                            </div>
                            <div className="flex items-center gap-1.5 mt-2 justify-end">
                                <span className={`text-[10px] ${t.subText} font-bold mr-1 uppercase`}>Quick:</span>
                                {[
                                    { label: '1 Day', days: 1 },
                                    { label: '7 Days', days: 7 },
                                    { label: '30 Days', days: 30 }
                                ].map((btn) => {
                                    // Calculate if this button is currently active
                                    const d1 = new Date(batchStartDate);
                                    const d2 = new Date(batchEndDate);
                                    const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
                                    // The end date should also be today for it to match the quick button logic perfectly
                                    const isToday = batchEndDate === new Date().toLocaleDateString('en-CA'); // 'en-CA' outputs YYYY-MM-DD in local time
                                    const isActive = isToday && diffDays === btn.days;
                                    
                                    return (
                                        <button 
                                            key={btn.label}
                                            type="button" 
                                            onClick={() => {
                                                const end = new Date();
                                                const start = new Date();
                                                start.setDate(start.getDate() - btn.days);
                                                
                                                // Function to get YYYY-MM-DD in local timezone safely
                                                const formatLocal = (date) => {
                                                    const y = date.getFullYear();
                                                    const m = String(date.getMonth() + 1).padStart(2, '0');
                                                    const d = String(date.getDate()).padStart(2, '0');
                                                    return `${y}-${m}-${d}`;
                                                };
                                                
                                                setBatchEndDate(formatLocal(end));
                                                setBatchStartDate(formatLocal(start));
                                            }} 
                                            className={`px-2 py-1 rounded border text-[10px] transition-colors ${isActive ? 'bg-blue-600 text-white border-blue-500' : `${t.dropdown.bg} ${t.dropdown.text} ${t.dropdown.border} hover:bg-gray-700`}`}
                                        >
                                            {btn.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className={`p-3 ${t.selectorContainer} rounded-lg border ${t.modalBorder} flex-1 flex flex-col min-h-[250px]`}>
                            <div className="flex justify-between items-center mb-2">
                                <label className={`block text-xs font-bold ${t.subText} uppercase tracking-wide`}>Batch Queue ({batchQueue.length})</label>
                                {batchQueue.length > 0 && <button onClick={() => setBatchQueue([])} className="text-[10px] text-red-400 hover:text-red-300 uppercase font-semibold">Clear</button>}
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                                {batchQueue.length === 0 && <div className="text-xs text-gray-500 py-4 text-center">Queue is empty</div>}
                                {batchQueue.map((item, idx) => (
                                    <div key={idx} className="bg-gray-800/50 rounded p-2 text-xs flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-gray-200 font-semibold">{item.zoneName}</span>
                                            <span className="text-[9px] text-gray-500">{item.accountName}</span>
                                        </div>
                                        <button onClick={() => removeFromQueue(idx)} className="text-gray-500 hover:text-red-400 p-1"><X className="w-3 h-3" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`p-4 border-t ${t.modalBorder} ${t.modalHeaderBg} flex justify-end gap-3`}>
                    <button onClick={onClose} className={`px-4 py-2 rounded font-medium transition-colors text-xs ${t.button}`}>Cancel</button>
                    <button onClick={() => { if(batchQueue.length === 0) { Swal.fire('Error', 'Batch Queue is empty', 'error'); return; } onConfirm(batchQueue, batchStartDate, batchEndDate, selectedTemplateId, [], null, false, [], exportThaiDigits); }} className={`px-4 py-2 rounded ${t.buttonSecondary || 'bg-purple-600 hover:bg-purple-700 text-white'} font-bold transition-all text-xs flex items-center gap-2`}>
                        <FileText className="w-3 h-3" /> Start Processing Queue
                    </button>
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

export default function NTBCCFReportPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState(null);

    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isReportMenuOpen, setIsReportMenuOpen] = useState(false); // Dropdown State
    const [isTemplateSubmenuOpen, setIsTemplateSubmenuOpen] = useState(false); // Submenu State
    const [isThemeSubmenuOpen, setIsThemeSubmenuOpen] = useState(false); // Submenu State
    const [isVncModalOpen, setIsVncModalOpen] = useState(false);
    const [mainVncStreamKey, setMainVncStreamKey] = useState(Date.now());

    const [dashboardImage, setDashboardImage] = useState(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [reportTemplate, setReportTemplate] = useState('');
    const [staticReportTemplate, setStaticReportTemplate] = useState(''); // Will be loaded from JSON file only
    const [middleReportTemplate, setMiddleReportTemplate] = useState('');
    const [reportModalMode, setReportModalMode] = useState('preview'); // 'preview' (report) | 'static-template' | 'middle-template'
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false); // NEW: Batch Modal State
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [isAutoReportModalOpen, setIsAutoReportModalOpen] = useState(false);
    const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
    const [autoDownloadWord, setAutoDownloadWord] = useState(false);
    const [chromeRunning, setChromeRunning] = useState(false);
    const [checkingChrome, setCheckingChrome] = useState(true);
    const [launchingChrome, setLaunchingChrome] = useState(false);
    const dashboardRef = useRef(null);
    const [isImageSettingsModalOpen, setIsImageSettingsModalOpen] = useState(false);
    const [isTableSettingsModalOpen, setIsTableSettingsModalOpen] = useState(false);
    const [isPageMarginModalOpen, setIsPageMarginModalOpen] = useState(false);
    const [pageMargins, setPageMargins] = useState({
        top: 2.54,
        bottom: 2.54,
        left: 2.54,
        right: 2.54,
        presetId: 'normal'
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem('ntbc:page-margins');
                if (stored) {
                    setPageMargins(JSON.parse(stored));
                }
            } catch (e) {}
        }
    }, []);
    const [capturedDomainImage, setCapturedDomainImage] = useState(null);
    const [capturedDnsImage, setCapturedDnsImage] = useState(null);
    const [capturedDnsPages, setCapturedDnsPages] = useState([]);
    const [capturedTrafficImage, setCapturedTrafficImage] = useState(null);
    const [capturedTrafficImageSub1, setCapturedTrafficImageSub1] = useState(null);
    const [capturedTrafficImageSub2, setCapturedTrafficImageSub2] = useState(null);
    const [capturedTrafficImageSub3, setCapturedTrafficImageSub3] = useState(null);
    const [capturedTrafficImageSub4, setCapturedTrafficImageSub4] = useState(null);
    const [capturedTrafficImageSub5, setCapturedTrafficImageSub5] = useState(null);
    const [capturedFirewallImage, setCapturedFirewallImage] = useState(null);
    const [capturedSecurityRulesImage, setCapturedSecurityRulesImage] = useState(null);
    const [capturedArgoImage, setCapturedArgoImage] = useState(null);
    const [capturedSpeedImage, setCapturedSpeedImage] = useState(null);
    const [capturedSpeedMobileImage, setCapturedSpeedMobileImage] = useState(null);
    const [capturedBotManagementImage, setCapturedBotManagementImage] = useState(null);
    const [capturedSecurityLevelImage, setCapturedSecurityLevelImage] = useState(null);
    const [capturedSslOverviewImage, setCapturedSslOverviewImage] = useState(null);
    const [capturedSslEdgeImage, setCapturedSslEdgeImage] = useState(null);
    const [capturedRateLimitingImage, setCapturedRateLimitingImage] = useState(null);
    const [capturedManagedRulesImage, setCapturedManagedRulesImage] = useState(null);
    const [capturedIpAccessImage, setCapturedIpAccessImage] = useState(null);
    const [capturedZoneLockdownImage, setCapturedZoneLockdownImage] = useState(null);
    const [capturedTrafficCountriesImage, setCapturedTrafficCountriesImage] = useState(null);
    const [capturedTopEventsSourceImage, setCapturedTopEventsSourceImage] = useState(null);

    // Load saved screenshots from control center session
    // Always load screenshot images from server files
    useEffect(() => {
        setCapturedDomainImage('/captured-domains.png');
        setCapturedDnsImage('/captured-dns.png');
        setCapturedDnsPages(['/captured-dns-1.png', '/captured-dns-2.png']);
        setCapturedTrafficImage('/captured-traffic.png');
        setCapturedTrafficImageSub1('/captured-traffic-sub1.png');
        setCapturedTrafficImageSub2('/captured-traffic-sub2.png');
        setCapturedTrafficImageSub3('/captured-traffic-sub3.png');
        setCapturedTrafficImageSub4('/captured-traffic-sub4.png');
        setCapturedTrafficImageSub5('/captured-traffic-sub5.png');
        setCapturedFirewallImage('/captured-firewall.png');
        setCapturedSecurityRulesImage('/captured-security-rules.png');
        setCapturedArgoImage('/captured-argo.png');
        setCapturedSpeedImage('/captured-speed.png');
        setCapturedSpeedMobileImage('/captured-speed-mobile.png');
        setCapturedBotManagementImage('/captured-bot-management.png');
        setCapturedSecurityLevelImage('/captured-security-level.png');
        setCapturedSslOverviewImage('/captured-ssl-overview.png');
        setCapturedSslEdgeImage('/captured-ssl-edge.png');
        setCapturedRateLimitingImage('/captured-rate-limiting.png');
        setCapturedManagedRulesImage('/captured-managed-rules.png');
        setCapturedIpAccessImage('/captured-ip-access.png');
        setCapturedZoneLockdownImage('/captured-zone-lockdown.png');
        setCapturedTrafficCountriesImage('/captured-traffic-countries.png');
        setCapturedTopEventsSourceImage('/captured-top-events-source.png');
    }, [isReportModalOpen]);
    const [showScreenshotModal, setShowScreenshotModal] = useState(false);
    const [isScreenshotBatchMode, setIsScreenshotBatchMode] = useState(false);
    const [isControlModalOpen, setIsControlModalOpen] = useState(false);
    const [useThaiDigits, setUseThaiDigits] = useState(false);

    // Theme State
    const [currentTheme, setCurrentTheme] = useState('dark');
    const theme = THEMES[currentTheme] || THEMES.dark;

    // Theme Persist & Broadcast
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('ntbc_theme');
            if (stored && THEMES[stored]) {
                setCurrentTheme(stored);
                // Dispatch initial event just in case
                window.dispatchEvent(new CustomEvent('theme-change', { detail: stored }));
            }
        }
    }, []);

    const checkChromeStatus = async () => {
        try {
            const res = await fetch('/api/ntbc-launch-chrome?check=true');
            const data = await res.json();
            if (data && data.success) {
                setChromeRunning(!!data.running);
            }
        } catch (err) {
            console.error('Failed to check chrome status:', err);
        } finally {
            setCheckingChrome(false);
        }
    };

    const handleLaunchChrome = async () => {
        setLaunchingChrome(true);
        try {
            const res = await fetch('/api/ntbc-launch-chrome');
            const data = await res.json();
            if (data && data.success) {
                setTimeout(checkChromeStatus, 2000);
            }
        } catch (err) {
            console.error('Failed to launch Chrome:', err);
        } finally {
            setLaunchingChrome(false);
        }
    };

    useEffect(() => {
        checkChromeStatus();
        const interval = setInterval(checkChromeStatus, 5000);
        return () => clearInterval(interval);
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
            localStorage.setItem('ntbc_theme', newThemeId);
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
    const [pageViews, setPageViews] = useState(0);
    const [visits, setVisits] = useState(0);

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
                    action: 'sync-ntbc-history',
                    zoneId: selectedZone,
                    zoneName: getZoneName(selectedZone, zones),
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

        let zReq = 0, zBytes = 0, zCacheReq = 0, zCacheBytes = 0, zPageViews = 0, zUniques = 0;
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
        let firewallActivity = [];
        let firewallRulesData = [];

        if (result && result.success) {
            // console.log('✅ Traffic Data Received:', result.data); // Debug Header
            filteredData = result.data?.httpRequestsAdaptiveGroups || [];
            hostRequestTotal = result.data?.hostRequestTotal || 0;
            // console.log('   - Adaptive Groups:', filteredData.length);

            firewallActivity = result.data?.firewallActivity || [];
            firewallRulesData = result.data?.firewallRules || [];
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
                zPageViews = zoneSummary.reduce((acc, day) => acc + (day.sum?.pageViews || 0), 0);
                zUniques = zoneSummary.reduce((acc, day) => acc + (day.uniq?.uniques || 0), 0);

                setZoneWideRequests(zReq);
                setZoneWideDataTransfer(zBytes);
                setZoneWideCacheRequests(zCacheReq);
                setZoneWideCacheDataTransfer(zCacheBytes);
                setPageViews(zPageViews);
                setVisits(zUniques);

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
                setTotalDataTransfer(zBytes);
                setCacheHitRequests(zCacheReq);
                setCacheHitDataTransfer(zCacheBytes);
            }
        } else {
            setBlockedEvents(0); setLogEvents(0); setTopFirewallActions([]);
            setTopRules([]); setTopAttackers([]);
            setTotalDataTransfer(0); setCacheHitRequests(0); setCacheHitDataTransfer(0); setPageViews(0); setVisits(0);
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
            totalDataTransfer: zBytes,
            pageViews: zPageViews,
            visits: zUniques,
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
            fwEvents: { total: fwTotal, managed: fwManaged, custom: fwCustom, bic: fwBic, access: fwAccess },
            firewallRules: firewallRulesData || [],
            firewallActivity: firewallActivity || []
        };

        setLoadingStats(false);
        setHasGenerated(true); // Mark generation as complete
        return stats;
    };

    const handleBatchReport = async (selectedHosts, batchStartDate, batchEndDate, templateId = 'default', promotedHosts = [], zoneId = null, exportSeparated = false, batchModalZones = [], exportThaiDigits = false) => {
        setUseThaiDigits(exportThaiDigits);
        setIsBatchModalOpen(false);
        router.push('/systems/ntbc_cfreport/control');
    };

    const handleQuickLaunchDebug = async () => {
        router.push('/systems/ntbc_cfreport/control');
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

    const handleCaptureScreenshot = async () => {
        try {
            Swal.fire({
                title: 'Capturing Remote Cloudflare Dashboard...',
                text: 'Connecting to browser on port 9222...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                },
                background: theme?.modalBg || '#111827',
                color: theme?.text || '#fff'
            });

            const res = await fetch('/api/ntbc-capture');
            const data = await res.json();

            if (data.success && data.image) {
                setCapturedDomainImage(data.image);
                setShowScreenshotModal(true);

                Swal.fire({
                    title: 'Success',
                    text: 'Screenshot captured from debug browser and mapped to @captured_domain_page!',
                    icon: 'success',
                    background: theme?.modalBg || '#111827',
                    color: theme?.text || '#fff',
                    confirmButtonColor: '#3b82f6'
                });
            } else {
                throw new Error(data.error || 'Failed to capture screenshot');
            }
        } catch (error) {
            console.error('Remote capture failed:', error);
            Swal.fire({
                title: 'Capture Failed',
                text: error.message || 'Make sure Google Chrome is running with --remote-debugging-port=9222 and logged into Cloudflare',
                icon: 'error',
                background: theme?.modalBg || '#111827',
                color: theme?.text || '#fff',
            });
        }
    };

    const handleCaptureScreenshotConfirm = async (batchQueue, batchStartDate, batchEndDate, templateId = 'default', promotedHosts = [], zoneId = null, exportSeparated = false, batchModalZones = [], exportThaiDigits = false) => {
        setUseThaiDigits(exportThaiDigits);
        setIsBatchModalOpen(false);
        if(!batchQueue || batchQueue.length === 0) return;
        
        // Group queue by Zone to process efficiently
        const groupedByZone = {};
        batchQueue.forEach(item => {
            if(!groupedByZone[item.zoneId]) {
                groupedByZone[item.zoneId] = {
                    accountId: item.accountId,
                    zoneId: item.zoneId,
                    hosts: []
                };
            }
            groupedByZone[item.zoneId].hosts.push(item.domain === '__ALL_SUBDOMAINS__' ? 'ALL_SUBDOMAINS' : item.domain);
        });

        const zonesToProcess = Object.values(groupedByZone);
        
        for (let i = 0; i < zonesToProcess.length; i++) {
            const currentZone = zonesToProcess[i];
            // Pass the grouped hosts for this zone
            const success = await processSingleZoneCapture(currentZone.zoneId, currentZone.accountId, currentZone.hosts, batchStartDate, batchEndDate, templateId, [], false, i, zonesToProcess.length);
            
            if (!success) {
                console.log('Stopping batch queue processing due to failure or user cancellation.');
                break;
            }
            
            // Wait for download to finish
            await new Promise(resolve => {
                window.__batchNext = resolve;
                // fallback resolve after 25 seconds in case something goes wrong
                setTimeout(resolve, 25000); 
            });
        }
    };

    const processSingleZoneCapture = async (activeZoneId, activeAccountId, selectedHosts, batchStartDate, batchEndDate, templateId = 'default', promotedHosts = [], exportSeparated = false, currentIndex = 0, totalZones = 1) => {
        let isCancelled = false;
        let isFinished = false;
        const checkCancelled = () => {
            if (isCancelled) {
                throw new Error('Force stopped by user');
            }
        };

        let activeZones = zones;
        if (!activeZones || activeZones.length === 0 || !activeZones.find(z => z.id === activeZoneId)) {
            try {
                const result = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'list-zones',
                        accountId: activeAccountId,
                        apiToken: currentUser?.cloudflare_api_token || auth.getCurrentUser()?.cloudflare_api_token
                    })
                });
                const resData = await result.json();
                if (resData.success && resData.data) {
                    activeZones = resData.data;
                    setZones(resData.data);
                }
            } catch (err) {
                console.error('Failed to fetch zones dynamically:', err);
            }
        }

        const zoneObj = activeZones.find(z => z.id === activeZoneId);
        const domainName = zoneObj ? zoneObj.name : '';

        if (!activeAccountId || !activeZoneId || !domainName) {
            Swal.fire('Error', 'Invalid Account or Zone configuration.', 'error');
            return;
        }

        // Show Progress Modal
        const statusMap = {
            launch: 'running',
            domains: 'pending',
            dns: 'pending',
            bot: 'pending',
            securityLevel: 'pending',
            sslOverview: 'pending',
            sslEdge: 'pending',
            traffic: 'pending',
            trafficCountries: 'pending',
            firewall: 'pending',
            topEvents: 'pending',
            rules: 'pending',
            rateLimiting: 'pending',
            managedRules: 'pending',
            ipAccess: 'pending',
            zoneLockdown: 'pending',
            argo: 'pending',
            speed: 'pending',
            speedMobile: 'pending',
            stats: 'pending',
            report: 'pending'
        };

        const errorMap = {};

        const renderHtml = () => {
            const getIcon = (status) => {
                if (status === 'running') return '<span style="display: inline-block; animation: spin 1s linear infinite; margin-right: 8px;">🔄</span>';
                if (status === 'success') return '<span style="color: #10b981; margin-right: 8px;">✅</span>';
                if (status === 'error') return '<span style="color: #ef4444; margin-right: 8px;">❌</span>';
                if (status === 'warn') return '<span style="color: #f59e0b; margin-right: 8px;">⚠️</span>';
                return '<span style="color: #6b7280; margin-right: 8px;">⚪</span>';
            };

            const renderLine = (statusKey, text) => {
                const icon = getIcon(statusMap[statusKey]);
                const errMsg = errorMap[statusKey] ? `<div style="color: #ef4444; font-size: 11px; margin-left: 24px; margin-top: -6px; margin-bottom: 8px; line-height: 1.2; word-break: break-word;">${errorMap[statusKey]}</div>` : '';
                return `<div style="margin-bottom: ${errMsg ? '2px' : '6px'}; font-size: 13px;">${icon} ${text}</div>${errMsg}`;
            };

            return `
                <div style="margin-bottom: 10px; background-color: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); padding: 8px; border-radius: 6px; text-align: center;">
                    <p style="color: #60a5fa; font-size: 13px; font-weight: bold; margin: 0;">
                        ℹ️ You can safely minimize this browser tab or switch to another window. The process will continue in the background.
                    </p>
                </div>
                <div style="display: flex; gap: 16px; text-align: left; font-size: 13px; color: #d1d5db; line-height: 1.4; margin-top: 10px;">
                    <style>
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    </style>
                    <div style="flex: 2.5; display: flex; flex-direction: column; gap: 10px;">
                        <div style="border: 1px solid #374151; border-radius: 8px; overflow: hidden; position: relative; height: 100%; min-height: 380px; background: #000;">
                            <div style="position: absolute; top: 0; left: 0; background: #e11d48; color: white; font-size: 10px; padding: 2px 6px; z-index: 10; border-bottom-right-radius: 6px; font-weight: bold;">Live Browser Monitor</div>
                            <iframe src="${window.location.origin}/vnc/?autoconnect=1&resize=scale&path=websockify" style="width: 100%; height: 100%; border: none;" title="Live Browser Monitor"></iframe>
                        </div>
                    </div>
                    <div style="flex: 1.5; display: flex; flex-direction: column; justify-content: flex-start; border-left: 1px solid #374151; padding-left: 16px; max-height: 480px; overflow-y: auto;">
                        ${renderLine('launch', 'Start debug browser')}
                        ${renderLine('domains', 'Capture Domains Overview')}
                        ${renderLine('dns', 'Capture DNS Records')}
                        ${renderLine('bot', 'Capture Bot Management')}
                        ${renderLine('securityLevel', 'Capture Security Level & BIC')}
                        ${renderLine('sslOverview', 'Capture SSL/TLS Overview')}
                        ${renderLine('sslEdge', 'Capture Min TLS & TLS 1.3')}
                        ${renderLine('traffic', 'Capture HTTP Traffic')}
                        ${renderLine('trafficCountries', 'Capture Traffic by Country')}
                        ${renderLine('firewall', 'Capture Firewall Events')}
                        ${renderLine('topEvents', 'Capture Top Events by Source')}
                        ${renderLine('rules', 'Capture Security Rules')}
                        ${renderLine('rateLimiting', 'Capture Rate Limiting Rules')}
                        ${renderLine('managedRules', 'Capture Managed WAF Rules')}
                        ${renderLine('ipAccess', 'Capture IP Access Rules')}
                        ${renderLine('zoneLockdown', 'Capture Zone Lockdown')}
                        ${renderLine('argo', 'Capture Argo Routing')}
                        ${renderLine('speed', 'Capture Speed Test')}
                        ${renderLine('stats', 'Fetch CF Statistics')}
                        ${renderLine('report', 'Generate & Download Report')}
                        <div style="text-align: left; margin-top: 10px;">
                            <button id="force-stop-btn" style="background-color: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background-color 0.2s; width: 100%;">
                                Force Stop
                            </button>
                        </div>
                    </div>
                </div>
            `;
        };

        Swal.fire({
            title: totalZones > 1 ? `Generating Report... (${currentIndex + 1}/${totalZones}) [${domainName}]` : 'Generating Report & Capturing Screenshots...',
            html: renderHtml(),
            width: '1200px',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
                const btn = Swal.getHtmlContainer()?.querySelector('#force-stop-btn');
                if (btn) {
                    btn.onclick = () => {
                        isCancelled = true;
                        Swal.close();
                    };
                }
            },
            didClose: () => {
                if (!isFinished) {
                    isCancelled = true;
                }
            },
            background: theme?.modalBg || '#111827',
            color: theme?.text || '#fff'
        });

        const updateProgress = () => {
            if (isCancelled) return;
            Swal.update({
                title: totalZones > 1 ? `Generating Report... (${currentIndex + 1}/${totalZones}) [${domainName}]` : 'Generating Report & Capturing Screenshots...',
                html: renderHtml()
            });
            const btn = Swal.getHtmlContainer()?.querySelector('#force-stop-btn');
            if (btn) {
                btn.onclick = () => {
                    isCancelled = true;
                    Swal.close();
                };
            }
        };

        try {
            // Fetch global coordinates for cropping
            let globalCoords = null;
            try {
                const resCoords = await fetch('/api/ntbc-capture-coords');
                globalCoords = await resCoords.json();
            } catch (err) {
                console.error('Failed to load global coords:', err);
            }

            const getCoordParams = (type) => {
                if (!globalCoords) return '';
                let key = type;
                if (type === 'speed-mobile') key = 'speedMobile';
                if (type === 'rules' || type === 'security-rules') key = 'securityRules';
                if (type === 'bot-management') key = 'botManagement';
                if (type === 'security-level') key = 'securityLevel';
                if (type === 'ssl-overview') key = 'sslOverview';
                if (type === 'ssl-edge') key = 'sslEdge';
                if (type === 'rate-limiting') key = 'rateLimiting';
                if (type === 'managed-rules') key = 'managedRules';
                if (type === 'ip-access-rules') key = 'ipAccess';
                if (type === 'zone-lockdown') key = 'zoneLockdown';
                if (type === 'traffic-countries') key = 'trafficCountries';
                if (type === 'top-events-source') key = 'topEventsSource';
                const c = globalCoords[key];
                if (c) {
                    let params = '';
                    if (c.xStart) params += `&xStart=${c.xStart}`;
                    if (c.xEnd) params += `&xEnd=${c.xEnd}`;
                    if (c.yStart) params += `&yStart=${c.yStart}`;
                    if (c.yEnd) params += `&yEnd=${c.yEnd}`;
                    return params;
                }
                return '';
            };

            // Set states on main page
            setSelectedAccount(activeAccountId);
            setSelectedZone(activeZoneId);
            const subdomainVal = selectedHosts.length > 0 ? (typeof selectedHosts[0] === 'object' ? selectedHosts[0].name : selectedHosts[0]) : 'ALL_SUBDOMAINS';
            setSelectedSubDomain(subdomainVal);
            setStartDate(batchStartDate);
            setEndDate(batchEndDate);

            const skipCaptures = false;
            if (!skipCaptures) {
                // Step 1: Ensure Chrome is running
                checkCancelled();
                try {
                    const launchRes = await fetch('/api/ntbc-launch-chrome');
                    const launchData = await launchRes.json();
                    if (launchData.success) {
                        statusMap.launch = 'success';
                    } else {
                        statusMap.launch = 'warn';
                    }
                } catch (err) {
                    if (err.message === 'Force stopped by user') throw err;
                    console.error('Launch Chrome failed:', err);
                    statusMap.launch = 'warn';
                }
                updateProgress();

                // Stabilize wait
                for (let i = 0; i < 10; i++) {
                    checkCancelled();
                    await new Promise(r => setTimeout(r, 100));
                }

                // Check Cloudflare Authentication Status before doing anything else
                checkCancelled();
                try {
                    console.log('Checking Cloudflare authentication status...');
                    const authRes = await fetch('/api/ntbc-control-chrome');
                    const authData = await authRes.json();
                    if (authRes.status === 401 || authData.errorType === 'unauthenticated') {
                        throw new Error('UNAUTHENTICATED_CLOUDFLARE');
                    }
                } catch (err) {
                    if (err.message === 'UNAUTHENTICATED_CLOUDFLARE' || err.message === 'Force stopped by user') throw err;
                    console.error('Initial Cloudflare auth check failed:', err);
                }

                // Helper to handle navigation and screenshot
                const controlAndCapture = async (url, type, statusKey) => {
                    checkCancelled();
                    statusMap[statusKey] = 'running';
                    updateProgress();
                    try {
                        checkCancelled();
                        const res = await fetch(`/api/ntbc-control-chrome?url=${encodeURIComponent(url)}`);
                        const data = await res.json();
                        checkCancelled();
                        if (res.status === 401 || data.errorType === 'unauthenticated') {
                            throw new Error('UNAUTHENTICATED_CLOUDFLARE');
                        }
                        if (data.success) {
                            const loops = Math.ceil(DELAY_CONFIG.NAV_STABILIZE_MS / DELAY_CONFIG.SHORT_RETRY_MS);
                            for (let i = 0; i < loops; i++) {
                                checkCancelled();
                                await new Promise(r => setTimeout(r, DELAY_CONFIG.SHORT_RETRY_MS));
                            }
                            checkCancelled();
                            const captureRes = await fetch(`/api/ntbc-capture?type=${type}${getCoordParams(type)}`);
                            const captureData = await captureRes.json();
                            if (captureRes.status === 401 || captureData.errorType === 'unauthenticated') {
                                throw new Error('UNAUTHENTICATED_CLOUDFLARE');
                            }
                            if (captureData.success && captureData.image) {
                                statusMap[statusKey] = 'success';
                                updateProgress();
                                return captureData;
                            } else {
                                errorMap[statusKey] = captureData.error || captureData.message || 'Failed to capture screenshot';
                            }
                        } else {
                            errorMap[statusKey] = data.message || data.error || 'Failed to navigate to target URL';
                        }
                        statusMap[statusKey] = 'warn';
                    } catch (err) {
                        if (err.message === 'UNAUTHENTICATED_CLOUDFLARE' || err.message === 'Force stopped by user') throw err;
                        console.error(`Capture ${type} failed:`, err);
                        statusMap[statusKey] = 'warn';
                        errorMap[statusKey] = err.message || 'Unknown error during capture';
                    }
                    updateProgress();
                    return null;
                };

                // Step 2: Domains Overview
                checkCancelled();
                statusMap.domains = 'running';
                updateProgress();
                try {
                    const targetDomainsUrl = `https://dash.cloudflare.com/${activeAccountId}/domains/overview`;
                    const res = await fetch(`/api/ntbc-control-chrome?url=${encodeURIComponent(targetDomainsUrl)}`);
                    const data = await res.json();
                    checkCancelled();
                    if (res.status === 401 || data.errorType === 'unauthenticated') {
                        throw new Error('UNAUTHENTICATED_CLOUDFLARE');
                    }
                    if (data.success) {
                        const loops = Math.ceil(DELAY_CONFIG.NAV_STABILIZE_MS / DELAY_CONFIG.SHORT_RETRY_MS);
                        for (let i = 0; i < loops; i++) {
                            checkCancelled();
                            await new Promise(r => setTimeout(r, DELAY_CONFIG.SHORT_RETRY_MS));
                        }
                        checkCancelled();
                        const captureRes = await fetch(`/api/ntbc-capture?type=domains${getCoordParams('domains')}`);
                        const captureData = await captureRes.json();
                        if (captureRes.status === 401 || captureData.errorType === 'unauthenticated') {
                            throw new Error('UNAUTHENTICATED_CLOUDFLARE');
                        }
                        if (captureData.success && captureData.image) {
                            setCapturedDomainImage(captureData.image);
                            localStorage.setItem('control_capturedScreenshot', captureData.image);
                            statusMap.domains = 'success';
                        } else {
                            statusMap.domains = 'warn';
                        }
                    } else {
                        statusMap.domains = 'warn';
                    }
                } catch (err) {
                    if (err.message === 'UNAUTHENTICATED_CLOUDFLARE' || err.message === 'Force stopped by user') throw err;
                    console.error('Capture domains failed:', err);
                    statusMap.domains = 'warn';
                }
                updateProgress();

                // Step 3: DNS Records
                const dnsData = await controlAndCapture(
                    `https://dash.cloudflare.com/${activeAccountId}/${domainName}/dns/records`,
                    'dns',
                    'dns'
                );
                if (dnsData) {
                    setCapturedDnsImage(dnsData.image);
                    localStorage.setItem('control_capturedDnsScreenshot', dnsData.image);
                    if (dnsData.dnsPages) {
                        setCapturedDnsPages(dnsData.dnsPages);
                        localStorage.setItem('control_capturedDnsPages', JSON.stringify(dnsData.dnsPages));
                    } else {
                        setCapturedDnsPages([]);
                        localStorage.removeItem('control_capturedDnsPages');
                    }
                }

                // Step 4: Security Settings (Bot Management & Security Level)
                const botData = await controlAndCapture(
                    `https://dash.cloudflare.com/${activeAccountId}/${domainName}/security/settings`,
                    'bot-management',
                    'bot'
                );
                if (botData) {
                    setCapturedBotManagementImage(botData.image);
                    localStorage.setItem('control_capturedBotManagementScreenshot', botData.image);
                }
                const secLevelData = await controlAndCapture(
                    `https://dash.cloudflare.com/${activeAccountId}/${domainName}/security/settings`,
                    'security-level',
                    'securityLevel'
                );
                if (secLevelData) {
                    setCapturedSecurityLevelImage(secLevelData.image);
                    localStorage.setItem('control_capturedSecurityLevelScreenshot', secLevelData.image);
                }

                // Step 5: SSL/TLS Overview
                const sslOverviewData = await controlAndCapture(
                    `https://dash.cloudflare.com/${activeAccountId}/${domainName}/ssl-tls`,
                    'ssl-overview',
                    'sslOverview'
                );
                if (sslOverviewData) {
                    setCapturedSslOverviewImage(sslOverviewData.image);
                    localStorage.setItem('control_capturedSslOverviewScreenshot', sslOverviewData.image);
                }

                // Step 6: SSL/TLS Edge Certificates (Min TLS & TLS 1.3)
                const sslEdgeData = await controlAndCapture(
                    `https://dash.cloudflare.com/${activeAccountId}/${domainName}/ssl-tls/edge-certificates`,
                    'ssl-edge',
                    'sslEdge'
                );
                if (sslEdgeData) {
                    setCapturedSslEdgeImage(sslEdgeData.image);
                    localStorage.setItem('control_capturedSslEdgeScreenshot', sslEdgeData.image);
                }

                // Step 7: HTTP Traffic
                let trafficQuery = '';
                if (batchStartDate && batchEndDate) {
                    const startIso = new Date(batchStartDate + 'T00:00:00.000Z').toISOString();
                    const endIso = new Date(batchEndDate + 'T23:59:59.999Z').toISOString();
                    trafficQuery = `?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`;
                }
                const trafficData = await controlAndCapture(
                    `https://dash.cloudflare.com/${activeAccountId}/${domainName}/analytics/traffic${trafficQuery}`,
                    'traffic',
                    'traffic'
                );
                if (trafficData) {
                    setCapturedTrafficImage(trafficData.image);
                    localStorage.setItem('control_capturedHttpTrafficScreenshot', trafficData.image);
                    if (trafficData.imageSub1) {
                        setCapturedTrafficImageSub1(trafficData.imageSub1);
                        localStorage.setItem('control_capturedHttpTrafficScreenshot1', trafficData.imageSub1);
                    }
                    if (trafficData.imageSub2) {
                        setCapturedTrafficImageSub2(trafficData.imageSub2);
                        localStorage.setItem('control_capturedHttpTrafficScreenshot2', trafficData.imageSub2);
                    }
                    if (trafficData.imageSub3) {
                        setCapturedTrafficImageSub3(trafficData.imageSub3);
                        localStorage.setItem('control_capturedHttpTrafficScreenshot3', trafficData.imageSub3);
                    }
                    if (trafficData.imageSub4) {
                        setCapturedTrafficImageSub4(trafficData.imageSub4);
                        localStorage.setItem('control_capturedHttpTrafficScreenshot4', trafficData.imageSub4);
                    }
                    if (trafficData.imageSub5) {
                        setCapturedTrafficImageSub5(trafficData.imageSub5);
                        localStorage.setItem('control_capturedHttpTrafficScreenshot5', trafficData.imageSub5);
                    }
                }

                // Step 8: Traffic Countries
                const trafficCountriesData = await controlAndCapture(
                    `https://dash.cloudflare.com/${activeAccountId}/${domainName}/analytics/traffic${trafficQuery}`,
                    'traffic-countries',
                    'trafficCountries'
                );
                if (trafficCountriesData) {
                    setCapturedTrafficCountriesImage(trafficCountriesData.image);
                    localStorage.setItem('control_capturedTrafficCountriesScreenshot', trafficCountriesData.image);
                }

                // Step 9: Firewall Events
                const firewallData = await controlAndCapture(
                    `https://dash.cloudflare.com/${activeAccountId}/${domainName}/security/analytics/events`,
                    'firewall',
                    'firewall'
                );
                if (firewallData) {
                    setCapturedFirewallImage(firewallData.image);
                    localStorage.setItem('control_capturedFirewallScreenshot', firewallData.image);
                }

                // Step 10: Top Events by Source
                const topEventsData = await controlAndCapture(
                    `https://dash.cloudflare.com/${activeAccountId}/${domainName}/security/analytics/events`,
                    'top-events-source',
                    'topEvents'
                );
                if (topEventsData) {
                    setCapturedTopEventsSourceImage(topEventsData.image);
                    localStorage.setItem('control_capturedTopEventsSourceScreenshot', topEventsData.image);
                }

                // Step 11: Security Rules (Custom Rules)
                const rulesData = await controlAndCapture(
                    `https://dash.cloudflare.com/${activeAccountId}/${domainName}/security/security-rules`,
                    'security-rules',
                    'rules'
                );
                if (rulesData) {
                    setCapturedSecurityRulesImage(rulesData.image);
                    localStorage.setItem('control_capturedSecurityRulesScreenshot', rulesData.image);
                }

                // Step 12: Rate Limiting Rules
                const rateLimitData = await controlAndCapture(
                    `https://dash.cloudflare.com/${activeAccountId}/${domainName}/security/security-rules`,
                    'rate-limiting',
                    'rateLimiting'
                );
                if (rateLimitData) {
                    setCapturedRateLimitingImage(rateLimitData.image);
                    localStorage.setItem('control_capturedRateLimitingScreenshot', rateLimitData.image);
                }

                // Step 13: Managed Rules
                const managedRulesData = await controlAndCapture(
                    `https://dash.cloudflare.com/${activeAccountId}/${domainName}/security/security-rules`,
                    'managed-rules',
                    'managedRules'
                );
                if (managedRulesData) {
                    setCapturedManagedRulesImage(managedRulesData.image);
                    localStorage.setItem('control_capturedManagedRulesScreenshot', managedRulesData.image);
                }

                // Step 14: IP Access Rules
                const ipAccessData = await controlAndCapture(
                    `https://dash.cloudflare.com/${activeAccountId}/${domainName}/security/security-rules`,
                    'ip-access-rules',
                    'ipAccess'
                );
                if (ipAccessData) {
                    setCapturedIpAccessImage(ipAccessData.image);
                    localStorage.setItem('control_capturedIpAccessScreenshot', ipAccessData.image);
                }

                // Step 15: Zone Lockdown
                const zoneLockdownData = await controlAndCapture(
                    `https://dash.cloudflare.com/${activeAccountId}/${domainName}/security/security-rules`,
                    'zone-lockdown',
                    'zoneLockdown'
                );
                if (zoneLockdownData) {
                    setCapturedZoneLockdownImage(zoneLockdownData.image);
                    localStorage.setItem('control_capturedZoneLockdownScreenshot', zoneLockdownData.image);
                }

                // Step 16: Argo Routing
                const argoData = await controlAndCapture(
                    `https://dash.cloudflare.com/${activeAccountId}/${domainName}/traffic`,
                    'argo',
                    'argo'
                );
                if (argoData) {
                    setCapturedArgoImage(argoData.image);
                    localStorage.setItem('control_capturedArgoScreenshot', argoData.image);
                }

                // Step 8: Speed Test Desktop + Mobile
                checkCancelled();
                statusMap.speed = 'running';
                updateProgress();
                try {
                    const targetSpeedUrl = `https://dash.cloudflare.com/${activeAccountId}/${domainName}/speed/test/browser`;
                    const res = await fetch(`/api/ntbc-control-chrome?url=${encodeURIComponent(targetSpeedUrl)}`);
                    const data = await res.json();
                    checkCancelled();
                    if (data.success) {
                        const loops = Math.ceil(DELAY_CONFIG.NAV_STABILIZE_MS / DELAY_CONFIG.SHORT_RETRY_MS);
                        for (let i = 0; i < loops; i++) {
                            checkCancelled();
                            await new Promise(r => setTimeout(r, DELAY_CONFIG.SHORT_RETRY_MS));
                        }
                        
                        // Trigger speed test run
                        const runRes = await fetch('/api/scrape', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'run-speed-test',
                                apiToken: currentUser?.cloudflare_api_token,
                                domainVal: domainName
                            })
                        });
                        const runData = await runRes.json();
                        checkCancelled();
                        if (runData.success) {
                            // Fast Polling loop (Max 60 seconds, check every 3 seconds)
                            let isSuccess = false;
                            const maxAttempts = DELAY_CONFIG.SPEED_TEST_MAX_ATTEMPTS;
                            for (let retry = 0; retry < maxAttempts; retry++) {
                                checkCancelled();
                                const checkRes = await fetch('/api/scrape', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        action: 'check-speed-results',
                                        apiToken: currentUser?.cloudflare_api_token
                                    })
                                });
                                const checkData = await checkRes.json();
                                if (checkData.success && checkData.found) {
                                    isSuccess = true;
                                    break;
                                }
                                // Wait 3 seconds before next check
                                for (let s = 0; s < 3; s++) {
                                    checkCancelled();
                                    await new Promise(r => setTimeout(r, 1000));
                                }
                            }

                            // Capture Speed Desktop
                            checkCancelled();
                            const captureRes = await fetch(`/api/ntbc-capture?type=speed${getCoordParams('speed')}`);
                            const captureData = await captureRes.json();
                            let desktopSpeedImg = null;
                            if (captureData.success && captureData.image) {
                                desktopSpeedImg = captureData.image;
                                setCapturedSpeedImage(captureData.image);
                                localStorage.setItem('control_capturedSpeedScreenshot', captureData.image);
                            }

                            // Capture Speed Mobile
                            if (desktopSpeedImg) {
                                checkCancelled();
                                const mobileClickRes = await fetch('/api/scrape', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        action: 'click-speed-mobile',
                                        apiToken: currentUser?.cloudflare_api_token
                                    })
                                });
                                const mobileClickData = await mobileClickRes.json();
                                checkCancelled();
                                if (mobileClickData.success) {
                                    const captureMobileRes = await fetch(`/api/ntbc-capture?type=speed-mobile${getCoordParams('speed-mobile')}`);
                                    const captureMobileData = await captureMobileRes.json();
                                    if (captureMobileData.success && captureMobileData.image) {
                                        setCapturedSpeedMobileImage(captureMobileData.image);
                                        localStorage.setItem('control_capturedSpeedMobileScreenshot', captureMobileData.image);
                                    }
                                }
                            }

                            statusMap.speed = 'success';
                        } else {
                            // Fallback capture Speed Desktop
                            checkCancelled();
                            const captureRes = await fetch(`/api/ntbc-capture?type=speed${getCoordParams('speed')}`);
                            const captureData = await captureRes.json();
                            if (captureData.success && captureData.image) {
                                setCapturedSpeedImage(captureData.image);
                                localStorage.setItem('control_capturedSpeedScreenshot', captureData.image);
                                statusMap.speed = 'success';
                            } else {
                                statusMap.speed = 'warn';
                            }
                        }
                    } else {
                        statusMap.speed = 'warn';
                    }
                } catch (err) {
                    if (err.message === 'Force stopped by user') throw err;
                    console.error('Speed test capture failed:', err);
                    statusMap.speed = 'warn';
                }
                updateProgress();
            } else {
                statusMap.launch = 'success';
                statusMap.domains = 'success';
                statusMap.dns = 'success';
                statusMap.traffic = 'success';
                statusMap.firewall = 'success';
                statusMap.rules = 'success';
                statusMap.argo = 'success';
                statusMap.speed = 'success';
                updateProgress();
            }

            // Step 9: Fetch WAF Settings and Statistics
            checkCancelled();
            statusMap.stats = 'running';
            updateProgress();
            try {
                // Fetch settings
                const settingsResult = await callAPI('get-zone-settings', { zoneId: activeZoneId });
                checkCancelled();
                if (settingsResult && settingsResult.data) {
                    setZoneSettings(settingsResult.data);
                }
                const dnsRes = await callAPI('get-dns-records', { zoneId: activeZoneId });
                checkCancelled();
                if (dnsRes && dnsRes.data) {
                    setDnsRecords(dnsRes.data);
                }

                // Fetch statistics
                await fetchAndApplyTrafficData(subdomainVal, activeZoneId, batchStartDate, batchEndDate);
                statusMap.stats = 'success';
            } catch (err) {
                if (err.message === 'Force stopped by user') throw err;
                console.error('Fetch stats failed:', err);
                statusMap.stats = 'error';
            }
            updateProgress();

            // Step 10: Generate and download report
            checkCancelled();
            statusMap.report = 'running';
            updateProgress();

            // Load template
            const domainTmpl = await loadStaticTemplate(templateId);
            checkCancelled();
            
            console.log('DEBUG handleCaptureScreenshotConfirm: loaded template parts:', {
                domainTmplLength: domainTmpl?.length
            });
            const combinedTmpl = domainTmpl || '';
            console.log('DEBUG handleCaptureScreenshotConfirm: combinedTmpl length =', combinedTmpl.length);
            setReportTemplate(combinedTmpl);
            setReportModalMode('report');

            // Set autoDownloadReport to true and open modal
            setAutoDownloadWord(true);
            setIsReportModalOpen(true);

            statusMap.report = 'success';
            updateProgress();

            isFinished = true;

            // Close sweetalert after success
            setTimeout(() => {
                Swal.close();
            }, 1000);
            return true;

        } catch (error) {
            if (error.message === 'UNAUTHENTICATED_CLOUDFLARE') {
                setIsVncModalOpen(true);
                Swal.close();
                return false;
            }
            if (error.message === 'Force stopped by user') {
                console.log('Workflow force stopped by user.');
                Swal.fire({
                    title: 'Cancelled',
                    text: 'Report generation was stopped.',
                    icon: 'info',
                    timer: 2000,
                    showConfirmButton: false,
                    background: theme?.modalBg || '#111827',
                    color: theme?.text || '#fff'
                });
                return false;
            }
            console.error('Workflow error:', error);
            statusMap.report = 'error';
            updateProgress();
            Swal.fire({
                title: 'Workflow Failed',
                text: error.message || 'An error occurred during report generation.',
                icon: 'error',
                background: theme?.modalBg || '#111827',
                color: theme?.text || '#fff'
            });
            return false;
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
            const rootDomain = getZoneName(selectedZone, zones);

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
            if (tmpl !== null) setReportTemplate(tmpl);
        });
        loadStaticTemplate().then(tmpl => {
            if (tmpl !== null) setStaticReportTemplate(tmpl);
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
        const res = await saveTemplate(newTemplate, templateToEditId);
        if (!res || res.error) {
            Swal.fire('Error', res?.error || 'Failed to save template', 'error');
        } else {
            Swal.fire({ title: 'Saved!', icon: 'success', timer: 1500, showConfirmButton: false });
        }
    };

    const handleSaveStaticTemplate = async (newTemplate) => {
        setStaticReportTemplate(newTemplate);
        const res = await saveStaticTemplate(newTemplate, templateToEditId);
        if (!res || res.error) {
            Swal.fire('Error', res?.error || 'Failed to save template', 'error');
        } else {
            Swal.fire({ title: 'Saved!', icon: 'success', timer: 1500, showConfirmButton: false });
        }
    };

    const handleSaveMiddleTemplate = async (newTemplate) => {
        setMiddleReportTemplate(newTemplate);
        const res = await saveMiddleTemplate(newTemplate, templateToEditId);
        if (!res || res.error) {
            Swal.fire('Error', res?.error || 'Failed to save template', 'error');
        } else {
            Swal.fire({ title: 'Saved!', icon: 'success', timer: 1500, showConfirmButton: false });
        }
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
        totalDataTransfer: totalDataTransfer,
        pageViews: pageViews,
        visits: visits,
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
                            <h1 className={`text-sm font-bold ${theme.text}`}>NTBC <span className={theme.subText}>CFReport Manager</span></h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* BROWSER STATUS INDICATOR / BUTTON */}
                        {checkingChrome ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-gray-800/40 border border-gray-700/50 text-gray-400 text-xs font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
                                Checking browser...
                            </div>
                        ) : chromeRunning ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Browser Debugging Active (Port 9222)
                            </div>
                        ) : (
                            <button
                                onClick={handleLaunchChrome}
                                disabled={launchingChrome}
                                className="flex items-center gap-2 px-3 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 text-xs font-medium transition-all duration-200 cursor-pointer disabled:opacity-50"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                {launchingChrome ? 'Launching...' : 'Launch Debug Browser'}
                            </button>
                        )}

                        {/* ACTIONS DROPDOWN */}
                        <div className="relative">
                            <button
                                onClick={() => setIsReportMenuOpen(!isReportMenuOpen)}
                                className={`flex items-center gap-2 ${theme.button} px-3 py-1.5 rounded text-xs transition-colors`}
                            >
                                <Settings className="w-3 h-3" /> Actions
                                <svg className={`w-3 h-3 transition-transform ${isReportMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {isReportMenuOpen && (
                                <div className={`absolute right-0 mt-2 w-56 ${theme.dropdown?.menuBg || 'bg-gray-800'} rounded-lg shadow-xl border ${theme.dropdown?.border || 'border-gray-700'} z-[60] animate-fade-in-up`}>
                                    <div className={`pt-1 mt-1`}>
                                        <button
                                            onClick={() => { setIsReportMenuOpen(false); setIsTemplateSubmenuOpen(false); setIsManageTemplateModalOpen(true); }}
                                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 border border-transparent ${theme.text || 'text-gray-300'} ${theme.id === 'corporate' ? 'hover:bg-blue-600 hover:border-blue-500 hover:text-white' : (theme.dropdown?.hover || 'hover:bg-gray-700') + ' hover:text-white'}`}
                                        >
                                            <FileText className="w-3 h-3" /> Manage Template
                                        </button>
                                        <button
                                            onClick={() => { 
                                                setIsReportMenuOpen(false); 
                                                setIsTemplateSubmenuOpen(false); 
                                                handleQuickLaunchDebug(); 
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 border border-transparent ${theme.text || 'text-gray-300'} ${theme.id === 'corporate' ? 'hover:bg-blue-600 hover:border-blue-500 hover:text-white' : (theme.dropdown?.hover || 'hover:bg-gray-700') + ' hover:text-white'}`}
                                        >
                                            <Terminal className="w-3 h-3" /> Quick Debug Session
                                        </button>
                                        <button
                                            onClick={() => { 
                                                setIsReportMenuOpen(false); 
                                                setIsTemplateSubmenuOpen(false); 
                                                setIsVncModalOpen(true); 
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 border border-transparent ${theme.text || 'text-gray-300'} ${theme.id === 'corporate' ? 'hover:bg-blue-600 hover:border-blue-500 hover:text-white' : (theme.dropdown?.hover || 'hover:bg-gray-700') + ' hover:text-white'}`}
                                        >
                                            <Monitor className="w-3 h-3" /> Live Browser Monitor
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
                                        <button
                                            onClick={() => { 
                                                setIsReportMenuOpen(false); 
                                                setIsTemplateSubmenuOpen(false); 
                                                setIsImageSettingsModalOpen(true); 
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 border border-transparent ${theme.text || 'text-gray-300'} ${theme.id === 'corporate' ? 'hover:bg-blue-600 hover:border-blue-500 hover:text-white' : (theme.dropdown?.hover || 'hover:bg-gray-700') + ' hover:text-white'}`}
                                        >
                                            <Settings className="w-3 h-3" /> Image Size Settings
                                        </button>
                                        <button
                                            onClick={() => { 
                                                setIsReportMenuOpen(false); 
                                                setIsTemplateSubmenuOpen(false); 
                                                setIsTableSettingsModalOpen(true); 
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 border border-transparent ${theme.text || 'text-gray-300'} ${theme.id === 'corporate' ? 'hover:bg-blue-600 hover:border-blue-500 hover:text-white' : (theme.dropdown?.hover || 'hover:bg-gray-700') + ' hover:text-white'}`}
                                        >
                                            <Table className="w-3 h-3" /> Table Column Settings
                                        </button>
                                        <button
                                            onClick={() => { 
                                                setIsReportMenuOpen(false); 
                                                setIsTemplateSubmenuOpen(false); 
                                                setIsPageMarginModalOpen(true); 
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 border border-transparent ${theme.text || 'text-gray-300'} ${theme.id === 'corporate' ? 'hover:bg-blue-600 hover:border-blue-500 hover:text-white' : (theme.dropdown?.hover || 'hover:bg-gray-700') + ' hover:text-white'}`}
                                        >
                                            <Layout className="w-3 h-3" /> Page Margin Settings
                                        </button>
                                    </div>
                                    {/* Theme Settings */}
                                    <div className="relative border-t border-gray-700/50">
                                        <button
                                            onClick={() => setIsThemeSubmenuOpen(!isThemeSubmenuOpen)}
                                            className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between border border-transparent ${theme.text || 'text-gray-300'} ${theme.id === 'corporate' ? 'hover:bg-blue-600 hover:border-blue-500 hover:text-white' : (theme.dropdown?.hover || 'hover:bg-gray-700') + ' hover:text-white'}`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Activity className="w-3 h-3" /> Theme
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
                useThaiDigits={useThaiDigits}
                setUseThaiDigits={setUseThaiDigits}
                data={{
                    ...reportData,
                    zoneName: getZoneName(selectedZone, zones),
                    accountName: accounts.find(a => a.id === selectedAccount)?.name,
                    botManagementEnabled: zoneSettings?.botManagement?.enabled ? 'Enabled' : 'Disabled',
                    blockAiBots: zoneSettings?.botManagement?.blockAiBots || 'unknown',
                    definitelyAutomated: zoneSettings?.botManagement?.definitelyAutomated || 'unknown',
                    likelyAutomated: zoneSettings?.botManagement?.likelyAutomated || 'unknown',
                    verifiedBots: zoneSettings?.botManagement?.verifiedBots || 'unknown',
                    sslMode: zoneSettings?.sslMode || 'unknown',
                    minTlsVersion: zoneSettings?.minTlsVersion || 'unknown',
                    tls13: (zoneSettings?.tls13 === 'on' || zoneSettings?.tls13 === 'zrt') ? 'Enabled' : 'Disabled',
                    dnsRecordsStatus: zoneSettings?.dnsRecordsCount > 0 ? 'Enabled' : 'Disabled',
                    leakedCredentials: zoneSettings?.leakedCredentials === 'on' ? 'Enabled' : 'Disabled',
                    browserIntegrityCheck: zoneSettings?.browserIntegrityCheck === 'on' ? 'Enabled' : 'Disabled',
                    hotlinkProtection: zoneSettings?.hotlinkProtection === 'on' ? 'Enabled' : 'Disabled',
                    zoneLockdownRules: zoneSettings?.zoneLockdownRules || '0',
                    ddosProtection: zoneSettings?.ddosProtection?.enabled === 'on' ? 'Enabled' : 'Disabled',
                    httpDdosProtection: 'Always On',
                    sslTlsDdosProtection: 'Always On',
                    networkDdosProtection: 'Always On',
                    cloudflareManaged: zoneSettings?.wafManagedRules?.cloudflareManaged === 'enabled' ? 'Enabled' : 'Disabled',
                    owaspCore: zoneSettings?.wafManagedRules?.owaspCore === 'enabled' ? 'Enabled' : 'Disabled',
                    exposedCredsRuleset: zoneSettings?.wafManagedRules?.exposedCredentials === 'enabled' ? 'Enabled' : 'Disabled',
                    ddosL7Ruleset: zoneSettings?.wafManagedRules?.ddosL7Ruleset === 'enabled' ? 'Enabled' : 'Disabled',
                    managedRulesCount: zoneSettings?.wafManagedRules?.managedRulesCount || '0',
                    rulesetActions: zoneSettings?.wafManagedRules?.rulesetActions || 'unknown',
                    ipAccessRules: zoneSettings?.ipAccessRules || '0',
                    customRules: zoneSettings?.customRules,
                    rateLimits: zoneSettings?.rateLimits,
                    dnsRecords: dnsRecords || [],
                    domainCount: (zones || []).length || '0',
                    capturedDomainImage,
                    capturedDnsImage,
                    capturedDnsPages,
                    capturedTrafficImage,
                    capturedTrafficImageSub1,
                    capturedTrafficImageSub2,
                    capturedTrafficImageSub3,
                    capturedTrafficImageSub4,
                    capturedTrafficImageSub5,
                    capturedFirewallImage,
                    capturedSecurityRulesImage,
                    capturedArgoImage,
                    capturedSpeedImage,
                    capturedSpeedMobileImage
                }}
                dashboardImage={dashboardImage}
                template={reportModalMode === 'static-template' ? staticReportTemplate : reportModalMode === 'middle-template' ? middleReportTemplate : reportTemplate}
                onSaveTemplate={reportModalMode === 'static-template' ? handleSaveStaticTemplate : reportModalMode === 'middle-template' ? handleSaveMiddleTemplate : handleSaveTemplate}
                onGenerate={captureAndGenerateReport}
                mode={reportModalMode}
                theme={theme}
                templateName={templateToEditName}
                templateId={templateToEditId}
                currentUserId={currentUser?.id}
                capturedDomainImage={capturedDomainImage}
                onCaptureScreenshot={handleCaptureScreenshot}
                autoDownloadWord={autoDownloadWord}
                onAutoDownloadComplete={() => {
                    setAutoDownloadWord(false);
                    if (window.__batchNext) {
                        window.__batchNext();
                        window.__batchNext = null;
                    }
                }}
            />

            <ScreenshotPreviewModal isOpen={showScreenshotModal} onClose={() => setShowScreenshotModal(false)} imgUrl={capturedDomainImage} theme={theme} />

            <VncModal isOpen={isVncModalOpen} onClose={() => setIsVncModalOpen(false)} theme={theme} />

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
                onConfirm={isScreenshotBatchMode ? handleCaptureScreenshotConfirm : handleBatchReport}
                theme={theme}
                selectedZone={selectedZone}
                selectedAccount={selectedAccount}
                accounts={accounts}
                currentUser={currentUser}
                loading={loading}
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
                zoneName={getZoneName(selectedZone, zones)}
                selectedAccountId={selectedAccount}
                subdomains={subDomains.map(s => s.value)}
                accounts={accounts}
                currentUser={currentUser}
            />

            <ImageSettingsModal
                isOpen={isImageSettingsModalOpen}
                onClose={() => setIsImageSettingsModalOpen(false)}
                theme={theme}
            />

            <TableSettingsModal
                isOpen={isTableSettingsModalOpen}
                onClose={() => setIsTableSettingsModalOpen(false)}
                theme={theme}
                storageKey="ntbc:table-column-widths"
            />

            <PageMarginSettingsModal
                isOpen={isPageMarginModalOpen}
                onClose={() => setIsPageMarginModalOpen(false)}
                theme={theme}
                onSave={(newMargins) => setPageMargins(newMargins)}
                storageKey="ntbc:page-margins"
            />

            <main className="max-w-6xl mx-auto p-8 min-h-[calc(100vh-3.5rem)] flex flex-col justify-center">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-extrabold text-white tracking-tight mb-3">
                        NTBC CFReport Template Workspace
                    </h2>
                    <p className="text-gray-400 text-sm max-w-xl mx-auto">
                        Create, configure and manage custom PDF or Word templates specifically for NTBC reporting.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
                    {/* WORKSPACE CARD 1: IMAGE SIZE & CROP SETTINGS */}
                    <div 
                        onClick={() => setIsImageSettingsModalOpen(true)}
                        className="group bg-gray-800/40 hover:bg-gradient-to-br hover:from-blue-900/30 hover:to-indigo-900/30 border border-gray-700/60 hover:border-blue-500/50 rounded-2xl p-8 cursor-pointer transition-all duration-300 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity transform group-hover:scale-110 duration-500">
                            <Sliders className="w-40 h-40 text-white" />
                        </div>
                        <div className="bg-blue-500/10 w-fit p-4 rounded-xl mb-6 border border-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                            <Sliders className="w-8 h-8 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-blue-300 transition-colors">Image Size Settings</h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            Configure screenshot crop coordinates, aspect ratio, and custom image display dimensions for report exports.
                        </p>
                        <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider group-hover:text-blue-300">Configure Size &rarr;</span>
                    </div>

                    {/* WORKSPACE CARD 2: TEMPLATE CREATION & MANAGEMENT */}
                    <div 
                        onClick={() => setIsManageTemplateModalOpen(true)}
                        className="group bg-gray-800/40 hover:bg-gradient-to-br hover:from-purple-900/30 hover:to-indigo-900/30 border border-gray-700/60 hover:border-purple-500/50 rounded-2xl p-8 cursor-pointer transition-all duration-300 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity transform group-hover:scale-110 duration-500">
                            <FileText className="w-40 h-40 text-white" />
                        </div>
                        <div className="bg-purple-500/10 w-fit p-4 rounded-xl mb-6 border border-purple-500/20 group-hover:scale-110 transition-transform duration-300">
                            <FileText className="w-8 h-8 text-purple-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-purple-300 transition-colors">Manage Templates</h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            Create new report structures, edit subdomain templates, customize domain metrics layouts, and export or import templates.
                        </p>
                        <span className="text-purple-400 text-xs font-semibold uppercase tracking-wider group-hover:text-purple-300">Open Workspace &rarr;</span>
                    </div>

                    {/* WORKSPACE CARD 3: CAPTURE SCREENSHOT & GENERATE REPORT */}
                    <div 
                        onClick={() => {
                            setIsScreenshotBatchMode(true);
                            setIsBatchModalOpen(true);
                        }}
                        className="group bg-gray-800/40 hover:bg-gradient-to-br hover:from-purple-900/30 hover:to-indigo-900/30 border border-gray-700/60 hover:border-purple-500/50 rounded-2xl p-8 cursor-pointer transition-all duration-300 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity transform group-hover:scale-110 duration-500">
                            <Camera className="w-40 h-40 text-white" />
                        </div>
                        <div className="bg-purple-500/10 w-fit p-4 rounded-xl mb-6 border border-purple-500/20 group-hover:scale-110 transition-transform duration-300">
                            <Camera className="w-8 h-8 text-purple-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-purple-300 transition-colors">Generate Report</h3>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            Select Cloudflare domains/subdomains and capture screenshots directly from the active dashboard session.
                        </p>
                        <span className="text-purple-400 text-xs font-semibold uppercase tracking-wider group-hover:text-purple-300">Select & Capture &rarr;</span>
                    </div>
                </div>

                {/* BIG SCREEN: LIVE BROWSER MONITOR */}
                <div className="mt-10 w-full max-w-5xl mx-auto bg-gray-900/60 border border-gray-700/60 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
                    {/* Monitor Top Control Bar */}
                    <div className="px-6 py-4 border-b border-gray-800/80 bg-gray-900/80 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                                <Monitor className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <h3 className="text-base font-bold text-white tracking-wide">Live Browser Monitor</h3>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${chromeRunning ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' : 'bg-yellow-500/15 border border-yellow-500/30 text-yellow-400'}`}>
                                        <span className={`w-2 h-2 rounded-full ${chromeRunning ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                                        {chromeRunning ? 'Active Stream (1920×1080)' : 'Browser Ready (Port 9222)'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Interactive Chromium container session used for real-time Cloudflare navigation & screenshot capturing.
                                </p>
                            </div>
                        </div>

                        {/* Top Bar Actions */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setMainVncStreamKey(Date.now())}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors shadow-sm"
                                title="Reconnect / Refresh Stream"
                            >
                                <RefreshCw className="w-3.5 h-3.5" /> Reconnect
                            </button>
                            <button
                                onClick={() => handleQuickLaunchDebug()}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors shadow-sm"
                                title="Quick Cloudflare Login & Debug"
                            >
                                <Terminal className="w-3.5 h-3.5 text-yellow-400" /> Quick Debug
                            </button>
                            <a
                                href="/vnc/?autoconnect=1&resize=scale&path=websockify"
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 hover:text-rose-200 text-xs font-medium transition-colors shadow-sm"
                                title="Open Live Monitor in New Tab"
                            >
                                <ExternalLink className="w-3.5 h-3.5" /> Fullscreen Tab
                            </a>
                        </div>
                    </div>

                    {/* Main Big Display Iframe */}
                    <div className="relative w-full bg-black flex flex-col items-center justify-center min-h-[580px] lg:min-h-[720px]">
                        <div className="absolute top-3 left-3 z-10 pointer-events-none">
                            <span className="px-2.5 py-1 rounded bg-black/70 backdrop-blur-sm border border-gray-800 text-[11px] font-mono text-gray-300 shadow-md">
                                🔴 LIVE DISPLAY • 1920×1080
                            </span>
                        </div>
                        {typeof window !== 'undefined' && (
                            <iframe
                                key={mainVncStreamKey}
                                src={`${window.location.origin}/vnc/?autoconnect=1&resize=scale&path=websockify`}
                                className="w-full h-[580px] lg:h-[720px] border-none"
                                title="Live Browser Monitor"
                            />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
