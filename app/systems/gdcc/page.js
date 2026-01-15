'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/app/utils/auth';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
    ShieldAlert, Activity, Clock, Globe,
    AlertTriangle, FileText, LayoutDashboard, Database,
    Search, Bell, Menu, Download
} from 'lucide-react';
import jsPDF from 'jspdf';
import * as htmlToImage from 'html-to-image'; // New library

// --- MOCK DATA (Same) ---

const throughputData = Array.from({ length: 24 }, (_, i) => ({
    time: `${i}:00`,
    requests: Math.floor(Math.random() * 5000) + 1000,
    blocked: Math.floor(Math.random() * 500)
}));

const firewallPieData = [
    { name: 'Allow', value: 98.74, color: '#3b82f6' }, // Blue
    { name: 'Block', value: 1.26, color: '#f97316' },  // Orange
];

const topUrls = [
    { path: '/', count: 20062 },
    { path: '/api/v1/users', count: 7260 },
    { path: '/api/v1/profile', count: 2419 },
    { path: '/api/v1/posts', count: 2417 },
    { path: '/api/v1/users/5', count: 827 },
];

const topIps = [
    { ip: '184.22.181.37', count: 28347 },
    { ip: '161.118.237.245', count: 3432 },
    { ip: '142.248.88.57', count: 1881 },
    { ip: '172.190.142.176', count: 1752 },
    { ip: '52.187.162.248', count: 1493 },
];

const topCountries = [
    { country: 'th', count: 28513, name: 'Thailand' },
    { country: 'sg', count: 12153, name: 'Singapore' },
    { country: 'us', count: 10785, name: 'United States' },
    { country: 'jp', count: 8411, name: 'Japan' },
    { country: 'ie', count: 6430, name: 'Ireland' },
];

const topUserAgents = [
    { agent: '<empty string>', count: 28917 },
    { agent: 'python-requests/2.32.3', count: 28435 },
    { agent: 'Mozilla/5.0 (Windows NT 10.0; Win64)...', count: 3606 },
    { agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...', count: 2702 },
    { agent: 'Go-http-client/1.1', count: 2467 },
];

const protectionStats = Array.from({ length: 30 }, (_, i) => ({
    date: `Jan ${i + 1}`,
    count: i > 25 ? Math.floor(Math.random() * 800) + 100 : 50
}));

const topRules = [
    { name: 'All Log', count: 88888 },
    { name: 'Plone - Dangerous File Extension', count: 33290 },
    { name: 'Anomaly:Header:User-Agent - Empty', count: 24821 },
    { name: 'Anomaly:Header:User-Agent - Missing', count: 24821 },
    { name: 'Anomaly:Header:User-Agent - Anomaly', count: 24016 },
];

const attackLogs = [
    { time: '2026-01-15T07:41:29Z', host: 'ssh2.softdebut.online', path: '/', rule: 'Manage AI bots', color: 'blue' },
    { time: '2026-01-15T07:13:46Z', host: '140.softdebut.online', path: '//zwso.php', rule: '//', color: 'blue' },
    { time: '2026-01-15T06:23:43Z', host: 'nokair.softdebut.online', path: '/', rule: 'Manage AI bots', color: 'blue' },
    { time: '2026-01-15T06:12:27Z', host: 'ip.softdebut.online', path: '/', rule: 'Manage AI bots', color: 'blue' },
    { time: '2026-01-15T05:47:54Z', host: 'www99.softdebut.online', path: '/', rule: 'Manage AI bots', color: 'blue' },
    { time: '2026-01-15T05:27:46Z', host: 'dd-prod.airtrfx.com.softdebut.online', path: '//zwso.php', rule: '//', color: 'blue' },
    { time: '2026-01-15T05:27:10Z', host: 'a.b.c.d.e.f.softdebut.online', path: '/', rule: 'Manage AI bots', color: 'blue' },
];

const topAttackers = [
    { ip: '52.169.206.229', country: 'Ireland', attacks: 242, type: '[//, test55r.softdebut.online]' },
    { ip: '172.192.50.124', country: 'Japan', attacks: 178, type: '[test temp]' },
    { ip: '20.239.240.150', country: 'Hong Kong', attacks: 154, type: '[block poc.softdebut.online]' },
    { ip: '20.205.123.55', country: 'Hong Kong', attacks: 153, type: '[test temp]' },
    { ip: '4.213.16.78', country: 'India', attacks: 153, type: '[test55r.softdebut.online]' },
];

// --- COMPONENTS ---

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

const HorizontalBarList = ({ data, labelKey, valueKey, color = "bg-blue-600", showValue = true }) => {
    const maxValue = Math.max(...data.map(d => d[valueKey]));
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
                        <span className="text-gray-400">{item[valueKey].toLocaleString()}</span>
                    </div>
                    <div className="absolute top-0 left-0 h-full bg-gray-800/50 w-full rounded-sm">
                        <div
                            className={`h-full ${color} opacity-40 rounded-sm transition-all duration-1000`}
                            style={{ width: `${(item[valueKey] / maxValue) * 100}%` }}
                        ></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default function GDCCPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const dashboardRef = useRef(null);

    useEffect(() => {
        const user = auth.requireAuth(router);
        if (user) setCurrentUser(user);
    }, []);

    const handleExportPDF = async () => {
        if (!dashboardRef.current) return;
        setIsExporting(true);

        try {
            window.scrollTo(0, 0);
            await new Promise(resolve => setTimeout(resolve, 800));

            const element = dashboardRef.current;
            console.log('Capture started with html-to-image (JPEG)...');

            const imgData = await htmlToImage.toJpeg(element, {
                quality: 0.8,
                backgroundColor: '#000000',
            });

            console.log('Capture finished, generating PDF...');

            const pdf = new jsPDF('l', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            // Use jsPDF's built-in image properties to get accurate ratios
            const imgProps = pdf.getImageProperties(imgData);
            const imgRatio = imgProps.width / imgProps.height;
            const pageRatio = pdfWidth / pdfHeight;

            let renderW, renderH;

            // "Contain" logic: Fit the image entirely within the page bounds
            if (imgRatio > pageRatio) {
                // Image is wider than page (relative to aspect) -> Fit Width
                renderW = pdfWidth;
                renderH = pdfWidth / imgRatio;
            } else {
                // Image is taller than page -> Fit Height
                renderH = pdfHeight;
                renderW = pdfHeight * imgRatio;
            }

            // Center the image
            const x = (pdfWidth - renderW) / 2;
            const y = (pdfHeight - renderH) / 2;

            pdf.addImage(imgData, 'JPEG', x, y, renderW, renderH);
            pdf.save(`gdcc-security-report-${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error('Export Failed:', error);
            alert(`Export PDF error: ${error.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    if (!currentUser) return null;

    return (
        <div className="min-h-screen bg-black font-sans text-white">
            {/* Navbar Minimal */}
            <nav className="border-b border-gray-800 bg-[#0f1115] sticky top-0 z-50">
                <div className="w-full px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
                            <LayoutDashboard className="w-5 h-5 text-orange-500" />
                            <h1 className="text-sm font-bold text-gray-200">GDCC <span className="text-gray-500">Analytics</span></h1>
                        </div>
                        <div className="h-4 w-px bg-gray-700 mx-2"></div>
                        <span className="text-xs text-gray-400">Security Overview</span>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* PDF Export Button */}
                        <button
                            onClick={handleExportPDF}
                            disabled={isExporting}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isExporting ? (
                                <Activity className="w-3 h-3 animate-spin" />
                            ) : (
                                <Download className="w-3 h-3" />
                            )}
                            {isExporting ? 'Exporting...' : 'Export PDF'}
                        </button>

                        <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded text-xs border border-gray-800">
                            <Clock className="w-3 h-3 text-gray-500" />
                            <span className="text-gray-300">Last 24 Hours</span>
                        </div>
                        <div className="bg-orange-600/20 text-orange-500 w-8 h-8 rounded flex items-center justify-center">
                            <span className="font-bold text-xs">{currentUser.ownerName?.charAt(0) || 'U'}</span>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Capture Area */}
            <main ref={dashboardRef} className="p-4 space-y-4 bg-black">

                {/* Row 1: Big Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card title="Total Requests (จำนวนการร้องขอใช้งานทั้งหมด)">
                        <div className="flex items-baseline gap-2">
                            <span className="text-6xl font-bold text-blue-400">91,054</span>
                            <span className="text-xl text-gray-500 font-thai">ครั้ง</span>
                        </div>
                    </Card>
                    <Card title="Avg Response Time (เวลาเฉลี่ยในการตอบสนอง)">
                        <div className="flex items-baseline gap-2">
                            <span className="text-6xl font-bold text-purple-400">621.314</span>
                            <span className="text-xl text-gray-500">ms</span>
                        </div>
                    </Card>
                    <Card title="Blocked Security Events (จำนวนเหตุการณ์ด้านความปลอดภัยที่ถูกบล็อก)">
                        <div className="flex items-baseline gap-2">
                            <span className="text-6xl font-bold text-orange-400">3,243</span>
                            <span className="text-xl text-gray-500 font-thai">ครั้ง</span>
                        </div>
                    </Card>
                </div>

                {/* Row 2: Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card title="HTTP Request Volume (ปริมาณการเรียกใช้งาน HTTP ตามช่วงเวลา)">
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={throughputData}>
                                    <defs>
                                        <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    {!isExporting && <Tooltip
                                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }}
                                        itemStyle={{ color: '#60a5fa' }}
                                    />}
                                    <Area type="monotone" dataKey="requests" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRequests)" />
                                    <Bar dataKey="blocked" fill="#f97316" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card title="Top URLs (URL ที่มีการเรียกใช้งานบ่อยที่สุด)">
                        <HorizontalBarList data={topUrls} labelKey="path" valueKey="count" />
                    </Card>

                    <Card title="Firewall Actions (ประเภทการตอบโต้โดยไฟร์วอลล์)">
                        <div className="h-64 flex flex-col items-center justify-center relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={firewallPieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {firewallPieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    {!isExporting && <Tooltip />}
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mt-[-20px]">
                                <div className="text-2xl font-bold text-blue-400">98.74%</div>
                                <div className="text-xs text-gray-500">Allow</div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Row 3 */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card title="Top Client IPs (อันดับ IP ของผู้ใช้งานที่มีการเชื่อมต่อมากที่สุด)">
                        <HorizontalBarList data={topIps} labelKey="ip" valueKey="count" color="bg-cyan-600" />
                    </Card>

                    <Card title="Top User Agents (อันดับของ User Agents ที่ใช้เรียกข้อมูลมากที่สุด)">
                        <HorizontalBarList data={topUserAgents} labelKey="agent" valueKey="count" color="bg-indigo-600" />
                    </Card>

                    <Card title="Attack Prevention Stats (กราฟสถิติการป้องกันการโจมตี แยกตามช่วงเวลา)">
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={protectionStats}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                    <XAxis dataKey="date" hide />
                                    {!isExporting && <Tooltip
                                        contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }}
                                    />}
                                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>

                {/* Row 4 */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card title="Top Countries (ประเทศของผู้ใช้งานที่ส่งคำขอเข้ามามากที่สุด)">
                        <HorizontalBarList data={topCountries} labelKey="name" valueKey="count" color="bg-blue-800" />
                    </Card>

                    <Card title="HTTP Status Codes (สถานะการตอบกลับของ HTTP ไม่รวม 200)">
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={throughputData.slice(0, 10)}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                    {!isExporting && <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#111827', borderColor: '#374151' }} />}
                                    <Bar dataKey="blocked" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card title="Top Security Rules Triggered (อันดับกฎความปลอดภัยที่ถูกเรียกใช้งานมากที่สุด)">
                        <HorizontalBarList data={topRules} labelKey="name" valueKey="count" color="bg-blue-900" />
                    </Card>
                </div>

                {/* Row 5: Logs */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                        <Card title="Attack Log Details (ตาราง รายละเอียดการโจมตี - Log รายการ)">
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs font-mono text-gray-400">
                                    <thead>
                                        <tr className="border-b border-gray-800 text-left">
                                            <th className="py-2 px-2 text-gray-500 font-semibold w-4"></th>
                                            <th className="py-2 px-2 text-gray-500 font-semibold">Time</th>
                                            <th className="py-2 px-2 text-gray-500 font-semibold">Host</th>
                                            <th className="py-2 px-2 text-gray-500 font-semibold">Path</th>
                                            <th className="py-2 px-2 text-gray-500 font-semibold">RuleName</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attackLogs.map((log, i) => (
                                            <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                                                <td className="py-2 px-2">
                                                    <div className="w-2 h-2 bg-blue-500 rounded-sm"></div>
                                                </td>
                                                <td className="py-2 px-2 whitespace-nowrap">{log.time}</td>
                                                <td className="py-2 px-2 text-gray-300">{log.host}</td>
                                                <td className="py-2 px-2 text-orange-400">{log.path}</td>
                                                <td className="py-2 px-2 text-gray-400">{log.rule}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>

                    <div className="lg:col-span-1">
                        <Card title="Top 5 Attackers Summary (ตาราง สรุป 5 อันดับผู้โจมตีสูงสุดและรูปแบบการโจมตี)">
                            <div className="text-xs font-mono">
                                <div className="grid grid-cols-12 text-gray-500 border-b border-gray-800 pb-2 mb-2 gap-2">
                                    <div className="col-span-5">Client IP / Country</div>
                                    <div className="col-span-2 text-end">Attacks</div>
                                    <div className="col-span-5">Attack Types</div>
                                </div>
                                {topAttackers.map((attacker, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-2 py-3 border-b border-gray-800 hover:bg-gray-800/50">
                                        <div className="col-span-5 truncate">
                                            <div className="text-gray-200">{attacker.ip}</div>
                                            <div className="text-gray-500 text-[10px]">{attacker.country}</div>
                                        </div>
                                        <div className="col-span-2 text-end">
                                            <div className="h-full relative bg-blue-900/20 rounded">
                                                <div className="absolute top-0 right-0 h-full bg-blue-600 rounded opacity-50" style={{ width: `${(attacker.attacks / 250) * 100}%` }}></div>
                                                <span className="relative z-10 pr-1 text-blue-200">{attacker.attacks}</span>
                                            </div>
                                        </div>
                                        <div className="col-span-5 text-gray-400 truncate text-[10px] flex items-center">
                                            {attacker.type}
                                        </div>
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
