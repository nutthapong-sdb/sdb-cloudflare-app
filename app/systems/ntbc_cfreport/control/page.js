'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
    CheckCircle, Play, ArrowLeft, RefreshCw, Terminal, 
    Layers, Settings, ShieldAlert, Cpu, Activity, Clock, Check
} from 'lucide-react';
import Swal from 'sweetalert2';
import { auth } from '@/app/utils/auth';
import { getUserProfileAction } from '@/app/actions/authActions';
import SearchableDropdown from '../SearchableDropdown';

export default function ControlPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [stepStatus, setStepStatus] = useState(Array(10).fill('pending')); // 'pending' | 'running' | 'completed'
    const [activeStep, setActiveStep] = useState(0);
    const [logs, setLogs] = useState([]);
 
     // Dropdown Data States
     const [currentUser, setCurrentUser] = useState(null);
     const [accounts, setAccounts] = useState([]);
     const [zones, setZones] = useState([]);
     const [subdomains, setSubdomains] = useState([]);
 
     // Environment Selection States
     const [envAccount, setEnvAccount] = useState('ae240d50da44461d1fc5e34f708ebec8');
     const [envZone, setEnvZone] = useState('');
     const [envSubdomain, setEnvSubdomain] = useState('');
     const [envStartDate, setEnvStartDate] = useState('2026-05-30');
     const [envEndDate, setEnvEndDate] = useState('2026-06-04');
     const [capturedScreenshot, setCapturedScreenshot] = useState(null);
     const [captureDomains, setCaptureDomains] = useState(false);

    const [isLoadingSettings, setIsLoadingSettings] = useState(false);

    const addLog = useCallback((text, type = 'info') => {
        setLogs(prev => [
            ...prev,
            { time: new Date().toLocaleTimeString(), text, type }
        ]);
    }, []);

    // Call API Helper matching page.js
    const callAPI = async (action, params = {}, tokenOverride = null) => {
        try {
            const apiToken = tokenOverride || currentUser?.cloudflare_api_token || auth.getCurrentUser()?.cloudflare_api_token;
            if (!apiToken) {
                console.warn('No API Token available');
                return null;
            }
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    ...params,
                    apiToken
                }),
            });
            const result = await response.json();
            if (!result.success) {
                console.warn(`API Error [${action}]:`, result.message);
                return null;
            }
            return result;
        } catch (err) {
            console.error('API call exception:', err);
            return null;
        }
    };

    // Load Accounts
    const loadAccounts = async (token) => {
        setIsLoadingSettings(true);
        addLog('Loading Cloudflare accounts...', 'info');
        try {
            const res = await callAPI('get-account-info', {}, token);
            if (res && res.data) {
                setAccounts(res.data);
                addLog(`Loaded ${res.data.length} accounts.`, 'success');
                
                // Override/force account ID for debug period
                setEnvAccount('ae240d50da44461d1fc5e34f708ebec8');
                const matchedAcc = res.data.find(a => a.id === 'ae240d50da44461d1fc5e34f708ebec8');
                const accName = matchedAcc ? matchedAcc.name : 'ae240d50da44461d1fc5e34f708ebec8';
                addLog(`Forced debug account: ${accName}`, 'info');
            }
        } finally {
            setIsLoadingSettings(false);
        }
    };

    // Load Zones
    const loadZonesForAccount = async (accountId) => {
        if (!accountId) return;
        setIsLoadingSettings(true);
        addLog(`Loading zones for account ${accountId}...`, 'info');
        try {
            const res = await callAPI('list-zones', { accountId });
            if (res && res.data) {
                setZones(res.data);
                addLog(`Loaded ${res.data.length} zones.`, 'success');

                // Prioritize saved localStorage default zone first
                const savedZone = localStorage.getItem('control_envZone');
                if (savedZone && res.data.some(z => z.id === savedZone)) {
                    setEnvZone(savedZone);
                    const zoneName = res.data.find(z => z.id === savedZone)?.name || savedZone;
                    addLog(`Loaded saved zone from defaults: ${zoneName}`, 'info');
                    return;
                }

                const matchedZone = res.data.find(z => z.name.toLowerCase().trim() === 'sesalpglpn.go.th');
                if (matchedZone) {
                    setEnvZone(matchedZone.id);
                    addLog(`Auto-selected zone: ${matchedZone.name}`, 'info');
                } else if (res.data.length > 0) {
                    setEnvZone(res.data[0].id);
                }
            }
        } finally {
            setIsLoadingSettings(false);
        }
    };

    // Load Subdomains (DNS Records)
    const loadSubdomainsForZone = async (zoneId) => {
        if (!zoneId) return;
        setIsLoadingSettings(true);
        addLog(`Loading DNS records for zone ${zoneId}...`, 'info');
        try {
            const res = await callAPI('get-dns-records', { zoneId });
            if (res && res.data) {
                // Filter unique proxied subdomains
                const uniqueSubs = Array.from(new Set(res.data.map(item => item.name)))
                    .map(name => {
                        const match = res.data.find(item => item.name === name);
                        return { name, proxied: match.proxied, type: match.type };
                    })
                    .filter(item => item.proxied);

                setSubdomains(uniqueSubs);
                addLog(`Loaded ${uniqueSubs.length} proxied subdomains.`, 'success');

                // Prioritize saved localStorage default subdomain first
                const savedSub = localStorage.getItem('control_envSubdomain');
                if (savedSub && uniqueSubs.some(s => s.name === savedSub)) {
                    setEnvSubdomain(savedSub);
                    addLog(`Loaded saved subdomain from defaults: ${savedSub}`, 'info');
                    return;
                }

                const matchedSub = uniqueSubs.find(s => s.name.toLowerCase().trim() === 'www.sesalpglnp.go.th');
                if (matchedSub) {
                    setEnvSubdomain(matchedSub.name);
                    addLog(`Auto-selected subdomain: ${matchedSub.name}`, 'info');
                } else if (uniqueSubs.length > 0) {
                    setEnvSubdomain(uniqueSubs[0].name);
                }
            }
        } finally {
            setIsLoadingSettings(false);
        }
    };

    // Load User and settings on Mount
    useEffect(() => {
        const init = async () => {
            const user = auth.requireAuth(router);
            if (user) {
                setCurrentUser(user);

                // Fetch fresh profile
                const res = await getUserProfileAction(user.id);
                const activeToken = res.success ? res.user.cloudflare_api_token : user.cloudflare_api_token;
                
                if (res.success) {
                    setCurrentUser(res.user);
                }

                if (activeToken) {
                    await loadAccounts(activeToken);
                }
            }
        };

        // Load stored screenshot and reset step status
        if (typeof window !== 'undefined') {
            const savedScreenshot = localStorage.getItem('control_capturedScreenshot');
            if (savedScreenshot) {
                setCapturedScreenshot(savedScreenshot);
            }
            const savedCaptureDomains = localStorage.getItem('control_captureDomains');
            if (savedCaptureDomains === 'true') {
                setCaptureDomains(true);
            }
            // Clear stepStatus from localStorage on refresh
            localStorage.removeItem('control_stepStatus');
        }

        // Initialize logs with first entry containing client-side timestamp
        setLogs([{ time: new Date().toLocaleTimeString(), text: 'System initialized and ready.', type: 'info' }]);
        setMounted(true);
        init();
    }, [router]);

    // Trigger zone loading when account changes
    useEffect(() => {
        if (envAccount) {
            loadZonesForAccount(envAccount);
        }
    }, [envAccount]);

    // Trigger subdomain loading when zone changes
    useEffect(() => {
        if (envZone) {
            loadSubdomainsForZone(envZone);
        }
    }, [envZone]);

    const saveAsDefault = () => {
        localStorage.setItem('control_envAccount', envAccount);
        localStorage.setItem('control_envZone', envZone);
        localStorage.setItem('control_envSubdomain', envSubdomain);
        localStorage.setItem('control_envStartDate', envStartDate);
        localStorage.setItem('control_envEndDate', envEndDate);

        addLog('Environment settings saved as new defaults.', 'success');
        
        Swal.fire({
            title: 'Settings Saved',
            text: 'These values have been locked in as your new session defaults.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false,
            background: '#111827',
            color: '#fff'
        });
    };

    const steps = [
        { name: "Step 1: Go to Login Page", desc: "Launches the Cloudflare login dashboard (dash.cloudflare.com) on port 9222." },
        { name: "Step 2: Login Success, Capturing", desc: "Redirects active tab directly to the selected Cloudflare Account Home Overview." },
        { name: "Step 3: Fetch DNS Records", desc: "Retrieves active DNS A, AAAA, CNAME, and MX records." },
        { name: "Step 4: Load Security Settings", desc: "Queries WAF security level, SSL configuration, and custom rules." },
        { name: "Step 5: Load WAF Event Logs", desc: "Downloads recent firewall block/challenge event logs." },
        { name: "Step 6: Render Dashboard Charts", desc: "Compiles traffic metrics and renders SVG overview graphs." },
        { name: "Step 7: Replace Template Placeholders", desc: "Injects live host analytics into target report template structures." },
        { name: "Step 8: Generate PDF Draft", desc: "Compiles page layout into a print-ready PDF document format." },
        { name: "Step 9: Compile Word Document", desc: "Formats final output as an editable Word Document (.doc)." },
        { name: "Step 10: Finalize and Email Report", desc: "Stores report data locally and sends completion alerts." }
    ];

    const isConfigComplete = true;

    const updateStepStatusAtIndex = (index, status) => {
        setStepStatus(prev => {
            const updated = [...prev];
            updated[index] = status;
            if (typeof window !== 'undefined') {
                localStorage.setItem('control_stepStatus', JSON.stringify(updated));
            }
            return updated;
        });
    };

    const runStep = async (index) => {
        if (!isConfigComplete) {
            Swal.fire({
                title: 'Configuration Incomplete',
                text: 'Please select Account, Zone, Subdomain, and Date Range before running any execution steps.',
                icon: 'warning',
                background: '#111827',
                color: '#fff'
            });
            return;
        }

        const markCompleted = (screenshot = null) => {
            updateStepStatusAtIndex(index, 'completed');
            addLog(`${steps[index].name} completed successfully.`, 'success');

            let htmlContent = `<div class="text-center font-bold text-lg text-white">Already done[ step ${index + 1} ]</div>`;
            if (index === 1 && screenshot) {
                htmlContent += `
                    <div class="mt-4 border border-gray-800 rounded bg-black p-2 flex items-center justify-center overflow-hidden">
                        <img src="${screenshot}" class="max-w-full rounded h-auto max-h-[300px] object-contain border border-gray-700" alt="Captured Domains List" />
                    </div>
                `;
            }

            Swal.fire({
                title: 'Notification',
                html: htmlContent,
                icon: 'success',
                position: 'center',
                timer: index === 1 && screenshot ? undefined : 2000,
                showConfirmButton: index === 1 && screenshot,
                confirmButtonText: 'Great!',
                confirmButtonColor: '#e11d48',
                background: '#111827',
                color: '#fff',
                customClass: {
                    popup: 'rounded-2xl border border-rose-500/30 shadow-2xl w-[500px]'
                }
            });
        };

        updateStepStatusAtIndex(index, 'running');
        setActiveStep(index);
        addLog(`Executing ${steps[index].name}...`, 'warn');

        // Step 1: Open Chrome
        if (index === 0) {
            try {
                addLog('Requesting Remote Debugging Chrome Launch...', 'info');
                await fetch('/api/ntbc-launch-chrome');
                addLog('Chrome launched successfully on port 9222 pointed to Cloudflare Dashboard.', 'success');
                markCompleted();
            } catch (err) {
                console.error('Launch Chrome failed:', err);
                addLog(`Chrome launch failed: ${err.message}`, 'error');
                updateStepStatusAtIndex(index, 'pending');
            }
            return;
        }

        // Step 2: Redirect active tab to target Account ID & Capture screenshot
        if (index === 1) {
            try {
                addLog('Connecting to debug browser on port 9222...', 'info');
                addLog(`Redirecting active tab to account overview for ID: ${envAccount || 'Default'}`, 'info');
                const res = await fetch(`/api/ntbc-control-chrome?accountId=${envAccount}`);
                const data = await res.json();
                if (data.success) {
                    addLog(`Redirect successful to: ${data.redirectedUrl}`, 'success');
                    
                    // Wait 500ms for browser transition to stabilize, then trigger capture
                    addLog('Waiting for page rendering to stabilize...', 'info');
                    await new Promise(r => setTimeout(r, 500));

                    // Trigger Screenshot capture immediately after redirection success
                    addLog('Triggering cropped screenshot capture ("Domains" heading to pagination)...', 'info');
                    const captureRes = await fetch('/api/ntbc-capture');
                    const captureData = await captureRes.json();
                    let img = null;
                    if (captureData.success && captureData.image) {
                        img = captureData.image;
                        setCapturedScreenshot(captureData.image);
                        if (typeof window !== 'undefined') {
                            localStorage.setItem('control_capturedScreenshot', captureData.image);
                        }
                        addLog('Screenshot captured and loaded onto control panel successfully.', 'success');
                    } else {
                        addLog(`Screenshot capture failed: ${captureData.error || 'Failed to capture screenshot'}`, 'warn');
                    }
                    
                    addLog('Session capturing completed successfully.', 'success');
                    markCompleted(img);
                } else {
                    addLog(`Error: ${data.error}`, 'error');
                    updateStepStatusAtIndex(index, 'pending');
                }
            } catch (err) {
                console.error('Control Chrome failed:', err);
                addLog(`Control Chrome failed: ${err.message}`, 'error');
                updateStepStatusAtIndex(index, 'pending');
            }
            return;
        }

        // Mock steps (3-10)
        setTimeout(() => {
            markCompleted();
        }, 800);
    };

    const resetAll = () => {
        setStepStatus(Array(10).fill('pending'));
        setCapturedScreenshot(null);
        setCaptureDomains(false);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('control_stepStatus');
            localStorage.removeItem('control_capturedScreenshot');
            localStorage.removeItem('control_captureDomains');
        }
        setActiveStep(0);
        setLogs([{ time: new Date().toLocaleTimeString(), text: 'Control panel reset to initial state.', type: 'info' }]);
        
        Swal.fire({
            title: 'Reset Completed',
            text: 'All steps have been reset to pending state.',
            icon: 'info',
            timer: 1500,
            showConfirmButton: false,
            background: '#111827',
            color: '#fff'
        });
    };

    return (
        <div className="min-h-screen bg-[#030712] text-gray-100 font-sans p-6 md:p-10 flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-6 mb-8">
                <div>
                    <div className="flex items-center gap-3">
                        <span className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
                            <Settings className="w-6 h-6 animate-spin" style={{ animationDuration: '8s' }} />
                        </span>
                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
                            System Control Center
                        </h1>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">
                        Full-page interactive debugger & mockup generation workflow controller.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={resetAll}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-all border border-gray-700/50"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reset All Steps
                    </button>
                    <button
                        onClick={() => router.push('/systems/ntbc_cfreport')}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-lg hover:shadow-rose-900/30"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to Generator
                    </button>
                </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
                {/* Steps and Environment Section (Left) */}
                <div className="lg:col-span-8 space-y-6 flex flex-col">
                    {/* Live status info / Active Environment */}
                    <div className="bg-gradient-to-br from-rose-950/20 to-gray-900/40 border border-gray-800/80 rounded-2xl p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4 border-b border-gray-800/40 pb-3">
                            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                <Activity className="w-4 h-4 text-rose-500" />
                                Active Environment Settings
                                {isLoadingSettings && (
                                    <span className="flex items-center gap-1.5 text-xs text-rose-400 font-normal lowercase normal-case ml-3 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                        <RefreshCw className="w-3 h-3 animate-spin text-rose-500" />
                                        Loading...
                                    </span>
                                )}
                            </h3>
                            <button
                                onClick={saveAsDefault}
                                disabled
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/40 border border-gray-800/80 rounded-lg text-[10px] font-bold text-gray-500 cursor-not-allowed transition-colors shadow-md pointer-events-none"
                            >
                                <Check className="w-3.5 h-3.5 text-gray-500" />
                                Set as Default (Disabled)
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pointer-events-none opacity-50 select-none">
                            {/* Account Dropdown */}
                            <div className="flex flex-col gap-1 py-1 justify-end">
                                <SearchableDropdown 
                                    label="Account"
                                    placeholder="Select Account"
                                    options={accounts.map(acc => ({ value: acc.id, label: acc.name, subtitle: acc.id }))}
                                    value={envAccount}
                                    onChange={(val) => {
                                        setEnvAccount(val);
                                        const selectedName = accounts.find(a => a.id === val)?.name || val;
                                        addLog(`Account selected: ${selectedName}`, 'info');
                                    }}
                                />
                            </div>

                            {/* Zone Dropdown */}
                            <div className="flex flex-col gap-1 py-1 justify-end">
                                <SearchableDropdown 
                                    label="Zone"
                                    placeholder="Select Zone"
                                    options={zones.map(z => ({ value: z.id, label: z.name, subtitle: z.id }))}
                                    value={envZone}
                                    onChange={(val) => {
                                        setEnvZone(val);
                                        const selectedName = zones.find(z => z.id === val)?.name || val;
                                        addLog(`Zone selected: ${selectedName}`, 'info');
                                    }}
                                />
                            </div>

                            {/* Subdomain Dropdown */}
                            <div className="flex flex-col gap-1 py-1 justify-end">
                                <SearchableDropdown 
                                    label="Subdomain"
                                    placeholder="Select Subdomain"
                                    options={subdomains.map(sub => ({ value: sub.name, label: sub.name, subtitle: sub.type }))}
                                    value={envSubdomain}
                                    onChange={(val) => {
                                        setEnvSubdomain(val);
                                        addLog(`Subdomain selected: ${val}`, 'info');
                                    }}
                                />
                            </div>

                            {/* Time range date pickers */}
                            <div className="grid grid-cols-2 gap-2 py-1">
                                <div className="flex flex-col gap-1">
                                    <span className="text-gray-500 font-medium">Start Date:</span>
                                    <input 
                                        type="date" 
                                        value={envStartDate} 
                                        onChange={(e) => {
                                            setEnvStartDate(e.target.value);
                                            addLog(`Start date updated to: ${e.target.value}`, 'info');
                                        }} 
                                        className="bg-gray-950/80 border border-gray-800 rounded px-2.5 py-1.5 text-gray-300 focus:outline-none focus:border-rose-500/50 transition-colors w-full scheme-dark"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-gray-500 font-medium">End Date:</span>
                                    <input 
                                        type="date" 
                                        value={envEndDate} 
                                        onChange={(e) => {
                                            setEnvEndDate(e.target.value);
                                            addLog(`End date updated to: ${e.target.value}`, 'info');
                                        }} 
                                        className="bg-gray-950/80 border border-gray-800 rounded px-2.5 py-1.5 text-gray-300 focus:outline-none focus:border-rose-500/50 transition-colors w-full scheme-dark"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Execution Stages Card */}
                    <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-6 shadow-xl flex-1">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Layers className="w-5 h-5 text-rose-500" />
                                Execution Stages (10 Mockup Steps)
                            </h2>
                            <span className="text-xs text-gray-500">
                                Click any step to execute/verify it
                            </span>
                        </div>

                        <div className="flex flex-col gap-3">
                            {steps.map((step, idx) => {
                                const status = stepStatus[idx];
                                const isCurrent = activeStep === idx;

                                let borderClass = "border-gray-800 hover:border-rose-500/50 bg-gray-950/40";
                                let textClass = "text-gray-300";
                                let statusIcon = <Play className="w-4 h-4 text-gray-500" />;

                                if (status === 'completed') {
                                    borderClass = "border-emerald-500/40 bg-emerald-950/10 hover:border-emerald-500/80";
                                    textClass = "text-emerald-300";
                                    statusIcon = <CheckCircle className="w-4 h-4 text-emerald-400" />;
                                } else if (status === 'running') {
                                    borderClass = "border-rose-500 bg-rose-950/20";
                                    textClass = "text-rose-300 font-bold";
                                    statusIcon = <RefreshCw className="w-4 h-4 text-rose-400 animate-spin" />;
                                }

                                const isButtonDisabled = !mounted || !isConfigComplete || (idx === 1 && !captureDomains);

                                return (
                                    <div
                                        key={idx}
                                        className={`flex flex-col p-4 rounded-xl border ${borderClass} transition-all duration-200 relative overflow-hidden gap-4 ${!isConfigComplete ? 'opacity-45 select-none' : ''}`}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                                            <button
                                                disabled={isButtonDisabled}
                                                onClick={() => runStep(idx)}
                                                className={`flex items-center gap-3 shrink-0 min-w-[240px] text-left hover:text-white transition-colors group ${isButtonDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                            >
                                                <span className="p-1 rounded bg-gray-900/80 border border-gray-800 group-hover:border-rose-500/30">
                                                    {statusIcon}
                                                </span>
                                                <span className={`text-sm font-semibold ${textClass}`}>
                                                    {step.name}
                                                </span>
                                            </button>
                                            <p className="text-xs text-gray-500 flex-1 leading-relaxed sm:pl-4 border-l border-gray-800/80">
                                                {step.desc}
                                            </p>
                                        </div>
                                        
                                        {idx === 1 && (
                                            <div className="mt-2 pl-8 flex flex-col gap-2 border-t border-gray-800/50 pt-3" onClick={(e) => e.stopPropagation()}>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Required Capture Checklist:</span>
                                                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-rose-400 transition-colors">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={captureDomains} 
                                                        onChange={(e) => {
                                                            setCaptureDomains(e.target.checked);
                                                            if (typeof window !== 'undefined') {
                                                                localStorage.setItem('control_captureDomains', e.target.checked ? 'true' : 'false');
                                                            }
                                                        }}
                                                        className="accent-rose-500 rounded border-gray-800 bg-gray-950 focus:ring-rose-500"
                                                    />
                                                    Domains Option (Check to enable Step 2 Execution)
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Console Log Section (Right) */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    {/* Console / Log output */}
                    <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex-1 flex flex-col min-h-[350px] shadow-2xl relative">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-rose-500" />
                                <span className="text-xs font-bold text-gray-300 font-mono">Live Debug Console</span>
                            </div>
                            <div className="flex gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500/60"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60"></span>
                                <span className="w-2.5 h-2.5 rounded-full bg-green-500/60"></span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2.5 pr-1 max-h-[500px]">
                            {mounted && logs.map((log, index) => {
                                let color = 'text-gray-400';
                                if (log.type === 'success') color = 'text-emerald-400';
                                if (log.type === 'warn') color = 'text-yellow-400';
                                return (
                                    <div key={index} className="flex gap-2.5 items-start leading-relaxed">
                                        <span className="text-gray-600 shrink-0">[{log.time}]</span>
                                        <span className={color}>{log.text}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    {capturedScreenshot && (
                        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex flex-col shadow-2xl animate-scale-up">
                            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Captured Domains List
                            </h4>
                            <div className="rounded border border-gray-800/80 bg-black flex items-center justify-center p-1.5 overflow-hidden">
                                <img src={capturedScreenshot} className="max-w-full rounded h-auto max-h-[260px] object-contain" alt="Domains Overview" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
