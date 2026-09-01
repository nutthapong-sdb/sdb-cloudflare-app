import { useState, useEffect } from 'react';
import { X, Settings, RotateCcw, Download, Sliders, Shield, Lock, Activity, Globe, Check } from 'lucide-react';
import Swal from 'sweetalert2';

export const IMAGE_CONFIG_ITEMS = [
    { key: 'domains', varTag: '@captured_domain_page', label: 'Domain Overview (Sites)', desc: 'ภาพรวมหน้ารวมไซต์โดเมนทั้งหมด', category: 'domains', defaultWidth: 605, defaultCoords: { xStart: '395', xEnd: '1785', yStart: '85', yEnd: '' } },
    { key: 'dns', varTag: '@captured_dns_page', label: 'DNS Records', desc: 'ภาพรายการบันทึก DNS Records ทั้งหมด', category: 'domains', defaultWidth: 605, defaultCoords: { xStart: '365', xEnd: '1843', yStart: '95', yEnd: '' } },
    { key: 'botManagement', varTag: '@captured_bot_management', label: 'Bot Management', desc: 'ภาพกล่องการตั้งค่า Bot Management (Super Bot Fight Mode)', category: 'security', defaultWidth: 605, defaultCoords: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '750' } },
    { key: 'securityLevel', varTag: '@captured_security_level', label: 'Security Level & BIC', desc: 'ภาพกล่องการตั้งค่า Security Level และ Browser Integrity Check', category: 'security', defaultWidth: 605, defaultCoords: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '850' } },
    { key: 'sslOverview', varTag: '@captured_ssl_overview', label: 'SSL/TLS Encryption', desc: 'ภาพกล่องการตั้งค่าโหมด SSL/TLS Encryption (Full/Strict)', category: 'ssl', defaultWidth: 605, defaultCoords: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '800' } },
    { key: 'sslEdge', varTag: '@captured_ssl_edge', label: 'Edge Certificates (TLS 1.2/1.3)', desc: 'ภาพกล่องการตั้งค่า Minimum TLS Version และ TLS 1.3', category: 'ssl', defaultWidth: 605, defaultCoords: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '900' } },
    { key: 'traffic', varTag: '@captured_traffic_page', label: 'HTTP Traffic Overview', desc: 'ภาพรวมกราฟ HTTP Traffic สถิติคำขอทั้งหมด', category: 'traffic', defaultWidth: 605, defaultCoords: { xStart: '422', xEnd: '1766', yStart: '105', yEnd: '1005' } },
    { key: 'trafficCountries', varTag: '@captured_traffic_countries_page', label: 'Traffic by Country', desc: 'ภาพตารางสถิติปริมาณ Requests แยกตามประเทศ', category: 'traffic', defaultWidth: 605, defaultCoords: { xStart: '350', xEnd: '1880', yStart: '100', yEnd: '950' } },
    { key: 'firewall', varTag: '@captured_firewall_page', label: 'Firewall Overview', desc: 'ภาพหน้าจอเหตุการณ์ความปลอดภัยและ WAF Analytics', category: 'security', defaultWidth: 605, defaultCoords: { xStart: '288', xEnd: '1728', yStart: '115', yEnd: '980' } },
    { key: 'topEventsSource', varTag: '@captured_top_events_source_page', label: 'Top Events by Source', desc: 'ภาพตารางสถิติเหตุการณ์ Top Events แยกตาม Source', category: 'security', defaultWidth: 605, defaultCoords: { xStart: '288', xEnd: '1728', yStart: '100', yEnd: '950' } },
    { key: 'securityRules', varTag: '@captured_security_rules_page', label: 'Security Rules (WAF)', desc: 'ภาพหน้ารายการกฎความปลอดภัย Custom Rules', category: 'security', defaultWidth: 605, defaultCoords: { xStart: '350', xEnd: '1880', yStart: '85', yEnd: '' } },
    { key: 'rateLimiting', varTag: '@captured_rate_limiting_page', label: 'Rate Limiting Rules', desc: 'ภาพหน้ารายการกฎ Rate Limiting Rules', category: 'security', defaultWidth: 605, defaultCoords: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '' } },
    { key: 'managedRules', varTag: '@captured_managed_rules_page', label: 'Managed WAF Rules', desc: 'ภาพหน้ารายการกฎ Managed WAF Rules', category: 'security', defaultWidth: 605, defaultCoords: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '' } },
    { key: 'ipAccess', varTag: '@captured_ip_access_page', label: 'IP Access Rules', desc: 'ภาพหน้ารายการกฎ IP Access Rules', category: 'security', defaultWidth: 605, defaultCoords: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '' } },
    { key: 'zoneLockdown', varTag: '@captured_zone_lockdown_page', label: 'Zone Lockdown Rules', desc: 'ภาพหน้ารายการกฎ Zone Lockdown Rules', category: 'security', defaultWidth: 605, defaultCoords: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '' } },
    { key: 'argo', varTag: '@captured_argo_page', label: 'Argo Smart Routing', desc: 'ภาพการตั้งค่า Argo Smart Routing', category: 'traffic', defaultWidth: 605, defaultCoords: { xStart: '520', xEnd: '1632', yStart: '90', yEnd: '600' } },
    { key: 'speed', varTag: '@captured_speed_page', label: 'Speed Test (Desktop)', desc: 'ภาพผลการทดสอบความเร็วเว็บไซต์แบบ Desktop', category: 'domains', defaultWidth: 605, defaultCoords: { xStart: '480', xEnd: '1632', yStart: '115', yEnd: '870' } },
    { key: 'speedMobile', varTag: '@captured_speed_mobile_page', label: 'Speed Test (Mobile)', desc: 'ภาพผลการทดสอบความเร็วเว็บไซต์แบบ Mobile', category: 'domains', defaultWidth: 605, defaultCoords: { xStart: '480', xEnd: '1632', yStart: '95', yEnd: '850' } },
    { key: 'dashboard', varTag: '@DASHBOARD_IMAGE', label: 'Full Dashboard Snapshot', desc: 'ภาพรวม Dashboard Snapshot ทั้งหมด (@DASHBOARD_IMAGE)', category: 'domains', defaultWidth: 504, defaultCoords: { xStart: '', xEnd: '', yStart: '', yEnd: '' } }
];

const DEFAULT_WIDTHS = Object.fromEntries(IMAGE_CONFIG_ITEMS.map(i => [i.key, i.defaultWidth]));
const DEFAULT_COORDS = Object.fromEntries(IMAGE_CONFIG_ITEMS.map(i => [i.key, { ...i.defaultCoords }]));

export default function ImageSettingsModal({ isOpen, onClose, theme }) {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [widths, setWidths] = useState(DEFAULT_WIDTHS);
    const [coords, setCoords] = useState(DEFAULT_COORDS);

    useEffect(() => {
        if (!isOpen) return;
        if (typeof window !== 'undefined') {
            try {
                // Load independent Image Size Settings
                const storedSettings = localStorage.getItem('ntbc:image-size-settings');
                if (storedSettings) {
                    const parsed = JSON.parse(storedSettings);
                    if (parsed.widths) setWidths(prev => ({ ...prev, ...parsed.widths }));
                    if (parsed.coords) setCoords(prev => ({ ...prev, ...parsed.coords }));
                } else {
                    // Fallback to legacy widths if available
                    const legacyWidths = localStorage.getItem('ntbc:cropped-image-widths');
                    if (legacyWidths) {
                        setWidths(prev => ({ ...prev, ...JSON.parse(legacyWidths) }));
                    }
                }
            } catch (e) {
                console.error('Failed to load image settings:', e);
            }
        }
    }, [isOpen]);

    const handleWidthChange = (key, val) => {
        const intVal = parseInt(val, 10);
        setWidths(prev => ({
            ...prev,
            [key]: isNaN(intVal) ? '' : intVal
        }));
    };

    const handleCoordChange = (key, coordKey, val) => {
        setCoords(prev => ({
            ...prev,
            [key]: {
                ...(prev[key] || {}),
                [coordKey]: val
            }
        }));
    };

    // Pull settings from Debug Setting (independent pull)
    const handlePullFromDebugSettings = async () => {
        try {
            let debugCoords = null;
            // 1. Try fetching from server API first
            const res = await fetch('/api/ntbc-capture-coords');
            if (res.ok) {
                debugCoords = await res.json();
            }
            // 2. Fallback to localStorage control_coords
            if (!debugCoords && typeof window !== 'undefined') {
                const stored = localStorage.getItem('control_coords');
                if (stored) debugCoords = JSON.parse(stored);
            }

            if (debugCoords) {
                setCoords(prev => {
                    const updated = { ...prev };
                    for (const [k, v] of Object.entries(debugCoords)) {
                        if (updated[k]) {
                            updated[k] = { ...updated[k], ...v };
                        } else {
                            updated[k] = { ...v };
                        }
                    }
                    return updated;
                });

                Swal.fire({
                    title: 'ดึงค่าสำเร็จ!',
                    text: 'คัดลอกพิกัด Crop จาก Debug Setting เรียบร้อยแล้ว (อย่าลืมกด Save Settings)',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false,
                    background: '#111827',
                    color: '#fff'
                });
            } else {
                Swal.fire('Info', 'ไม่พบข้อมูลพิกัดใน Debug Setting', 'info');
            }
        } catch (e) {
            console.error('Failed to pull debug coordinates:', e);
            Swal.fire('Error', 'เกิดข้อผิดพลาดในการดึงค่าจาก Debug Setting', 'error');
        }
    };

    const handleSave = () => {
        const finalWidths = {};
        for (const [key, val] of Object.entries(widths)) {
            const intVal = parseInt(val, 10);
            if (isNaN(intVal) || intVal <= 0) {
                Swal.fire('Error', `กรุณากรอกความกว้างภาพที่ถูกต้องสำหรับ ${key}`, 'error');
                return;
            }
            finalWidths[key] = intVal;
        }

        if (typeof window !== 'undefined') {
            try {
                // Save to independent storage
                const payload = {
                    widths: finalWidths,
                    coords: coords,
                    updatedAt: new Date().toISOString()
                };
                localStorage.setItem('ntbc:image-size-settings', JSON.stringify(payload));
                localStorage.setItem('ntbc:cropped-image-widths', JSON.stringify(finalWidths));

                Swal.fire({
                    title: 'Saved!',
                    text: 'บันทึกการตั้งค่าขนาดภาพและพิกัด Crop สำหรับ Image Size Setting เรียบร้อยแล้ว',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false,
                    background: '#111827',
                    color: '#fff'
                });
                onClose();
            } catch (e) {
                Swal.fire('Error', 'Failed to save settings', 'error');
            }
        }
    };

    const handleReset = () => {
        setWidths(DEFAULT_WIDTHS);
        setCoords(DEFAULT_COORDS);
    };

    if (!isOpen) return null;

    const t = theme || {
        modalOverlay: 'bg-black/75 backdrop-blur-sm',
        modalBg: 'bg-gray-900',
        modalBorder: 'border-gray-800',
        modalHeaderBg: 'bg-gray-950/50',
        modalTitle: 'text-white',
        modalCloseIcon: 'text-gray-400 hover:text-white',
        iconAccent: 'text-blue-400',
        buttonPrimary: 'bg-blue-600 hover:bg-blue-500 text-white',
        subText: 'text-gray-400',
        card: 'bg-gray-800/40 border-gray-700/50',
        text: 'text-gray-200',
        button: 'bg-gray-800 text-gray-300'
    };

    const filteredItems = selectedCategory === 'all' 
        ? IMAGE_CONFIG_ITEMS 
        : IMAGE_CONFIG_ITEMS.filter(i => i.category === selectedCategory);

    return (
        <div
            className={`fixed inset-0 z-[200] flex items-center justify-center p-4 ${t.modalOverlay}`}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className={`${t.modalBg} border ${t.modalBorder} rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-5 border-b ${t.modalBorder} ${t.modalHeaderBg} rounded-t-2xl`}>
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 text-blue-400">
                            <Sliders className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className={`text-base font-bold ${t.modalTitle}`}>Image Size & Crop Settings</h2>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono">
                                    Independent Config
                                </span>
                            </div>
                            <p className={`text-xs ${t.subText} mt-0.5`}>
                                กำหนดขนาดความกว้าง (Width px) และพิกัด Crop หน้าจอสำหรับรายงาน Word (ไม่เชื่อมโยงค่าอัตโนมัติกับ Debug Setting)
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${t.modalCloseIcon}`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Categories & Actions Bar */}
                <div className="px-5 py-3 border-b border-gray-800/80 bg-gray-950/40 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                        {[
                            { id: 'all', label: 'All Images', icon: Globe },
                            { id: 'security', label: 'Security & WAF', icon: Shield },
                            { id: 'ssl', label: 'SSL / TLS', icon: Lock },
                            { id: 'traffic', label: 'Traffic & Events', icon: Activity },
                            { id: 'domains', label: 'Domains & General', icon: Globe },
                        ].map((cat) => {
                            const Icon = cat.icon;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                        selectedCategory === cat.id
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'bg-gray-800/60 hover:bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700/50'
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Pull from Debug Settings Button */}
                    <button
                        onClick={handlePullFromDebugSettings}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-semibold transition-all shadow-sm cursor-pointer"
                        title="คัดลอกค่าพิกัด Crop ล่าสุดมาจาก Debug Setting"
                    >
                        <Download className="w-3.5 h-3.5 text-indigo-400" />
                        📥 ดึงค่าจาก Debug Setting
                    </button>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <div className="grid grid-cols-1 gap-3.5">
                        {filteredItems.map((item) => {
                            const itemCoords = coords[item.key] || { xStart: '', xEnd: '', yStart: '', yEnd: '' };
                            return (
                                <div key={item.key} className={`p-4 border ${t.card || 'border-gray-800 bg-gray-900/50'} rounded-xl transition-all hover:border-gray-700/80`}>
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className={`text-sm font-bold ${t.text || 'text-gray-100'}`}>{item.label}</h3>
                                                <span className="text-[11px] font-mono text-purple-400 bg-purple-950/60 border border-purple-800/50 px-2 py-0.5 rounded">
                                                    {item.varTag}
                                                </span>
                                            </div>
                                            <p className={`text-xs ${t.subText || 'text-gray-400'} mt-1`}>{item.desc}</p>
                                        </div>

                                        {/* Width setting */}
                                        <div className="flex items-center gap-2 shrink-0 bg-gray-950/60 p-2 rounded-lg border border-gray-800">
                                            <span className="text-xs text-gray-400 font-medium">Export Width:</span>
                                            <input
                                                type="number"
                                                value={widths[item.key] ?? item.defaultWidth}
                                                onChange={(e) => handleWidthChange(item.key, e.target.value)}
                                                className="w-20 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-mono text-center"
                                                placeholder={String(item.defaultWidth)}
                                                min="1"
                                            />
                                            <span className="text-[10px] text-gray-500 font-mono">px</span>
                                        </div>
                                    </div>

                                    {/* Crop Coordinates Grid */}
                                    {item.key !== 'dashboard' && (
                                        <div className="mt-3 pt-3 border-t border-gray-800/60 grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-gray-950/40 p-2.5 rounded-lg">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] text-gray-400 font-mono">X-Start (px)</span>
                                                <input
                                                    type="number"
                                                    value={itemCoords.xStart || ''}
                                                    onChange={(e) => handleCoordChange(item.key, 'xStart', e.target.value)}
                                                    placeholder="Auto"
                                                    className="bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] text-gray-400 font-mono">X-End (px)</span>
                                                <input
                                                    type="number"
                                                    value={itemCoords.xEnd || ''}
                                                    onChange={(e) => handleCoordChange(item.key, 'xEnd', e.target.value)}
                                                    placeholder="Auto"
                                                    className="bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] text-gray-400 font-mono">Y-Start (px)</span>
                                                <input
                                                    type="number"
                                                    value={itemCoords.yStart || ''}
                                                    onChange={(e) => handleCoordChange(item.key, 'yStart', e.target.value)}
                                                    placeholder="Auto"
                                                    className="bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] text-gray-400 font-mono">Y-End (px)</span>
                                                <input
                                                    type="text"
                                                    value={itemCoords.yEnd || ''}
                                                    onChange={(e) => handleCoordChange(item.key, 'yEnd', e.target.value)}
                                                    placeholder="Auto"
                                                    className="bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className={`p-4 border-t ${t.modalBorder} ${t.modalHeaderBg} flex items-center justify-between rounded-b-2xl`}>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                        title="Reset all fields to default values"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> รีเซ็ตเป็นค่าเริ่มต้น
                    </button>
                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={onClose}
                            className={`px-4 py-2 hover:bg-white/10 rounded-lg text-xs font-semibold transition-colors ${t.button || 'bg-gray-800 text-gray-300'}`}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-lg flex items-center gap-1.5 ${t.buttonPrimary || 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                        >
                            <Check className="w-4 h-4" /> Save Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
