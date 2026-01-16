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
    Search, Bell, Menu, Download, Server, Key
} from 'lucide-react';
import jsPDF from 'jspdf';
import * as htmlToImage from 'html-to-image';

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
        subDomain: "140.softdebut.online"
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
    const [throughputData, setThroughputData] = useState([]);
    const [topUrls, setTopUrls] = useState([]);
    const [topIps, setTopIps] = useState([]);
    const [topCountries, setTopCountries] = useState([]);
    const [topUserAgents, setTopUserAgents] = useState([]);

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
                console.log(`✅ Auto-Selecting Account: ${defaultAcc.name}`);
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
                    console.log(`✅ Auto-Selecting Zone: ${defaultZone.name}`);
                    setSelectedZone(defaultZone.id);
                }
            }
        }
        setLoadingZones(false);
    };

    const resetDashboardData = () => {
        setRawData([]); setTotalRequests(0); setAvgResponseTime(0);
        setThroughputData([]); setTopUrls([]); setTopIps([]); setTopCountries([]); setTopUserAgents([]);
    };

    // 3. Zone Selected -> Load DNS
    useEffect(() => {
        if (!selectedZone) { resetDashboardData(); setSubDomains([]); return; }

        const loadDNS = async () => {
            setLoadingStats(true); setSelectedSubDomain(''); setSubDomains([]);
            const dnsRes = await callAPI('get-dns-records', { zoneId: selectedZone });
            const allHosts = new Set();

            if (dnsRes && dnsRes.data) {
                dnsRes.data.forEach(rec => {
                    if (['A', 'AAAA', 'CNAME'].includes(rec.type)) allHosts.add(rec.name);
                });
            }

            const hostOptions = Array.from(allHosts).sort().map(h => ({ value: h, label: h }));
            setSubDomains(hostOptions);

            const defaultSub = hostOptions.find(h => h.value.toLowerCase() === DEFAULT_CONFIG.subDomain.toLowerCase());
            if (defaultSub) {
                console.log(`✅ Auto-Selecting Subdomain: ${defaultSub.value}`);
                setSelectedSubDomain(defaultSub.value);
            }
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
                zoneId: selectedZone,
                timeRange: timeRange,
                subdomain: selectedSubDomain
            });

            let filteredData = [];
            let totalReq = 0;
            // let weightedAvgTime = 0; // Disabled as backend removed 'sum'

            if (result && result.data) {
                filteredData = result.data;
                console.log('✅ Received Filtered Groups:', filteredData.length);

                filteredData.forEach(item => {
                    totalReq += item.count;
                });
            }

            setRawData(filteredData);
            setTotalRequests(totalReq);
            setAvgResponseTime(0); // Set to 0 for now as requested to revert

            // Map charts data
            const urlCounts = {}; const ipCounts = {}; const countryCounts = {}; const uaCounts = {};
            const timeBuckets = Array(24).fill(0);

            filteredData.forEach(item => {
                const count = item.count;
                const dims = item.dimensions;

                const path = dims.clientRequestPath || 'Unknown';
                const ip = dims.clientIP || 'Unknown';
                const country = dims.clientCountryName || 'Unknown';
                const ua = dims.userAgent || 'Unknown';

                urlCounts[path] = (urlCounts[path] || 0) + count;
                ipCounts[ip] = (ipCounts[ip] || 0) + count;
                countryCounts[country] = (countryCounts[country] || 0) + count;
                uaCounts[ua] = (uaCounts[ua] || 0) + count;

                if (dims.datetimeHour) {
                    const h = new Date(dims.datetimeHour).getHours();
                    timeBuckets[h] += count;
                }
            });

            const toArray = (obj, keyName) => Object.entries(obj).map(([name, count]) => ({ [keyName]: name, count })).sort((a, b) => b.count - a.count).slice(0, 5);

            setTopUrls(toArray(urlCounts, 'path'));
            setTopIps(toArray(ipCounts, 'ip'));
            setTopCountries(toArray(countryCounts, 'name'));
            setTopUserAgents(toArray(uaCounts, 'agent'));

            setThroughputData(timeBuckets.map((count, i) => ({
                time: `${i}:00`, requests: count, blocked: Math.floor(count * 0.05)
            })));

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
            const imgData = await htmlToImage.toJpeg(element, { quality: 0.8, backgroundColor: '#000000' });
            const pdf = new jsPDF('l', 'mm', 'a4');
            pdf.addImage(imgData, 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
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

                {/* TIME RANGE SELECTOR */}
                <div className="flex justify-end mb-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-1 flex gap-1">
                        {[{ label: '30m', val: 30 }, { label: '6h', val: 360 }, { label: '12h', val: 720 }, { label: '24h', val: 1440 }].map(t => (
                            <button key={t.val} onClick={() => setTimeRange(t.val)} className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${timeRange === t.val ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>{t.label}</button>
                        ))}
                    </div>
                </div>

                {/* DASHBOARD CONTENT */}
                <div className={`space-y-4 transition-all duration-500 ${selectedSubDomain && !loadingStats ? 'opacity-100 filter-none' : 'opacity-40 grayscale blur-sm'}`}>

                    {/* STATS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card title="Total Requests">
                            <div className="flex items-baseline gap-2">
                                <span className="text-6xl font-bold text-blue-400">{totalRequests.toLocaleString()}</span>
                                <span className="text-xl text-gray-500 font-thai">Req</span>
                            </div>
                        </Card>
                        <Card title="Avg Response Time">
                            <div className="flex items-baseline gap-2">
                                <span className="text-6xl font-bold text-purple-400">{avgResponseTime}</span>
                                <span className="text-xl text-gray-500">ms</span>
                            </div>
                        </Card>
                        <Card title="Blocked Events (Mock)">
                            <div className="flex items-baseline gap-2">
                                <span className="text-6xl font-bold text-orange-400">{selectedSubDomain && totalRequests > 0 ? Math.floor(totalRequests * 0.05) : "0"}</span>
                                <span className="text-xl text-gray-500 font-thai">Events</span>
                            </div>
                        </Card>
                    </div>

                    {/* CHARTS ROW 1 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card title="Traffic Volume">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={throughputData}>
                                        <defs><linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
                                        <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }} itemStyle={{ color: '#60a5fa' }} />
                                        <Area type="monotone" dataKey="requests" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRequests)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                        <Card title="Top URLs"><HorizontalBarList data={topUrls} labelKey="path" valueKey="count" /></Card>
                        <Card title="Top User Agents"><HorizontalBarList data={topUserAgents} labelKey="agent" valueKey="count" color="bg-indigo-600" /></Card>
                    </div>

                    {/* CHARTS ROW 2 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card title="Top Client IPs"><HorizontalBarList data={topIps} labelKey="ip" valueKey="count" color="bg-cyan-600" /></Card>
                        <Card title="Top Countries"><HorizontalBarList data={topCountries} labelKey="name" valueKey="count" color="bg-blue-800" /></Card>
                        <Card title="Status (Mock)"><div className="h-full flex items-center justify-center text-gray-500 text-xs italic">No status code data in current dataset</div></Card>
                    </div>

                    {/* RAW DATA INSPECTOR */}
                    <div className="grid grid-cols-1 gap-4">
                        <Card title={`Raw API Data for ${selectedSubDomain} (Last ${timeRange < 60 ? timeRange + 'm' : timeRange / 60 + 'h'})`}>
                            <div className="overflow-x-auto max-h-96 overflow-y-auto font-mono text-xs text-gray-400 bg-gray-950 p-4 rounded border border-gray-800">
                                <div className="grid grid-cols-7 gap-2 border-b border-gray-800 pb-2 mb-2 font-bold text-gray-300 min-w-[800px]">
                                    <div className="col-span-2">Host</div><div className="col-span-1">IP</div><div className="col-span-1">Country</div>
                                    <div className="col-span-1">OS</div><div className="col-span-1">Device</div><div className="col-span-1 text-right">Count</div>
                                </div>
                                {rawData.length === 0 ? (<div className="text-gray-600 italic p-4 text-center">No data loaded.</div>) : (
                                    rawData.map((item, i) => (
                                        <div key={i} className="grid grid-cols-7 gap-2 hover:bg-gray-900 transition-colors py-1 border-b border-gray-900/50 min-w-[800px] items-center">
                                            <div className="col-span-2 text-green-400 truncate pr-2" title={item.dimensions?.clientRequestHTTPHost}>{item.dimensions?.clientRequestHTTPHost}</div>
                                            <div className="col-span-1 text-blue-400 truncate">{item.dimensions?.clientIP}</div>
                                            <div className="col-span-1 text-gray-500 truncate">{item.dimensions?.clientCountryName}</div>
                                            <div className="col-span-1 text-orange-400 truncate">{item.dimensions?.userAgentOS || '-'}</div>
                                            <div className="col-span-1 text-purple-400 truncate">{item.dimensions?.clientDeviceType || '-'}</div>
                                            <div className="col-span-1 text-white font-bold text-right">{item.count}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="mt-2 flex justify-end gap-4 items-center">
                                <button onClick={async () => {
                                    if (!selectedSubDomain) return; const res = await callAPI('debug-check-datasets', { zoneId: selectedZone, subdomain: selectedSubDomain, timeRange });
                                    if (res && res.data) { console.log('Deep Debug:', res.data); alert(`Debug Result for ${selectedSubDomain} (Last ${timeRange} mins):\n` + `Adaptive: ${res.data.counts.adaptive_requests}\n` + `Hourly: ${res.data.counts.hourly_requests}\n` + `Firewall: ${res.data.counts.firewall_events}`); }
                                }}
                                    className="text-[10px] text-orange-500 hover:text-orange-400 underline">Deep Debug Counts (Adaptive vs Hourly)</button>
                                <button onClick={() => console.log(rawData)} className="text-[10px] text-blue-500 hover:text-blue-400 underline">Log Full Object</button>
                            </div>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
