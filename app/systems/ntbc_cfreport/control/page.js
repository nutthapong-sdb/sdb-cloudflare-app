'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
    CheckCircle, Play, ArrowLeft, RefreshCw, Terminal, 
    Layers, Settings, ShieldAlert, Cpu, Activity, Clock, Check, Chrome
} from 'lucide-react';
import Swal from '../utils/alert';
import { Editor } from '@tinymce/tinymce-react';
import { REPORT_VARIABLES, STATIC_VARIABLES } from '../variableDefinitions';
import { DELAY_CONFIG } from '@/lib/delay-config';
import { auth } from '@/app/utils/auth';
import { getUserProfileAction } from '@/app/actions/authActions';
import SearchableDropdown from '../SearchableDropdown';

export default function ControlPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [stepStatus, setStepStatus] = useState(Array(2).fill('pending')); // 'pending' | 'running' | 'completed'
    const [activeStep, setActiveStep] = useState(0);
    const [logs, setLogs] = useState([]);
    const [activeCaptureTab, setActiveCaptureTab] = useState('domains');
    const vncIframeRef = useRef(null);
    const [isVncMaximized, setIsVncMaximized] = useState(false);

    const requestVncFullscreen = () => {
        if (vncIframeRef.current) {
            if (vncIframeRef.current.requestFullscreen) {
                vncIframeRef.current.requestFullscreen();
            } else if (vncIframeRef.current.webkitRequestFullscreen) {
                vncIframeRef.current.webkitRequestFullscreen();
            } else if (vncIframeRef.current.msRequestFullscreen) {
                vncIframeRef.current.msRequestFullscreen();
            }
        }
    };
 
     // Dropdown Data States
     const [currentUser, setCurrentUser] = useState(null);
     const [vncUrl, setVncUrl] = useState('');
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
     const [capturedBotManagementScreenshot, setCapturedBotManagementScreenshot] = useState(null);
     const [capturedSecurityLevelScreenshot, setCapturedSecurityLevelScreenshot] = useState(null);
     const [capturedSslOverviewScreenshot, setCapturedSslOverviewScreenshot] = useState(null);
     const [capturedSslEdgeScreenshot, setCapturedSslEdgeScreenshot] = useState(null);
     const [capturedRateLimitingScreenshot, setCapturedRateLimitingScreenshot] = useState(null);
     const [capturedManagedRulesScreenshot, setCapturedManagedRulesScreenshot] = useState(null);
     const [capturedIpAccessScreenshot, setCapturedIpAccessScreenshot] = useState(null);
     const [capturedZoneLockdownScreenshot, setCapturedZoneLockdownScreenshot] = useState(null);
     const [capturedTrafficCountriesScreenshot, setCapturedTrafficCountriesScreenshot] = useState(null);
     const [capturedTopEventsSourceScreenshot, setCapturedTopEventsSourceScreenshot] = useState(null);
     const [captureMeta, setCaptureMeta] = useState({});
     const [isCapturingDirect, setIsCapturingDirect] = useState(false);

     const [captureDomains, setCaptureDomains] = useState(true);
     const [captureDnsRecord, setCaptureDnsRecord] = useState(true);
     const [captureHttpTraffic, setCaptureHttpTraffic] = useState(true);
     const [trafficTimeWindow, setTrafficTimeWindow] = useState('1440'); // '1440' = 1d, '10080' = 7d, '43200' = 30d, 'custom'
     const [trafficStartDate, setTrafficStartDate] = useState('');
     const [trafficEndDate, setTrafficEndDate] = useState('');
     const [captureFirewall, setCaptureFirewall] = useState(true);
     const [captureSecurityRules, setCaptureSecurityRules] = useState(true);
     const [captureArgo, setCaptureArgo] = useState(true);
     const [captureSpeed, setCaptureSpeed] = useState(true);

     const [coords, setCoords] = useState({
         domains: { xStart: '395', xEnd: '1785', yStart: '85', yEnd: '' },
         dns: { xStart: '365', xEnd: '1843', yStart: '95', yEnd: '' },
         traffic: { xStart: '422', xEnd: '1766', yStart: '105', yEnd: '1005' },
         firewall: { xStart: '288', xEnd: '1728', yStart: '115', yEnd: '980' },
         securityRules: { xStart: '350', xEnd: '1880', yStart: '85', yEnd: '' },
         argo: { xStart: '520', xEnd: '1632', yStart: '90', yEnd: '600' },
         speed: { xStart: '480', xEnd: '1632', yStart: '115', yEnd: '870' },
         speedMobile: { xStart: '480', xEnd: '1632', yStart: '95', yEnd: '850' },
         botManagement: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '750' },
         securityLevel: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '850' },
         sslOverview: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '800' },
         sslEdge: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '900' },
         rateLimiting: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '' },
         managedRules: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '' },
         ipAccess: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '' },
         zoneLockdown: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '' },
         trafficCountries: { xStart: '350', xEnd: '1880', yStart: '100', yEnd: '950' },
         topEventsSource: { xStart: '288', xEnd: '1728', yStart: '100', yEnd: '950' }
     });

    const pullFromImageSizeSettings = (e) => {
        if (e) e.stopPropagation();
        try {
            const stored = localStorage.getItem('ntbc:image-size-settings');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.coords) {
                    setCoords(prev => ({
                        ...prev,
                        ...parsed.coords
                    }));
                    Swal.fire({
                        icon: 'success',
                        title: 'ดึงค่าสำเร็จ!',
                        text: 'คัดลอกพิกัด Crop จาก Image Size Setting เรียบร้อยแล้ว (อย่าลืมกด Save to Database)',
                        timer: 2000,
                        showConfirmButton: false,
                        background: '#111827',
                        color: '#fff'
                    });
                    return;
                }
            }
            Swal.fire('Info', 'ยังไม่มีการบันทึกข้อมูลพิกัดใน Image Size Setting', 'info');
        } catch (err) {
            console.error('Failed to pull from image size settings:', err);
            Swal.fire('Error', 'เกิดข้อผิดพลาดในการดึงค่าจาก Image Size Setting', 'error');
        }
    };

    const getCaptureUrl = (typeKey, typeValue) => {
        let url = `/api/ntbc-capture?type=${typeValue}`;
        const c = coords[typeKey];
        if (c) {
            if (c.xStart) url += `&xStart=${c.xStart}`;
            if (c.xEnd) url += `&xEnd=${c.xEnd}`;
            if (c.yStart) url += `&yStart=${c.yStart}`;
            if (c.yEnd) url += `&yEnd=${c.yEnd}`;
        }
        return url;
    };

    const handleCoordChange = (key, coord, val) => {
        console.log(`[DEBUG] handleCoordChange called for ${key}.${coord} = ${val}`);
        setCoords(prev => {
            const updated = {
                ...prev,
                [key]: {
                    ...prev[key],
                    [coord]: val
                }
            };
            return updated;
        });
    };

    useEffect(() => {
        console.log(`[DEBUG] useEffect for coords triggered. coords=`, coords);
        if (coords) {
            localStorage.setItem('control_coords', JSON.stringify(coords));
            console.log(`[DEBUG] control_coords saved to localStorage.`);
        }
    }, [coords]);

    const saveCoordsToDatabase = async (e) => {
        if (e) e.stopPropagation();
        try {
            const res = await fetch('/api/ntbc-capture-coords', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(coords)
            });
            const data = await res.json();
            if (data.success) {
                Swal.fire({ icon: 'success', title: 'Saved!', text: 'Coordinates have been updated in the central database.', timer: 1500, showConfirmButton: false, background: '#111827', color: '#fff' });
            } else {
                throw new Error(data.error);
            }
        } catch (e) {
            console.error(e);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save coordinates.', background: '#111827', color: '#fff' });
        }
    };

     const openImageInNewTab = (base64Data) => {
         if (!base64Data) return;
         try {
             const w = window.open("");
             if (w) {
                 w.document.write(
                     `<html><head><title>Captured Screenshot</title><style>body{margin:0;background:#030712;display:flex;justify-content:center;align-items:center;min-height:100vh}img{max-width:100%;max-height:100vh;object-fit:contain;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5)}</style></head><body><img src="${base64Data}"/></body></html>`
                 );
                 w.document.close();
             } else {
                 Swal.fire({
                     title: 'Pop-up Blocked',
                     text: 'Please allow pop-ups for this site to view full images.',
                     icon: 'warning',
                     background: '#111827',
                     color: '#fff'
                 });
             }
         } catch (err) {
             console.error('Failed to open image in new tab:', err);
         }
     };


      const renderCoordsInput = (key) => {
          return (
              <div className="flex flex-col gap-1.5 max-w-md pb-3 border-b border-gray-800/30" onClick={(e) => e.stopPropagation()}>
                  <div className="mt-2 ml-6 grid grid-cols-4 gap-3">
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-gray-400 font-mono font-medium">Xstart</span>
                          <input 
                              type="number"
                              placeholder="Auto"
                              value={coords[key]?.xStart || ''}
                              onChange={(e) => handleCoordChange(key, 'xStart', e.target.value)}
                              className="bg-gray-950/80 border border-gray-800 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-rose-500/50 transition-colors w-full"
                          />
                      </div>
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-gray-400 font-mono font-medium">Xend</span>
                          <input 
                              type="number"
                              placeholder="Auto"
                              value={coords[key]?.xEnd || ''}
                              onChange={(e) => handleCoordChange(key, 'xEnd', e.target.value)}
                              className="bg-gray-950/80 border border-gray-800 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-rose-500/50 transition-colors w-full"
                          />
                      </div>
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-gray-400 font-mono font-medium">Ystart</span>
                          <input 
                              type="number"
                              placeholder="Auto"
                              value={coords[key]?.yStart || ''}
                              onChange={(e) => handleCoordChange(key, 'yStart', e.target.value)}
                              className="bg-gray-950/80 border border-gray-800 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-rose-500/50 transition-colors w-full"
                          />
                      </div>
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-gray-400 font-mono font-medium">Yend</span>
                          <input 
                              type="text"
                              placeholder="Auto"
                              value={coords[key]?.yEnd || ''}
                              onChange={(e) => {
                                  const val = e.target.value;
                                  if (/^-?\d*$/.test(val)) {
                                      handleCoordChange(key, 'yEnd', val);
                                  }
                              }}
                              className="bg-gray-950/80 border border-gray-800 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-rose-500/50 transition-colors w-full"
                          />
                      </div>
                  </div>
                  <div className="ml-6 mt-2 flex items-center justify-between gap-2">
                      <button 
                          type="button"
                          onClick={pullFromImageSizeSettings}
                          className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-[11px] font-semibold rounded transition-colors flex items-center gap-1 cursor-pointer"
                          title="ดึงค่าพิกัดมาจาก Image Size Setting"
                      >
                          📥 ดึงค่าจาก Image Size Setting
                      </button>
                      <button 
                          type="button"
                          onClick={saveCoordsToDatabase}
                          className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold rounded transition-colors cursor-pointer"
                      >
                          Save to Database
                      </button>
                  </div>
                  {key === 'domains' && (
                      <p className="ml-6 text-[10px] text-gray-400 font-sans leading-normal mt-1.5">
                        * ค่า Yend สำหรับ Domains จะใช้ปรับขอบล่าง: ใส่ **ค่าลบ** เพื่อหักครอปขึ้นด้านบน (เช่น -250), ใส่ **ค่าบวก** เพื่อยืดขอบลงด้านล่าง (เช่น 50), หรือว่างไว้เป็น Auto (มี Pagination ยืด +15px / ไม่มีหักขึ้น -250px)
                      </p>
                  )}
                  {key === 'dns' && (
                      <p className="ml-6 text-[10px] text-gray-400 font-sans leading-normal mt-1.5">
                        * ค่า Yend สำหรับ DNS จะใช้ปรับขอบล่าง: ใส่ **ค่าลบ** เพื่อหักครอปขึ้นด้านบน, ใส่ **ค่าบวก** เพื่อยืดขอบลงด้านล่าง, หรือว่างไว้เป็น Auto (ยืดลง +15px จากกล่อง pagination 1 to 50 of records)
                      </p>
                  )}
              </div>
          );
      };
 
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
                
                // Prioritize saved localStorage default account first
                const savedAccount = localStorage.getItem('control_envAccount');
                if (savedAccount && res.data.some(a => a.id === savedAccount)) {
                    setEnvAccount(savedAccount);
                    const accName = res.data.find(a => a.id === savedAccount)?.name || savedAccount;
                    addLog(`Loaded saved account from defaults: ${accName}`, 'info');
                } else {
                    setEnvAccount('ae240d50da44461d1fc5e34f708ebec8');
                    const matchedAcc = res.data.find(a => a.id === 'ae240d50da44461d1fc5e34f708ebec8');
                    const accName = matchedAcc ? matchedAcc.name : 'ae240d50da44461d1fc5e34f708ebec8';
                    addLog(`Loaded default account: ${accName}`, 'info');
                }
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
                try {
                    const parsed = savedDnsScreenshot.startsWith('[') ? JSON.parse(savedDnsScreenshot) : [savedDnsScreenshot];
                    setCapturedDnsScreenshot(parsed);
                } catch(e) {
                    setCapturedDnsScreenshot([savedDnsScreenshot]);
                }
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
            const savedBotManagement = localStorage.getItem('control_capturedBotManagementScreenshot');
            if (savedBotManagement) setCapturedBotManagementScreenshot(savedBotManagement);
            const savedSecurityLevel = localStorage.getItem('control_capturedSecurityLevelScreenshot');
            if (savedSecurityLevel) setCapturedSecurityLevelScreenshot(savedSecurityLevel);
            const savedSslOverview = localStorage.getItem('control_capturedSslOverviewScreenshot');
            if (savedSslOverview) setCapturedSslOverviewScreenshot(savedSslOverview);
            const savedSslEdge = localStorage.getItem('control_capturedSslEdgeScreenshot');
            if (savedSslEdge) setCapturedSslEdgeScreenshot(savedSslEdge);
            const savedRateLimiting = localStorage.getItem('control_capturedRateLimitingScreenshot');
            if (savedRateLimiting) setCapturedRateLimitingScreenshot(savedRateLimiting);
            const savedManagedRules = localStorage.getItem('control_capturedManagedRulesScreenshot');
            if (savedManagedRules) setCapturedManagedRulesScreenshot(savedManagedRules);
            const savedIpAccess = localStorage.getItem('control_capturedIpAccessScreenshot');
            if (savedIpAccess) setCapturedIpAccessScreenshot(savedIpAccess);
            const savedZoneLockdown = localStorage.getItem('control_capturedZoneLockdownScreenshot');
            if (savedZoneLockdown) setCapturedZoneLockdownScreenshot(savedZoneLockdown);
            const savedTrafficCountries = localStorage.getItem('control_capturedTrafficCountriesScreenshot');
            if (savedTrafficCountries) setCapturedTrafficCountriesScreenshot(savedTrafficCountries);
            const savedTopEventsSource = localStorage.getItem('control_capturedTopEventsSourceScreenshot');
            if (savedTopEventsSource) setCapturedTopEventsSourceScreenshot(savedTopEventsSource);
            const savedCaptureDomains = localStorage.getItem('control_captureDomains') !== null 
                ? localStorage.getItem('control_captureDomains') 
                : localStorage.getItem('control_default_captureDomains');
            if (savedCaptureDomains !== null) {
                setCaptureDomains(savedCaptureDomains === 'true');
            }
            const savedCaptureDnsRecord = localStorage.getItem('control_captureDnsRecord') !== null
                ? localStorage.getItem('control_captureDnsRecord')
                : localStorage.getItem('control_default_captureDnsRecord');
            if (savedCaptureDnsRecord !== null) {
                setCaptureDnsRecord(savedCaptureDnsRecord === 'true');
            }
            const savedCaptureHttpTraffic = localStorage.getItem('control_captureHttpTraffic') !== null
                ? localStorage.getItem('control_captureHttpTraffic')
                : localStorage.getItem('control_default_captureHttpTraffic');
            if (savedCaptureHttpTraffic !== null) {
                setCaptureHttpTraffic(savedCaptureHttpTraffic === 'true');
            }
            const savedCaptureFirewall = localStorage.getItem('control_captureFirewall') !== null
                ? localStorage.getItem('control_captureFirewall')
                : localStorage.getItem('control_default_captureFirewall');
            if (savedCaptureFirewall !== null) {
                setCaptureFirewall(savedCaptureFirewall === 'true');
            }
            const savedCaptureSecurityRules = localStorage.getItem('control_captureSecurityRules') !== null
                ? localStorage.getItem('control_captureSecurityRules')
                : localStorage.getItem('control_default_captureSecurityRules');
            if (savedCaptureSecurityRules !== null) {
                setCaptureSecurityRules(savedCaptureSecurityRules === 'true');
            }
            const savedCaptureArgo = localStorage.getItem('control_captureArgo') !== null
                ? localStorage.getItem('control_captureArgo')
                : localStorage.getItem('control_default_captureArgo');
            if (savedCaptureArgo !== null) {
                setCaptureArgo(savedCaptureArgo === 'true');
            }
            const savedCaptureSpeed = localStorage.getItem('control_captureSpeed') !== null
                ? localStorage.getItem('control_captureSpeed')
                : localStorage.getItem('control_default_captureSpeed');
            if (savedCaptureSpeed !== null) {
                setCaptureSpeed(savedCaptureSpeed === 'true');
            }
            const savedStartDate = localStorage.getItem('control_envStartDate');
            if (savedStartDate) {
                setEnvStartDate(savedStartDate);
            }
            const savedEndDate = localStorage.getItem('control_envEndDate');
            if (savedEndDate) {
                setEnvEndDate(savedEndDate);
            }
            try {
                const savedMeta = localStorage.getItem('control_captureMeta');
                if (savedMeta) {
                    setCaptureMeta(JSON.parse(savedMeta));
                }
            } catch (e) {
                console.error('Failed to parse captureMeta:', e);
            }
            
            // Fetch central database coordinates
            fetch('/api/ntbc-capture-coords')
                .then(res => res.json())
                .then(data => {
                    setCoords(data);
                })
                .catch(e => {
                    console.error('Failed to load global coords:', e);
                    const defaultCoords = {
                        domains: { xStart: '395', xEnd: '1785', yStart: '115', yEnd: '' },
                        dns: { xStart: '365', xEnd: '1843', yStart: '95', yEnd: '' },
                        traffic: { xStart: '422', xEnd: '1766', yStart: '105', yEnd: '1005' },
                        firewall: { xStart: '288', xEnd: '1728', yStart: '115', yEnd: '815' },
                        securityRules: { xStart: '288', xEnd: '1920', yStart: '115', yEnd: '815' },
                        argo: { xStart: '480', xEnd: '1632', yStart: '95', yEnd: '850' },
                        speed: { xStart: '480', xEnd: '1632', yStart: '95', yEnd: '850' },
                        speedMobile: { xStart: '480', xEnd: '1632', yStart: '95', yEnd: '850' }
                    };
                    setCoords(defaultCoords);
                });
            // Clear stepStatus from localStorage on refresh
            localStorage.removeItem('control_stepStatus');
        }

        // Initialize logs with first entry containing client-side timestamp
        setLogs([{ time: new Date().toLocaleTimeString(), text: 'System initialized and ready.', type: 'info' }]);
        if (typeof window !== 'undefined') {
            setVncUrl(`${window.location.origin}/vnc/?autoconnect=1&resize=scale&path=vnc/websockify`);
        }
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

    // Auto-select tab when a screenshot is captured
    useEffect(() => {
        if (capturedScreenshot) setActiveCaptureTab('domains');
    }, [capturedScreenshot]);

    useEffect(() => {
        if (capturedDnsScreenshot) setActiveCaptureTab('dns');
    }, [capturedDnsScreenshot]);

    useEffect(() => {
        if (capturedHttpTrafficScreenshot) setActiveCaptureTab('traffic');
    }, [capturedHttpTrafficScreenshot]);

    useEffect(() => {
        if (capturedFirewallScreenshot) setActiveCaptureTab('firewall');
    }, [capturedFirewallScreenshot]);

    useEffect(() => {
        if (capturedSecurityRulesScreenshot) setActiveCaptureTab('securityRules');
    }, [capturedSecurityRulesScreenshot]);

    useEffect(() => {
        if (capturedArgoScreenshot) setActiveCaptureTab('argo');
    }, [capturedArgoScreenshot]);

    useEffect(() => {
        if (capturedSpeedScreenshot || capturedSpeedMobileScreenshot) setActiveCaptureTab('speed');
    }, [capturedSpeedScreenshot, capturedSpeedMobileScreenshot]);

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
        { name: "Step 2: Login Success, Capturing", desc: "Redirects active tab directly to the selected Cloudflare Account Home Overview and captures all active Cloudflare settings & screenshots." }
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

        const markCompleted = () => {
            updateStepStatusAtIndex(index, 'completed');
            addLog(`${steps[index].name} completed successfully.`, 'success');

            Swal.fire({
                title: `${steps[index].name} Completed`,
                text: 'All captures finished successfully.',
                icon: 'success',
                position: 'center',
                timer: 2000,
                showConfirmButton: false,
                background: '#111827',
                color: '#fff',
                customClass: {
                    popup: 'rounded-2xl border border-rose-500/30 shadow-2xl'
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
                const getCaptureUrl = (typeKey, typeValue) => {
                    let url = `/api/ntbc-capture?type=${typeValue}`;
                    const c = coords[typeKey];
                    if (c) {
                        if (c.xStart) url += `&xStart=${c.xStart}`;
                        if (c.xEnd) url += `&xEnd=${c.xEnd}`;
                        if (c.yStart) url += `&yStart=${c.yStart}`;
                        if (c.yEnd) url += `&yEnd=${c.yEnd}`;
                    }
                    return url;
                };

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
                        await new Promise(r => setTimeout(r, DELAY_CONFIG.NAV_STABILIZE_MS));

                        addLog('Triggering cropped screenshot capture ("Domains" heading to pagination)...', 'info');
                        const captureRes = await fetch(getCaptureUrl('domains', 'domains'));
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
                        await new Promise(r => setTimeout(r, DELAY_CONFIG.NAV_STABILIZE_MS));

                        addLog('Triggering cropped screenshot capture ("DNS" heading)...', 'info');
                        const captureRes = await fetch(getCaptureUrl('dns', 'dns'));
                        const captureData = await captureRes.json();
                        if (captureData.success && captureData.image) {
                            const dnsImages = captureData.dnsPages || [captureData.image];
                            setCapturedDnsScreenshot(dnsImages);
                            if (typeof window !== 'undefined') {
                                localStorage.setItem('control_capturedDnsScreenshot', JSON.stringify(dnsImages));
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
                    let trafficQuery = '';
                    if (trafficTimeWindow === 'custom' && trafficStartDate && trafficEndDate) {
                        const startIso = new Date(trafficStartDate).toISOString();
                        const endIso = new Date(trafficEndDate).toISOString();
                        trafficQuery = `?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`;
                    } else if (trafficTimeWindow !== 'custom') {
                        trafficQuery = `?time-window=${trafficTimeWindow}`;
                    }
                    const targetTrafficUrl = `https://dash.cloudflare.com/${envAccount}/${debugDomain}/analytics/traffic${trafficQuery}`;
                    addLog(`Connecting to debug browser on port 9222 for HTTP Traffic...`, 'info');
                    addLog(`Redirecting active tab to Traffic Analytics page: ${targetTrafficUrl}`, 'info');
                    const res = await fetch(`/api/ntbc-control-chrome?url=${encodeURIComponent(targetTrafficUrl)}`);
                    const data = await res.json();
                    if (data.success) {
                        addLog(`Redirect successful to: ${data.redirectedUrl}`, 'success');
                        addLog('Waiting for page rendering to stabilize...', 'info');
                        await new Promise(r => setTimeout(r, DELAY_CONFIG.NAV_STABILIZE_MS));

                        addLog('Triggering cropped screenshot capture ("Traffic" heading)...', 'info');
                        const captureRes = await fetch(getCaptureUrl('traffic', 'traffic'));
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
                        await new Promise(r => setTimeout(r, DELAY_CONFIG.NAV_STABILIZE_MS));

                        addLog('Triggering cropped screenshot capture ("Firewall" heading)...', 'info');
                        const captureRes = await fetch(getCaptureUrl('firewall', 'firewall'));
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
                        await new Promise(r => setTimeout(r, DELAY_CONFIG.NAV_STABILIZE_MS));

                        addLog('Triggering cropped screenshot capture ("Security Rules" heading)...', 'info');
                        const captureRes = await fetch(getCaptureUrl('securityRules', 'security-rules'));
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
                        await new Promise(r => setTimeout(r, DELAY_CONFIG.NAV_STABILIZE_MS));

                        addLog('Triggering cropped screenshot capture ("Argo" heading)...', 'info');
                        const captureRes = await fetch(getCaptureUrl('argo', 'argo'));
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
                                addLog('Speed test successfully triggered. Waiting dynamically for results (max 60s)...', 'info');
                                
                                // Check loop (Polling)
                                let isSuccess = false;
                                const maxAttempts = DELAY_CONFIG.SPEED_TEST_MAX_ATTEMPTS;
                                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                                    addLog(`Checking for speed test result (Attempt ${attempt}/${maxAttempts})...`, 'info');
                                    
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
                                    
                                    if (attempt < maxAttempts) {
                                        await new Promise(r => setTimeout(r, DELAY_CONFIG.SPEED_TEST_POLL_MS));
                                    }
                                }
                            
                            if (isSuccess) {
                                addLog('Triggering cropped screenshot capture ("Speed" heading)...', 'info');
                                const captureRes = await fetch(getCaptureUrl('speed', 'speed'));
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
                                const captureRes = await fetch(getCaptureUrl('speed', 'speed'));
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
                                    addLog(`Waiting ${DELAY_CONFIG.DELAY_BEFORE_SPEED_TEST_MOBILE_MS}ms before Mobile Speed Test begins...`, 'info');
                                    await new Promise(r => setTimeout(r, DELAY_CONFIG.DELAY_BEFORE_SPEED_TEST_MOBILE_MS));

                                    addLog(`Waiting ${DELAY_CONFIG.SPEED_TEST_MOBILE_WAIT_MS}ms for Mobile Speed Test to finish...`, 'info');
                                    await new Promise(r => setTimeout(r, DELAY_CONFIG.SPEED_TEST_MOBILE_WAIT_MS));

                                    addLog('Triggering mobile speed screenshot capture...', 'info');
                                    const captureMobileRes = await fetch(getCaptureUrl('speed', 'speed-mobile'));
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
                
                markCompleted();
            } catch (err) {
                console.error('Control Chrome failed:', err);
                addLog(`Control Chrome failed: ${err.message}`, 'error');
                updateStepStatusAtIndex(index, 'pending');
            }
            return;
        }
    };

    const isAllSelected = captureDomains && captureDnsRecord && captureHttpTraffic && captureFirewall && captureSecurityRules && captureArgo && captureSpeed;

    const toggleSelectAll = () => {
        const targetVal = !isAllSelected;
        setCaptureDomains(targetVal);
        setCaptureDnsRecord(targetVal);
        setCaptureHttpTraffic(targetVal);
        setCaptureFirewall(targetVal);
        setCaptureSecurityRules(targetVal);
        setCaptureArgo(targetVal);
        setCaptureSpeed(targetVal);

        if (typeof window !== 'undefined') {
            const valStr = targetVal ? 'true' : 'false';
            localStorage.setItem('control_captureDomains', valStr);
            localStorage.setItem('control_captureDnsRecord', valStr);
            localStorage.setItem('control_captureHttpTraffic', valStr);
            localStorage.setItem('control_captureFirewall', valStr);
            localStorage.setItem('control_captureSecurityRules', valStr);
            localStorage.setItem('control_captureArgo', valStr);
            localStorage.setItem('control_captureSpeed', valStr);
        }
        addLog(targetVal ? 'All captures selected.' : 'All captures deselected.', 'info');
    };

    const saveStep2Settings = () => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('control_captureDomains', captureDomains ? 'true' : 'false');
            localStorage.setItem('control_captureDnsRecord', captureDnsRecord ? 'true' : 'false');
            localStorage.setItem('control_captureHttpTraffic', captureHttpTraffic ? 'true' : 'false');
            localStorage.setItem('control_captureFirewall', captureFirewall ? 'true' : 'false');
            localStorage.setItem('control_captureSecurityRules', captureSecurityRules ? 'true' : 'false');
            localStorage.setItem('control_captureArgo', captureArgo ? 'true' : 'false');
            localStorage.setItem('control_captureSpeed', captureSpeed ? 'true' : 'false');
        }
        addLog('Step 2 capture settings saved successfully.', 'success');
        Swal.fire({
            title: 'Settings Saved',
            text: 'Step 2 checklist switch status saved successfully.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false,
            background: '#111827',
            color: '#fff'
        });
    };

    const saveStep2AsDefault = () => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('control_default_captureDomains', captureDomains ? 'true' : 'false');
            localStorage.setItem('control_default_captureDnsRecord', captureDnsRecord ? 'true' : 'false');
            localStorage.setItem('control_default_captureHttpTraffic', captureHttpTraffic ? 'true' : 'false');
            localStorage.setItem('control_default_captureFirewall', captureFirewall ? 'true' : 'false');
            localStorage.setItem('control_default_captureSecurityRules', captureSecurityRules ? 'true' : 'false');
            localStorage.setItem('control_default_captureArgo', captureArgo ? 'true' : 'false');
            localStorage.setItem('control_default_captureSpeed', captureSpeed ? 'true' : 'false');
            localStorage.setItem('control_default_coords', JSON.stringify(coords));
            
            // Also save to active keys
            localStorage.setItem('control_captureDomains', captureDomains ? 'true' : 'false');
            localStorage.setItem('control_captureDnsRecord', captureDnsRecord ? 'true' : 'false');
            localStorage.setItem('control_captureHttpTraffic', captureHttpTraffic ? 'true' : 'false');
            localStorage.setItem('control_captureFirewall', captureFirewall ? 'true' : 'false');
            localStorage.setItem('control_captureSecurityRules', captureSecurityRules ? 'true' : 'false');
            localStorage.setItem('control_captureArgo', captureArgo ? 'true' : 'false');
            localStorage.setItem('control_captureSpeed', captureSpeed ? 'true' : 'false');
            localStorage.setItem('control_coords', JSON.stringify(coords));
        }
        addLog('Step 2 capture settings saved as defaults.', 'success');
        Swal.fire({
            title: 'Saved as Default',
            text: 'Step 2 checklist and coordinates locked in as default values.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false,
            background: '#111827',
            color: '#fff'
        });
    };

    const resetAll = () => {
        setStepStatus(Array(2).fill('pending'));
        const defaultCoords = {
            domains: { xStart: '395', xEnd: '1785', yStart: '115', yEnd: '' },
            dns: { xStart: '365', xEnd: '1843', yStart: '95', yEnd: '' },
            traffic: { xStart: '422', xEnd: '1766', yStart: '105', yEnd: '1005' },
            firewall: { xStart: '288', xEnd: '1728', yStart: '115', yEnd: '815' },
            securityRules: { xStart: '288', xEnd: '1920', yStart: '115', yEnd: '815' },
            argo: { xStart: '480', xEnd: '1632', yStart: '95', yEnd: '850' },
            speed: { xStart: '480', xEnd: '1632', yStart: '95', yEnd: '850' }
        };

        const defDomains = typeof window !== 'undefined' ? (localStorage.getItem('control_default_captureDomains') === 'true') : false;
        const defDns = typeof window !== 'undefined' ? (localStorage.getItem('control_default_captureDnsRecord') === 'true') : false;
        const defTraffic = typeof window !== 'undefined' ? (localStorage.getItem('control_default_captureHttpTraffic') === 'true') : false;
        const defFirewall = typeof window !== 'undefined' ? (localStorage.getItem('control_default_captureFirewall') === 'true') : false;
        const defRules = typeof window !== 'undefined' ? (localStorage.getItem('control_default_captureSecurityRules') === 'true') : false;
        const defArgo = typeof window !== 'undefined' ? (localStorage.getItem('control_default_captureArgo') === 'true') : false;
        const defSpeed = typeof window !== 'undefined' ? (localStorage.getItem('control_default_captureSpeed') === 'true') : false;

        setCaptureDomains(defDomains);
        setCaptureDnsRecord(defDns);
        setCaptureHttpTraffic(defTraffic);
        setCaptureFirewall(defFirewall);
        setCaptureSecurityRules(defRules);
        setCaptureArgo(defArgo);
        setCaptureSpeed(defSpeed);

        const savedDefCoords = typeof window !== 'undefined' ? localStorage.getItem('control_default_coords') : null;
        if (savedDefCoords) {
            try {
                setCoords(JSON.parse(savedDefCoords));
                if (typeof window !== 'undefined') {
                    localStorage.setItem('control_coords', savedDefCoords);
                }
            } catch (e) {
                setCoords(defaultCoords);
            }
        } else {
            setCoords(defaultCoords);
        }

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

            localStorage.setItem('control_captureDomains', defDomains ? 'true' : 'false');
            localStorage.setItem('control_captureDnsRecord', defDns ? 'true' : 'false');
            localStorage.setItem('control_captureHttpTraffic', defTraffic ? 'true' : 'false');
            localStorage.setItem('control_captureFirewall', defFirewall ? 'true' : 'false');
            localStorage.setItem('control_captureSecurityRules', defRules ? 'true' : 'false');
            localStorage.setItem('control_captureArgo', defArgo ? 'true' : 'false');
            localStorage.setItem('control_captureSpeed', defSpeed ? 'true' : 'false');
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

    const handleDirectCapture = async (tabId, captureType, stateSetter, storageKey, relativePath) => {
        setIsCapturingDirect(true);
        try {
            const targetDomain = zones.find(z => z.id === envZone)?.name || 'log.softdebut.online';
            let targetUrl = null;
            if (relativePath === 'domains') {
                targetUrl = `https://dash.cloudflare.com/${envAccount}`;
            } else if (relativePath) {
                targetUrl = `https://dash.cloudflare.com/${envAccount}/${targetDomain}${relativePath}`;
            }

            if (tabId === 'traffic' || tabId === 'trafficCountries') {
                let trafficQuery = '';
                if (trafficTimeWindow === 'custom' && trafficStartDate && trafficEndDate) {
                    const startTs = new Date(trafficStartDate).toISOString();
                    const endTs = new Date(trafficEndDate).toISOString();
                    trafficQuery = `?since=${encodeURIComponent(startTs)}&until=${encodeURIComponent(endTs)}`;
                } else if (trafficTimeWindow !== 'custom') {
                    trafficQuery = `?time-window=${trafficTimeWindow}`;
                }
                if (targetUrl) targetUrl += trafficQuery;
            }
            
            addLog(`Direct capture triggered for [${tabId}]...`, 'info');
            if (targetUrl) {
                addLog(`Redirecting active tab to: ${targetUrl}`, 'info');
                const res = await fetch(`/api/ntbc-control-chrome?url=${encodeURIComponent(targetUrl)}`);
                const data = await res.json();
                if (!data.success) throw new Error(data.error);
                addLog('Waiting for page rendering to stabilize...', 'info');
                await new Promise(r => setTimeout(r, DELAY_CONFIG.NAV_STABILIZE_MS));
            }
            addLog(`Capturing screenshot with type=${captureType}...`, 'info');
            const captureRes = await fetch(getCaptureUrl(tabId, captureType));
            const captureData = await captureRes.json();
            if (captureData.success && captureData.image) {
                const imgResult = (tabId === 'dns' && captureData.dnsPages) ? captureData.dnsPages : captureData.image;
                stateSetter(imgResult);
                if (typeof window !== 'undefined' && storageKey) {
                    localStorage.setItem(storageKey, typeof imgResult === 'string' ? imgResult : JSON.stringify(imgResult));
                }

                // Record capture metadata (timestamp and user)
                const uName = currentUser?.username || auth.getCurrentUser()?.username || 'root';
                const nowIso = new Date().toISOString();
                setCaptureMeta(prev => {
                    const next = {
                        ...prev,
                        [tabId]: {
                            capturedAt: nowIso,
                            capturedBy: uName
                        }
                    };
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('control_captureMeta', JSON.stringify(next));
                    }
                    return next;
                });

                addLog(`Screenshot for [${tabId}] captured successfully!`, 'success');
                Swal.fire({
                    icon: 'success',
                    title: 'Captured!',
                    text: `Screenshot for ${tabId} captured successfully.`,
                    timer: 1500,
                    showConfirmButton: false,
                    background: '#111827',
                    color: '#fff'
                });
            } else {
                throw new Error(captureData.error || 'Failed to capture screenshot');
            }
        } catch (err) {
            addLog(`Direct capture failed for [${tabId}]: ${err.message}`, 'error');
            Swal.fire('Capture Error', err.message, 'error');
        } finally {
            setIsCapturingDirect(false);
        }
    };

    const renderVncCard = () => (
        <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-6 shadow-xl flex flex-col mb-6">
            <div className="flex items-center justify-between mb-4 border-b border-gray-800/40 pb-3">
                <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-rose-500 animate-pulse" />
                    Live Browser Monitor (noVNC)
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsVncMaximized(!isVncMaximized)}
                        className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-[10px] font-bold transition-all flex items-center gap-1.5 border border-gray-700/50 cursor-pointer"
                    >
                        {isVncMaximized ? '🗗 Minimize Layout' : '🗖 Maximize Layout'}
                    </button>
                    <button
                        onClick={requestVncFullscreen}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                        🖥️ Fullscreen Mode
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
                {/* Live Browser Monitor */}
                <div className="rounded-xl overflow-hidden bg-black aspect-video relative border border-gray-800 shadow-inner">
                    <div className="absolute top-0 left-0 bg-rose-600 text-white text-[10px] px-2 py-0.5 z-10 rounded-br-lg font-bold">Live Browser Monitor</div>
                    {mounted && vncUrl ? (
                        <iframe 
                            ref={vncIframeRef}
                            src={`${window.location.origin}/vnc/?autoconnect=1&resize=scale&path=websockify`}
                            allowFullScreen
                            className="w-full h-full border-none min-h-[250px]"
                            title="Live Browser Monitor"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs font-mono">Initializing Browser...</div>
                    )}
                </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-2 font-mono">
                Connecting VNC display at: {vncUrl}
            </p>
        </div>
    );

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
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-all border border-gray-700/50 cursor-pointer"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reset All Steps
                    </button>
                    <button
                        onClick={() => router.push('/systems/ntbc_cfreport')}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-lg hover:shadow-rose-900/30 cursor-pointer"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to Generator
                    </button>
                </div>
            </div>

            {/* VNC Card rendering when maximized */}
            {isVncMaximized && renderVncCard()}

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
                {/* Steps and Environment Section (Left) */}
                <div className="lg:col-span-8 space-y-6 flex flex-col">
                    {/* Live Browser Monitor Card */}
                    {!isVncMaximized && renderVncCard()}

                    {/* Consolidated Captured Screenshots (Step 2) */}
                    <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex flex-col shadow-2xl relative animate-scale-up">
                        <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                                <span className="text-xs font-bold text-gray-300 font-mono">Captured Screenshots ({[
                                    capturedScreenshot, capturedDnsScreenshot, capturedBotManagementScreenshot,
                                    capturedSecurityLevelScreenshot, capturedSslOverviewScreenshot, capturedSslEdgeScreenshot,
                                    capturedHttpTrafficScreenshot, capturedTrafficCountriesScreenshot, capturedFirewallScreenshot,
                                    capturedTopEventsSourceScreenshot, capturedSecurityRulesScreenshot, capturedRateLimitingScreenshot,
                                    capturedManagedRulesScreenshot, capturedIpAccessScreenshot, capturedZoneLockdownScreenshot,
                                    capturedArgoScreenshot, capturedSpeedScreenshot
                                ].filter(Boolean).length}/17)</span>
                            </div>
                        </div>

                        {/* Tab Sidebar layout */}
                        <div className="flex flex-col md:flex-row gap-4 flex-1">
                            {/* Left-hand sidebar nav bar */}
                            <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 md:pr-3 border-b md:border-b-0 md:border-r border-gray-900 scrollbar-thin scrollbar-thumb-gray-800 shrink-0 md:w-[150px] max-h-[550px] md:overflow-y-auto">
                                {[
                                    { id: 'domains', label: 'Domains', hasData: !!capturedScreenshot, icon: '🌐', type: 'domains', path: 'domains', setter: setCapturedScreenshot, key: 'control_capturedScreenshot' },
                                    { id: 'dns', label: 'DNS Records', hasData: !!capturedDnsScreenshot, icon: '💾', type: 'dns', path: '/dns/records', setter: setCapturedDnsScreenshot, key: 'control_capturedDnsScreenshot' },
                                    { id: 'botManagement', label: 'Bot Management', hasData: !!capturedBotManagementScreenshot, icon: '🤖', type: 'bot-management', path: '/security/settings', setter: setCapturedBotManagementScreenshot, key: 'control_capturedBotManagementScreenshot' },
                                    { id: 'securityLevel', label: 'Security Level', hasData: !!capturedSecurityLevelScreenshot, icon: '🛡️', type: 'security-level', path: '/security/settings', setter: setCapturedSecurityLevelScreenshot, key: 'control_capturedSecurityLevelScreenshot' },
                                    { id: 'sslOverview', label: 'SSL/TLS Mode', hasData: !!capturedSslOverviewScreenshot, icon: '🔒', type: 'ssl-overview', path: '/ssl-tls', setter: setCapturedSslOverviewScreenshot, key: 'control_capturedSslOverviewScreenshot' },
                                    { id: 'sslEdge', label: 'Edge Certificates', hasData: !!capturedSslEdgeScreenshot, icon: '📜', type: 'ssl-edge', path: '/ssl-tls/edge-certificates', setter: setCapturedSslEdgeScreenshot, key: 'control_capturedSslEdgeScreenshot' },
                                    { id: 'traffic', label: 'HTTP Traffic', hasData: !!capturedHttpTrafficScreenshot, icon: '📈', type: 'traffic', path: '/analytics/traffic', setter: setCapturedHttpTrafficScreenshot, key: 'control_capturedHttpTrafficScreenshot' },
                                    { id: 'trafficCountries', label: 'Traffic Countries', hasData: !!capturedTrafficCountriesScreenshot, icon: '🗺️', type: 'traffic-countries', path: '/analytics/traffic', setter: setCapturedTrafficCountriesScreenshot, key: 'control_capturedTrafficCountriesScreenshot' },
                                    { id: 'firewall', label: 'Firewall', hasData: !!capturedFirewallScreenshot, icon: '🔥', type: 'firewall', path: '/security/analytics/events', setter: setCapturedFirewallScreenshot, key: 'control_capturedFirewallScreenshot' },
                                    { id: 'topEventsSource', label: 'Events by Source', hasData: !!capturedTopEventsSourceScreenshot, icon: '📊', type: 'top-events-source', path: '/security/analytics/events', setter: setCapturedTopEventsSourceScreenshot, key: 'control_capturedTopEventsSourceScreenshot' },
                                    { id: 'securityRules', label: 'Custom Rules', hasData: !!capturedSecurityRulesScreenshot, icon: '🛡️', type: 'security-rules', path: '/security/security-rules', setter: setCapturedSecurityRulesScreenshot, key: 'control_capturedSecurityRulesScreenshot' },
                                    { id: 'rateLimiting', label: 'Rate Limiting', hasData: !!capturedRateLimitingScreenshot, icon: '⏱️', type: 'rate-limiting', path: '/security/security-rules', setter: setCapturedRateLimitingScreenshot, key: 'control_capturedRateLimitingScreenshot' },
                                    { id: 'managedRules', label: 'Managed WAF', hasData: !!capturedManagedRulesScreenshot, icon: '🧱', type: 'managed-rules', path: '/security/security-rules', setter: setCapturedManagedRulesScreenshot, key: 'control_capturedManagedRulesScreenshot' },
                                    { id: 'ipAccess', label: 'IP Access', hasData: !!capturedIpAccessScreenshot, icon: '🚫', type: 'ip-access-rules', path: '/security/security-rules', setter: setCapturedIpAccessScreenshot, key: 'control_capturedIpAccessScreenshot' },
                                    { id: 'zoneLockdown', label: 'Zone Lockdown', hasData: !!capturedZoneLockdownScreenshot, icon: '🔐', type: 'zone-lockdown', path: '/security/security-rules', setter: setCapturedZoneLockdownScreenshot, key: 'control_capturedZoneLockdownScreenshot' },
                                    { id: 'argo', label: 'Argo Smart', hasData: !!capturedArgoScreenshot, icon: '⚡', type: 'argo', path: '/traffic', setter: setCapturedArgoScreenshot, key: 'control_capturedArgoScreenshot' },
                                    { id: 'speed', label: 'Speed Test', hasData: !!(capturedSpeedScreenshot || capturedSpeedMobileScreenshot), icon: '🚀', type: 'speed', path: '/speed/test/browser', setter: setCapturedSpeedScreenshot, key: 'control_capturedSpeedScreenshot' }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveCaptureTab(tab.id)}
                                        className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all text-left flex items-center gap-1.5 border w-full cursor-pointer ${
                                            activeCaptureTab === tab.id
                                                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                                                : 'bg-gray-900/40 border-gray-800/80 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                                        }`}
                                    >
                                        <span>{tab.icon}</span>
                                        <span className="truncate">{tab.label}</span>
                                        {tab.hasData && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-auto shrink-0"></span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Tab contents (Right) */}
                            <div className="flex-1 flex flex-col min-w-0">
                                {/* Current Crop Coordinates display */}
                                {coords[activeCaptureTab] && (
                                    <div className="text-[9px] font-mono text-gray-400 bg-gray-900/60 px-2.5 py-1.5 rounded-lg border border-gray-800/80 mb-3 flex items-center justify-between">
                                        <span className="text-gray-500">Crop Coordinates:</span>
                                        <span>X: {coords[activeCaptureTab].xStart || 'Auto'} → {coords[activeCaptureTab].xEnd || 'Auto'} | Y: {coords[activeCaptureTab].yStart || 'Auto'} → {coords[activeCaptureTab].yEnd || 'Auto'}</span>
                                    </div>
                                )}

                                {/* Generic function to render preview with capture button */}
                                {(() => {
                                    const tabMap = {
                                        domains: { label: 'Domains Overview', img: capturedScreenshot, type: 'domains', path: 'domains', setter: setCapturedScreenshot, key: 'control_capturedScreenshot' },
                                        dns: { label: 'DNS Records', img: capturedDnsScreenshot, type: 'dns', path: '/dns/records', setter: setCapturedDnsScreenshot, key: 'control_capturedDnsScreenshot', isArray: true },
                                        botManagement: { label: 'Bot Management', img: capturedBotManagementScreenshot, type: 'bot-management', path: '/security/settings', setter: setCapturedBotManagementScreenshot, key: 'control_capturedBotManagementScreenshot' },
                                        securityLevel: { label: 'Security Level & BIC', img: capturedSecurityLevelScreenshot, type: 'security-level', path: '/security/settings', setter: setCapturedSecurityLevelScreenshot, key: 'control_capturedSecurityLevelScreenshot' },
                                        sslOverview: { label: 'SSL/TLS Encryption', img: capturedSslOverviewScreenshot, type: 'ssl-overview', path: '/ssl-tls', setter: setCapturedSslOverviewScreenshot, key: 'control_capturedSslOverviewScreenshot' },
                                        sslEdge: { label: 'Edge Certificates (TLS 1.2/1.3)', img: capturedSslEdgeScreenshot, type: 'ssl-edge', path: '/ssl-tls/edge-certificates', setter: setCapturedSslEdgeScreenshot, key: 'control_capturedSslEdgeScreenshot' },
                                        traffic: { label: 'HTTP Traffic Overview', img: capturedHttpTrafficScreenshot, type: 'traffic', path: '/analytics/traffic', setter: setCapturedHttpTrafficScreenshot, key: 'control_capturedHttpTrafficScreenshot' },
                                        trafficCountries: { label: 'Traffic by Country', img: capturedTrafficCountriesScreenshot, type: 'traffic-countries', path: '/analytics/traffic', setter: setCapturedTrafficCountriesScreenshot, key: 'control_capturedTrafficCountriesScreenshot' },
                                        firewall: { label: 'Firewall Overview', img: capturedFirewallScreenshot, type: 'firewall', path: '/security/analytics/events', setter: setCapturedFirewallScreenshot, key: 'control_capturedFirewallScreenshot' },
                                        topEventsSource: { label: 'Top Events by Source', img: capturedTopEventsSourceScreenshot, type: 'top-events-source', path: '/security/analytics/events', setter: setCapturedTopEventsSourceScreenshot, key: 'control_capturedTopEventsSourceScreenshot' },
                                        securityRules: { label: 'Security Custom Rules', img: capturedSecurityRulesScreenshot, type: 'security-rules', path: '/security/security-rules', setter: setCapturedSecurityRulesScreenshot, key: 'control_capturedSecurityRulesScreenshot' },
                                        rateLimiting: { label: 'Rate Limiting Rules', img: capturedRateLimitingScreenshot, type: 'rate-limiting', path: '/security/security-rules', setter: setCapturedRateLimitingScreenshot, key: 'control_capturedRateLimitingScreenshot' },
                                        managedRules: { label: 'Managed WAF Rules', img: capturedManagedRulesScreenshot, type: 'managed-rules', path: '/security/security-rules', setter: setCapturedManagedRulesScreenshot, key: 'control_capturedManagedRulesScreenshot' },
                                        ipAccess: { label: 'IP Access Rules', img: capturedIpAccessScreenshot, type: 'ip-access-rules', path: '/security/security-rules', setter: setCapturedIpAccessScreenshot, key: 'control_capturedIpAccessScreenshot' },
                                        zoneLockdown: { label: 'Zone Lockdown Rules', img: capturedZoneLockdownScreenshot, type: 'zone-lockdown', path: '/security/security-rules', setter: setCapturedZoneLockdownScreenshot, key: 'control_capturedZoneLockdownScreenshot' },
                                        argo: { label: 'Argo Smart Routing', img: capturedArgoScreenshot, type: 'argo', path: '/traffic', setter: setCapturedArgoScreenshot, key: 'control_capturedArgoScreenshot' },
                                        speed: { label: 'Speed Test Results', img: capturedSpeedScreenshot, type: 'speed', path: '/speed/test/browser', setter: setCapturedSpeedScreenshot, key: 'control_capturedSpeedScreenshot' }
                                    };

                                    const current = tabMap[activeCaptureTab];
                                    if (!current) return null;

                                    return (
                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800/60 pb-2.5">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-bold text-gray-200">{current.label}</span>
                                                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-400">
                                                        <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                                        {captureMeta[activeCaptureTab]?.capturedAt ? (
                                                            <span>
                                                                แคปล่าสุด: <strong className="text-gray-200 font-semibold">{new Date(captureMeta[activeCaptureTab].capturedAt).toLocaleString('th-TH')}</strong> โดย <strong className="text-rose-300">@{captureMeta[activeCaptureTab].capturedBy || 'root'}</strong>
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-500 italic">ยังไม่มีประวัติการแคป</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={isCapturingDirect}
                                                    onClick={() => handleDirectCapture(activeCaptureTab, current.type, current.setter, current.key, current.path)}
                                                    className={`px-3 py-1.5 bg-rose-600/25 hover:bg-rose-600/40 border border-rose-500/50 text-rose-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md self-start sm:self-auto ${
                                                        isCapturingDirect ? 'opacity-60 cursor-not-allowed' : ''
                                                    }`}
                                                >
                                                    {isCapturingDirect ? (
                                                        <>
                                                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                                                            <span>Capturing...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>📸 Capture This Page Now</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            {current.img ? (
                                                current.isArray && Array.isArray(current.img) ? (
                                                    <div className="flex flex-col gap-2">
                                                        {current.img.map((imgSrc, idx) => (
                                                            <div key={idx} className="rounded-xl border border-gray-800/80 bg-black flex items-center justify-center p-2 overflow-hidden group relative">
                                                                <img src={imgSrc} className="max-w-full rounded h-auto max-h-[280px] object-contain transition-transform group-hover:scale-[1.02] duration-300" alt={`${current.label} - Page ${idx + 1}`} />
                                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                                                                    <button type="button" onClick={() => openImageInNewTab(imgSrc)} className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-bold hover:bg-rose-700 transition-colors">
                                                                        View Full Image
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="rounded-xl border border-gray-800/80 bg-black flex items-center justify-center p-2 overflow-hidden group relative">
                                                        <img src={current.img} className="max-w-full rounded h-auto max-h-[280px] object-contain transition-transform group-hover:scale-[1.02] duration-300" alt={current.label} />
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                                                            <button type="button" onClick={() => openImageInNewTab(current.img)} className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-bold hover:bg-rose-700 transition-colors">
                                                                View Full Image
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            ) : (
                                                <div className="py-12 text-center text-xs text-gray-500 font-mono bg-gray-900/30 rounded-xl border border-gray-800/50">
                                                    No {current.label} captured yet. Click "Capture This Page Now" to capture.
                                                </div>
                                            )}

                                            {/* Crop Coordinates Controls directly under the screenshot image */}
                                            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3.5 flex flex-col gap-2.5">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-300">
                                                        <span>✂️</span>
                                                        <span>Crop Coordinates ({current.label})</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={pullFromImageSizeSettings}
                                                            className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-[10px] font-semibold rounded transition-colors cursor-pointer flex items-center gap-1"
                                                            title="ดึงค่าจาก Image Size Setting"
                                                        >
                                                            📥 ดึงจาก Image Size
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={saveCoordsToDatabase}
                                                            className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white text-[11px] font-semibold rounded transition-colors cursor-pointer shadow-sm"
                                                        >
                                                            💾 Save to DB
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Quick Options for HTTP Traffic and Traffic Countries */}
                                                {(activeCaptureTab === 'traffic' || activeCaptureTab === 'trafficCountries') && (
                                                    <div className="flex flex-col gap-2 p-2.5 bg-gray-950/70 rounded-lg border border-gray-800/80 my-1">
                                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                                            <span className="text-gray-400 font-bold min-w-[85px]">Quick Options:</span>
                                                            <button type="button" onClick={() => setTrafficTimeWindow('1440')} className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors cursor-pointer ${trafficTimeWindow === '1440' ? 'bg-rose-600 text-white border-rose-500 shadow-sm' : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-700'}`}>1 Day</button>
                                                            <button type="button" onClick={() => setTrafficTimeWindow('10080')} className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors cursor-pointer ${trafficTimeWindow === '10080' ? 'bg-rose-600 text-white border-rose-500 shadow-sm' : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-700'}`}>7 Days</button>
                                                            <button type="button" onClick={() => setTrafficTimeWindow('43200')} className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors cursor-pointer ${trafficTimeWindow === '43200' ? 'bg-rose-600 text-white border-rose-500 shadow-sm' : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-700'}`}>30 Days</button>
                                                            <button type="button" onClick={() => setTrafficTimeWindow('custom')} className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors cursor-pointer ${trafficTimeWindow === 'custom' ? 'bg-rose-600 text-white border-rose-500 shadow-sm' : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-700'}`}>Custom</button>
                                                        </div>
                                                        {trafficTimeWindow === 'custom' && (
                                                            <div className="flex flex-wrap items-center gap-2 text-xs mt-1">
                                                                <span className="text-gray-400 font-bold min-w-[85px]">Date Range:</span>
                                                                <input type="datetime-local" value={trafficStartDate} onChange={(e) => setTrafficStartDate(e.target.value)} className="bg-gray-900 border border-gray-800 text-gray-200 rounded px-2 py-1 text-xs" />
                                                                <span className="text-gray-500 font-bold px-1">to</span>
                                                                <input type="datetime-local" value={trafficEndDate} onChange={(e) => setTrafficEndDate(e.target.value)} className="bg-gray-900 border border-gray-800 text-gray-200 rounded px-2 py-1 text-xs" />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] text-gray-400 font-mono font-medium">Xstart</span>
                                                        <input
                                                            type="number"
                                                            placeholder="Auto"
                                                            value={coords[activeCaptureTab]?.xStart || ''}
                                                            onChange={(e) => handleCoordChange(activeCaptureTab, 'xStart', e.target.value)}
                                                            className="bg-gray-950/90 border border-gray-800 rounded px-2.5 py-1 text-xs text-gray-200 focus:outline-none focus:border-rose-500/50 transition-colors w-full font-mono"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] text-gray-400 font-mono font-medium">Xend</span>
                                                        <input
                                                            type="number"
                                                            placeholder="Auto"
                                                            value={coords[activeCaptureTab]?.xEnd || ''}
                                                            onChange={(e) => handleCoordChange(activeCaptureTab, 'xEnd', e.target.value)}
                                                            className="bg-gray-950/90 border border-gray-800 rounded px-2.5 py-1 text-xs text-gray-200 focus:outline-none focus:border-rose-500/50 transition-colors w-full font-mono"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] text-gray-400 font-mono font-medium">Ystart</span>
                                                        <input
                                                            type="number"
                                                            placeholder="Auto"
                                                            value={coords[activeCaptureTab]?.yStart || ''}
                                                            onChange={(e) => handleCoordChange(activeCaptureTab, 'yStart', e.target.value)}
                                                            className="bg-gray-950/90 border border-gray-800 rounded px-2.5 py-1 text-xs text-gray-200 focus:outline-none focus:border-rose-500/50 transition-colors w-full font-mono"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] text-gray-400 font-mono font-medium">Yend</span>
                                                        <input
                                                            type="text"
                                                            placeholder="Auto"
                                                            value={coords[activeCaptureTab]?.yEnd || ''}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (/^-?\d*$/.test(val)) {
                                                                    handleCoordChange(activeCaptureTab, 'yEnd', val);
                                                                }
                                                            }}
                                                            className="bg-gray-950/90 border border-gray-800 rounded px-2.5 py-1 text-xs text-gray-200 focus:outline-none focus:border-rose-500/50 transition-colors w-full font-mono"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="text-[10px] text-gray-500 font-sans pt-1">
                                                    {activeCaptureTab === 'domains' || activeCaptureTab === 'dns'
                                                        ? '* Yend: ค่าลบ = หักขึ้นบน (เช่น -250), ค่าบวก = ยืดลงล่าง, ว่าง = Auto | ปรับพิกัดแล้วกดปุ่ม "Capture This Page Now" ด้านบน'
                                                        : '* ความละเอียดมาตรฐาน 1920x1080 (Chrome Live Monitor) | ปรับพิกัดแล้วกดปุ่ม "Capture This Page Now" ด้านบน'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Console Log Section (Right) */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    {/* Console / Log output */}
                    <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex flex-col h-[460px] shadow-2xl relative">
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
                        <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2.5 pr-1">
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
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 border border-rose-500/30 rounded-lg text-[10px] font-bold text-white transition-colors shadow-md"
                            >
                                <Check className="w-3.5 h-3.5 text-white" />
                                Set as Default
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
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

                    {/* Step 1: Launch Debug Browser Card */}
                    <div className="bg-gradient-to-br from-gray-900/60 to-gray-950/80 border border-gray-800/80 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
                        <div className="flex items-center justify-between border-b border-gray-800/40 pb-3">
                            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                                <Chrome className="w-4 h-4 text-rose-500" />
                                Step 1: Launch Debug Browser
                            </h3>
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                                stepStatus[0] === 'completed'
                                    ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30'
                                    : stepStatus[0] === 'running'
                                    ? 'bg-rose-950/50 text-rose-400 border-rose-500/30 animate-pulse'
                                    : 'bg-gray-900 text-gray-400 border-gray-800'
                            }`}>
                                {stepStatus[0] === 'completed' ? '● Connected' : stepStatus[0] === 'running' ? '● Launching...' : '● Ready'}
                            </span>
                        </div>
                        
                        <p className="text-xs text-gray-400 leading-relaxed">
                            เปิดหน้าต่าง Cloudflare Login บน Remote Debugging Browser (พอร์ต 9222) เพื่อให้สามารถล็อกอินหรือเข้าสู่ระบบจัดการ Cloudflare ได้โดยตรงผ่าน Live Browser Monitor
                        </p>

                        <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] font-mono text-gray-500">
                                Target: dash.cloudflare.com
                            </span>
                            <button
                                type="button"
                                disabled={!mounted || stepStatus[0] === 'running'}
                                onClick={() => runStep(0)}
                                className={`flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-rose-900/30 cursor-pointer ${
                                    stepStatus[0] === 'running' ? 'opacity-60 cursor-not-allowed' : ''
                                }`}
                            >
                                {stepStatus[0] === 'running' ? (
                                    <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        Launching Browser...
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-3.5 h-3.5 fill-current" />
                                        Launch / Go to Login
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
