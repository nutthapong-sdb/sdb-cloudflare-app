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
    Search, Bell, Menu, Download, Server, Key, List
} from 'lucide-react';
import jsPDF from 'jspdf';
import * as htmlToImage from 'html-to-image';

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

// --- COMPONENTS ---

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

    const [throughputData, setThroughputData] = useState([]);
    const [attackSeriesData, setAttackSeriesData] = useState([]);
    const [detailedAttackList, setDetailedAttackList] = useState([]); // Real-time list
    const [httpStatusSeriesData, setHttpStatusSeriesData] = useState({ data: [], keys: [] });

    const [topUrls, setTopUrls] = useState([]);
    const [topIps, setTopIps] = useState([]);
    const [topCountries, setTopCountries] = useState([]);
    const [topUserAgents, setTopUserAgents] = useState([]);
    const [topFirewallActions, setTopFirewallActions] = useState([]);

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
            setSubDomains(hostOptions);
            const defaultSub = hostOptions.find(h => h.value.toLowerCase() === DEFAULT_CONFIG.subDomain.toLowerCase());
            if (defaultSub) setSelectedSubDomain(defaultSub.value);
            setLoadingStats(false);
        };
        loadDNS();
    }, [selectedZone]);

    // 4. Subdomain Selected -> Fetch Traffic
    useEffect(() => {
        if (!selectedSubDomain) { resetDashboardData(); return; }

        const loadTrafficData = async () => {
            setLoadingStats(true);
            console.log(`🔍 Fetching traffic for subdomain: ${selectedSubDomain} (Range: ${timeRange}m)`);

            const result = await callAPI('get-traffic-analytics', {
                zoneId: selectedZone, timeRange: timeRange, subdomain: selectedSubDomain
            });

            let filteredData = [];
            let totalReq = 0;
            let weightedAvgTime = 0;

            if (result && result.data) {
                filteredData = result.data;
                const firewallGroups = result.firewallData || [];

                // --- FIREWALL SUMMARY ---
                const blockedCount = firewallGroups
                    .filter(g => g.dimensions?.action !== 'log' && g.dimensions?.action !== 'skip')
                    .reduce((acc, g) => acc + g.count, 0);

                const logCount = firewallGroups
                    .filter(g => g.dimensions?.action === 'log')
                    .reduce((acc, g) => acc + g.count, 0);

                setBlockedEvents(blockedCount);
                setLogEvents(logCount);

                // --- FIREWALL PIE ---
                const actionCounts = {};
                firewallGroups.forEach(g => {
                    const act = g.dimensions?.action || 'Unknown';
                    actionCounts[act] = (actionCounts[act] || 0) + g.count;
                });
                const topActions = Object.entries(actionCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
                setTopFirewallActions(topActions);

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

            // 2. FILL DATA

            // Collect ALL unique status codes FIRST
            const allCodes = new Set();

            // HTTP DATA
            filteredData.forEach(item => {
                const count = item.count;
                const dims = item.dimensions;

                // Top Lists
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
                        throughputBuckets.get(bucketTime).count += count;
                    }

                    const status = dims.edgeResponseStatus;
                    if (status && status !== 200 && httpCodeBuckets.has(bucketTime)) {
                        const bucket = httpCodeBuckets.get(bucketTime);
                        bucket.series[status] = (bucket.series[status] || 0) + count;
                        statusTotals[status] = (statusTotals[status] || 0) + count;
                        allCodes.add(status); // Collect here!
                    }
                }
            });

            // FIREWALL DATA
            const firewallGroups = result?.firewallData || [];
            const realAttackEvents = [];

            firewallGroups.forEach(g => {
                const action = g.dimensions?.action;
                const targetActions = new Set(['block', 'challenge', 'js_challenge', 'jschallenge', 'managed_challenge']);

                if (targetActions.has(action)) {
                    // Add to Chart buckets
                    if (g.dimensions?.datetimeMinute) {
                        const itemTime = new Date(g.dimensions.datetimeMinute).getTime();
                        const bucketTime = Math.floor(itemTime / bucketSizeMs) * bucketSizeMs;
                        if (attackBuckets.has(bucketTime)) {
                            attackBuckets.get(bucketTime).count += g.count;
                        }

                        // Add to Detailed List (Real time)
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

                // IMPORTANT: Ensure EVERY key is present, default to 0
                allCodes.forEach(code => {
                    entry[code] = b.series[code] || 0;
                });

                return entry;
            });

            // SORT KEYS BY TOTAL COUNT (DESC)
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
    }, []);

    const handleExportPDF = async () => {
        if (!dashboardRef.current) return;
        setIsExporting(true);
        try {
            window.scrollTo(0, 0); await new Promise(resolve => setTimeout(resolve, 800));
            const element = dashboardRef.current;

            // Standard capture with high quality
            const imgData = await htmlToImage.toJpeg(element, {
                quality: 0.9,
                backgroundColor: '#000000',
                pixelRatio: 2 // Keep resolution high
            });

            // Standard A4 Landscape
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            // Fit image to full page (Stretch like original settings)
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`gdcc-report.pdf`);
        } catch (error) { console.error('Export Failed:', error); } finally { setIsExporting(false); }
    };

    if (!currentUser) return null;

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
                        <button onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs transition-colors">
                            {isExporting ? <Activity className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} {isExporting ? 'Exporting...' : 'Export PDF'}
                        </button>
                        <div className="bg-orange-600/20 text-orange-500 w-8 h-8 rounded flex items-center justify-center">
                            <span className="font-bold text-xs">{currentUser.ownerName?.charAt(0) || 'U'}</span>
                        </div>
                    </div>
                </div>
            </nav>

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

                </div>
            </main>
        </div>
    );
}
