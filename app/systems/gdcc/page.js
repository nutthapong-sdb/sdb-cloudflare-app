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

const DEFAULT_STATIC_TEMPLATE = `
<h1 style="text-align: center; font-size: 24pt; font-weight: bold;">รายงานสรุปผลการดำเนินงาน (Standard Report Form)</h1>
<h2 style="text-align: center; font-size: 18pt;">ประจำเดือน .............................. พ.ศ. ...........</h2>
<br>
<p><strong>เรียน:</strong> ผู้บริหาร / คณะกรรมการ</p>
<p><strong>เรื่อง:</strong> รายงานสรุปสถานะความมั่นคงปลอดภัยไซเบอร์ (Web Application Firewall)</p>
<br>
<p><strong>1. บทสรุปผู้บริหาร (Executive Summary)</strong></p>
<p style="text-indent: 1cm;">[ใส่เนื้อหาบทสรุปที่นี่...]</p>
<br>
<p><strong>2. สถิติการใช้งานและการโจมตี (Statistics & Attacks)</strong></p>
<table style="width: 100%; border-collapse: collapse; border: 1px solid black;">
  <tr>
    <th style="border: 1px solid black; padding: 5px; background-color: #eee; width: 30%;">รายการ (Item)</th>
    <th style="border: 1px solid black; padding: 5px; background-color: #eee; width: 20%;">สถานะ (Status)</th>
    <th style="border: 1px solid black; padding: 5px; background-color: #eee; width: 50%;">รายละเอียด (Details)</th>
  </tr>
  <tr>
    <td style="border: 1px solid black; padding: 5px;">Total Requests</td>
    <td style="border: 1px solid black; padding: 5px;"></td>
    <td style="border: 1px solid black; padding: 5px;"></td>
  </tr>
   <tr>
    <td style="border: 1px solid black; padding: 5px;">Attacks Blocked</td>
    <td style="border: 1px solid black; padding: 5px;"></td>
    <td style="border: 1px solid black; padding: 5px;"></td>
  </tr>
</table>
<br>
<p><strong>3. ข้อเสนอแนะ (Recommendation)</strong></p>
<ul style="list-style-type: square; margin-left: 20px;">
  <li>ตรวจสอบการโจมตีที่เกิดขึ้นบ่อย</li>
  <li>ปรับปรุง Rule WAF ให้เหมาะสม</li>
</ul>
<br>
<div style="margin-top: 50px; text-align: right;">
    <p>ลงชื่อ ....................................................... ผู้จัดทำรายงาน</p>
    <p>(.......................................................)</p>
    <p>ตำแหน่ง .......................................................</p>
    <p>วันที่ ......../......../............</p>
</div>
`;

// Helper to generate HTML tables for lists
const generateHtmlTable = (headers, rows, styles = {}) => {
    const thStyle = "border: 1px solid black; padding: 8px; background-color: #f3f4f6; font-weight: bold;";
    const tdStyle = "border: 1px solid black; padding: 8px;";

    let html = `<div class="mt-2 pl-4 mb-4" style="${styles.div || ''}">
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd; ${styles.table || ''}">
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

    html += `</tbody></table></div>`;
    return html;
};

// --- COMPONENTS ---

// 1. Report Modal Component
const ReportModal = ({ isOpen, onClose, data, dashboardImage, template, onSaveTemplate, mode = 'report' }) => {
    if (!isOpen) return null;

    // mode: 'report' | 'static-template'

    // If no template passed, use default (fallback)
    const currentTemplate = template || DEFAULT_TEMPLATE;

    // Default to editing in static mode, preview in report mode
    const [isEditing, setIsEditing] = useState(false);
    const [localTemplate, setLocalTemplate] = useState(currentTemplate);
    const reportContentRef = useRef(null);

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

    // Helper for Thai Date
    const formatThaiDate = (date) => {
        return date.toLocaleString('th-TH', {
            year: '2-digit', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
        });
    };

    // --- DATA PREPARATION ---
    // Safely handle missing data for static mode or initial load
    const safeData = data || {
        domain: '-', timeRange: 0, totalRequests: 0, avgTime: 0,
        blockedEvents: 0, logEvents: 0, topUrls: [], topIps: [],
        topRules: [], topAttackers: []
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
    const processTemplate = (tmpl) => {
        // If static template mode, return raw HTML (no replacement)
        if (mode === 'static-template') return tmpl;

        let html = tmpl;

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
        };

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
        alert('Report copied to clipboard!');
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
            "body { font-family: 'TH SarabunPSK', 'Sarabun', sans-serif; font-size: 16pt; }" +
            "img { width: 500px; height: auto; }" +
            "table { width: 100%; border-collapse: collapse; }" +
            "td, th { border: 1px solid #000; padding: 5px; }" +
            "</style>" +
            "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->" +
            "</head><body><div class='Section1'>";
        const footer = "</div></body></html>";

        let cleanHTML = reportContentRef.current.innerHTML;

        // If editing, cleanHTML is the TEXTAREA html. We don't want that.
        // We want the RAW template text if in edit mode (as user requested to download the 'template').
        if (isEditing) {
            cleanHTML = localTemplate;
        } else {
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-950/50 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <h3 className="text-lg font-bold text-gray-100">
                            {mode === 'static-template' ? 'แบบฟอร์มรายงาน (Report Template Source)' : (isEditing ? 'แก้ไข Template (Edit Template)' : 'สรุปรายงาน (Report Summary)')}
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isEditing && (
                            <button onClick={() => setIsEditing(true)} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded border border-gray-700 transition-colors">
                                Edit Template
                            </button>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* CONTENT AREA (Scrollable) */}
                <div className="flex-grow overflow-y-auto p-8 bg-white text-black font-serif shadow-inner" id="print-area">
                    <div ref={reportContentRef} className="space-y-4 text-base leading-relaxed" style={{ fontFamily: '"TH SarabunPSK", "Sarabun", sans-serif' }}>

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
                            <div className="flex flex-col h-full">
                                <div className="mb-2 text-xs text-gray-500 bg-yellow-50 p-2 rounded border border-yellow-200">
                                    <strong>Template Editor:</strong> HTML Tags supported.
                                    {mode === 'report' && " Use variables like @TIME_RANGE, @DOMAIN."}
                                </div>
                                <textarea
                                    className="w-full h-[500px] p-4 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 mb-4"
                                    value={localTemplate}
                                    onChange={(e) => setLocalTemplate(e.target.value)}
                                    placeholder="Enter your HTML template here..."
                                />
                            </div>
                        ) : (
                            <div dangerouslySetInnerHTML={{ __html: processTemplate(localTemplate) }} />
                        )}

                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-800 bg-gray-950/50 flex justify-end gap-3 flex-shrink-0">
                    {/* In Edit Mode (Default for Static) */}
                    {isEditing ? (
                        <>
                            <button onClick={() => setLocalTemplate(template || DEFAULT_TEMPLATE)} className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-200 text-xs font-bold rounded">
                                Reset
                            </button>
                            <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded">
                                    Cancel
                                </button>
                            <button onClick={handleDownloadWord} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors">
                                <FileType className="w-3 h-3" /> Download Word
                            </button>
                            <button onClick={handleSave} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded flex items-center gap-2">
                                <Edit3 className="w-3 h-3" /> {mode === 'static-template' ? 'Save Template' : 'Save & Preview'}
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={handleCopy} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors">
                                <Copy className="w-3 h-3" /> Copy All
                            </button>
                            <button onClick={handleDownloadWord} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors">
                                <FileType className="w-3 h-3" /> Download Word
                            </button>
                        </>
                    )}
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
    const [isExporting, setIsExporting] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [dashboardImage, setDashboardImage] = useState(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [reportTemplate, setReportTemplate] = useState(DEFAULT_TEMPLATE);
    const [staticReportTemplate, setStaticReportTemplate] = useState(DEFAULT_STATIC_TEMPLATE);
    const [reportModalMode, setReportModalMode] = useState('preview'); // 'preview' (report) or 'static-template'
    const dashboardRef = useRef(null);

    // --- DEFAULT CONFIG ---
    const DEFAULT_CONFIG = {
        accountName: "Softdebut POC",
        zoneName: "softdebut.online",
        subDomain: "softdebut.online"
    };

    // Selector States
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [zones, setZones] = useState([]);
    const [subDomains, setSubDomains] = useState([]);

    const [selectedAccount, setSelectedAccount] = useState('');
    const [selectedZone, setSelectedZone] = useState('');
    const [selectedSubDomain, setSelectedSubDomain] = useState('');
    const [timeRange, setTimeRange] = useState(1440); // Default 24h

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
    const [topRules, setTopRules] = useState([]);
    const [topAttackers, setTopAttackers] = useState([]); // RENAMED/MODIFIED from topAttackCountries for clarity

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
            return result.success ? result : null;
        } catch (err) {
            console.error('API Error:', err);
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
    }, [selectedZone]);

    // 4. Subdomain Selected -> Fetch Traffic
    useEffect(() => {
        if (!selectedSubDomain) { resetDashboardData(); return; }

        const loadTrafficData = async () => {
            setLoadingStats(true);
            const isAllSubdomains = selectedSubDomain === 'ALL_SUBDOMAINS';
            console.log(`🔍 Fetching traffic for: ${isAllSubdomains ? 'ALL ZONES' : selectedSubDomain} (Range: ${timeRange}m)`);

            const result = await callAPI('get-traffic-analytics', {
                zoneId: selectedZone,
                timeRange: timeRange,
                subdomain: isAllSubdomains ? null : selectedSubDomain
            });

            let filteredData = [];
            let totalReq = 0;
            let weightedAvgTime = 0;

            if (result && result.data) {
                filteredData = result.data;
                const firewallActivity = result.firewallActivity || [];
                const firewallRulesData = result.firewallRules || [];
                const firewallIPsData = result.firewallIPs || [];

                // --- 1. FIREWALL SUMMARY (From Activity: Minute x Action) ---
                const blockedCount = firewallActivity
                    .filter(g => g.dimensions?.action !== 'log' && g.dimensions?.action !== 'skip' && g.dimensions?.action !== 'allow')
                    .reduce((acc, g) => acc + g.count, 0);

                const logCount = firewallActivity
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
                const topActions = Object.entries(actionCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
                setTopFirewallActions(topActions);


                // --- 2. TOP RULES (From Rules: Desc x ID) ---
                // Already aggregated correctly by API
                const processedRules = firewallRulesData.map(g => ({
                    rule: `${g.dimensions.description} (${g.dimensions.ruleId})`,
                    count: g.count
                }));
                // Sort again just in case API order was affected by aliases (though it shouldn't be)
                setTopRules(processedRules.sort((a, b) => b.count - a.count).slice(0, 5));


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
                const sortedAttackers = Object.values(attackerMap)
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
            setTopUserAgents(toArray(uaCounts, 'agent'));

            setLoadingStats(false);
        };

        loadTrafficData();
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

    const handleOpenReportWithImage = async () => {
        if (!dashboardRef.current) return;
        setIsGeneratingReport(true);
        try {
            window.scrollTo(0, 0); await new Promise(resolve => setTimeout(resolve, 800));
            const element = dashboardRef.current;
            const imgData = await htmlToImage.toJpeg(element, {
                quality: 0.8, backgroundColor: '#000000', pixelRatio: 1.5
            });
            setDashboardImage(imgData);
            setReportModalMode('report');
            setIsReportModalOpen(true);
        } catch (error) { console.error('Report Gen Failed:', error); }
        finally { setIsGeneratingReport(false); }
    };

    const handleOpenTemplateManager = () => {
        setReportModalMode('static-template');
        setIsReportModalOpen(true);
    };

    const handleExportPDF = async () => {
        if (!dashboardRef.current) return;
        setIsExporting(true);
        try {
            window.scrollTo(0, 0); await new Promise(resolve => setTimeout(resolve, 800));
            const element = dashboardRef.current;

            const imgData = await htmlToImage.toJpeg(element, {
                quality: 0.9, backgroundColor: '#000000', pixelRatio: 2
            });

            // Force Portrait - standard arguments
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            // 1. Fill PDF Background with Black (matches App Theme)
            pdf.setFillColor(0, 0, 0);
            pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');

            // Calculate height to maintain aspect ratio based on the captured element's dimensions
            const contentWidth = element.scrollWidth;
            const contentHeight = element.scrollHeight;
            const ratio = contentHeight / contentWidth;
            const calculatedHeight = pdfWidth * ratio;

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, calculatedHeight);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            pdf.save(`gdcc-report-portrait-${timestamp}.pdf`);
        } catch (error) { console.error('Export Failed:', error); } finally { setIsExporting(false); }
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
        topAttackers: topAttackers // NEW
    };

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
                        <button onClick={handleOpenTemplateManager} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 hover:text-white text-gray-300 px-3 py-1.5 rounded text-xs transition-colors border border-gray-700">
                            <FileText className="w-3 h-3" /> Report Template
                        </button>
                        <button onClick={handleOpenReportWithImage} disabled={isGeneratingReport} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 hover:text-white text-gray-300 px-3 py-1.5 rounded text-xs transition-colors border border-gray-700">
                            {isGeneratingReport ? <Activity className="w-3 h-3 animate-spin" /> : <Edit3 className="w-3 h-3" />} {isGeneratingReport ? 'Capturing...' : 'Write Report'}
                        </button>
                        <button onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs transition-colors">
                            {isExporting ? <Activity className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} {isExporting ? 'Exporting...' : 'Export PDF'}
                        </button>
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
                    zoneName: zones.find(z => z.id === selectedZone)?.name
                }}
                dashboardImage={dashboardImage}
                template={reportModalMode === 'static-template' ? staticReportTemplate : reportTemplate}
                onSaveTemplate={reportModalMode === 'static-template' ? handleSaveStaticTemplate : handleSaveTemplate}
                mode={reportModalMode}
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
                        {[{ label: '30m', val: 30 }, { label: '6h', val: 360 }, { label: '12h', val: 720 }, { label: '24h', val: 1440 }].map(t => (
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
