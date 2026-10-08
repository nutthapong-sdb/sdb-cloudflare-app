'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
    CheckCircle, Play, ArrowLeft, RefreshCw, Terminal, 
    Layers, Settings, ShieldAlert, Cpu, Activity, Clock, Check, Chrome,
    Camera, Image as ImageIcon, Sparkles, Download, Upload, Sliders,
    Plus, Trash2, Edit3, Save, UserCheck, ShieldCheck, FileJson, FolderPlus
} from 'lucide-react';
import Swal from '../utils/alert';
import { Editor } from '@tinymce/tinymce-react';
import { REPORT_VARIABLES, STATIC_VARIABLES } from '../variableDefinitions';
import { getInappPreviewHtml } from '../utils/inappTemplates';
import { UPLOADED_SLOTS } from '../utils/uploadedVariables';
import { DELAY_CONFIG } from '@/lib/delay-config';
import { auth } from '@/app/utils/auth';
import { getUserProfileAction } from '@/app/actions/authActions';
import SearchableDropdown from '../SearchableDropdown';

const safeSetItem = (key, val) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, val);
    } catch (e) {
        console.warn(`[safeSetItem] Storage quota exceeded or unavailable for key "${key}":`, e.message);
    }
};

export default function ControlPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [stepStatus, setStepStatus] = useState(Array(2).fill('pending')); // 'pending' | 'running' | 'completed'
    const [activeStep, setActiveStep] = useState(0);
    const [logs, setLogs] = useState([]);
    const [activeCaptureTab, setActiveCaptureTab] = useState('domains');
    // Top-level page section: 'setup' (environment + launch debug browser), 'capture'
    // (live monitor + captured/inapp/uploaded preview), 'console' (debug log). Splits what used
    // to be one very long two-column scroll into three focused views.
    const [activeMainTab, setActiveMainTab] = useState('setup');
    const MAIN_TAB_STORAGE_KEY = 'ntbc_control_activeMainTab';
    const MAIN_TAB_IDS = ['setup', 'capture', 'console'];
    // Remember which section the user last opened. Restored after mount (not in the useState
    // initializer) so the server-rendered HTML and the first client render still match.
    useEffect(() => {
        try {
            const saved = localStorage.getItem(MAIN_TAB_STORAGE_KEY);
            if (saved && MAIN_TAB_IDS.includes(saved)) setActiveMainTab(saved);
        } catch (e) { /* localStorage unavailable (private mode etc.) - keep default */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const selectMainTab = (tabId) => {
        setActiveMainTab(tabId);
        try { localStorage.setItem(MAIN_TAB_STORAGE_KEY, tabId); } catch (e) { /* ignore */ }
    };
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
    const [vncRestartKey, setVncRestartKey] = useState(0);
    const [isRestartingVnc, setIsRestartingVnc] = useState(false);
     const [accounts, setAccounts] = useState([]);
     const [zones, setZones] = useState([]);
     const [subdomains, setSubdomains] = useState([]);

     // Preset & JSON Export/Import States
     const [presets, setPresets] = useState([]);
     const [activePresetId, setActivePresetId] = useState('default');
     const [isLoadingPresets, setIsLoadingPresets] = useState(false);
     const jsonImportInputRef = useRef(null);
 
     // Environment Selection States
     const [envAccount, setEnvAccount] = useState('');
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
     const [capturedMinTlsVersionScreenshot, setCapturedMinTlsVersionScreenshot] = useState(null);
     const [capturedTls13Screenshot, setCapturedTls13Screenshot] = useState(null);
     const [capturedBrowserIntegrityScreenshot, setCapturedBrowserIntegrityScreenshot] = useState(null);
     const [capturedLoadBalancingSpectrumScreenshot, setCapturedLoadBalancingSpectrumScreenshot] = useState(null);
     const [capturedRateLimitingScreenshot, setCapturedRateLimitingScreenshot] = useState(null);
     const [capturedManagedRulesScreenshot, setCapturedManagedRulesScreenshot] = useState(null);
     const [capturedIpAccessScreenshot, setCapturedIpAccessScreenshot] = useState(null);
     const [capturedZoneLockdownScreenshot, setCapturedZoneLockdownScreenshot] = useState(null);
     const [capturedTrafficCountriesScreenshot, setCapturedTrafficCountriesScreenshot] = useState(null);
     const [capturedTopEventsSourceScreenshot, setCapturedTopEventsSourceScreenshot] = useState(null);
     const [captureMeta, setCaptureMeta] = useState({});
     const [isCapturingDirect, setIsCapturingDirect] = useState(false);
     // 'screenshot' shows the real captured image; 'inapp' shows the app-generated @inapp_* table preview
     const [capturePreviewMode, setCapturePreviewMode] = useState('screenshot');
    const [uploadedImages, setUploadedImages] = useState({});
    const [uploadingImageId, setUploadingImageId] = useState(null);
    const [uploadImageError, setUploadImageError] = useState(null);
     const [inappZoneSettings, setInappZoneSettings] = useState(null);
     const [isLoadingInappPreview, setIsLoadingInappPreview] = useState(false);
     const [inappLoadBalancers, setInappLoadBalancers] = useState(null);
     const [inappSpeedResult, setInappSpeedResult] = useState(null);
     const [inappTrafficData, setInappTrafficData] = useState(null);
    const [inappDnsRecords, setInappDnsRecords] = useState(null);
     const [isCapturingAll, setIsCapturingAll] = useState(false);
     const [captureAllStatus, setCaptureAllStatus] = useState({ current: 0, total: 21, currentLabel: '' });
     const abortCaptureAllRef = useRef(false);

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
         domains: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         dns: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         traffic: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         firewall: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         securityRules: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         argo: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         speed: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         speedMobile: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         botManagement: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         securityLevel: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         sslOverview: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         sslEdge: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         minTlsVersion: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         tls13: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         browserIntegrity: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         loadBalancingSpectrum: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         rateLimiting: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         managedRules: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         ipAccess: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         zoneLockdown: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         trafficCountries: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
         topEventsSource: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' }
     });

    const DEFAULT_ZERO_COORDS = {
        domains: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        dns: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        traffic: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        firewall: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        securityRules: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        argo: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        speed: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        speedMobile: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        botManagement: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        securityLevel: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        sslOverview: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        sslEdge: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        minTlsVersion: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        tls13: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        browserIntegrity: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        loadBalancingSpectrum: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        rateLimiting: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        managedRules: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        ipAccess: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        zoneLockdown: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        trafficCountries: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
        topEventsSource: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' }
    };

    const fetchPresets = useCallback(async () => {
        try {
            setIsLoadingPresets(true);
            const res = await fetch('/api/ntbc-capture-presets');
            const data = await res.json();
            if (data.success && Array.isArray(data.presets)) {
                setPresets(data.presets);
            }
        } catch (e) {
            console.error('Failed to fetch capture presets:', e);
        } finally {
            setIsLoadingPresets(false);
        }
    }, []);

    const activePreset = presets.find(p => p.id === activePresetId) || null;
    const isOwnerOrAdmin = Boolean(
        currentUser && (
            currentUser.role === 'admin' || 
            currentUser.role === 'root' || 
            (activePreset && (activePreset.createdBy === currentUser.username || (currentUser.id && activePreset.createdById === currentUser.id)))
        )
    );

    const handleSelectPreset = (presetId) => {
        if (presetId === 'default') {
            setCoords(DEFAULT_ZERO_COORDS);
            setActivePresetId('default');
            if (typeof window !== 'undefined') {
                localStorage.setItem('control_activePresetId', 'default');
            }
            Swal.fire({
                icon: 'info',
                title: 'คืนค่าพิกัดเริ่มต้น (Auto +0)',
                text: 'โหลดพิกัดเริ่มต้นเรียบร้อยแล้ว',
                timer: 1500,
                showConfirmButton: false,
                background: '#111827',
                color: '#fff'
            });
            return;
        }

        const targetPreset = presets.find(p => p.id === presetId);
        if (targetPreset && targetPreset.coords) {
            setCoords(targetPreset.coords);
            setActivePresetId(presetId);
            if (typeof window !== 'undefined') {
                localStorage.setItem('control_activePresetId', presetId);
            }
            Swal.fire({
                icon: 'success',
                title: 'โหลด Preset สำเร็จ!',
                text: `ใช้การตั้งค่าพิกัดจาก Preset: "${targetPreset.name}"`,
                timer: 1500,
                showConfirmButton: false,
                background: '#111827',
                color: '#fff'
            });
        }
    };

    const handleSaveAsNewPreset = async () => {
        const { value: presetName } = await Swal.fire({
            title: '💾 บันทึกเป็น Preset ใหม่',
            input: 'text',
            inputLabel: 'ตั้งชื่อ Preset สำหรับพิกัดปัจจุบัน',
            inputPlaceholder: 'เช่น NTBC Standard 1080p, High DNS Table...',
            showCancelButton: true,
            confirmButtonText: 'บันทึก Preset',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#e11d48',
            background: '#111827',
            color: '#fff',
            inputValidator: (val) => {
                if (!val || !val.trim()) {
                    return 'กรุณากรอกชื่อ Preset';
                }
            }
        });

        if (!presetName) return;

        try {
            const user = currentUser || auth.getCurrentUser() || { username: 'root', role: 'admin' };
            const res = await fetch('/api/ntbc-capture-presets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: presetName.trim(),
                    coords,
                    user
                })
            });
            const data = await res.json();
            if (data.success && data.preset) {
                await fetchPresets();
                setActivePresetId(data.preset.id);
                if (typeof window !== 'undefined') {
                    localStorage.setItem('control_activePresetId', data.preset.id);
                }
                Swal.fire({
                    icon: 'success',
                    title: 'บันทึก Preset สำเร็จ!',
                    text: `Preset "${data.preset.name}" ถูกสร้างและเปิดใช้งานแล้ว`,
                    timer: 2000,
                    showConfirmButton: false,
                    background: '#111827',
                    color: '#fff'
                });
            } else {
                throw new Error(data.error || 'Failed to create preset');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Error', err.message || 'เกิดข้อผิดพลาดในการบันทึก Preset', 'error');
        }
    };

    const handleUpdatePreset = async () => {
        if (!activePreset || activePresetId === 'default') {
            return handleSaveAsNewPreset();
        }

        if (!isOwnerOrAdmin) {
            Swal.fire({
                icon: 'warning',
                title: 'ไม่มีสิทธิ์ดำเนินการ',
                text: `คุณไม่มีสิทธิ์แก้ไข Preset "${activePreset.name}" (เฉพาะผู้สร้าง @${activePreset.createdBy} หรือ Admin เท่านั้นที่มีสิทธิ์ดำเนินการ)`,
                background: '#111827',
                color: '#fff'
            });
            return;
        }

        const result = await Swal.fire({
            title: 'ยืนยันบันทึกทับ Preset?',
            text: `ต้องการบันทึกพิกัดปัจจุบันทับลงใน Preset "${activePreset.name}" ใช่หรือไม่?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'บันทึกทับ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#e11d48',
            background: '#111827',
            color: '#fff'
        });

        if (!result.isConfirmed) return;

        try {
            const user = currentUser || auth.getCurrentUser();
            const res = await fetch('/api/ntbc-capture-presets', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: activePreset.id,
                    coords,
                    user
                })
            });
            const data = await res.json();
            if (data.success) {
                await fetchPresets();
                Swal.fire({
                    icon: 'success',
                    title: 'อัปเดต Preset สำเร็จ!',
                    text: `บันทึกพิกัดลงใน Preset "${activePreset.name}" เรียบร้อยแล้ว`,
                    timer: 1800,
                    showConfirmButton: false,
                    background: '#111827',
                    color: '#fff'
                });
            } else {
                throw new Error(data.error || 'Failed to update preset');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Error', err.message || 'เกิดข้อผิดพลาดในการอัปเดต Preset', 'error');
        }
    };

    const handleRenamePreset = async () => {
        if (!activePreset || activePresetId === 'default') return;

        if (!isOwnerOrAdmin) {
            Swal.fire({
                icon: 'warning',
                title: 'ไม่มีสิทธิ์ดำเนินการ',
                text: `คุณไม่มีสิทธิ์เปลี่ยนชื่อ Preset "${activePreset.name}" (เฉพาะผู้สร้าง @${activePreset.createdBy} หรือ Admin เท่านั้นที่มีสิทธิ์ดำเนินการ)`,
                background: '#111827',
                color: '#fff'
            });
            return;
        }

        const { value: newName } = await Swal.fire({
            title: '✏️ เปลี่ยนชื่อ Preset',
            input: 'text',
            inputValue: activePreset.name,
            inputPlaceholder: 'กรอกชื่อ Preset ใหม่...',
            showCancelButton: true,
            confirmButtonText: 'บันทึกชื่อใหม่',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#e11d48',
            background: '#111827',
            color: '#fff',
            inputValidator: (val) => {
                if (!val || !val.trim()) {
                    return 'กรุณากรอกชื่อ Preset';
                }
            }
        });

        if (!newName || newName.trim() === activePreset.name) return;

        try {
            const user = currentUser || auth.getCurrentUser();
            const res = await fetch('/api/ntbc-capture-presets', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: activePreset.id,
                    name: newName.trim(),
                    user
                })
            });
            const data = await res.json();
            if (data.success) {
                await fetchPresets();
                Swal.fire({
                    icon: 'success',
                    title: 'เปลี่ยนชื่อสำเร็จ!',
                    text: `เปลี่ยนชื่อเป็น "${newName.trim()}" เรียบร้อยแล้ว`,
                    timer: 1500,
                    showConfirmButton: false,
                    background: '#111827',
                    color: '#fff'
                });
            } else {
                throw new Error(data.error || 'Failed to rename preset');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Error', err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนชื่อ Preset', 'error');
        }
    };

    const handleDeletePreset = async () => {
        if (!activePreset || activePresetId === 'default') return;

        if (!isOwnerOrAdmin) {
            Swal.fire({
                icon: 'warning',
                title: 'ไม่มีสิทธิ์ดำเนินการ',
                text: `คุณไม่มีสิทธิ์ลบ Preset "${activePreset.name}" (เฉพาะผู้สร้าง @${activePreset.createdBy} หรือ Admin เท่านั้นที่มีสิทธิ์ดำเนินการ)`,
                background: '#111827',
                color: '#fff'
            });
            return;
        }

        const result = await Swal.fire({
            title: 'ยืนยันการลบ Preset?',
            text: `ต้องการลบ Preset "${activePreset.name}" หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ลบ Preset',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#e11d48',
            background: '#111827',
            color: '#fff'
        });

        if (!result.isConfirmed) return;

        try {
            const user = currentUser || auth.getCurrentUser();
            const query = new URLSearchParams({
                id: activePreset.id,
                username: user?.username || '',
                role: user?.role || '',
                userId: user?.id ? String(user.id) : ''
            });
            const res = await fetch(`/api/ntbc-capture-presets?${query.toString()}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                await fetchPresets();
                handleSelectPreset('default');
                Swal.fire({
                    icon: 'success',
                    title: 'ลบ Preset สำเร็จ!',
                    text: `Preset "${activePreset.name}" ถูกลบเรียบร้อยแล้ว`,
                    timer: 1800,
                    showConfirmButton: false,
                    background: '#111827',
                    color: '#fff'
                });
            } else {
                throw new Error(data.error || 'Failed to delete preset');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Error', err.message || 'เกิดข้อผิดพลาดในการลบ Preset', 'error');
        }
    };

    const handleExportJson = () => {
        try {
            const exportData = {
                appName: "SDB NTBC Cloudflare Automated Report Generator",
                version: "1.1",
                type: "ntbc_capture_preset",
                presetName: activePreset?.name || "Capture Coordinates Preset",
                exportedAt: new Date().toISOString(),
                exportedBy: currentUser?.username || 'root',
                coords: coords
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const filenameSafe = (activePreset?.name || 'capture_coords').replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, '_');
            a.download = `ntbc_coords_${filenameSafe}_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            Swal.fire({
                icon: 'success',
                title: 'Export JSON สำเร็จ!',
                text: `ดาวน์โหลดไฟล์ ${a.download} เรียบร้อยแล้ว`,
                timer: 1800,
                showConfirmButton: false,
                background: '#111827',
                color: '#fff'
            });
        } catch (err) {
            console.error('Export JSON failed:', err);
            Swal.fire('Error', 'เกิดข้อผิดพลาดในการ Export JSON', 'error');
        }
    };

    const handleImportJson = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            let parsed;
            try {
                parsed = JSON.parse(text);
            } catch (jsonErr) {
                throw new Error('รูปแบบไฟล์ JSON ไม่ถูกต้อง');
            }

            const importedCoords = parsed.coords || (parsed.domains ? parsed : null);
            if (!importedCoords || typeof importedCoords !== 'object') {
                throw new Error('ไม่พบข้อมูลพิกัด (Coordinates) ที่ถูกต้องในไฟล์ JSON');
            }

            // Clean imported coordinates to ensure valid object format
            const sanitizedCoords = { ...coords };
            Object.keys(importedCoords).forEach(key => {
                if (typeof importedCoords[key] === 'object' && importedCoords[key] !== null) {
                    sanitizedCoords[key] = {
                        xStart: String(importedCoords[key].xStart ?? '0'),
                        xEnd: String(importedCoords[key].xEnd ?? '0'),
                        yStart: String(importedCoords[key].yStart ?? '0'),
                        yEnd: String(importedCoords[key].yEnd ?? '0')
                    };
                }
            });

            const suggestedPresetName = parsed.presetName || file.name.replace(/\.json$/i, '') || 'Imported Preset';

            const result = await Swal.fire({
                title: '📥 นำเข้าพิกัดจากไฟล์ JSON',
                html: `
                    <div style="text-align:left; font-size:13px; color:#cbd5e1;">
                        <p class="mb-2">พบการตั้งค่าพิกัดในไฟล์: <strong>${file.name}</strong></p>
                        <p class="mb-2 text-rose-400">เลือกวิธีการนำข้อมูลไปใช้งาน:</p>
                    </div>
                `,
                icon: 'question',
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: '⚡ นำมาใช้ทันที (Apply)',
                denyButtonText: '💾 บันทึกเป็น Preset ใหม่',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#2563eb',
                denyButtonColor: '#e11d48',
                background: '#111827',
                color: '#fff'
            });

            if (result.isConfirmed) {
                // Apply directly
                setCoords(sanitizedCoords);
                await fetch('/api/ntbc-capture-coords', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sanitizedCoords)
                });
                Swal.fire({
                    icon: 'success',
                    title: 'นำเข้าสำเร็จ!',
                    text: 'นำเข้าพิกัดและนำมาใช้งานทันทีเรียบร้อยแล้ว',
                    timer: 1800,
                    showConfirmButton: false,
                    background: '#111827',
                    color: '#fff'
                });
            } else if (result.isDenied) {
                // Save as new preset
                const { value: newPresetName } = await Swal.fire({
                    title: 'ตั้งชื่อ Preset สำหรับไฟล์ที่นำเข้า',
                    input: 'text',
                    inputValue: suggestedPresetName,
                    showCancelButton: true,
                    confirmButtonText: 'บันทึก Preset',
                    cancelButtonText: 'ยกเลิก',
                    confirmButtonColor: '#e11d48',
                    background: '#111827',
                    color: '#fff',
                    inputValidator: (val) => {
                        if (!val || !val.trim()) return 'กรุณากรอกชื่อ Preset';
                    }
                });

                if (!newPresetName) return;

                const user = currentUser || auth.getCurrentUser() || { username: 'root', role: 'admin' };
                const res = await fetch('/api/ntbc-capture-presets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: newPresetName.trim(),
                        coords: sanitizedCoords,
                        user
                    })
                });
                const data = await res.json();
                if (data.success && data.preset) {
                    setCoords(sanitizedCoords);
                    await fetchPresets();
                    setActivePresetId(data.preset.id);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('control_activePresetId', data.preset.id);
                    }
                    Swal.fire({
                        icon: 'success',
                        title: 'บันทึก Preset สำเร็จ!',
                        text: `นำเข้าและสร้าง Preset "${data.preset.name}" เรียบร้อยแล้ว`,
                        timer: 2000,
                        showConfirmButton: false,
                        background: '#111827',
                        color: '#fff'
                    });
                } else {
                    throw new Error(data.error || 'Failed to save preset');
                }
            }
        } catch (err) {
            console.error('Import JSON error:', err);
            Swal.fire('Error', err.message || 'เกิดข้อผิดพลาดในการนำเข้าไฟล์ JSON', 'error');
        } finally {
            if (e.target) e.target.value = '';
        }
    };



    const getCaptureUrl = (typeKey, typeValue) => {
        const targetDomain = zones.find(z => z.id === envZone)?.name || (typeKey === 'domains' ? 'overview' : null);
        let url = `/api/ntbc-capture?type=${typeValue}`;
        if (envAccount) url += `&account=${encodeURIComponent(envAccount)}`;
        if (targetDomain && targetDomain !== 'overview') {
            url += `&zone=${encodeURIComponent(targetDomain)}&domain=${encodeURIComponent(targetDomain)}&siteName=${encodeURIComponent(targetDomain)}`;
        }
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
                          <span className="text-[10px] text-cyan-400 font-mono font-medium">Xstart (Offset)</span>
                          <input 
                              type="text"
                              placeholder="0"
                              value={coords[key]?.xStart ?? '0'}
                              onChange={(e) => {
                                  const val = e.target.value;
                                  if (/^-?\d*$/.test(val)) {
                                      handleCoordChange(key, 'xStart', val);
                                  }
                              }}
                              className="bg-gray-950/80 border border-cyan-800/40 rounded px-2 py-1 text-xs text-cyan-200 focus:outline-none focus:border-cyan-500/50 transition-colors w-full font-mono"
                          />
                      </div>
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-cyan-400 font-mono font-medium">Xend (Offset)</span>
                          <input 
                              type="text"
                              placeholder="0"
                              value={coords[key]?.xEnd ?? '0'}
                              onChange={(e) => {
                                  const val = e.target.value;
                                  if (/^-?\d*$/.test(val)) {
                                      handleCoordChange(key, 'xEnd', val);
                                  }
                              }}
                              className="bg-gray-950/80 border border-cyan-800/40 rounded px-2 py-1 text-xs text-cyan-200 focus:outline-none focus:border-cyan-500/50 transition-colors w-full font-mono"
                          />
                      </div>
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-cyan-400 font-mono font-medium">Ystart (Offset)</span>
                          <input 
                              type="text"
                              placeholder="0"
                              value={coords[key]?.yStart ?? '0'}
                              onChange={(e) => {
                                  const val = e.target.value;
                                  if (/^-?\d*$/.test(val)) {
                                      handleCoordChange(key, 'yStart', val);
                                  }
                              }}
                              className="bg-gray-950/80 border border-cyan-800/40 rounded px-2 py-1 text-xs text-cyan-200 focus:outline-none focus:border-cyan-500/50 transition-colors w-full font-mono"
                          />
                      </div>
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-cyan-400 font-mono font-medium">Yend (Offset)</span>
                          <input 
                              type="text"
                              placeholder="0"
                              value={coords[key]?.yEnd ?? '0'}
                              onChange={(e) => {
                                  const val = e.target.value;
                                  if (/^-?\d*$/.test(val)) {
                                      handleCoordChange(key, 'yEnd', val);
                                  }
                              }}
                              className="bg-gray-950/80 border border-cyan-800/40 rounded px-2 py-1 text-xs text-cyan-200 focus:outline-none focus:border-cyan-500/50 transition-colors w-full font-mono"
                          />
                      </div>
                  </div>
                  <div className="ml-6 mt-2 flex items-center justify-end gap-2">
                      <button 
                          type="button"
                          onClick={saveCoordsToDatabase}
                          className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold rounded transition-colors cursor-pointer"
                      >
                          Save to Database
                      </button>
                  </div>
                  {key === 'domains' && (
                      <p className="ml-6 text-[10px] text-amber-400/90 font-sans leading-normal mt-1.5">
                        💡 <b>Yend (Offset):</b> สำหรับ Domains เป็นการบวก/ลบระยะความสูงจากท้ายตาราง (Showing 1-X): เช่น ใส่ <b>+50</b> เพื่อยืดขอบล่างลงอีก 50px, ใส่ <b>-30</b> เพื่อตัดขอบล่างขึ้น 30px, หรือเว้นว่างเป็น <b>Auto (+0)</b>
                      </p>
                  )}
                  {key === 'dns' && (
                      <p className="ml-6 text-[10px] text-amber-400/90 font-sans leading-normal mt-1.5">
                        💡 <b>Yend (Offset):</b> สำหรับ DNS เป็นการบวก/ลบระยะความสูงจากท้ายตาราง DNS: ใส่ <b>+50</b> เพื่อยืดลงล่าง, ใส่ <b>-30</b> เพื่อตัดขึ้นบน, หรือเว้นว่างเป็น <b>Auto (+0)</b>
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
                    setEnvAccount('');
                }
            }
        } finally {
            setIsLoadingSettings(false);
        }
    };

    // Load Zones
    const loadZonesForAccount = async (accountId) => {
        if (!accountId) {
            setZones([]);
            setEnvZone('');
            return;
        }
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
                } else {
                    setEnvZone('');
                }
            }
        } finally {
            setIsLoadingSettings(false);
        }
    };

    // Fetches real zone settings (min TLS version, TLS 1.3, etc.) used by the "inapp" preview
    // tab, so the app-generated table shows real data instead of just the mockup placeholder.
    // Cached in state so switching tabs doesn't refetch every time; call again to refresh.
    // Some tabs need extra real data beyond get-zone-settings (Load Balancing's own Cloudflare
    // API, Speed Test's live-browser DOM read) — fetched only when that tab is the active one.
    const loadInappPreviewData = async (tabId, forceRefresh = false) => {
        if (!envZone) return;

        if (tabId === 'loadBalancingSpectrum') {
            if (inappLoadBalancers && !forceRefresh) return;
            setIsLoadingInappPreview(true);
            try {
                const res = await callAPI('get-load-balancers', { zoneId: envZone, accountId: envAccount });
                if (res && res.data) {
                    setInappLoadBalancers(res.data.loadBalancers || []);
                }
            } catch (err) {
                console.error('Failed to load load balancers for inapp preview:', err);
            } finally {
                setIsLoadingInappPreview(false);
            }
            return;
        }

        if (tabId === 'dns') {
            if (inappDnsRecords && !forceRefresh) return;
            setIsLoadingInappPreview(true);
            try {
                const res = await callAPI('get-dns-records', { zoneId: envZone });
                if (res && res.data) {
                    setInappDnsRecords(res.data);
                }
            } catch (err) {
                console.error('Failed to load DNS records for inapp preview:', err);
            } finally {
                setIsLoadingInappPreview(false);
            }
            return;
        }

        if (tabId === 'speed') {
            // Live browser status, not a cacheable REST fetch — always re-check.
            // NOTE: this endpoint legitimately returns success:false for 'waiting'/'error'/'running'
            // statuses (that's part of its normal vocabulary, not a request failure), so we must
            // NOT go through callAPI() here — callAPI() discards any success:false body and would
            // collapse every real status into the 'waiting' fallback below.
            setIsLoadingInappPreview(true);
            try {
                const domainVal = zones.find(z => z.id === envZone)?.name || '';
                const apiToken = currentUser?.cloudflare_api_token || auth.getCurrentUser()?.cloudflare_api_token;
                const response = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'check-speed-results', domainVal, apiToken }),
                });
                const res = await response.json();
                setInappSpeedResult(res || { status: 'waiting' });
            } catch (err) {
                console.error('Failed to check speed test results for inapp preview:', err);
                setInappSpeedResult({ status: 'error', error: err.message });
            } finally {
                setIsLoadingInappPreview(false);
            }
            return;
        }

        if (tabId === 'traffic' || tabId === 'trafficCountries' || tabId === 'topEventsSource') {
            // The three traffic-analytics tabs share one GraphQL fetch (same action the report
            // generator uses: 'get-traffic-analytics'), then each reduces it differently. Cached
            // together in inappTrafficData since they're always viewed against the same date range.
            if (inappTrafficData && !forceRefresh) return;
            setIsLoadingInappPreview(true);
            try {
                const res = await callAPI('get-traffic-analytics', {
                    zoneId: envZone,
                    startDate: envStartDate,
                    endDate: envEndDate,
                    subdomain: envSubdomain || 'ALL_SUBDOMAINS',
                });
                if (res && res.data) {
                    const filteredData = res.data.httpRequestsAdaptiveGroups || [];
                    const zoneSummary = res.data.zoneSummary || [];
                    const firewallSourcesData = res.data.firewallSources || [];

                    // Total requests / bandwidth / page views / visits: same reduction as the
                    // report's zoneWideRequests/zoneWideDataTransfer/pageViews/visits.
                    let zReq = 0, zBytes = 0, zPageViews = 0, zUniques = 0;
                    zoneSummary.forEach(day => {
                        zReq += (day.sum?.requests || 0);
                        zBytes += (day.sum?.bytes || 0);
                        zPageViews += (day.sum?.pageViews || 0);
                        zUniques += (day.uniq?.uniques || 0);
                    });

                    // Country breakdown: same reduction as the report's countryCounts, built by
                    // walking httpRequestsAdaptiveGroups (each row is either a live GraphQL group
                    // or a pre-aggregated SQLite "isSummary" row with its own nested totals).
                    const countryCounts = {};
                    filteredData.forEach(item => {
                        if (item.isSummary) {
                            (item.totals?.countries || []).forEach(c => {
                                const name = c.clientCountryName || 'Unknown';
                                countryCounts[name] = (countryCounts[name] || 0) + (c.requests || 0);
                            });
                            return;
                        }
                        const name = item.dimensions?.clientCountryName || 'Unknown';
                        countryCounts[name] = (countryCounts[name] || 0) + (item.count || 0);
                    });
                    const topCountries = Object.entries(countryCounts)
                        .map(([name, count]) => ({ name, count }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 8);

                    // Events-by-source breakdown: same bucketing as the report's fwEvents.
                    let fwTotal = 0, fwManaged = 0, fwCustom = 0, fwBic = 0, fwAccess = 0;
                    firewallSourcesData.forEach(item => {
                        const source = (item.dimensions?.source || 'Unknown');
                        const count = item.count || 0;
                        fwTotal += count;
                        const s = source.toLowerCase();
                        if (s === 'waf' || s === 'firewallmanaged' || s.includes('managed_rules') || s === 'managedrules') fwManaged += count;
                        else if (s === 'firewallrules' || s === 'filterbasedfirewall' || s.includes('custom_rules') || s === 'firewallcustom' || s === 'firewall_rules' || s === 'customrules') fwCustom += count;
                        else if (s === 'bic' || s === 'browser_integrity_check') fwBic += count;
                        else if (s === 'accessrules' || s === 'ip_access_rules' || s === 'ip' || s === 'asn' || s === 'ipaddress' || s === 'ip_access_rule') fwAccess += count;
                    });

                    setInappTrafficData({
                        zoneTotalRequests: zReq.toLocaleString(),
                        zoneTotalDataTransfer: (zReq > 0 ? (zBytes / (1024 * 1024 * 1024)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00') + ' GB',
                        pageViews: zPageViews,
                        visits: zUniques,
                        topCountries,
                        fwEvents: { total: fwTotal, managed: fwManaged, custom: fwCustom, bic: fwBic, access: fwAccess },
                    });
                }
            } catch (err) {
                console.error('Failed to load traffic analytics for inapp preview:', err);
            } finally {
                setIsLoadingInappPreview(false);
            }
            return;
        }

        if (inappZoneSettings && !forceRefresh) return;
        setIsLoadingInappPreview(true);
        try {
            const res = await callAPI('get-zone-settings', { zoneId: envZone });
            if (res && res.data) {
                setInappZoneSettings(res.data);
            }
        } catch (err) {
            console.error('Failed to load zone settings for inapp preview:', err);
        } finally {
            setIsLoadingInappPreview(false);
        }
    };

    // Switching tabs while already in "inapp" preview mode should refetch whatever that tab
    // needs (load balancers, speed status) instead of leaving the previous tab's data showing.
    useEffect(() => {
        if (capturePreviewMode === 'inapp') {
            loadInappPreviewData(activeCaptureTab);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCaptureTab, capturePreviewMode]);

    // Every inapp-preview cache (zone settings, load balancers, traffic analytics) is keyed
    // implicitly by "whatever zone/date/subdomain was active when it was fetched" — none of them
    // knew to invalidate themselves when the user changed those fields, so a stale zone's or
    // stale date range's numbers could keep showing after a change (this is what made HTTP
    // Traffic / Traffic Countries / Events by Source show "0" right after changing dates: the
    // cache from the old range was still sitting there). Clear every cache whenever any of the
    // fields that feed these fetches changes, and if the user is currently looking at the inapp
    // preview, immediately force a refetch for the active tab instead of leaving it blank until
    // the next tab switch.
    useEffect(() => {
        setInappZoneSettings(null);
        setInappLoadBalancers(null);
        setInappTrafficData(null);
        setInappDnsRecords(null);
        // Speed Test status is intentionally NOT cleared here: it reflects the live debug
        // browser's last run, which is independent of zone/date/subdomain selection.
        if (capturePreviewMode === 'inapp') {
            loadInappPreviewData(activeCaptureTab, true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [envZone, envStartDate, envEndDate, envSubdomain]);

    // Manual "@uploaded_X" image upload: lets the user supply their own image for a report
    // section, bypassing automated capture entirely (useful when Cloudflare's UI changes, or
    // the user just wants to paste in their own screenshot). Stored server-side under
    // db/captured/uploaded-<slug>.png via POST /api/ntbc-capture, independent of the
    // captured-<slug>.png files used by @captured_X.
    const handleUploadImage = (id, file) => {
        if (!file) return;
        setUploadImageError(null);
        setUploadingImageId(id);
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const imageBase64 = reader.result;
                const response = await fetch('/api/ntbc-capture', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'save-uploaded', id, imageBase64 }),
                });
                const data = await response.json();
                if (data && data.success) {
                    setUploadedImages(prev => ({ ...prev, [id]: data.image }));
                } else {
                    setUploadImageError((data && data.error) || 'อัปโหลดรูปไม่สำเร็จ');
                }
            } catch (err) {
                console.error('Failed to upload image:', err);
                setUploadImageError('อัปโหลดรูปไม่สำเร็จ: ' + err.message);
            } finally {
                setUploadingImageId(null);
            }
        };
        reader.onerror = () => {
            setUploadImageError('ไม่สามารถอ่านไฟล์รูปภาพได้');
            setUploadingImageId(null);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveUploadedImage = async (id) => {
        setUploadImageError(null);
        setUploadingImageId(id);
        try {
            const response = await fetch('/api/ntbc-capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete-uploaded', id }),
            });
            const data = await response.json();
            if (data && data.success) {
                setUploadedImages(prev => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
            } else {
                setUploadImageError((data && data.error) || 'ลบรูปไม่สำเร็จ');
            }
        } catch (err) {
            console.error('Failed to delete uploaded image:', err);
            setUploadImageError('ลบรูปไม่สำเร็จ: ' + err.message);
        } finally {
            setUploadingImageId(null);
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
            // Clean up any legacy screenshot blobs from localStorage
            const legacyKeys = [
                'control_capturedScreenshot', 'control_capturedDnsScreenshot', 'control_capturedDnsPages',
                'control_capturedHttpTrafficScreenshot', 'control_capturedHttpTrafficScreenshot1',
                'control_capturedHttpTrafficScreenshot2', 'control_capturedHttpTrafficScreenshot3',
                'control_capturedHttpTrafficScreenshot4', 'control_capturedHttpTrafficScreenshot5',
                'control_capturedFirewallScreenshot', 'control_capturedSecurityRulesScreenshot',
                'control_capturedArgoScreenshot', 'control_capturedSpeedScreenshot', 'control_capturedSpeedMobileScreenshot',
                'control_capturedBotManagementScreenshot', 'control_capturedSecurityLevelScreenshot',
                'control_capturedSslOverviewScreenshot', 'control_capturedSslEdgeScreenshot',
                'control_capturedRateLimitingScreenshot', 'control_capturedManagedRulesScreenshot',
                'control_capturedIpAccessScreenshot', 'control_capturedZoneLockdownScreenshot',
                'control_capturedTrafficCountriesScreenshot', 'control_capturedTopEventsSourceScreenshot'
            ];
            legacyKeys.forEach(k => localStorage.removeItem(k));
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
            const savedActiveTab = localStorage.getItem('control_activeCaptureTab');
            if (savedActiveTab) {
                setActiveCaptureTab(savedActiveTab);
            }

            try {
                const savedMeta = localStorage.getItem('control_captureMeta');
                if (savedMeta) {
                    setCaptureMeta(JSON.parse(savedMeta));
                }
            } catch (e) {
                console.error('Failed to parse captureMeta:', e);
            }

            // Fetch saved screenshots and metadata directly from persistent server disk
            fetch('/api/ntbc-capture?action=get-saved')
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.screenshots) {
                        const s = data.screenshots;
                        if (s.domains) setCapturedScreenshot(s.domains);
                        if (s.dns) setCapturedDnsScreenshot(s.dns);
                        if (s.loadBalancingSpectrum) setCapturedLoadBalancingSpectrumScreenshot(s.loadBalancingSpectrum);
                        if (s.traffic) setCapturedHttpTrafficScreenshot(s.traffic);
                        if (s.trafficSub1) setCapturedHttpTrafficScreenshot1(s.trafficSub1);
                        if (s.trafficSub2) setCapturedHttpTrafficScreenshot2(s.trafficSub2);
                        if (s.trafficSub3) setCapturedHttpTrafficScreenshot3(s.trafficSub3);
                        if (s.trafficSub4) setCapturedHttpTrafficScreenshot4(s.trafficSub4);
                        if (s.trafficSub5) setCapturedHttpTrafficScreenshot5(s.trafficSub5);
                        if (s.firewall) setCapturedFirewallScreenshot(s.firewall);
                        if (s.securityRules) setCapturedSecurityRulesScreenshot(s.securityRules);
                        if (s.argo) setCapturedArgoScreenshot(s.argo);
                        if (s.speed) setCapturedSpeedScreenshot(s.speed);
                        if (s.speedMobile) setCapturedSpeedMobileScreenshot(s.speedMobile);
                        if (s.botManagement) setCapturedBotManagementScreenshot(s.botManagement);
                        if (s.securityLevel) setCapturedSecurityLevelScreenshot(s.securityLevel);
                        if (s.browserIntegrity) setCapturedBrowserIntegrityScreenshot(s.browserIntegrity);
                        if (s.sslOverview) setCapturedSslOverviewScreenshot(s.sslOverview);
                        if (s.sslEdge) setCapturedSslEdgeScreenshot(s.sslEdge);
                        if (s.minTlsVersion) setCapturedMinTlsVersionScreenshot(s.minTlsVersion);
                        if (s.tls13) setCapturedTls13Screenshot(s.tls13);
                        if (s.rateLimiting) setCapturedRateLimitingScreenshot(s.rateLimiting);
                        if (s.managedRules) setCapturedManagedRulesScreenshot(s.managedRules);
                        if (s.ipAccess) setCapturedIpAccessScreenshot(s.ipAccess);
                        if (s.zoneLockdown) setCapturedZoneLockdownScreenshot(s.zoneLockdown);
                        if (s.trafficCountries) setCapturedTrafficCountriesScreenshot(s.trafficCountries);
                        if (s.topEventsSource) setCapturedTopEventsSourceScreenshot(s.topEventsSource);

                        if (data.metadata) {
                            setCaptureMeta(prev => ({
                                ...prev,
                                ...data.metadata
                            }));
                        }
                    }
                    if (data.success && data.uploaded) {
                        setUploadedImages(data.uploaded);
                    }
                })
                .catch(e => {
                    console.error('Failed to load saved screenshots from server disk:', e);
                });
            
            // Fetch central database coordinates
            fetch('/api/ntbc-capture-coords')
                .then(res => res.json())
                .then(data => {
                    setCoords(data);
                })
                .catch(e => {
                    console.error('Failed to load global coords:', e);
                    const defaultCoords = {
                        domains: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        dns: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        traffic: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        firewall: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        securityRules: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        argo: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        speed: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        speedMobile: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        botManagement: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        securityLevel: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        sslOverview: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        sslEdge: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        rateLimiting: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        managedRules: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        ipAccess: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        zoneLockdown: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        trafficCountries: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' },
                        topEventsSource: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' }
                    };
                    setCoords(defaultCoords);
                });
            // Fetch presets
            fetchPresets();
            const savedPresetId = localStorage.getItem('control_activePresetId');
            if (savedPresetId) {
                setActivePresetId(savedPresetId);
            }

            // Clear stepStatus from localStorage on refresh
            localStorage.removeItem('control_stepStatus');
        }

        // Initialize logs with first entry containing client-side timestamp
        setLogs([{ time: new Date().toLocaleTimeString(), text: 'System initialized and ready.', type: 'info' }]);
        if (typeof window !== 'undefined') {
            setVncUrl(`${window.location.origin}/vnc/?autoconnect=1&resize=scale&path=websockify`);
        }
        setMounted(true);
        init();
    }, [router]);

    // Save activeCaptureTab to localStorage on change
    useEffect(() => {
        if (typeof window !== 'undefined' && activeCaptureTab) {
            localStorage.setItem('control_activeCaptureTab', activeCaptureTab);
        }
    }, [activeCaptureTab]);

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
                position: 'top-end',
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
                        if (captureData.success && captureData.image) {
                            domainsImg = captureData.image;
                            setCapturedScreenshot(domainsImg);
                            safeSetItem('control_capturedScreenshot', domainsImg);
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
                        if (captureData.success && (captureData.image || captureData.dnsPages)) {
                            const dnsImages = (captureData.dnsPages && captureData.dnsPages.length > 0) ? captureData.dnsPages : [captureData.image];
                            dnsImg = dnsImages;
                            setCapturedDnsScreenshot(dnsImages);
                            safeSetItem('control_capturedDnsScreenshot', JSON.stringify(dnsImages));
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
                            setCapturedHttpTrafficScreenshot(trafficImg);
                            safeSetItem('control_capturedHttpTrafficScreenshot', trafficImg);
                            if (captureData.imageSub1) {
                                setCapturedHttpTrafficScreenshot1(captureData.imageSub1);
                                safeSetItem('control_capturedHttpTrafficScreenshot1', captureData.imageSub1);
                            }
                            if (captureData.imageSub2) {
                                setCapturedHttpTrafficScreenshot2(captureData.imageSub2);
                                safeSetItem('control_capturedHttpTrafficScreenshot2', captureData.imageSub2);
                            }
                            if (captureData.imageSub3) {
                                setCapturedHttpTrafficScreenshot3(captureData.imageSub3);
                                safeSetItem('control_capturedHttpTrafficScreenshot3', captureData.imageSub3);
                            }
                            if (captureData.imageSub4) {
                                setCapturedHttpTrafficScreenshot4(captureData.imageSub4);
                                safeSetItem('control_capturedHttpTrafficScreenshot4', captureData.imageSub4);
                            }
                            if (captureData.imageSub5) {
                                setCapturedHttpTrafficScreenshot5(captureData.imageSub5);
                                safeSetItem('control_capturedHttpTrafficScreenshot5', captureData.imageSub5);
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
                            setCapturedFirewallScreenshot(firewallImg);
                            safeSetItem('control_capturedFirewallScreenshot', firewallImg);
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
                            setCapturedSecurityRulesScreenshot(securityRulesImg);
                            safeSetItem('control_capturedSecurityRulesScreenshot', securityRulesImg);
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
                            setCapturedArgoScreenshot(argoImg);
                            safeSetItem('control_capturedArgoScreenshot', argoImg);
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
                                    setCapturedSpeedScreenshot(speedImg);
                                    safeSetItem('control_capturedSpeedScreenshot', speedImg);
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
                                    setCapturedSpeedScreenshot(speedImg);
                                    safeSetItem('control_capturedSpeedScreenshot', speedImg);
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
                                        setCapturedSpeedMobileScreenshot(speedMobileImg);
                                        safeSetItem('control_capturedSpeedMobileScreenshot', speedMobileImg);
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

    const ALL_CAPTURE_TABS = [
        { id: 'domains', label: 'Domains', hasData: !!capturedScreenshot, icon: '🌐', type: 'domains', path: '/domains/overview', setter: setCapturedScreenshot, key: 'control_capturedScreenshot', isDynamic: true },
        { id: 'dns', label: 'DNS Records', hasData: !!(capturedDnsScreenshot && (Array.isArray(capturedDnsScreenshot) ? capturedDnsScreenshot.length > 0 : true)), icon: '💾', type: 'dns', path: '/dns/records', setter: setCapturedDnsScreenshot, key: 'control_capturedDnsScreenshot', isDynamic: true },
        { id: 'loadBalancingSpectrum', label: 'Load Balancing & Spectrum', hasData: !!capturedLoadBalancingSpectrumScreenshot, icon: '⚖️', type: 'load-balancing-spectrum', path: '/traffic/load-balancing', setter: setCapturedLoadBalancingSpectrumScreenshot, key: 'control_capturedLoadBalancingSpectrumScreenshot' },
        { id: 'botManagement', label: 'Bot Management', hasData: !!capturedBotManagementScreenshot, icon: '🤖', type: 'bot-management', path: '/security/settings', setter: setCapturedBotManagementScreenshot, key: 'control_capturedBotManagementScreenshot' },
        { id: 'securityLevel', label: 'Security Level', hasData: !!capturedSecurityLevelScreenshot, icon: '🛡️', type: 'security-level', path: '/security/settings', setter: setCapturedSecurityLevelScreenshot, key: 'control_capturedSecurityLevelScreenshot' },
        { id: 'browserIntegrity', label: 'Browser Integrity', hasData: !!capturedBrowserIntegrityScreenshot, icon: '🛡️', type: 'browser-integrity-check', path: '/security/settings', setter: setCapturedBrowserIntegrityScreenshot, key: 'control_capturedBrowserIntegrityScreenshot' },
        { id: 'sslOverview', label: 'SSL/TLS Mode', hasData: !!capturedSslOverviewScreenshot, icon: '🔒', type: 'ssl-overview', path: '/ssl-tls', setter: setCapturedSslOverviewScreenshot, key: 'control_capturedSslOverviewScreenshot' },
        { id: 'minTlsVersion', label: 'Min TLS Version', hasData: !!capturedMinTlsVersionScreenshot, icon: '🔒', type: 'min-tls-version', path: '/ssl-tls/edge-certificates', setter: setCapturedMinTlsVersionScreenshot, key: 'control_capturedMinTlsVersionScreenshot' },
        { id: 'tls13', label: 'TLS 1.3', hasData: !!capturedTls13Screenshot, icon: '⚡', type: 'tls-1-3', path: '/ssl-tls/edge-certificates', setter: setCapturedTls13Screenshot, key: 'control_capturedTls13Screenshot' },
        { id: 'traffic', label: 'HTTP Traffic', hasData: !!capturedHttpTrafficScreenshot, icon: '📈', type: 'traffic', path: '/analytics/traffic', setter: setCapturedHttpTrafficScreenshot, key: 'control_capturedHttpTrafficScreenshot' },
        { id: 'trafficCountries', label: 'Traffic Countries', hasData: !!capturedTrafficCountriesScreenshot, icon: '🗺️', type: 'traffic-countries', path: '/analytics/traffic', setter: setCapturedTrafficCountriesScreenshot, key: 'control_capturedTrafficCountriesScreenshot' },
        { id: 'firewall', label: 'Firewall', hasData: !!capturedFirewallScreenshot, icon: '🔥', type: 'firewall', path: '/security/analytics/events', setter: setCapturedFirewallScreenshot, key: 'control_capturedFirewallScreenshot' },
        { id: 'topEventsSource', label: 'Events by Source', hasData: !!capturedTopEventsSourceScreenshot, icon: '📊', type: 'top-events-source', path: '/security/analytics/events', setter: setCapturedTopEventsSourceScreenshot, key: 'control_capturedTopEventsSourceScreenshot' },
        { id: 'securityRules', label: 'Custom Rules', hasData: !!capturedSecurityRulesScreenshot, icon: '🛡️', type: 'security-rules', path: '/security/waf/custom-rules', setter: setCapturedSecurityRulesScreenshot, key: 'control_capturedSecurityRulesScreenshot', isDynamic: true },
        { id: 'rateLimiting', label: 'Rate Limiting', hasData: !!capturedRateLimitingScreenshot, icon: '⏱️', type: 'rate-limiting', path: '/security/waf/rate-limiting-rules', setter: setCapturedRateLimitingScreenshot, key: 'control_capturedRateLimitingScreenshot', isDynamic: true },
        { id: 'managedRules', label: 'Managed WAF', hasData: !!capturedManagedRulesScreenshot, icon: '🧱', type: 'managed-rules', path: '/security/waf/managed-rules', setter: setCapturedManagedRulesScreenshot, key: 'control_capturedManagedRulesScreenshot', isDynamic: true },
        { id: 'ipAccess', label: 'IP Access', hasData: !!capturedIpAccessScreenshot, icon: '🚫', type: 'ip-access-rules', path: '/security/security-rules', setter: setCapturedIpAccessScreenshot, key: 'control_capturedIpAccessScreenshot', isDynamic: true },
        { id: 'zoneLockdown', label: 'Zone Lockdown', hasData: !!capturedZoneLockdownScreenshot, icon: '🔐', type: 'zone-lockdown', path: '/security/security-rules', setter: setCapturedZoneLockdownScreenshot, key: 'control_capturedZoneLockdownScreenshot', isDynamic: true },
        { id: 'argo', label: 'Argo Smart', hasData: !!capturedArgoScreenshot, icon: '⚡', type: 'argo', path: '/traffic', setter: setCapturedArgoScreenshot, key: 'control_capturedArgoScreenshot' },
        { id: 'speed', label: 'Speed Test', hasData: !!(capturedSpeedScreenshot || capturedSpeedMobileScreenshot), icon: '🚀', type: 'speed', path: '/speed/test/browser', setter: setCapturedSpeedScreenshot, key: 'control_capturedSpeedScreenshot' }
    ];

    const isEnvReady = Boolean(envAccount && envZone && envStartDate && envEndDate);

    const handleDirectCapture = async (tabId, captureType, stateSetter, storageKey, relativePath, isSilent = false) => {
        if (!envAccount) {
            if (!isSilent) {
                Swal.fire({
                    icon: 'warning',
                    title: 'กรุณาเลือก Account ก่อน',
                    text: 'กรุณาเลือก Cloudflare Account ในส่วน Active Environment Settings ให้เรียบร้อยก่อนทำการแคปภาพ',
                    confirmButtonColor: '#e11d48',
                    background: '#111827',
                    color: '#fff'
                });
            }
            return false;
        }

        if (!envZone && tabId !== 'domains') {
            if (!isSilent) {
                Swal.fire({
                    icon: 'warning',
                    title: 'กรุณาเลือก Zone (โดเมน) ก่อน',
                    text: 'กรุณาเลือก Zone ในส่วน Active Environment Settings ให้เรียบร้อยก่อนทำการแคปภาพ',
                    confirmButtonColor: '#e11d48',
                    background: '#111827',
                    color: '#fff'
                });
            }
            return false;
        }

        if (!isSilent) setIsCapturingDirect(true);
        try {
            const targetDomain = zones.find(z => z.id === envZone)?.name || (tabId === 'domains' ? 'overview' : null);
            if (!targetDomain && tabId !== 'domains') {
                throw new Error('ไม่พบข้อมูลโดเมน (Zone) กรุณาเลือก Zone ใน Active Environment Settings');
            }

            // Dedicated Speed Test Execution Workflow
            if (tabId === 'speed') {
                addLog('🚀 เริ่มต้นกระบวนการรัน Speed Test และตรวจจับสถานะแบบละเอียด...', 'info');
                const targetSpeedUrl = `https://dash.cloudflare.com/${envAccount}/${targetDomain}/speed/test/browser`;
                
                addLog(`กำลังเชื่อมต่อไปยังหน้า Speed Test: ${targetSpeedUrl}`, 'info');
                const navRes = await fetch(`/api/ntbc-control-chrome?url=${encodeURIComponent(targetSpeedUrl)}`);
                const navData = await navRes.json();
                if (!navData.success) throw new Error(navData.error);
                
                addLog('รอหน้าเว็บ Speed Test โหลดข้อมูลและองค์ประกอบให้พร้อม...', 'info');
                await new Promise(r => setTimeout(r, DELAY_CONFIG.NAV_STABILIZE_MS));

                // Trigger Speed Test
                addLog(`กดปุ่มเริ่มการทดสอบความเร็ว (Run Test) สำหรับโดเมน ${targetDomain}...`, 'info');
                const runRes = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'run-speed-test',
                        domainVal: targetDomain,
                        apiToken: currentUser?.cloudflare_api_token
                    })
                });
                const runData = await runRes.json();

                if (!runData.success) {
                    if (runData.errorType === 'quota_exceeded') {
                        addLog(`⚠️ ${runData.error}`, 'warn');
                    } else {
                        addLog(`⚠️ แจ้งเตือนจาก Cloudflare: ${runData.error || runData.message}`, 'warn');
                    }
                } else {
                    addLog('✅ เริ่มการทดสอบความเร็วสำเร็จ กำลังรอผลประมวลผลจาก Cloudflare...', 'success');
                }

                // Polling Loop with Error Detection (Max 30 attempts x 3s = 90s)
                const maxAttempts = 30;
                let completedState = null;
                let lastError = null;

                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    addLog(`⏳ กำลังตรวจสอบผลการทดสอบความเร็ว (รอบที่ ${attempt}/${maxAttempts})...`, 'info');
                    const checkRes = await fetch('/api/scrape', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'check-speed-results',
                            domainVal: targetDomain,
                            apiToken: currentUser?.cloudflare_api_token
                        })
                    });
                    const checkData = await checkRes.json();

                    if (checkData.success && checkData.status === 'completed') {
                        completedState = checkData;
                        addLog(`🎉 ผลการทดสอบความเร็วเสร็จสมบูรณ์! (คะแนน: ${checkData.score || 'พร้อมแสดงผล'})`, 'success');
                        break;
                    }

                    if (checkData.status === 'error') {
                        lastError = checkData;
                        addLog(`❌ Cloudflare ตรวจพบข้อผิดพลาด: ${checkData.error || 'Test Failed'}`, 'error');

                        // If previous valid result exists in history, load it
                        if (checkData.hasPreviousResult && checkData.previousResultUrl) {
                            addLog(`ℹ️ กำลังโหลดผลการทดสอบที่สมบูรณ์ล่าสุดในประวัติ (คะแนน ${checkData.previousScore || ''})...`, 'warn');
                            await fetch('/api/scrape', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    action: 'view-previous-speed-result',
                                    resultUrl: checkData.previousResultUrl
                                })
                            });
                            completedState = { status: 'completed', score: checkData.previousScore, isPrevious: true };
                            break;
                        } else {
                            break;
                        }
                    }

                    await new Promise(r => setTimeout(r, 3000));
                }

                // Capture Desktop and Mobile screenshots
                addLog('📸 กำลังจับภาพหน้าจอผลการทดสอบความเร็ว Desktop...', 'info');
                const captureDesktopRes = await fetch(getCaptureUrl('speed', 'speed'));
                const captureDesktopData = await captureDesktopRes.json();

                let desktopImg = null;
                if (captureDesktopData.success && captureDesktopData.image) {
                    desktopImg = captureDesktopData.image;
                    setCapturedSpeedScreenshot(desktopImg);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('control_capturedSpeedScreenshot', desktopImg);
                    }
                    addLog('✅ บันทึกภาพ Speed Test (Desktop) เรียบร้อย', 'success');
                }

                // Switch to Mobile and Capture Mobile
                if (desktopImg) {
                    addLog('📱 กำลังสลับไปยังแท็บ Mobile Speed Test...', 'info');
                    const mobileRes = await fetch('/api/scrape', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'click-speed-mobile',
                            apiToken: currentUser?.cloudflare_api_token
                        })
                    });
                    const mobileData = await mobileRes.json();

                    if (mobileData.success) {
                        addLog('📸 กำลังจับภาพหน้าจอผลการทดสอบความเร็ว Mobile...', 'info');
                        const captureMobileRes = await fetch(getCaptureUrl('speedMobile', 'speed-mobile'));
                        const captureMobileData = await captureMobileRes.json();

                        if (captureMobileData.success && captureMobileData.image) {
                            setCapturedSpeedMobileScreenshot(captureMobileData.image);
                            if (typeof window !== 'undefined') {
                                localStorage.setItem('control_capturedSpeedMobileScreenshot', captureMobileData.image);
                            }
                            addLog('✅ บันทึกภาพ Speed Test (Mobile) เรียบร้อย', 'success');
                        }
                    }
                }

                // Record capture metadata
                const uName = currentUser?.username || auth.getCurrentUser()?.username || 'root';
                const nowIso = new Date().toISOString();
                setCaptureMeta(prev => {
                    const next = {
                        ...prev,
                        speed: { capturedAt: nowIso, capturedBy: uName }
                    };
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('control_captureMeta', JSON.stringify(next));
                    }
                    return next;
                });

                if (!isSilent) {
                    if (lastError && completedState?.isPrevious) {
                        Swal.fire({
                            icon: 'warning',
                            title: 'การทดสอบรอบล่าสุดเกิดข้อผิดพลาด',
                            html: `<div class="text-left text-xs space-y-2">
                                <p class="text-rose-400 font-bold">❌ ข้อความจาก Cloudflare: ${lastError.error}</p>
                                <p class="text-emerald-400 font-medium">💡 ระบบได้ตรวจจับและดึงผลการทดสอบที่สมบูรณ์ล่าสุดในประวัติ (คะแนน <strong>${completedState.score || ''}</strong>) มาบันทึกภาพให้เรียบร้อยแล้ว</p>
                            </div>`,
                            background: '#111827',
                            color: '#fff',
                            confirmButtonColor: '#e11d48'
                        });
                    } else if (lastError && !desktopImg) {
                        Swal.fire({
                            icon: 'error',
                            title: 'Speed Test Failed',
                            html: `<div class="text-left text-xs space-y-2">
                                <p class="text-rose-400 font-bold">❌ สาเหตุ: ${lastError.error || 'การทดสอบความเร็วล้มเหลว'}</p>
                                <p class="text-gray-300">ระบบได้ตรวจพบข้อผิดพลาดจาก Cloudflare และบันทึกภาพแจ้งเตือนข้อผิดพลาดไว้ในระบบเรียบร้อยแล้ว</p>
                            </div>`,
                            background: '#111827',
                            color: '#fff',
                            confirmButtonColor: '#e11d48'
                        });
                    } else {
                        Swal.fire({
                            icon: 'success',
                            title: 'Captured Speed Test!',
                            text: `บันทึกภาพผลการทดสอบความเร็วเรียบร้อย ${completedState?.score ? `(คะแนน: ${completedState.score})` : ''}`,
                            timer: 2200,
                            showConfirmButton: false,
                            background: '#111827',
                            color: '#fff'
                        });
                    }
                }
                return true;
            }

            let targetUrl = null;
            if (relativePath === 'domains' || relativePath === '/domains/overview') {
                targetUrl = `https://dash.cloudflare.com/${envAccount}/domains/overview`;
            } else if (relativePath && targetDomain) {
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
                addLog(`Checking active tab URL...`, 'info');
                const res = await fetch(`/api/ntbc-control-chrome?url=${encodeURIComponent(targetUrl)}`);
                const data = await res.json();
                if (!data.success) throw new Error(data.error);
                if (data.skippedRedirect) {
                    addLog(`⚡ Browser is already on target page (${targetUrl}) - skipped reload for faster capture & anti-bot protection.`, 'success');
                } else {
                    addLog(`Redirected active tab to: ${targetUrl}`, 'info');
                    addLog('Waiting for page rendering to stabilize...', 'info');
                    await new Promise(r => setTimeout(r, DELAY_CONFIG.NAV_STABILIZE_MS));
                }
            }
            addLog(`Capturing screenshot with type=${captureType}...`, 'info');
            const captureRes = await fetch(getCaptureUrl(tabId, captureType));
            const captureData = await captureRes.json();
            if (captureData.success && (captureData.image || captureData.dnsPages)) {
                let imgResult;
                if (tabId === 'dns') {
                    imgResult = (captureData.dnsPages && captureData.dnsPages.length > 0) ? captureData.dnsPages : [captureData.image];
                } else if (captureType === 'traffic' && tabId.startsWith('trafficSub')) {
                    const subIdx = tabId.replace('trafficSub', '');
                    imgResult = captureData[`imageSub${subIdx}`] || captureData.image;
                } else {
                    imgResult = captureData.image;
                }
                stateSetter(imgResult);
                if (storageKey && typeof window !== 'undefined') {
                    localStorage.setItem(storageKey, Array.isArray(imgResult) ? JSON.stringify(imgResult) : imgResult);
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

                if (captureData.isUnavailable) {
                    addLog(`ℹ️ [${tabId}] ไม่พบฟีเจอร์นี้บนหน้าเว็บ Cloudflare - บันทึกรูปภาพแจ้ง Feature Not Available เรียบร้อย`, 'warn');
                    if (!isSilent) {
                        Swal.fire({
                            icon: 'info',
                            title: 'ไม่พบฟีเจอร์นี้ในระบบ',
                            text: `ไม่พบ ${tabId} ใน Account/Zone นี้ ระบบได้บันทึกรูปภาพแจ้งเตือน (Feature Not Available) ให้เรียบร้อยแล้ว`,
                            timer: 2200,
                            showConfirmButton: false,
                            background: '#111827',
                            color: '#fff'
                        });
                    }
                } else {
                    addLog(`Screenshot for [${tabId}] captured successfully!`, 'success');
                    if (!isSilent) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Captured!',
                            text: `Screenshot for ${tabId} captured successfully.`,
                            timer: 1500,
                            showConfirmButton: false,
                            background: '#111827',
                            color: '#fff'
                        });
                    }
                }
                return true;
            } else {
                throw new Error(captureData.error || 'Failed to capture screenshot');
            }
        } catch (err) {
            addLog(`Direct capture failed for [${tabId}]: ${err.message}`, 'error');
            if (!isSilent) {
                Swal.fire('Capture Error', err.message, 'error');
            }
            return false;
        } finally {
            if (!isSilent) setIsCapturingDirect(false);
        }
    };

    const handleCaptureAll = async () => {
        if (isCapturingAll || isCapturingDirect) return;

        if (!envAccount || !envZone) {
            Swal.fire({
                icon: 'warning',
                title: 'กรุณาเลือก Account และ Zone ก่อน',
                text: 'จำเป็นต้องเลือก Cloudflare Account และ Zone (Domain) ในส่วน Active Environment Settings ให้ครบถ้วนก่อนจึงจะสามารถเริ่มแคปภาพทั้งหมดได้',
                confirmButtonColor: '#e11d48',
                background: '#111827',
                color: '#fff'
            });
            return;
        }

        const result = await Swal.fire({
            title: 'ยืนยันการแคปภาพทั้งหมด 17 หมวดหมู่?',
            text: 'ระบบจะนำทางเบราว์เซอร์สดและบันทึกภาพหน้าจอทั้ง 17 รายการอัตโนมัติ',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '🚀 เริ่มแคปทั้งหมด',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#374151',
            background: '#0f172a',
            color: '#f8fafc'
        });

        if (!result.isConfirmed) return;

        setIsCapturingAll(true);
        abortCaptureAllRef.current = false;
        addLog(`=== 🚀 เริ่มต้นกระบวนการแคปภาพทั้งหมด (17 รายการ) ===`, 'info');

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < ALL_CAPTURE_TABS.length; i++) {
            if (abortCaptureAllRef.current) {
                addLog(`⚠️ กระบวนการแคปทั้งหมดถูกยกเลิกโดยผู้ใช้`, 'warn');
                break;
            }

            const item = ALL_CAPTURE_TABS[i];
            setCaptureAllStatus({ current: i + 1, total: ALL_CAPTURE_TABS.length, currentLabel: item.label });
            setActiveCaptureTab(item.id);

            addLog(`[${i + 1}/${ALL_CAPTURE_TABS.length}] กำลังนำทางและแคป: ${item.label}...`, 'info');
            try {
                const ok = await handleDirectCapture(item.id, item.type, item.setter, item.key, item.path, true);
                if (ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                failCount++;
                addLog(`❌ แคป ${item.label} ไม่สำเร็จ: ${err.message}`, 'error');
            }

            // Brief pause between pages to prevent browser throttling
            if (i < ALL_CAPTURE_TABS.length - 1 && !abortCaptureAllRef.current) {
                await new Promise(r => setTimeout(r, 1200));
            }
        }

        setIsCapturingAll(false);
        setCaptureAllStatus({ current: 0, total: ALL_CAPTURE_TABS.length, currentLabel: '' });

        if (abortCaptureAllRef.current) {
            Swal.fire({
                icon: 'info',
                title: 'ยกเลิกการแคปแล้ว',
                text: `แคปสำเร็จไป ${successCount} จาก ${ALL_CAPTURE_TABS.length} รายการ`,
                background: '#111827',
                color: '#fff'
            });
        } else {
            addLog(`🎉 กระบวนการแคปทั้งหมดเสร็จสิ้น! สำเร็จ: ${successCount}, ผิดพลาด: ${failCount}`, successCount > 0 ? 'success' : 'warn');
            Swal.fire({
                icon: successCount === ALL_CAPTURE_TABS.length ? 'success' : 'info',
                title: 'แคปภาพทั้งหมดเสร็จสิ้น!',
                html: `บันทึกรูปภาพเรียบร้อย <b>${successCount}</b> / ${ALL_CAPTURE_TABS.length} รายการ${failCount > 0 ? `<br/><span style="color:#f87171">มีข้อผิดพลาด ${failCount} รายการ</span>` : ''}`,
                background: '#111827',
                color: '#fff',
                confirmButtonColor: '#e11d48'
            });
        }
    };

    // Button row above the Live Browser Monitor: go to the Cloudflare home page (step 0 of runStep) + restart the monitor.
    const renderStep1Card = () => (
        <div className="flex items-center justify-start gap-3 mb-3 flex-wrap">
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
                        กำลังเปิดเบราว์เซอร์...
                    </>
                ) : (
                    <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        ไปยังหน้าแรก Cloudflare
                    </>
                )}
            </button>
            <button
                type="button"
                onClick={handleRestartMonitor}
                disabled={isRestartingVnc}
                className={`flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700/60 rounded-xl text-xs font-bold transition-all shadow cursor-pointer ${isRestartingVnc ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
                <RefreshCw className={`w-3.5 h-3.5 ${isRestartingVnc ? 'animate-spin' : ''}`} />
                {isRestartingVnc ? 'Restarting Monitor...' : 'Restart Monitor'}
            </button>
        </div>
    );

    // Re-creates the Live Browser Monitor (noVNC) iframe so it reconnects from scratch. This only
    // refreshes the viewer in this page; it does not restart the Chrome/VNC containers.
    const handleRestartMonitor = () => {
        if (isRestartingVnc) return;
        setIsRestartingVnc(true);
        addLog('🔄 กำลังรีสตาร์ท Live Browser Monitor (เชื่อมต่อ VNC ใหม่)...', 'info');
        setVncUrl('');
        setTimeout(() => {
            setVncUrl(`${window.location.origin}/vnc/?autoconnect=1&resize=scale&path=websockify`);
            setVncRestartKey(k => k + 1);
            setIsRestartingVnc(false);
            addLog('✅ รีสตาร์ท Live Browser Monitor แล้ว', 'success');
        }, 600);
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
                            key={vncRestartKey}
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
            <p className="text-[10px] text-gray-500 mt-1.5 flex items-start gap-1.5">
                <Sliders className="w-3 h-3 text-gray-600 shrink-0 mt-0.5" />
                <span>
                    ก่อนแคปภาพทุกครั้ง ระบบจะ<strong className="text-gray-400">ขยาย (ไม่พับ)</strong> เมนูด้านข้างของหน้าเว็บ Cloudflare ให้เปิดเต็มเสมอ
                    (ถ้าตรวจพบว่าเมนูถูกพับอยู่ จะกดคีย์ลัด t แล้ว s เพื่อขยายให้อัตโนมัติ) เพื่อให้ภาพที่แคปออกมาหน้าตาสม่ำเสมอทุกครั้ง
                </span>
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
                        onClick={() => router.push('/systems/ntbc_cfreport')}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-lg hover:shadow-rose-900/30 cursor-pointer"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to Generator
                    </button>
                </div>
            </div>

            {/* VNC Card rendering when maximized */}
            {isVncMaximized && renderStep1Card()}
            {isVncMaximized && renderVncCard()}

            {/* Main section tabs — keeps the page from being one long scroll: pick one view
                instead of scrolling past Environment Settings, the monitor, capture/preview and
                the debug console all stacked in one column. */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-none shrink-0">
                {[
                    { id: 'setup', label: '⚙️ ตั้งค่า & เริ่มต้น' },
                    { id: 'capture', label: '📸 แคปภาพ & พรีวิว' },
                    { id: 'console', label: '🪵 Debug Console' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => selectMainTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                            activeMainTab === tab.id
                                ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-900/30'
                                : 'bg-gray-900/60 text-gray-400 hover:text-gray-200 border-gray-800 hover:border-gray-700'
                        }`}
                    >
                        {tab.label}
                        {tab.id === 'setup' && !isEnvReady && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="ยังไม่ได้ตั้งค่า Account/Zone" />
                        )}
                    </button>
                ))}
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
                {/* Steps and Environment Section (Left) */}
                <div className={`${activeMainTab === 'capture' ? 'lg:col-span-12' : 'hidden'} space-y-6 flex flex-col`}>
                    {/* Live Browser Monitor Card */}
                    {!isVncMaximized && renderStep1Card()}
                    {!isVncMaximized && renderVncCard()}

                    {/* Consolidated Captured Screenshots (Step 2) */}
                    <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 flex flex-col shadow-2xl relative animate-scale-up">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-3 mb-3 gap-2">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                                <span className="text-xs font-bold text-gray-300 font-mono">Captured Screenshots ({[
                                    capturedScreenshot, capturedDnsScreenshot, capturedLoadBalancingSpectrumScreenshot,
                                    capturedBotManagementScreenshot, capturedSecurityLevelScreenshot, capturedBrowserIntegrityScreenshot,
                                    capturedSslOverviewScreenshot, capturedSslEdgeScreenshot, capturedMinTlsVersionScreenshot,
                                    capturedTls13Screenshot, capturedHttpTrafficScreenshot, capturedTrafficCountriesScreenshot,
                                    capturedFirewallScreenshot, capturedTopEventsSourceScreenshot, capturedSecurityRulesScreenshot,
                                    capturedRateLimitingScreenshot, capturedManagedRulesScreenshot, capturedIpAccessScreenshot,
                                    capturedZoneLockdownScreenshot, capturedArgoScreenshot, capturedSpeedScreenshot
                                ].filter(Boolean).length}/21)</span>
                            </div>

                            {/* Top-Right Capture All Button & Live Progress */}
                            <div className="flex items-center gap-2">
                                {isCapturingAll ? (
                                    <div className="flex items-center gap-2 bg-rose-950/70 border border-rose-500/60 px-3 py-1.5 rounded-xl shadow-lg animate-pulse">
                                        <RefreshCw className="w-3.5 h-3.5 text-rose-400 animate-spin shrink-0" />
                                        <span className="text-xs font-bold text-rose-200 font-mono">
                                            แคปทั้งหมด: {captureAllStatus.current}/{captureAllStatus.total} ({captureAllStatus.currentLabel})
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => { abortCaptureAllRef.current = true; }}
                                            className="ml-1 px-2.5 py-0.5 bg-rose-700/80 hover:bg-rose-600 text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
                                        >
                                            หยุด
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={isCapturingDirect || isCapturingAll}
                                        onClick={handleCaptureAll}
                                        className={`px-3.5 py-1.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/20 hover:scale-[1.02] active:scale-95 ${
                                            (isCapturingDirect || isCapturingAll) ? 'opacity-60 cursor-not-allowed' : ''
                                        }`}
                                        title="กดเพื่อสั่งเบราว์เซอร์สดไล่จับภาพหน้าจอครบทั้ง 17 รายการอัตโนมัติ"
                                    >
                                        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                                        <span>⚡ แคปทั้งหมด (Capture All 17 Pages)</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Environment Incomplete Warning Banner */}
                        {!isEnvReady && (
                            <div className="mb-3 bg-amber-950/40 border border-amber-500/50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-200 animate-pulse">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                                    <span><b>จำเป็นต้องตั้งค่าก่อน:</b> กรุณาเลือก <b>Account</b> และ <b>Zone</b> ในส่วน <i>Active Environment Settings</i> ด้านล่าง ก่อนเริ่มกดแคปภาพหน้าจอ</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        document.getElementById('active-env-settings-card')?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded border border-amber-500/40 font-bold text-[10px] shrink-0 cursor-pointer self-start sm:self-auto"
                                >
                                    ไปที่การตั้งค่า ↓
                                </button>
                            </div>
                        )}

                        {/* Preset & Coordinate Management Toolbar */}
                        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3 mb-3.5 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 shadow-inner">
                            {/* Preset Selection & Info */}
                            <div className="flex flex-wrap items-center gap-2.5">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-300">
                                    <Sliders className="w-4 h-4 text-rose-400" />
                                    <span>Preset พิกัด:</span>
                                </div>
                                <select
                                    value={activePresetId}
                                    onChange={(e) => handleSelectPreset(e.target.value)}
                                    className="bg-gray-950 border border-gray-700/80 rounded-lg px-3 py-1.5 text-xs text-rose-200 font-medium focus:outline-none focus:border-rose-500/60 transition-colors cursor-pointer min-w-[180px] max-w-[260px] truncate"
                                >
                                    <option value="default">Standard Default (Auto +0)</option>
                                    {presets.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} {p.createdByName ? `(@${p.createdBy})` : ''}
                                        </option>
                                    ))}
                                </select>

                                {/* Creator & Permission Badge */}
                                {activePreset ? (
                                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-950/80 border border-gray-800 rounded text-[11px] font-mono">
                                        <span className="text-gray-400">👤 โดย:</span>
                                        <span className="text-rose-300 font-semibold truncate max-w-[100px]" title={activePreset.createdByName || activePreset.createdBy}>
                                            @{activePreset.createdBy}
                                        </span>
                                        {isOwnerOrAdmin ? (
                                            <span className="ml-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/40" title="คุณมีสิทธิ์แก้ไข/ลบ Preset นี้">
                                                ✓ แก้ไขได้
                                            </span>
                                        ) : (
                                            <span className="ml-1 text-[10px] text-amber-400 font-bold bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-800/40" title="เฉพาะผู้สร้างหรือ Admin เท่านั้นที่แก้ไขได้">
                                                🔒 อ่านอย่างเดียว
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-[11px] text-gray-400 font-mono bg-gray-950/60 border border-gray-800/60 px-2 py-1 rounded">
                                        ⚙️ ค่าเริ่มต้นระบบ
                                    </span>
                                )}

                                {/* Action Buttons for Active Preset */}
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={handleSaveAsNewPreset}
                                        className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                                        title="บันทึกพิกัดปัจจุบันเป็น Preset ใหม่"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>บันทึกเป็น Preset ใหม่</span>
                                    </button>

                                    {activePreset && activePresetId !== 'default' && (
                                        <>
                                            <button
                                                type="button"
                                                disabled={!isOwnerOrAdmin}
                                                onClick={handleUpdatePreset}
                                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border cursor-pointer ${
                                                    isOwnerOrAdmin
                                                        ? 'bg-blue-600/20 hover:bg-blue-600/40 border-blue-500/50 text-blue-300'
                                                        : 'bg-gray-800/50 border-gray-700/40 text-gray-500 opacity-50 cursor-not-allowed'
                                                }`}
                                                title={isOwnerOrAdmin ? "บันทึกพิกัดปัจจุบันทับ Preset นี้" : "เฉพาะผู้สร้างหรือ Admin เท่านั้นที่แก้ไขได้"}
                                            >
                                                <Save className="w-3.5 h-3.5" />
                                                <span>บันทึกทับ</span>
                                            </button>

                                            <button
                                                type="button"
                                                disabled={!isOwnerOrAdmin}
                                                onClick={handleRenamePreset}
                                                className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border cursor-pointer ${
                                                    isOwnerOrAdmin
                                                        ? 'bg-amber-600/20 hover:bg-amber-600/40 border-amber-500/50 text-amber-300'
                                                        : 'bg-gray-800/50 border-gray-700/40 text-gray-500 opacity-50 cursor-not-allowed'
                                                }`}
                                                title={isOwnerOrAdmin ? "เปลี่ยนชื่อ Preset" : "เฉพาะผู้สร้างหรือ Admin เท่านั้นที่แก้ไขได้"}
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                                <span>เปลี่ยนชื่อ</span>
                                            </button>

                                            <button
                                                type="button"
                                                disabled={!isOwnerOrAdmin}
                                                onClick={handleDeletePreset}
                                                className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border cursor-pointer ${
                                                    isOwnerOrAdmin
                                                        ? 'bg-rose-950/60 hover:bg-rose-900 border-rose-600/50 text-rose-300'
                                                        : 'bg-gray-800/50 border-gray-700/40 text-gray-500 opacity-50 cursor-not-allowed'
                                                }`}
                                                title={isOwnerOrAdmin ? "ลบ Preset นี้" : "เฉพาะผู้สร้างหรือ Admin เท่านั้นที่ลบได้"}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span>ลบ</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Export / Import JSON Section */}
                            <div className="flex items-center gap-2 border-t xl:border-t-0 pt-2 xl:pt-0 border-gray-800 shrink-0">
                                <input
                                    type="file"
                                    ref={jsonImportInputRef}
                                    onChange={handleImportJson}
                                    accept=".json,application/json"
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => jsonImportInputRef.current?.click()}
                                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:text-white"
                                    title="นำเข้าการตั้งค่าพิกัดจากไฟล์ JSON"
                                >
                                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>Import JSON</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExportJson}
                                    className="px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/50 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                    title="ส่งออกการตั้งค่าพิกัดทั้งหมดออกเป็นไฟล์ JSON"
                                >
                                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Export JSON</span>
                                </button>
                            </div>
                        </div>

                        {/* Tab Sidebar layout */}
                        <div className="flex flex-col md:flex-row gap-4 flex-1">
                            {/* Left-hand sidebar nav bar */}
                            <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 md:pr-3 border-b md:border-b-0 md:border-r border-gray-900 scrollbar-thin scrollbar-thumb-gray-800 shrink-0 md:w-[150px] max-h-[550px] md:overflow-y-auto">
                                {ALL_CAPTURE_TABS.map((tab) => (
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
                                        domains: { label: 'Domains Overview', img: capturedScreenshot, type: 'domains', path: '/domains/overview', setter: setCapturedScreenshot, key: 'control_capturedScreenshot' },
                                        dns: { label: 'DNS Records', img: (capturedDnsScreenshot && Array.isArray(capturedDnsScreenshot) && capturedDnsScreenshot.length > 0) ? capturedDnsScreenshot : (capturedDnsScreenshot ? [capturedDnsScreenshot] : null), type: 'dns', path: '/dns/records', setter: setCapturedDnsScreenshot, key: 'control_capturedDnsScreenshot', isArray: true },
                                        loadBalancingSpectrum: { label: 'Load Balancing & Spectrum (IF Enable)', img: capturedLoadBalancingSpectrumScreenshot, type: 'load-balancing-spectrum', path: '/traffic/load-balancing', setter: setCapturedLoadBalancingSpectrumScreenshot, key: 'control_capturedLoadBalancingSpectrumScreenshot' },
                                        botManagement: { label: 'Bot Management', img: capturedBotManagementScreenshot, type: 'bot-management', path: '/security/settings', setter: setCapturedBotManagementScreenshot, key: 'control_capturedBotManagementScreenshot' },
                                        securityLevel: { label: 'Security Level & BIC', img: capturedSecurityLevelScreenshot, type: 'security-level', path: '/security/settings', setter: setCapturedSecurityLevelScreenshot, key: 'control_capturedSecurityLevelScreenshot' },
                                        browserIntegrity: { label: 'Browser Integrity Check (IF Enable)', img: capturedBrowserIntegrityScreenshot, type: 'browser-integrity-check', path: '/security/settings', setter: setCapturedBrowserIntegrityScreenshot, key: 'control_capturedBrowserIntegrityScreenshot' },
                                        sslOverview: { label: 'SSL/TLS Encryption', img: capturedSslOverviewScreenshot, type: 'ssl-overview', path: '/ssl-tls', setter: setCapturedSslOverviewScreenshot, key: 'control_capturedSslOverviewScreenshot' },
                                        minTlsVersion: { label: 'Minimum TLS Version', img: capturedMinTlsVersionScreenshot, type: 'min-tls-version', path: '/ssl-tls/edge-certificates', setter: setCapturedMinTlsVersionScreenshot, key: 'control_capturedMinTlsVersionScreenshot' },
                                        tls13: { label: 'TLS 1.3 (IF Enable)', img: capturedTls13Screenshot, type: 'tls-1-3', path: '/ssl-tls/edge-certificates', setter: setCapturedTls13Screenshot, key: 'control_capturedTls13Screenshot' },
                                        traffic: { label: 'HTTP Traffic Overview', img: capturedHttpTrafficScreenshot, type: 'traffic', path: '/analytics/traffic', setter: setCapturedHttpTrafficScreenshot, key: 'control_capturedHttpTrafficScreenshot' },
                                        trafficCountries: { label: 'Traffic by Country', img: capturedTrafficCountriesScreenshot, type: 'traffic-countries', path: '/analytics/traffic', setter: setCapturedTrafficCountriesScreenshot, key: 'control_capturedTrafficCountriesScreenshot' },
                                        firewall: { label: 'Firewall Overview', img: capturedFirewallScreenshot, type: 'firewall', path: '/security/analytics/events', setter: setCapturedFirewallScreenshot, key: 'control_capturedFirewallScreenshot' },
                                        topEventsSource: { label: 'Top Events by Source', img: capturedTopEventsSourceScreenshot, type: 'top-events-source', path: '/security/analytics/events', setter: setCapturedTopEventsSourceScreenshot, key: 'control_capturedTopEventsSourceScreenshot' },
                                        securityRules: { label: 'Security Custom Rules', img: capturedSecurityRulesScreenshot, type: 'security-rules', path: '/security/waf/custom-rules', setter: setCapturedSecurityRulesScreenshot, key: 'control_capturedSecurityRulesScreenshot' },
                                        rateLimiting: { label: 'Rate Limiting Rules', img: capturedRateLimitingScreenshot, type: 'rate-limiting', path: '/security/waf/rate-limiting-rules', setter: setCapturedRateLimitingScreenshot, key: 'control_capturedRateLimitingScreenshot' },
                                        managedRules: { label: 'Managed WAF Rules', img: capturedManagedRulesScreenshot, type: 'managed-rules', path: '/security/waf/managed-rules', setter: setCapturedManagedRulesScreenshot, key: 'control_capturedManagedRulesScreenshot' },
                                        ipAccess: { label: 'IP Access Rules', img: capturedIpAccessScreenshot, type: 'ip-access-rules', path: '/security/security-rules', setter: setCapturedIpAccessScreenshot, key: 'control_capturedIpAccessScreenshot' },
                                        zoneLockdown: { label: 'Zone Lockdown Rules', img: capturedZoneLockdownScreenshot, type: 'zone-lockdown', path: '/security/security-rules', setter: setCapturedZoneLockdownScreenshot, key: 'control_capturedZoneLockdownScreenshot' },
                                        argo: { label: 'Argo Smart Routing', img: capturedArgoScreenshot, type: 'argo', path: '/traffic', setter: setCapturedArgoScreenshot, key: 'control_capturedArgoScreenshot' },
                                        speed: { 
                                            label: 'Speed Test Results (Desktop & Mobile)', 
                                            img: (capturedSpeedScreenshot || capturedSpeedMobileScreenshot) 
                                                ? [
                                                    ...(capturedSpeedScreenshot ? [{ label: '🖥️ Desktop Test Result', src: capturedSpeedScreenshot }] : []),
                                                    ...(capturedSpeedMobileScreenshot ? [{ label: '📱 Mobile Test Result', src: capturedSpeedMobileScreenshot }] : [])
                                                  ]
                                                : null, 
                                            type: 'speed', 
                                            path: '/speed/test/browser', 
                                            setter: setCapturedSpeedScreenshot, 
                                            key: 'control_capturedSpeedScreenshot',
                                            isSpeedDual: true
                                        }
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

                                                {/* Preview mode switcher: real screenshot vs. app-generated "inapp" table preview */}
                                                <div className="flex items-center gap-1 bg-gray-900/60 border border-gray-800 rounded-lg p-0.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setCapturePreviewMode('screenshot')}
                                                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                                            capturePreviewMode === 'screenshot'
                                                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                                                : 'text-gray-500 hover:text-gray-300 border border-transparent'
                                                        }`}
                                                        title="แสดงภาพแคปหน้าจอจริง"
                                                    >
                                                        📸 ภาพแคปจริง
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setCapturePreviewMode('inapp');
                                                            loadInappPreviewData(activeCaptureTab);
                                                        }}
                                                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                                            capturePreviewMode === 'inapp'
                                                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                                                : 'text-gray-500 hover:text-gray-300 border border-transparent'
                                                        }`}
                                                        title="แสดงตัวแปร inapp (ตารางที่แอปสร้างเอง)"
                                                    >
                                                        🧩 inapp
                                                    </button>
                                                    {capturePreviewMode === 'inapp' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => loadInappPreviewData(activeCaptureTab, true)}
                                                            disabled={isLoadingInappPreview}
                                                            className="px-1.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer text-gray-500 hover:text-indigo-300 border border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
                                                            title="ดึงข้อมูล inapp ใหม่ (บังคับรีเฟรช ไม่ใช้ cache)"
                                                        >
                                                            <RefreshCw className={`w-3 h-3 ${isLoadingInappPreview ? 'animate-spin' : ''}`} />
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => setCapturePreviewMode('upload')}
                                                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                                            capturePreviewMode === 'upload'
                                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                                                : 'text-gray-500 hover:text-gray-300 border border-transparent'
                                                        }`}
                                                        title="อัปโหลดรูปภาพเอง (ใช้แทนภาพแคปอัตโนมัติ)"
                                                    >
                                                        🖼️ อัปโหลดเอง
                                                    </button>
                                                </div>
                                            </div>

                                            {capturePreviewMode === 'upload' ? (
                                                (() => {
                                                    const slot = UPLOADED_SLOTS.find(s => s.id === activeCaptureTab);
                                                    const slotId = slot ? slot.id : activeCaptureTab;
                                                    const currentUploaded = uploadedImages[slotId];
                                                    const isBusy = uploadingImageId === slotId;
                                                    return (
                                                        <div className="rounded-xl border border-emerald-800/60 bg-gray-950/60 p-4 flex flex-col gap-3">
                                                            <p className="text-[11px] text-gray-400">
                                                                อัปโหลดรูปภาพของคุณเองสำหรับส่วนนี้ ใช้แทนภาพแคปอัตโนมัติหรือ inapp — เหมาะกรณีต้องการแคปเอง หรือหน้า Cloudflare เปลี่ยนแปลงจนแคปอัตโนมัติใช้ไม่ได้ชั่วคราว
                                                                {slot && (
                                                                    <> (ตัวแปร: <code className="text-emerald-300">{slot.varName}</code>)</>
                                                                )}
                                                            </p>
                                                            {uploadImageError && (
                                                                <p className="text-[11px] text-rose-400">{uploadImageError}</p>
                                                            )}
                                                            {currentUploaded ? (
                                                                <div className="rounded-xl border border-gray-800/80 bg-black flex items-center justify-center p-2 overflow-hidden group relative">
                                                                    <img src={currentUploaded} className="max-w-full rounded h-auto max-h-[380px] object-contain" alt="Uploaded" />
                                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity duration-300">
                                                                        <button type="button" onClick={() => openImageInNewTab(currentUploaded)} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer">
                                                                            View Full Image
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={isBusy}
                                                                            onClick={() => handleRemoveUploadedImage(slotId)}
                                                                            className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                                                        >
                                                                            {isBusy ? 'กำลังลบ...' : 'ลบรูป'}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="py-16 px-4 text-center bg-gray-950/40 rounded-2xl border border-dashed border-gray-800 flex flex-col items-center justify-center gap-3">
                                                                    <div className="w-12 h-12 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-500">
                                                                        <Camera className="w-6 h-6" />
                                                                    </div>
                                                                    <p className="text-sm font-bold text-gray-300">ยังไม่มีรูปภาพที่อัปโหลด</p>
                                                                </div>
                                                            )}
                                                            <label className={`self-start px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer border ${isBusy ? 'opacity-40 cursor-not-allowed border-gray-800 text-gray-500' : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'}`}>
                                                                {isBusy ? 'กำลังอัปโหลด...' : (currentUploaded ? '🖼️ เปลี่ยนรูปภาพ' : '🖼️ อัปโหลดรูปภาพ')}
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    disabled={isBusy}
                                                                    onChange={(e) => {
                                                                        const file = e.target.files && e.target.files[0];
                                                                        if (file) handleUploadImage(slotId, file);
                                                                        e.target.value = '';
                                                                    }}
                                                                />
                                                            </label>
                                                        </div>
                                                    );
                                                })()
                                            ) : capturePreviewMode === 'inapp' ? (
                                                <div className="rounded-xl border border-indigo-800/60 bg-gray-950/60 p-4 overflow-auto">
                                                    {isLoadingInappPreview ? (
                                                        <div className="flex items-center justify-center gap-2 py-10 text-xs text-gray-400">
                                                            <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                                                            <span>กำลังโหลดข้อมูลจริงสำหรับตัวอย่าง inapp...</span>
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className="inapp-preview-html"
                                                            dangerouslySetInnerHTML={{ __html: getInappPreviewHtml(activeCaptureTab, inappZoneSettings, {
                                                                zoneName: zones.find(z => z.id === envZone)?.name,
                                                                accountName: accounts.find(a => a.id === envAccount)?.name,
                                                                loadBalancers: inappLoadBalancers,
                                                                speedResult: inappSpeedResult,
                                                                trafficData: inappTrafficData,
                                                                dnsRecords: inappDnsRecords,
                                                            }) }}
                                                        />
                                                    )}
                                                </div>
                                            ) : (
                                            <>
                                            {/* Screenshot Preview (Multi-image in 2 columns, single image centered) */}
                                            {current.img ? (
                                                current.isSpeedDual && Array.isArray(current.img) ? (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {current.img.map((item, idx) => (
                                                            <div key={idx} className="flex flex-col gap-1.5">
                                                                <span className="text-[11px] font-bold text-rose-300 flex items-center gap-1">
                                                                    {item.label}
                                                                </span>
                                                                <div className="rounded-xl border border-gray-800/80 bg-black flex items-center justify-center p-2 overflow-hidden group relative">
                                                                    <img src={item.src} className="max-w-full rounded h-auto max-h-[360px] object-contain transition-transform group-hover:scale-[1.02] duration-300" alt={item.label} />
                                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                                                                        <button type="button" onClick={() => openImageInNewTab(item.src)} className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer">
                                                                            View Full Image
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : current.isArray && Array.isArray(current.img) ? (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {current.img.map((imgSrc, idx) => (
                                                            <div key={idx} className="rounded-xl border border-gray-800/80 bg-black flex items-center justify-center p-2 overflow-hidden group relative">
                                                                <img src={imgSrc} className="max-w-full rounded h-auto max-h-[360px] object-contain transition-transform group-hover:scale-[1.02] duration-300" alt={`${current.label} - Page ${idx + 1}`} />
                                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                                                                    <button type="button" onClick={() => openImageInNewTab(imgSrc)} className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer">
                                                                        View Full Image
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="rounded-xl border border-gray-800/80 bg-black flex items-center justify-center p-2 overflow-hidden group relative">
                                                        <img src={current.img} className="max-w-full rounded h-auto max-h-[380px] object-contain transition-transform group-hover:scale-[1.02] duration-300" alt={current.label} />
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                                                            <button type="button" onClick={() => openImageInNewTab(current.img)} className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer">
                                                                View Full Image
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            ) : (
                                                <div className="py-16 px-4 text-center bg-gray-950/40 rounded-2xl border border-dashed border-gray-800 flex flex-col items-center justify-center gap-3">
                                                    <div className="w-12 h-12 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-500">
                                                        <Camera className="w-6 h-6" />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <p className="text-sm font-bold text-gray-300">ยังไม่มีรูปภาพที่บันทึกไว้</p>
                                                        <p className="text-xs text-gray-500 max-w-md">กดปุ่ม <strong>"📸 Capture This Page Now"</strong> ด้านล่าง เพื่อจับภาพหน้าจอนี้จากเบราว์เซอร์สด</p>
                                                    </div>
                                                </div>
                                            )}
                                            </>
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
                                                            disabled={isCapturingDirect}
                                                            onClick={() => handleDirectCapture(activeCaptureTab, current.type, current.setter, current.key, current.path)}
                                                            className={`px-3 py-1 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/60 text-rose-200 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                                                                isCapturingDirect ? 'opacity-60 cursor-not-allowed' : ''
                                                            }`}
                                                            title="กดเพื่อจับภาพหน้าจอนี้ทันที"
                                                        >
                                                            {isCapturingDirect ? (
                                                                <>
                                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-300" />
                                                                    <span>Capturing...</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span>📸 Capture This Page Now</span>
                                                                </>
                                                            )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={saveCoordsToDatabase}
                                                            className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white text-[11px] font-semibold rounded-lg transition-colors cursor-pointer shadow-sm"
                                                            title="บันทึกพิกัดลงฐานข้อมูลกลาง"
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

                                                {/* Coordinates Setting Grid */}
                                                {(() => {
                                                    const DYNAMIC_TABS = ['domains', 'dns', 'securityRules', 'rateLimiting', 'managedRules', 'ipAccess', 'zoneLockdown'];
                                                    const isDynamicTab = DYNAMIC_TABS.includes(activeCaptureTab);

                                                    return (
                                                        <>
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-[10px] text-cyan-400 font-mono font-medium flex items-center gap-1">
                                                                        Xstart (Offset)
                                                                    </span>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="0"
                                                                        value={coords[activeCaptureTab]?.xStart ?? '0'}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            if (/^-?\d*$/.test(val)) {
                                                                                handleCoordChange(activeCaptureTab, 'xStart', val);
                                                                            }
                                                                        }}
                                                                        className="bg-gray-950/90 border border-cyan-800/40 rounded px-2.5 py-1 text-xs text-cyan-200 focus:outline-none focus:border-cyan-500/50 transition-colors w-full font-mono"
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-[10px] text-cyan-400 font-mono font-medium flex items-center gap-1">
                                                                        Xend (Offset)
                                                                    </span>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="0"
                                                                        value={coords[activeCaptureTab]?.xEnd ?? '0'}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            if (/^-?\d*$/.test(val)) {
                                                                                handleCoordChange(activeCaptureTab, 'xEnd', val);
                                                                            }
                                                                        }}
                                                                        className="bg-gray-950/90 border border-cyan-800/40 rounded px-2.5 py-1 text-xs text-cyan-200 focus:outline-none focus:border-cyan-500/50 transition-colors w-full font-mono"
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-[10px] text-cyan-400 font-mono font-medium flex items-center gap-1">
                                                                        Ystart (Offset)
                                                                    </span>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="0"
                                                                        value={coords[activeCaptureTab]?.yStart ?? '0'}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            if (/^-?\d*$/.test(val)) {
                                                                                handleCoordChange(activeCaptureTab, 'yStart', val);
                                                                            }
                                                                        }}
                                                                        className="bg-gray-950/90 border border-cyan-800/40 rounded px-2.5 py-1 text-xs text-cyan-200 focus:outline-none focus:border-cyan-500/50 transition-colors w-full font-mono"
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-[10px] text-cyan-400 font-mono font-medium flex items-center gap-1">
                                                                        Yend (Offset)
                                                                    </span>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="0"
                                                                        value={coords[activeCaptureTab]?.yEnd ?? '0'}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            if (/^-?\d*$/.test(val)) {
                                                                                handleCoordChange(activeCaptureTab, 'yEnd', val);
                                                                            }
                                                                        }}
                                                                        className="bg-gray-950/90 border border-cyan-800/40 rounded px-2.5 py-1 text-xs text-cyan-200 focus:outline-none focus:border-cyan-500/50 transition-colors w-full font-mono"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Console Log Section (Right) */}
                <div className={`${activeMainTab === 'capture' ? 'hidden' : 'lg:col-span-12'} flex flex-col gap-6`}>
                    {/* Console / Log output */}
                    <div className={`bg-gray-950 border border-gray-800 rounded-2xl p-4 flex flex-col h-[460px] shadow-2xl relative ${activeMainTab === 'console' ? '' : 'hidden'}`}>
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
                    <div id="active-env-settings-card" className={`bg-gradient-to-br from-rose-950/20 to-gray-900/40 border border-gray-800/80 rounded-2xl p-6 shadow-xl scroll-mt-6 ${activeMainTab === 'setup' ? '' : 'hidden'}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-gray-800/40 pb-3 gap-2">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-rose-500" />
                                    Active Environment Settings
                                </h3>
                                {isEnvReady ? (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                                        <Check className="w-3 h-3 text-emerald-400" /> พร้อมแคปภาพ
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30 animate-pulse">
                                        <ShieldAlert className="w-3 h-3 text-amber-400" /> จำเป็นต้องเลือก Account & Zone
                                    </span>
                                )}
                                {isLoadingSettings && (
                                    <span className="flex items-center gap-1.5 text-xs text-rose-400 font-normal lowercase normal-case bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                        <RefreshCw className="w-3 h-3 animate-spin text-rose-500" />
                                        Loading...
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={saveAsDefault}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 border border-rose-500/30 rounded-lg text-[10px] font-bold text-white transition-colors shadow-md self-start sm:self-auto cursor-pointer"
                            >
                                <Check className="w-3.5 h-3.5 text-white" />
                                Set as Default
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            {/* Account Dropdown */}
                            <div className="flex flex-col gap-1 py-1 justify-end">
                                <SearchableDropdown 
                                    label="Account (จำเป็น) *"
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
                                    label="Zone / Domain (จำเป็น) *"
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



                </div>
            </div>
        </div>
    );
}
