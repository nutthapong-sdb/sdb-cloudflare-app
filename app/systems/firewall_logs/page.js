'use client';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

import {
    Search, Shield, AlertTriangle, ChevronDown, ChevronRight,
    Globe, Server, User, Activity, Clock, Database, Hash
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
    const [ruleIdInput, setRuleIdInput] = useState('');

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
                apiToken: token
            });
            if (response.data.success) {
                setAccounts(response.data.data);
                // Auto-select first account if available
                if (response.data.data.length > 0) {
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
            apiToken: token
        });
        if (response.data.success) {
            setZones(response.data.data);
            if (response.data.data.length > 0) {
                setSelectedZone(response.data.data[0].id);
            }
        } else {
            setZones([]);
            setSelectedZone('');
        }
    };

    const handleAccountChange = (e) => {
        const accId = e.target.value;
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

    // --- 4. RENDER ---
    return (
        <div className={`flex min-h-screen ${THEME.bg} ${THEME.text} font-sans`}>
            {/* Main Content */}
            <div className="flex-1 p-8 overflow-y-auto w-full">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-8">
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

                    {/* Controls Card */}
                    <div className={`${THEME.cardBg} border ${THEME.border} rounded-xl p-6 shadow-xl`}>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">

                            {/* Account Select */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</label>
                                <div className="relative">
                                    <select
                                        value={selectedAccount}
                                        onChange={handleAccountChange}
                                        className={`w-full ${THEME.inputBg} border ${THEME.border} rounded-lg px-4 py-2.5 text-sm appearance-none focus:ring-2 focus:ring-blue-500/50 outline-none transition-all`}
                                        disabled={loading}
                                    >
                                        <option value="" disabled>Select Account</option>
                                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-500 pointer-events-none" />
                                </div>
                            </div>

                            {/* Zone Select */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Zone</label>
                                <div className="relative">
                                    <select
                                        value={selectedZone}
                                        onChange={(e) => setSelectedZone(e.target.value)}
                                        className={`w-full ${THEME.inputBg} border ${THEME.border} rounded-lg px-4 py-2.5 text-sm appearance-none focus:ring-2 focus:ring-blue-500/50 outline-none transition-all`}
                                        disabled={!selectedAccount || loading}
                                    >
                                        <option value="" disabled>Select Zone</option>
                                        {zones.map(zone => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-500 pointer-events-none" />
                                </div>
                            </div>

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
                                                                            <span className="text-gray-200">{log.source}</span>

                                                                            <span className="text-gray-500">Action taken</span>
                                                                            <span className="text-gray-200">{log.action}</span>

                                                                            <span className="text-gray-500">Rule ID</span>
                                                                            <span className="font-mono text-yellow-400 text-xs">{log.ruleId}</span>
                                                                        </div>

                                                                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest border-b border-gray-800 pb-2 pt-4">Request Analyses</h3>
                                                                        <div className="grid grid-cols-2 gap-y-3 text-sm">
                                                                            <span className="text-gray-500">WAF Attack Score</span>
                                                                            <span className="text-red-400 font-bold">{log.wafAttackScore || '-'}</span>

                                                                            <span className="text-gray-500">WAF SQLi Score</span>
                                                                            <span className="text-orange-400">{log.wafSqlInjectionAttackScore || '-'}</span>

                                                                            <span className="text-gray-500">WAF XSS Score</span>
                                                                            <span className="text-orange-400">{log.wafXssAttackScore || '-'}</span>

                                                                            <span className="text-gray-500">Bot Score</span>
                                                                            <span className="text-blue-400 font-bold">{log.botScore || '-'}</span>

                                                                            <span className="text-gray-500">Bot Source</span>
                                                                            <span className="text-gray-300">{log.botScoreSrcName || '-'}</span>
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
                                                                    <span>JA3: {log.ja3Hash || 'N/A'}</span>
                                                                    <span>JA4: {log.ja4 || 'N/A'}</span>
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
