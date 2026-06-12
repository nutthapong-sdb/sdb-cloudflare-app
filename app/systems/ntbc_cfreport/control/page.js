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
     const [capturedDnsScreenshot, setCapturedDnsScreenshot] = useState(null);
     const [capturedHttpTrafficScreenshot, setCapturedHttpTrafficScreenshot] = useState(null);
     const [capturedHttpTrafficScreenshot1, setCapturedHttpTrafficScreenshot1] = useState(null);
     const [capturedHttpTrafficScreenshot2, setCapturedHttpTrafficScreenshot2] = useState(null);
     const [capturedHttpTrafficScreenshot3, setCapturedHttpTrafficScreenshot3] = useState(null);
     const [capturedHttpTrafficScreenshot4, setCapturedHttpTrafficScreenshot4] = useState(null);
     const [capturedHttpTrafficScreenshot5, setCapturedHttpTrafficScreenshot5] = useState(null);
     const [capturedFirewallScreenshot, setCapturedFirewallScreenshot] = useState(null);
     const [capturedSecurityRulesScreenshot, setCapturedSecurityRulesScreenshot] = useState(null);
     const [capturedArgoScreenshot, setCapturedArgoScreenshot] = useState(null);
     const [capturedSpeedScreenshot, setCapturedSpeedScreenshot] = useState(null);
     const [capturedSpeedMobileScreenshot, setCapturedSpeedMobileScreenshot] = useState(null);
     const [captureDomains, setCaptureDomains] = useState(true);
     const [captureDnsRecord, setCaptureDnsRecord] = useState(true);
     const [captureHttpTraffic, setCaptureHttpTraffic] = useState(true);
     const [captureFirewall, setCaptureFirewall] = useState(true);
     const [captureSecurityRules, setCaptureSecurityRules] = useState(true);
     const [captureArgo, setCaptureArgo] = useState(true);
     const [captureSpeed, setCaptureSpeed] = useState(true);

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
            const savedDnsScreenshot = localStorage.getItem('control_capturedDnsScreenshot');
            if (savedDnsScreenshot) {
                setCapturedDnsScreenshot(savedDnsScreenshot);
            }
            const savedHttpTrafficScreenshot = localStorage.getItem('control_capturedHttpTrafficScreenshot');
            if (savedHttpTrafficScreenshot) {
                setCapturedHttpTrafficScreenshot(savedHttpTrafficScreenshot);
            }
            const savedHttpTrafficScreenshot1 = localStorage.getItem('control_capturedHttpTrafficScreenshot1');
            if (savedHttpTrafficScreenshot1) {
                setCapturedHttpTrafficScreenshot1(savedHttpTrafficScreenshot1);
            }
            const savedHttpTrafficScreenshot2 = localStorage.getItem('control_capturedHttpTrafficScreenshot2');
            if (savedHttpTrafficScreenshot2) {
                setCapturedHttpTrafficScreenshot2(savedHttpTrafficScreenshot2);
            }
            const savedHttpTrafficScreenshot3 = localStorage.getItem('control_capturedHttpTrafficScreenshot3');
            if (savedHttpTrafficScreenshot3) {
                setCapturedHttpTrafficScreenshot3(savedHttpTrafficScreenshot3);
            }
            const savedHttpTrafficScreenshot4 = localStorage.getItem('control_capturedHttpTrafficScreenshot4');
            if (savedHttpTrafficScreenshot4) {
                setCapturedHttpTrafficScreenshot4(savedHttpTrafficScreenshot4);
            }
            const savedHttpTrafficScreenshot5 = localStorage.getItem('control_capturedHttpTrafficScreenshot5');
            if (savedHttpTrafficScreenshot5) {
                setCapturedHttpTrafficScreenshot5(savedHttpTrafficScreenshot5);
            }
            const savedFirewallScreenshot = localStorage.getItem('control_capturedFirewallScreenshot');
            if (savedFirewallScreenshot) {
                setCapturedFirewallScreenshot(savedFirewallScreenshot);
            }
            const savedSecurityRulesScreenshot = localStorage.getItem('control_capturedSecurityRulesScreenshot');
            if (savedSecurityRulesScreenshot) {
                setCapturedSecurityRulesScreenshot(savedSecurityRulesScreenshot);
            }
            const savedArgoScreenshot = localStorage.getItem('control_capturedArgoScreenshot');
            if (savedArgoScreenshot) {
                setCapturedArgoScreenshot(savedArgoScreenshot);
            }
            const savedSpeedScreenshot = localStorage.getItem('control_capturedSpeedScreenshot');
            if (savedSpeedScreenshot) {
                setCapturedSpeedScreenshot(savedSpeedScreenshot);
            }
            const savedSpeedMobileScreenshot = localStorage.getItem('control_capturedSpeedMobileScreenshot');
            if (savedSpeedMobileScreenshot) {
                setCapturedSpeedMobileScreenshot(savedSpeedMobileScreenshot);
            }
            const savedCaptureDomains = localStorage.getItem('control_captureDomains');
            if (savedCaptureDomains !== null) {
                setCaptureDomains(savedCaptureDomains === 'true');
            }
            const savedCaptureDnsRecord = localStorage.getItem('control_captureDnsRecord');
            if (savedCaptureDnsRecord !== null) {
                setCaptureDnsRecord(savedCaptureDnsRecord === 'true');
            }
            const savedCaptureHttpTraffic = localStorage.getItem('control_captureHttpTraffic');
            if (savedCaptureHttpTraffic !== null) {
                setCaptureHttpTraffic(savedCaptureHttpTraffic === 'true');
            }
            const savedCaptureFirewall = localStorage.getItem('control_captureFirewall');
            if (savedCaptureFirewall !== null) {
                setCaptureFirewall(savedCaptureFirewall === 'true');
            }
            const savedCaptureSecurityRules = localStorage.getItem('control_captureSecurityRules');
            if (savedCaptureSecurityRules !== null) {
                setCaptureSecurityRules(savedCaptureSecurityRules === 'true');
            }
            const savedCaptureArgo = localStorage.getItem('control_captureArgo');
            if (savedCaptureArgo !== null) {
                setCaptureArgo(savedCaptureArgo === 'true');
            }
            const savedCaptureSpeed = localStorage.getItem('control_captureSpeed');
            if (savedCaptureSpeed !== null) {
                setCaptureSpeed(savedCaptureSpeed === 'true');
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

        const markCompleted = (screenshot = null, dnsScreenshot = null, trafficScreenshot = null, firewallScreenshot = null, securityRulesScreenshot = null, argoScreenshot = null, speedScreenshot = null) => {
            updateStepStatusAtIndex(index, 'completed');
            addLog(`${steps[index].name} completed successfully.`, 'success');

            let htmlContent = `<div class="text-center font-bold text-lg text-white">Already done[ step ${index + 1} ]</div>`;
            if (index === 1 && (screenshot || dnsScreenshot || trafficScreenshot || firewallScreenshot || securityRulesScreenshot || argoScreenshot || speedScreenshot)) {
                htmlContent += `<div class="mt-4 flex flex-col gap-4 max-h-[350px] overflow-y-auto">`;
                if (screenshot) {
                    htmlContent += `
                        <div class="border border-gray-800 rounded bg-black p-2 flex flex-col items-center justify-center overflow-hidden">
                            <span class="text-xs text-gray-400 mb-1">Domains Overview</span>
                            <img src="${screenshot}" class="max-w-full rounded h-auto max-h-[160px] object-contain border border-gray-700" alt="Captured Domains List" />
                        </div>
                    `;
                }
                if (dnsScreenshot) {
                    htmlContent += `
                        <div class="border border-gray-800 rounded bg-black p-2 flex flex-col items-center justify-center overflow-hidden">
                            <span class="text-xs text-gray-400 mb-1">DNS Records</span>
                            <img src="${dnsScreenshot}" class="max-w-full rounded h-auto max-h-[160px] object-contain border border-gray-700" alt="Captured DNS Records" />
                        </div>
                    `;
                }
                if (trafficScreenshot) {
                    htmlContent += `
                        <div class="border border-gray-800 rounded bg-black p-2 flex flex-col items-center justify-center overflow-hidden">
                            <span class="text-xs text-gray-400 mb-1">HTTP Traffic Overview</span>
                            <img src="${trafficScreenshot}" class="max-w-full rounded h-auto max-h-[160px] object-contain border border-gray-700" alt="Captured HTTP Traffic" />
                        </div>
                    `;
                    const ts1 = localStorage.getItem('control_capturedHttpTrafficScreenshot1');
                    if (ts1) {
                        htmlContent += `
                            <div class="border border-gray-800 rounded bg-black p-2 flex flex-col items-center justify-center overflow-hidden mt-2">
                                <span class="text-xs text-gray-400 mb-1">HTTP Traffic Sub 1 (900px)</span>
                                <img src="${ts1}" class="max-w-full rounded h-auto max-h-[160px] object-contain border border-gray-700" alt="Captured HTTP Traffic Sub 1" />
                            </div>
                        `;
                    }
                    const ts2 = localStorage.getItem('control_capturedHttpTrafficScreenshot2');
                    if (ts2) {
                        htmlContent += `
                            <div class="border border-gray-800 rounded bg-black p-2 flex flex-col items-center justify-center overflow-hidden mt-2">
                                <span class="text-xs text-gray-400 mb-1">HTTP Traffic Sub 2 (900px)</span>
                                <img src="${ts2}" class="max-w-full rounded h-auto max-h-[160px] object-contain border border-gray-700" alt="Captured HTTP Traffic Sub 2" />
                            </div>
                        `;
                    }
                    const ts3 = localStorage.getItem('control_capturedHttpTrafficScreenshot3');
                    if (ts3) {
                        htmlContent += `
                            <div class="border border-gray-800 rounded bg-black p-2 flex flex-col items-center justify-center overflow-hidden mt-2">
                                <span class="text-xs text-gray-400 mb-1">HTTP Traffic Sub 3 (900px)</span>
                                <img src="${ts3}" class="max-w-full rounded h-auto max-h-[160px] object-contain border border-gray-700" alt="Captured HTTP Traffic Sub 3" />
                            </div>
                        `;
                    }
                    const ts4 = localStorage.getItem('control_capturedHttpTrafficScreenshot4');
                    if (ts4) {
                        htmlContent += `
                            <div class="border border-gray-800 rounded bg-black p-2 flex flex-col items-center justify-center overflow-hidden mt-2">
                                <span class="text-xs text-gray-400 mb-1">HTTP Traffic Sub 4 (900px)</span>
                                <img src="${ts4}" class="max-w-full rounded h-auto max-h-[160px] object-contain border border-gray-700" alt="Captured HTTP Traffic Sub 4" />
                            </div>
                        `;
                    }
                    const ts5 = localStorage.getItem('control_capturedHttpTrafficScreenshot5');
                    if (ts5) {
                        htmlContent += `
                            <div class="border border-gray-800 rounded bg-black p-2 flex flex-col items-center justify-center overflow-hidden mt-2">
                                <span class="text-xs text-gray-400 mb-1">HTTP Traffic Sub 5 (900px)</span>
                                <img src="${ts5}" class="max-w-full rounded h-auto max-h-[160px] object-contain border border-gray-700" alt="Captured HTTP Traffic Sub 5" />
                            </div>
                        `;
                    }
                }
                if (firewallScreenshot) {
                    htmlContent += `
                        <div class="border border-gray-800 rounded bg-black p-2 flex flex-col items-center justify-center overflow-hidden mt-2">
                            <span class="text-xs text-gray-400 mb-1">Event Analytics (Firewall)</span>
                            <img src="${firewallScreenshot}" class="max-w-full rounded h-auto max-h-[160px] object-contain border border-gray-700" alt="Captured Firewall Analytics" />
                        </div>
                    `;
                }
                if (securityRulesScreenshot) {
                    htmlContent += `
                        <div class="border border-gray-800 rounded bg-black p-2 flex flex-col items-center justify-center overflow-hidden mt-2">
                            <span class="text-xs text-gray-400 mb-1">Security Rules</span>
                            <img src="${securityRulesScreenshot}" class="max-w-full rounded h-auto max-h-[160px] object-contain border border-gray-700" alt="Captured Security Rules" />
                        </div>
                    `;
                }
                if (argoScreenshot) {
                    htmlContent += `
                        <div class="border border-gray-800 rounded bg-black p-2 flex flex-col items-center justify-center overflow-hidden mt-2">
                            <span class="text-xs text-gray-400 mb-1">Argo Smart Routing</span>
                            <img src="${argoScreenshot}" class="max-w-full rounded h-auto max-h-[160px] object-contain border border-gray-700" alt="Captured Argo Smart Routing" />
                        </div>
                    `;
                }
                if (speedScreenshot) {
                    htmlContent += `
                        <div class="border border-gray-800 rounded bg-black p-2 flex flex-col items-center justify-center overflow-hidden mt-2">
                            <span class="text-xs text-gray-400 mb-1">Speed Test</span>
                            <img src="${speedScreenshot}" class="max-w-full rounded h-auto max-h-[160px] object-contain border border-gray-700" alt="Captured Speed Test" />
                        </div>
                    `;
                }
                const sms = localStorage.getItem('control_capturedSpeedMobileScreenshot');
                if (sms) {
                    htmlContent += `
                        <div class="border border-gray-800 rounded bg-black p-2 flex flex-col items-center justify-center overflow-hidden mt-2">
                            <span class="text-xs text-gray-400 mb-1">Speed Test (Mobile)</span>
                            <img src="${sms}" class="max-w-full rounded h-auto max-h-[160px] object-contain border border-gray-700" alt="Captured Speed Test (Mobile)" />
                        </div>
                    `;
                }
                htmlContent += `</div>`;
            }

            const hasAnyScreenshot = screenshot || dnsScreenshot || trafficScreenshot || firewallScreenshot || securityRulesScreenshot || argoScreenshot || speedScreenshot;

            Swal.fire({
                title: 'Notification',
                html: htmlContent,
                icon: 'success',
                position: 'center',
                timer: index === 1 && hasAnyScreenshot ? undefined : 2000,
                showConfirmButton: index === 1 && hasAnyScreenshot,
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

        // Step 2: Redirect active tab & Capture screenshot for selected options
        if (index === 1) {
            try {
                let domainsImg = null;
                let dnsImg = null;
                let trafficImg = null;
                let firewallImg = null;
                let securityRulesImg = null;
                let argoImg = null;
                let speedImg = null;
                let speedMobileImg = null;

                // 1. Domains overview capture
                if (captureDomains) {
                    addLog('Connecting to debug browser on port 9222 for domains list...', 'info');
                    addLog(`Redirecting active tab to account overview for ID: ${envAccount || 'Default'}`, 'info');
                    const res = await fetch(`/api/ntbc-control-chrome?accountId=${envAccount}`);
                    const data = await res.json();
                    if (data.success) {
                        addLog(`Redirect successful to: ${data.redirectedUrl}`, 'success');
                        addLog('Waiting for page rendering to stabilize...', 'info');
                        await new Promise(r => setTimeout(r, 500));

                        addLog('Triggering cropped screenshot capture ("Domains" heading to pagination)...', 'info');
                        const captureRes = await fetch('/api/ntbc-capture?type=domains');
                        const captureData = await captureRes.json();
                        if (captureData.success && captureData.image) {
                            domainsImg = captureData.image;
                            setCapturedScreenshot(captureData.image);
                            if (typeof window !== 'undefined') {
                                localStorage.setItem('control_capturedScreenshot', captureData.image);
                            }
                            addLog('Domains screenshot captured successfully.', 'success');
                        } else {
                            addLog(`Domains capture failed: ${captureData.error || 'Failed to capture screenshot'}`, 'warn');
                        }
                    } else {
                        addLog(`Domains redirect error: ${data.error}`, 'error');
                    }
                }

                // 2. DNS records capture
                if (captureDnsRecord) {
                    const debugDomain = 'log.softdebut.online';
                    const targetDnsUrl = `https://dash.cloudflare.com/${envAccount}/${debugDomain}/dns/records`;
                    addLog(`Connecting to debug browser on port 9222 for DNS records...`, 'info');
                    addLog(`Redirecting active tab to DNS Records page: ${targetDnsUrl}`, 'info');
                    const res = await fetch(`/api/ntbc-control-chrome?url=${encodeURIComponent(targetDnsUrl)}`);
                    const data = await res.json();
                    if (data.success) {
                        addLog(`Redirect successful to: ${data.redirectedUrl}`, 'success');
                        addLog('Waiting for page rendering to stabilize...', 'info');
                        await new Promise(r => setTimeout(r, 500));

                        addLog('Triggering cropped screenshot capture ("DNS" heading)...', 'info');
                        const captureRes = await fetch('/api/ntbc-capture?type=dns');
                        const captureData = await captureRes.json();
                        if (captureData.success && captureData.image) {
                            dnsImg = captureData.image;
                            setCapturedDnsScreenshot(captureData.image);
                            if (typeof window !== 'undefined') {
                                localStorage.setItem('control_capturedDnsScreenshot', captureData.image);
                                if (captureData.dnsPages) {
                                    localStorage.setItem('control_capturedDnsPages', JSON.stringify(captureData.dnsPages));
                                } else {
                                    localStorage.removeItem('control_capturedDnsPages');
                                }
                            }
                            addLog('DNS records screenshot captured successfully.', 'success');
                        } else {
                            addLog(`DNS records capture failed: ${captureData.error || 'Failed to capture screenshot'}`, 'warn');
                        }
                    } else {
                        addLog(`DNS redirect error: ${data.error}`, 'error');
                    }
                }

                // 3. HTTP Traffic overview capture
                if (captureHttpTraffic) {
                    const debugDomain = 'log.softdebut.online';
                    const targetTrafficUrl = `https://dash.cloudflare.com/${envAccount}/${debugDomain}/analytics/traffic`;
                    addLog(`Connecting to debug browser on port 9222 for HTTP Traffic...`, 'info');
                    addLog(`Redirecting active tab to Traffic Analytics page: ${targetTrafficUrl}`, 'info');
                    const res = await fetch(`/api/ntbc-control-chrome?url=${encodeURIComponent(targetTrafficUrl)}`);
                    const data = await res.json();
                    if (data.success) {
                        addLog(`Redirect successful to: ${data.redirectedUrl}`, 'success');
                        addLog('Waiting for page rendering to stabilize...', 'info');
                        await new Promise(r => setTimeout(r, 500));

                        addLog('Triggering cropped screenshot capture ("Traffic" heading)...', 'info');
                        const captureRes = await fetch('/api/ntbc-capture?type=traffic');
                        const captureData = await captureRes.json();
                        if (captureData.success && captureData.image) {
                            trafficImg = captureData.image;
                            setCapturedHttpTrafficScreenshot(captureData.image);
                            if (typeof window !== 'undefined') {
                                localStorage.setItem('control_capturedHttpTrafficScreenshot', captureData.image);
                            }
                            if (captureData.imageSub1) {
                                setCapturedHttpTrafficScreenshot1(captureData.imageSub1);
                                if (typeof window !== 'undefined') {
                                    localStorage.setItem('control_capturedHttpTrafficScreenshot1', captureData.imageSub1);
                                }
                            }
                            if (captureData.imageSub2) {
                                setCapturedHttpTrafficScreenshot2(captureData.imageSub2);
                                if (typeof window !== 'undefined') {
                                    localStorage.setItem('control_capturedHttpTrafficScreenshot2', captureData.imageSub2);
                                }
                            }
                            if (captureData.imageSub3) {
                                setCapturedHttpTrafficScreenshot3(captureData.imageSub3);
                                if (typeof window !== 'undefined') {
                                    localStorage.setItem('control_capturedHttpTrafficScreenshot3', captureData.imageSub3);
                                }
                            }
                            if (captureData.imageSub4) {
                                setCapturedHttpTrafficScreenshot4(captureData.imageSub4);
                                if (typeof window !== 'undefined') {
                                    localStorage.setItem('control_capturedHttpTrafficScreenshot4', captureData.imageSub4);
                                }
                            }
                            if (captureData.imageSub5) {
                                setCapturedHttpTrafficScreenshot5(captureData.imageSub5);
                                if (typeof window !== 'undefined') {
                                    localStorage.setItem('control_capturedHttpTrafficScreenshot5', captureData.imageSub5);
                                }
                            }
                            addLog('HTTP Traffic screenshots captured successfully.', 'success');
                        } else {
                            addLog(`HTTP Traffic capture failed: ${captureData.error || 'Failed to capture screenshot'}`, 'warn');
                        }
                    } else {
                        addLog(`HTTP Traffic redirect error: ${data.error}`, 'error');
                    }
                }

                // 4. Event Analytics (Firewall) capture
                if (captureFirewall) {
                    const debugDomain = 'log.softdebut.online';
                    const targetFirewallUrl = `https://dash.cloudflare.com/${envAccount}/${debugDomain}/security/analytics/events`;
                    addLog(`Connecting to debug browser on port 9222 for Firewall Events...`, 'info');
                    addLog(`Redirecting active tab to Firewall Analytics page: ${targetFirewallUrl}`, 'info');
                    const res = await fetch(`/api/ntbc-control-chrome?url=${encodeURIComponent(targetFirewallUrl)}`);
                    const data = await res.json();
                    if (data.success) {
                        addLog(`Redirect successful to: ${data.redirectedUrl}`, 'success');
                        addLog('Waiting for page rendering to stabilize...', 'info');
                        await new Promise(r => setTimeout(r, 500));

                        addLog('Triggering cropped screenshot capture ("Firewall" heading)...', 'info');
                        const captureRes = await fetch('/api/ntbc-capture?type=firewall');
                        const captureData = await captureRes.json();
                        if (captureData.success && captureData.image) {
                            firewallImg = captureData.image;
                            setCapturedFirewallScreenshot(captureData.image);
                            if (typeof window !== 'undefined') {
                                localStorage.setItem('control_capturedFirewallScreenshot', captureData.image);
                            }
                            addLog('Event Analytics (Firewall) screenshot captured successfully.', 'success');
                        } else {
                            addLog(`Event Analytics (Firewall) capture failed: ${captureData.error || 'Failed to capture screenshot'}`, 'warn');
                        }
                    } else {
                        addLog(`Event Analytics (Firewall) redirect error: ${data.error}`, 'error');
                    }
                }

                // 5. Security Rules capture
                if (captureSecurityRules) {
                    const debugDomain = 'log.softdebut.online';
                    const targetRulesUrl = `https://dash.cloudflare.com/${envAccount}/${debugDomain}/security/security-rules`;
                    addLog(`Connecting to debug browser on port 9222 for Security Rules...`, 'info');
                    addLog(`Redirecting active tab to Security Rules page: ${targetRulesUrl}`, 'info');
                    const res = await fetch(`/api/ntbc-control-chrome?url=${encodeURIComponent(targetRulesUrl)}`);
                    const data = await res.json();
                    if (data.success) {
                        addLog(`Redirect successful to: ${data.redirectedUrl}`, 'success');
                        addLog('Waiting for page rendering to stabilize...', 'info');
                        await new Promise(r => setTimeout(r, 500));

                        addLog('Triggering cropped screenshot capture ("Security Rules" heading)...', 'info');
                        const captureRes = await fetch('/api/ntbc-capture?type=security-rules');
                        const captureData = await captureRes.json();
                        if (captureData.success && captureData.image) {
                            securityRulesImg = captureData.image;
                            setCapturedSecurityRulesScreenshot(captureData.image);
                            if (typeof window !== 'undefined') {
                                localStorage.setItem('control_capturedSecurityRulesScreenshot', captureData.image);
                            }
                            addLog('Security Rules screenshot captured successfully.', 'success');
                        } else {
                            addLog(`Security Rules capture failed: ${captureData.error || 'Failed to capture screenshot'}`, 'warn');
                        }
                    } else {
                        addLog(`Security Rules redirect error: ${data.error}`, 'error');
                    }
                }

                // 6. Argo Smart Routing capture
                if (captureArgo) {
                    const debugDomain = 'log.softdebut.online';
                    const targetArgoUrl = `https://dash.cloudflare.com/${envAccount}/${debugDomain}/traffic`;
                    addLog(`Connecting to debug browser on port 9222 for Argo Smart Routing...`, 'info');
                    addLog(`Redirecting active tab to Argo page: ${targetArgoUrl}`, 'info');
                    const res = await fetch(`/api/ntbc-control-chrome?url=${encodeURIComponent(targetArgoUrl)}`);
                    const data = await res.json();
                    if (data.success) {
                        addLog(`Redirect successful to: ${data.redirectedUrl}`, 'success');
                        addLog('Waiting for page rendering to stabilize...', 'info');
                        await new Promise(r => setTimeout(r, 500));

                        addLog('Triggering cropped screenshot capture ("Argo" heading)...', 'info');
                        const captureRes = await fetch('/api/ntbc-capture?type=argo');
                        const captureData = await captureRes.json();
                        if (captureData.success && captureData.image) {
                            argoImg = captureData.image;
                            setCapturedArgoScreenshot(captureData.image);
                            if (typeof window !== 'undefined') {
                                localStorage.setItem('control_capturedArgoScreenshot', captureData.image);
                            }
                            addLog('Argo Smart Routing screenshot captured successfully.', 'success');
                        } else {
                            addLog(`Argo Smart Routing capture failed: ${captureData.error || 'Failed to capture screenshot'}`, 'warn');
                        }
                    } else {
                        addLog(`Argo Smart Routing redirect error: ${data.error}`, 'error');
                    }
                }

                // 7. Speed Test capture
                if (captureSpeed) {
                    const debugDomain = 'log.softdebut.online';
                    const targetSpeedUrl = `https://dash.cloudflare.com/${envAccount}/${debugDomain}/speed/test/browser`;
                    addLog(`Connecting to debug browser on port 9222 for Speed Test...`, 'info');
                    addLog(`Redirecting active tab to Speed Test page: ${targetSpeedUrl}`, 'info');
                    const res = await fetch(`/api/ntbc-control-chrome?url=${encodeURIComponent(targetSpeedUrl)}`);
                    const data = await res.json();
                    if (data.success) {
                        addLog(`Redirect successful. Injecting fields and triggering test run...`, 'info');
                        
                        // Execute Puppeteer execution inside control chrome logic using scraper actions
                        const runRes = await fetch('/api/scrape', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'run-speed-test',
                                apiToken: currentUser?.cloudflare_api_token || auth.getCurrentUser()?.cloudflare_api_token,
                                domainVal: debugDomain
                            })
                        });
                        const runData = await runRes.json();
                        if (runData.success) {
                            addLog('Speed test successfully triggered. Waiting 60 seconds before checking results...', 'info');
                            await new Promise(r => setTimeout(r, 60000));
                            
                            // Check loop
                            let isSuccess = false;
                            for (let retry = 1; retry <= 3; retry++) {
                                addLog(`Checking for speed test result (Attempt ${retry}/3)...`, 'info');
                                
                                const checkRes = await fetch('/api/scrape', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        action: 'check-speed-results',
                                        apiToken: currentUser?.cloudflare_api_token || auth.getCurrentUser()?.cloudflare_api_token
                                    })
                                });
                                const checkData = await checkRes.json();
                                if (checkData.success && checkData.found) {
                                    addLog('Found "Speed test result" text on active page!', 'success');
                                    isSuccess = true;
                                    break;
                                }
                                
                                if (retry < 3) {
                                    addLog('Result not found yet. Retrying in 5 seconds...', 'info');
                                    await new Promise(r => setTimeout(r, 5000));
                                }
                            }
                            
                            if (isSuccess) {
                                addLog('Triggering cropped screenshot capture ("Speed" heading)...', 'info');
                                const captureRes = await fetch('/api/ntbc-capture?type=speed');
                                const captureData = await captureRes.json();
                                if (captureData.success && captureData.image) {
                                    speedImg = captureData.image;
                                    setCapturedSpeedScreenshot(captureData.image);
                                    if (typeof window !== 'undefined') {
                                        localStorage.setItem('control_capturedSpeedScreenshot', captureData.image);
                                    }
                                    addLog('Speed Test screenshot captured successfully.', 'success');
                                } else {
                                    addLog(`Speed Test capture failed: ${captureData.error || 'Failed to capture screenshot'}`, 'warn');
                                }
                            } else {
                                addLog('Timeout waiting for Speed test results (Text not found after retries). Proceeding with screenshot fallback.', 'warn');
                                const captureRes = await fetch('/api/ntbc-capture?type=speed');
                                const captureData = await captureRes.json();
                                if (captureData.success && captureData.image) {
                                    speedImg = captureData.image;
                                    setCapturedSpeedScreenshot(captureData.image);
                                    if (typeof window !== 'undefined') {
                                        localStorage.setItem('control_capturedSpeedScreenshot', captureData.image);
                                    }
                                    addLog('Speed Test fallback screenshot captured successfully.', 'success');
                                }
                            }

                            // Capture Speed Mobile
                            if (speedImg) {
                                addLog('Clicking Mobile speed test tab...', 'info');
                                const mobileClickRes = await fetch('/api/scrape', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        action: 'click-speed-mobile',
                                        apiToken: currentUser?.cloudflare_api_token || auth.getCurrentUser()?.cloudflare_api_token
                                    })
                                });
                                const mobileClickData = await mobileClickRes.json();
                                if (mobileClickData.success) {
                                    addLog('Triggering mobile speed screenshot capture...', 'info');
                                    const captureMobileRes = await fetch('/api/ntbc-capture?type=speed-mobile');
                                    const captureMobileData = await captureMobileRes.json();
                                    if (captureMobileData.success && captureMobileData.image) {
                                        speedMobileImg = captureMobileData.image;
                                        setCapturedSpeedMobileScreenshot(captureMobileData.image);
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem('control_capturedSpeedMobileScreenshot', captureMobileData.image);
                                        }
                                        addLog('Mobile Speed Test screenshot captured successfully.', 'success');
                                    } else {
                                        addLog(`Mobile Speed Test capture failed: ${captureMobileData.error || 'Failed to capture screenshot'}`, 'warn');
                                    }
                                } else {
                                    addLog(`Failed to click Mobile speed tab: ${mobileClickData.error || 'Check active browser'}`, 'warn');
                                }
                            }
                        } else {
                            addLog(`Failed to run speed test form submission: ${runData.error || 'Check fields on screen'}`, 'error');
                        }
                    } else {
                        addLog(`Speed Test redirect error: ${data.error}`, 'error');
                    }
                }

                if ((captureDomains && !domainsImg) || (captureDnsRecord && !dnsImg) || (captureHttpTraffic && !trafficImg) || (captureFirewall && !firewallImg) || (captureSecurityRules && !securityRulesImg) || (captureArgo && !argoImg) || (captureSpeed && !speedImg)) {
                    addLog('Session capturing completed with some warnings/failures.', 'warn');
                } else {
                    addLog('Session capturing completed successfully.', 'success');
                }
                
                markCompleted(domainsImg, dnsImg, trafficImg, firewallImg, securityRulesImg, argoImg, speedImg);
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
        setCapturedDnsScreenshot(null);
        setCapturedHttpTrafficScreenshot(null);
        setCapturedHttpTrafficScreenshot1(null);
        setCapturedHttpTrafficScreenshot2(null);
        setCapturedHttpTrafficScreenshot3(null);
        setCapturedHttpTrafficScreenshot4(null);
        setCapturedHttpTrafficScreenshot5(null);
        setCapturedFirewallScreenshot(null);
        setCapturedSecurityRulesScreenshot(null);
        setCapturedArgoScreenshot(null);
        setCapturedSpeedScreenshot(null);
        setCapturedSpeedMobileScreenshot(null);
        setCaptureDomains(false);
        setCaptureDnsRecord(false);
        setCaptureHttpTraffic(false);
        setCaptureFirewall(false);
        setCaptureSecurityRules(false);
        setCaptureArgo(false);
        setCaptureSpeed(false);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('control_stepStatus');
            localStorage.removeItem('control_capturedScreenshot');
            localStorage.removeItem('control_capturedDnsScreenshot');
            localStorage.removeItem('control_capturedHttpTrafficScreenshot');
            localStorage.removeItem('control_capturedHttpTrafficScreenshot1');
            localStorage.removeItem('control_capturedHttpTrafficScreenshot2');
            localStorage.removeItem('control_capturedHttpTrafficScreenshot3');
            localStorage.removeItem('control_capturedHttpTrafficScreenshot4');
            localStorage.removeItem('control_capturedHttpTrafficScreenshot5');
            localStorage.removeItem('control_capturedFirewallScreenshot');
            localStorage.removeItem('control_capturedSecurityRulesScreenshot');
            localStorage.removeItem('control_capturedArgoScreenshot');
            localStorage.removeItem('control_capturedSpeedScreenshot');
            localStorage.removeItem('control_capturedSpeedMobileScreenshot');
            localStorage.removeItem('control_captureDomains');
            localStorage.removeItem('control_captureDnsRecord');
            localStorage.removeItem('control_captureHttpTraffic');
            localStorage.removeItem('control_captureFirewall');
            localStorage.removeItem('control_captureSecurityRules');
            localStorage.removeItem('control_captureArgo');
            localStorage.removeItem('control_captureSpeed');
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

                                const isButtonDisabled = !mounted || !isConfigComplete || (idx === 1 && (!captureDomains && !captureDnsRecord && !captureHttpTraffic && !captureFirewall && !captureSecurityRules && !captureArgo && !captureSpeed));

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
                                                <div className="flex flex-col gap-2">
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
                                                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-rose-400 transition-colors">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={captureDnsRecord} 
                                                            onChange={(e) => {
                                                                setCaptureDnsRecord(e.target.checked);
                                                                if (typeof window !== 'undefined') {
                                                                    localStorage.setItem('control_captureDnsRecord', e.target.checked ? 'true' : 'false');
                                                                }
                                                            }}
                                                            className="accent-rose-500 rounded border-gray-800 bg-gray-950 focus:ring-rose-500"
                                                        />
                                                        Dns Record Option (Check to enable Step 2 Execution)
                                                    </label>
                                                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-rose-400 transition-colors">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={captureHttpTraffic} 
                                                            onChange={(e) => {
                                                                setCaptureHttpTraffic(e.target.checked);
                                                                if (typeof window !== 'undefined') {
                                                                    localStorage.setItem('control_captureHttpTraffic', e.target.checked ? 'true' : 'false');
                                                                }
                                                            }}
                                                            className="accent-rose-500 rounded border-gray-800 bg-gray-950 focus:ring-rose-500"
                                                        />
                                                        HTTP Traffic Option (Check to enable Step 2 Execution)
                                                    </label>
                                                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-rose-400 transition-colors">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={captureFirewall} 
                                                            onChange={(e) => {
                                                                setCaptureFirewall(e.target.checked);
                                                                if (typeof window !== 'undefined') {
                                                                    localStorage.setItem('control_captureFirewall', e.target.checked ? 'true' : 'false');
                                                                }
                                                            }}
                                                            className="accent-rose-500 rounded border-gray-800 bg-gray-950 focus:ring-rose-500"
                                                        />
                                                        Event Analytics (Firewall) Option (Check to enable Step 2 Execution)
                                                    </label>
                                                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-rose-400 transition-colors">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={captureSecurityRules} 
                                                            onChange={(e) => {
                                                                setCaptureSecurityRules(e.target.checked);
                                                                if (typeof window !== 'undefined') {
                                                                    localStorage.setItem('control_captureSecurityRules', e.target.checked ? 'true' : 'false');
                                                                }
                                                            }}
                                                            className="accent-rose-500 rounded border-gray-800 bg-gray-950 focus:ring-rose-500"
                                                        />
                                                        Security Rules Option (Check to enable Step 2 Execution)
                                                    </label>
                                                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-rose-400 transition-colors">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={captureArgo} 
                                                            onChange={(e) => {
                                                                setCaptureArgo(e.target.checked);
                                                                if (typeof window !== 'undefined') {
                                                                    localStorage.setItem('control_captureArgo', e.target.checked ? 'true' : 'false');
                                                                }
                                                            }}
                                                            className="accent-rose-500 rounded border-gray-800 bg-gray-950 focus:ring-rose-500"
                                                        />
                                                        Argo Smart Routing Option (Check to enable Step 2 Execution)
                                                    </label>
                                                    <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-rose-400 transition-colors">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={captureSpeed} 
                                                            onChange={(e) => {
                                                                setCaptureSpeed(e.target.checked);
                                                                if (typeof window !== 'undefined') {
                                                                    localStorage.setItem('control_captureSpeed', e.target.checked ? 'true' : 'false');
                                                                }
                                                            }}
                                                            className="accent-rose-500 rounded border-gray-800 bg-gray-950 focus:ring-rose-500"
                                                        />
                                                        Speed Test Option (Check to enable Step 2 Execution)
                                                    </label>
                                                </div>
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

                    {capturedDnsScreenshot && (
                        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex flex-col shadow-2xl animate-scale-up mt-4">
                            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Captured DNS Records
                            </h4>
                            <div className="rounded border border-gray-800/80 bg-black flex items-center justify-center p-1.5 overflow-hidden">
                                <img src={capturedDnsScreenshot} className="max-w-full rounded h-auto max-h-[260px] object-contain" alt="DNS Records" />
                            </div>
                        </div>
                    )}

                    {capturedHttpTrafficScreenshot && (
                        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex flex-col shadow-2xl animate-scale-up mt-4">
                            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Captured HTTP Traffic
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="rounded border border-gray-800/80 bg-black flex flex-col items-center justify-center p-1.5 overflow-hidden">
                                    <span className="text-[10px] text-gray-400 mb-1">Overview</span>
                                    <img src={capturedHttpTrafficScreenshot} className="max-w-full rounded h-auto max-h-[260px] object-contain" alt="HTTP Traffic Overview" />
                                </div>
                                {capturedHttpTrafficScreenshot1 && (
                                    <div className="rounded border border-gray-800/80 bg-black flex flex-col items-center justify-center p-1.5 overflow-hidden">
                                        <span className="text-[10px] text-gray-400 mb-1">Requests (900px)</span>
                                        <img src={capturedHttpTrafficScreenshot1} className="max-w-full rounded h-auto max-h-[260px] object-contain" alt="HTTP Traffic Sub 1" />
                                    </div>
                                )}
                                {capturedHttpTrafficScreenshot2 && (
                                    <div className="rounded border border-gray-800/80 bg-black flex flex-col items-center justify-center p-1.5 overflow-hidden">
                                        <span className="text-[10px] text-gray-400 mb-1">Data Transfer (900px)</span>
                                        <img src={capturedHttpTrafficScreenshot2} className="max-w-full rounded h-auto max-h-[260px] object-contain" alt="HTTP Traffic Sub 2" />
                                    </div>
                                )}
                                {capturedHttpTrafficScreenshot3 && (
                                    <div className="rounded border border-gray-800/80 bg-black flex flex-col items-center justify-center p-1.5 overflow-hidden">
                                        <span className="text-[10px] text-gray-400 mb-1">Page views (900px)</span>
                                        <img src={capturedHttpTrafficScreenshot3} className="max-w-full rounded h-auto max-h-[260px] object-contain" alt="HTTP Traffic Sub 3" />
                                    </div>
                                )}
                                {capturedHttpTrafficScreenshot4 && (
                                    <div className="rounded border border-gray-800/80 bg-black flex flex-col items-center justify-center p-1.5 overflow-hidden">
                                        <span className="text-[10px] text-gray-400 mb-1">Visits (900px)</span>
                                        <img src={capturedHttpTrafficScreenshot4} className="max-w-full rounded h-auto max-h-[260px] object-contain" alt="HTTP Traffic Sub 4" />
                                    </div>
                                )}
                                {capturedHttpTrafficScreenshot5 && (
                                    <div className="rounded border border-gray-800/80 bg-black flex flex-col items-center justify-center p-1.5 overflow-hidden">
                                        <span className="text-[10px] text-gray-400 mb-1">API Requests (900px)</span>
                                        <img src={capturedHttpTrafficScreenshot5} className="max-w-full rounded h-auto max-h-[260px] object-contain" alt="HTTP Traffic Sub 5" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {capturedFirewallScreenshot && (
                        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex flex-col shadow-2xl animate-scale-up mt-4">
                            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Captured Firewall Events
                            </h4>
                            <div className="rounded border border-gray-800/80 bg-black flex items-center justify-center p-1.5 overflow-hidden">
                                <img src={capturedFirewallScreenshot} className="max-w-full rounded h-auto max-h-[260px] object-contain" alt="Firewall Events Overview" />
                            </div>
                        </div>
                    )}

                    {capturedSecurityRulesScreenshot && (
                        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex flex-col shadow-2xl animate-scale-up mt-4">
                            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Captured Security Rules
                            </h4>
                            <div className="rounded border border-gray-800/80 bg-black flex items-center justify-center p-1.5 overflow-hidden">
                                <img src={capturedSecurityRulesScreenshot} className="max-w-full rounded h-auto max-h-[260px] object-contain" alt="Security Rules Overview" />
                            </div>
                        </div>
                    )}

                    {capturedArgoScreenshot && (
                        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex flex-col shadow-2xl animate-scale-up mt-4">
                            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Captured Argo Smart Routing
                            </h4>
                            <div className="rounded border border-gray-800/80 bg-black flex items-center justify-center p-1.5 overflow-hidden">
                                <img src={capturedArgoScreenshot} className="max-w-full rounded h-auto max-h-[260px] object-contain" alt="Argo Smart Routing Overview" />
                            </div>
                        </div>
                    )}

                    {capturedSpeedScreenshot && (
                        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex flex-col shadow-2xl animate-scale-up mt-4">
                            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Captured Speed Test (Desktop)
                            </h4>
                            <div className="rounded border border-gray-800/80 bg-black flex items-center justify-center p-1.5 overflow-hidden">
                                <img src={capturedSpeedScreenshot} className="max-w-full rounded h-auto max-h-[260px] object-contain" alt="Speed Test Overview" />
                            </div>
                        </div>
                    )}

                    {capturedSpeedMobileScreenshot && (
                        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex flex-col shadow-2xl animate-scale-up mt-4">
                            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Captured Speed Test (Mobile)
                            </h4>
                            <div className="rounded border border-gray-800/80 bg-black flex items-center justify-center p-1.5 overflow-hidden">
                                <img src={capturedSpeedMobileScreenshot} className="max-w-full rounded h-auto max-h-[260px] object-contain" alt="Speed Test Mobile Overview" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
