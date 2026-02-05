'use client';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

import {
    Search, Shield, AlertTriangle, ChevronDown, ChevronRight,
    Globe, Server, User, Activity, Clock, Database, Hash, Download
} from 'lucide-react';
import { auth } from '../../utils/auth';

// --- THEME & CONFIG ---
const THEME = {
    bg: 'bg-[#0f1115]',
    secondaryBg: 'bg-[#181b21]',
    text: 'text-gray-200',
    subText: 'text-gray-400',
    border: 'border-gray-800',
    accent: 'text-blue-400',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
    inputBg: 'bg-[#0a0c10]',
    cardBg: 'bg-[#13161c]'
};

const SearchableDropdown = ({ options, value, onChange, placeholder, label, loading, icon }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                {icon} {label}
            </label>
            <div className="relative">
                <div
                    onClick={() => !loading && setIsOpen(!isOpen)}
                    className={`w-full px-4 py-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between bg-[#0a0c10] border border-gray-800 ${isOpen ? 'ring-2 ring-blue-500/50 border-blue-500' : 'hover:opacity-80'}`}
                >
                    {isOpen ? (
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            // OnBlur handled by click outside ref
                            placeholder="Search..."
                            className="w-full bg-transparent outline-none text-sm text-white placeholder-gray-500"
                            autoFocus
                        />
                    ) : (
                        <span className={`text-sm ${selectedOption ? 'text-white' : 'text-gray-500'}`}>
                            {selectedOption ? selectedOption.label : placeholder}
                        </span>
                    )}
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''} text-gray-500`} />
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
                                    className={`px-4 py-2 cursor-pointer transition-colors text-sm ${value === option.value ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}
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
};

export default function FirewallLogs() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);

    // Filter States
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [zones, setZones] = useState([]);
    const [selectedZone, setSelectedZone] = useState('');
    const [ruleIdInput, setRuleIdInput] = useState('18e96f1b9dc044daa9f5a3d302bda61d'); // Default Rule ID

    // Data States
    const [logs, setLogs] = useState([]);
    const [expandedRow, setExpandedRow] = useState(null);

    // --- 1. INITIALIZATION ---
    useEffect(() => {
        const user = auth.getCurrentUser();
        if (!user) {
            router.push('/login');
            return;
        }
        setCurrentUser(user);
        loadAccounts(user.cloudflare_api_token);
    }, []);

    const callAPI = async (action, payload = {}) => {
        try {
            const token = currentUser?.cloudflare_api_token;
            if (!token) return { success: false, message: 'No API Token found' };

            const response = await axios.post('/api/scrape', {
                action,
                apiToken: token,
                useFirewallToken: true,
                ...payload
            });
            return response.data;
        } catch (error) {
            console.error(`API Error (${action}):`, error);
            return { success: false, message: error.message };
        }
    };

    const loadAccounts = async (token) => {
        setLoading(true);
        try {
            // Need to pass token manually as currentUser might not be set yet inside useEffect
            const response = await axios.post('/api/scrape', {
                action: 'get-account-info',
                apiToken: token,
                useFirewallToken: true
            });
            if (response.data.success) {
                setAccounts(response.data.data);

                // Auto-select match 'Siam Cement Public Company Limited (SCG)' or fallback to first
                const targetAccount = response.data.data.find(a =>
                    a.name === 'Siam Cement Public Company Limited (SCG)' ||
                    a.name.includes('(SCG)')
                );
                if (targetAccount) {
                    setSelectedAccount(targetAccount.id);
                    loadZones(targetAccount.id, token);
                } else if (response.data.data.length > 0) {
                    const firstAcc = response.data.data[0];
                    setSelectedAccount(firstAcc.id);
                    loadZones(firstAcc.id, token);
                }
            }
        } catch (error) {
            console.error('Failed to load accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadZones = async (accountId, tokenOverride) => {
        const token = tokenOverride || currentUser?.cloudflare_api_token;
        const response = await axios.post('/api/scrape', {
            action: 'list-zones',
            accountId: accountId,
            apiToken: token,
            useFirewallToken: true
        });
        if (response.data.success) {
            setZones(response.data.data);

            // Auto-select 'scg.com' or fallback to first
            const targetZone = response.data.data.find(z => z.name === 'scg.com');
            if (targetZone) {
                setSelectedZone(targetZone.id);
            } else if (response.data.data.length > 0) {
                setSelectedZone(response.data.data[0].id);
            }
        } else {
            setZones([]);
            setSelectedZone('');
        }
    };

    const handleAccountChange = (accId) => {
        setSelectedAccount(accId);
        loadZones(accId);
    };

    // --- 2. SEARCH LOGS ---
    const handleSearch = async () => {
        if (!selectedZone) return;
        setSearching(true);
        setLogs([]);
        setExpandedRow(null);

        const result = await callAPI('get-firewall-logs', {
            zoneId: selectedZone,
            ruleId: ruleIdInput.trim() || undefined,
            timeRange: 1440 // 24 Hours
        });

        if (result.success) {
            setLogs(result.data);
        } else {
            alert('Failed to fetch logs: ' + (result.message || 'Unknown error'));
        }
        setSearching(false);
    };

    // --- 3. HELPER FUNCTIONS ---
    const formatDate = (isoString) => {
        return new Date(isoString).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
    };

    const downloadCSV = () => {
        if (!logs || logs.length === 0) return;

        // Define Headers
        const headers = [
            'datetime',
            'clientIP',
            'action',
            'ruleId',
            'source',
            'country',
            'userAgent',
            'rayId',
            'hostname',
            'path',
            'count'
        ];

        // Map Data
        const csvRows = logs.map(log => [
            `"${log.datetime}"`,
            `"${log.clientIP}"`,
            `"${log.action}"`,
            `"${log.ruleId}"`,
            `"${log.source}"`,
            `"${log.clientCountryName}"`,
            `"${log.userAgent ? log.userAgent.replace(/"/g, '""') : ''}"`, // Escape quotes
            `"${log.rayName}"`,
            `"${log.clientRequestHTTPHost}"`,
            `"${log.clientRequestPath}"`,
            "1" // count
        ]);

        // Combine Header and Data
        const csvContent = [
            headers.join(','),
            ...csvRows.map(row => row.join(','))
        ].join('\n');

        // Trigger Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `firewall_logs_${selectedZone}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- 4. RENDER ---
    return (
        <div className={`flex min-h-screen ${THEME.bg} ${THEME.text} font-sans`}>
            {/* Main Content */}
            <div className="flex-1 p-8 overflow-y-auto w-full">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                <Shield className="w-8 h-8 text-blue-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                                    Firewall Log Explorer
                                </h1>
                                <p className="text-sm text-gray-400">Deep dive into firewall events by Rule ID</p>
                            </div>
                        </div>
                        {logs.length > 0 && (
                            <button
                                onClick={downloadCSV}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-green-900/20"
                            >
                                <Download className="w-4 h-4" />
                                Download CSV
                            </button>
                        )}
                    </div>

                    {/* Controls Card */}
                    <div className={`${THEME.cardBg} border ${THEME.border} rounded-xl p-6 shadow-xl`}>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">

                            {/* Account Select (Live Search) */}
                            <SearchableDropdown
                                icon={<Server className="w-4 h-4 text-blue-400" />}
                                label="Account"
                                placeholder={loading ? "Loading..." : "Select Account"}
                                options={accounts.map(acc => ({ value: acc.id, label: acc.name, subtitle: `ID: ${acc.id}` }))}
                                value={selectedAccount}
                                onChange={handleAccountChange}
                                loading={loading}
                            />

                            {/* Zone Select (Live Search) */}
                            <SearchableDropdown
                                icon={<Globe className="w-4 h-4 text-green-400" />}
                                label="Zone"
                                placeholder={!selectedAccount ? "Select Account First" : "Select Zone"}
                                options={zones.map(zone => ({ value: zone.id, label: zone.name, subtitle: zone.status }))}
                                value={selectedZone}
                                onChange={setSelectedZone}
                                loading={loading}
                            />

                            {/* Rule ID Input */}
                            <div className="space-y-2 md:col-span-1">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Rule ID (Optional)</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="e.g. 75b7ab82..."
                                        value={ruleIdInput}
                                        onChange={(e) => setRuleIdInput(e.target.value)}
                                        className={`w-full ${THEME.inputBg} border ${THEME.border} rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-mono placeholder-gray-600`}
                                    />
                                    <Hash className="absolute right-3 top-3 w-4 h-4 text-gray-600" />
                                </div>
                            </div>

                            {/* Search Button */}
                            <button
                                onClick={handleSearch}
                                disabled={searching || !selectedZone}
                                className={`${THEME.button} px-6 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {searching ? (
                                    <span className="animate-pulse">Searching...</span>
                                ) : (
                                    <>
                                        <Search className="w-4 h-4" /> Fetch Logs
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Logs Table */}
                    <div className={`${THEME.cardBg} border ${THEME.border} rounded-xl overflow-hidden shadow-xl min-h-[400px]`}>
                        {logs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full py-20 text-gray-500 space-y-4">
                                {searching ? (
                                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Database className="w-12 h-12 opacity-20" />
                                        <p>No logs found. Select a zone and click Fetch.</p>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#0a0c10] border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wider">
                                            <th className="px-6 py-4 font-semibold w-10"></th>
                                            <th className="px-6 py-4 font-semibold">Date</th>
                                            <th className="px-6 py-4 font-semibold">Action Taken</th>
                                            <th className="px-6 py-4 font-semibold">Country</th>
                                            <th className="px-6 py-4 font-semibold">IP Address</th>
                                            <th className="px-6 py-4 font-semibold">Service</th>
                                            <th className="px-6 py-4 font-semibold">Method</th>
                                            <th className="px-6 py-4 font-semibold">Protocol</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800/50">
                                        {logs.map((log, index) => {
                                            const isExpanded = expandedRow === index;
                                            return (
                                                <React.Fragment key={index}>
                                                    <tr
                                                        onClick={() => setExpandedRow(isExpanded ? null : index)}
                                                        className={`cursor-pointer transition-colors hover:bg-white/5 ${isExpanded ? 'bg-blue-500/5' : ''}`}
                                                    >
                                                        <td className="px-6 py-4 text-center">
                                                            <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90 text-blue-400' : ''}`} />
                                                        </td>
                                                        <td className="px-6 py-4 text-sm whitespace-nowrap text-blue-300 font-mono">
                                                            {formatDate(log.datetime)}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm">
                                                            <span className={`px-2 py-1 rounded text-xs font-semibold 
                                                                ${log.action === 'block' ? 'bg-red-500/20 text-red-400' :
                                                                    log.action === 'challenge' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                        log.action === 'allow' ? 'bg-green-500/20 text-green-400' :
                                                                            'bg-gray-700/50 text-gray-400'}`}>
                                                                {log.action.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm flex items-center gap-2">
                                                            <Globe className="w-3 h-3 text-gray-500" /> {log.clientCountryName}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-mono text-gray-300">
                                                            {log.clientIP}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-400">
                                                            {log.source || 'Unknown'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-mono text-purple-400">
                                                            {log.clientRequestHTTPMethod}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                                                            {log.clientRequestHTTPProtocol}
                                                        </td>
                                                    </tr>

                                                    {/* EXPANDED ROW DETAIL */}
                                                    {isExpanded && (
                                                        <tr className="bg-[#0a0c10]/50">
                                                            <td colSpan="7" className="px-8 py-6 border-b border-gray-800 relative">
                                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>

                                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                                                                    {/* Left Column */}
                                                                    <div className="space-y-6">
                                                                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest border-b border-gray-800 pb-2">Matched Service</h3>
                                                                        <div className="grid grid-cols-2 gap-y-3 text-sm">
                                                                            <span className="text-gray-500">Service</span>
                                                                            <span className="text-white font-medium">{log.source}</span>

                                                                            <span className="text-gray-500">Activity</span>
                                                                            <span className="text-white">{log.action}</span>

                                                                            <span className="text-gray-500">Rule ID</span>
                                                                            <span className="font-mono text-yellow-400 text-xs">{log.ruleId}</span>
                                                                        </div>

                                                                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest border-b border-gray-800 pb-2 pt-4">Request Analyses</h3>
                                                                        <div className="grid grid-cols-[140px_1fr] gap-y-3 text-sm">
                                                                            <span className="text-gray-500">WAF Attack Score</span>
                                                                            <span className="text-orange-400 font-mono">{log.wafAttackScore ?? '-'}</span>

                                                                            <span className="text-gray-500">WAF SQLi Attack Score</span>
                                                                            <span className="text-orange-400 font-mono">{log.wafSqliAttackScore ?? '-'}</span>

                                                                            <span className="text-gray-500">WAF XSS Attack Score</span>
                                                                            <span className="text-orange-400 font-mono">{log.wafXssAttackScore ?? '-'}</span>

                                                                            <span className="text-gray-500">WAF RCE Attack Score</span>
                                                                            <span className="text-orange-400 font-mono">{log.wafRceAttackScore ?? '-'}</span>

                                                                            <span className="text-gray-500">Bot Score</span>
                                                                            <span className="text-blue-400 font-bold font-mono">{log.botScore ?? '-'}</span>

                                                                            <span className="text-gray-500">Bot Source</span>
                                                                            <span className="text-gray-300">{log.botScoreSrcName ?? '-'}</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Right Column (Request Details) */}
                                                                    <div className="space-y-6">
                                                                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest border-b border-gray-800 pb-2">Request Details</h3>
                                                                        <div className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
                                                                            <span className="text-gray-500">Ray ID</span>
                                                                            <span className="font-mono text-gray-300">{log.rayName}</span>

                                                                            <span className="text-gray-500">IP Address</span>
                                                                            <span className="font-mono text-gray-300">{log.clientIP}</span>

                                                                            <span className="text-gray-500">ASN</span>
                                                                            <span className="text-gray-300">{log.clientAsn} ({log.clientASNDescription})</span>

                                                                            <span className="text-gray-500">Country</span>
                                                                            <span className="text-gray-300">{log.clientCountryName}</span>

                                                                            <span className="text-gray-500">User Agent</span>
                                                                            <span className="text-gray-400 text-xs break-all">{log.userAgent}</span>

                                                                            <span className="text-gray-500">HTTP Version</span>
                                                                            <span className="text-gray-300">{log.clientRequestHTTPProtocol}</span>

                                                                            <div className="col-span-2 border-t border-gray-800 my-2"></div>

                                                                            <span className="text-gray-500">Host</span>
                                                                            <span className="text-blue-300">{log.clientRequestHTTPHost}</span>

                                                                            <span className="text-gray-500">Path</span>
                                                                            <span className="text-green-300 undo-tailwind-reset break-all">{log.clientRequestPath}</span>

                                                                            <span className="text-gray-500">Method</span>
                                                                            <span className="text-purple-400 font-bold">{log.clientRequestHTTPMethod}</span>

                                                                            <span className="text-gray-500">Query String</span>
                                                                            <span className="text-gray-400 font-mono text-xs break-all bg-black/20 p-2 rounded">{log.clientRequestQuery || '-'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Technical Details (JA3/JA4) - Optional Footer */}
                                                                <div className="mt-8 pt-4 border-t border-gray-800 flex flex-wrap gap-6 text-xs text-gray-500 font-mono">
                                                                    <span>JA3: {log.ja3Hash ?? '-'}</span>
                                                                    <span>JA4: {log.ja4 ?? '-'}</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
