import { useState, useEffect } from 'react';
import { X, Settings, RotateCcw, Sliders, Shield, Lock, Activity, Globe, Check } from 'lucide-react';
import Swal from './utils/alert';

const CAPTURED_IMAGE_ITEMS = [
    { key: 'domains', varTag: '@captured_domain_page', label: 'Domain Overview (Sites)', desc: 'ภาพรวมหน้ารวมไซต์โดเมนทั้งหมด', category: 'domains', defaultWidth: 605, defaultCoords: { xStart: '395', xEnd: '1785', yStart: '85', yEnd: '' } },
    { key: 'dns', varTag: '@captured_dns_page', label: 'DNS Records', desc: 'ภาพรายการบันทึก DNS Records ทั้งหมด', category: 'domains', defaultWidth: 605, defaultCoords: { xStart: '365', xEnd: '1843', yStart: '95', yEnd: '' } },
    { key: 'botManagement', varTag: '@captured_bot_management', label: 'Bot Management', desc: 'ภาพกล่องการตั้งค่า Bot Management (Super Bot Fight Mode)', category: 'security', defaultWidth: 605, defaultCoords: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '750' } },
    { key: 'securityLevel', varTag: '@captured_security_level', label: 'Security Level & BIC', desc: 'ภาพกล่องการตั้งค่า Security Level และ Browser Integrity Check', category: 'security', defaultWidth: 605, defaultCoords: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '850' } },
    { key: 'sslOverview', varTag: '@captured_ssl_overview', label: 'SSL/TLS Encryption', desc: 'ภาพกล่องการตั้งค่าโหมด SSL/TLS Encryption (Full/Strict)', category: 'ssl', defaultWidth: 605, defaultCoords: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '800' } },
    { key: 'sslEdge', varTag: '@captured_ssl_edge', label: 'Edge Certificates (TLS 1.2/1.3)', desc: 'ภาพกล่องการตั้งค่า Minimum TLS Version และ TLS 1.3', category: 'ssl', defaultWidth: 605, defaultCoords: { xStart: '350', xEnd: '1880', yStart: '95', yEnd: '900' } },
    { key: 'minTlsVersion', varTag: '@captured_min_tls_version', label: 'Minimum TLS Version', desc: 'ภาพกล่องการตั้งค่า Minimum TLS Version', category: 'ssl', defaultWidth: 605, defaultCoords: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' } },
    { key: 'tls13', varTag: '@captured_tls_1_3', label: 'TLS 1.3 (IF Enable)', desc: 'ภาพกล่องการตั้งค่า TLS 1.3', category: 'ssl', defaultWidth: 605, defaultCoords: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' } },
    { key: 'browserIntegrity', varTag: '@captured_browser_integrity', label: 'Browser Integrity Check (IF Enable)', desc: 'ภาพกล่องการตั้งค่า Browser Integrity Check', category: 'security', defaultWidth: 605, defaultCoords: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' } },
    { key: 'loadBalancingSpectrum', varTag: '@captured_load_balancing_spectrum', label: 'Load Balancing & Spectrum (IF Enable)', desc: 'ภาพกล่อง/ตาราง Load Balancing และ Spectrum records', category: 'domains', defaultWidth: 605, defaultCoords: { xStart: '0', xEnd: '0', yStart: '0', yEnd: '0' } },
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

// Every "@captured_X" screenshot slot also has an "@inapp_X" (app-generated mockup table) and
// "@uploaded_X" (user-uploaded image) counterpart — see variableDefinitions.js / uploadedVariables.js.
// All three need their own configurable export width so a user can size the inapp table or their
// uploaded image the same way they size a real screenshot. Crop coordinates only make sense for a
// real screenshot (they describe where Puppeteer crops the captured page), so the derived inapp/
// uploaded items intentionally carry no defaultCoords, and the modal hides that section for them.
const deriveVariantItem = (item, variant, variantLabel) => ({
    key: `${variant}_${item.key}`,
    varTag: item.varTag.replace('@captured_', `@${variant}_`),
    label: `${item.label} (${variantLabel})`,
    desc: item.desc,
    category: item.category,
    type: variant,
    defaultWidth: item.defaultWidth,
});

const CAPTURED_ONLY_ITEMS = CAPTURED_IMAGE_ITEMS.filter(i => i.key !== 'dashboard').map(i => ({ ...i, type: 'captured' }));
const DASHBOARD_ITEM = { ...CAPTURED_IMAGE_ITEMS.find(i => i.key === 'dashboard'), type: 'dashboard' };

export const IMAGE_CONFIG_ITEMS = [
    ...CAPTURED_ONLY_ITEMS,
    ...CAPTURED_ONLY_ITEMS.map(i => deriveVariantItem(i, 'inapp', 'inapp')),
    ...CAPTURED_ONLY_ITEMS.map(i => deriveVariantItem(i, 'uploaded', 'อัปโหลดเอง')),
    DASHBOARD_ITEM,
];

const DEFAULT_WIDTHS = Object.fromEntries(IMAGE_CONFIG_ITEMS.map(i => [i.key, i.defaultWidth]));

export default function ImageSettingsModal({ isOpen, onClose, theme }) {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedType, setSelectedType] = useState('all');
    const [widths, setWidths] = useState(DEFAULT_WIDTHS);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        (async () => {
            // Server copy first (what reports — including background jobs — actually use),
            // then this browser's older localStorage copy.
            let loaded = null;
            try {
                const data = await fetch('/api/ntbc-image-widths').then(r => r.json());
                if (data?.widths) loaded = data.widths;
            } catch (e) {
                console.error('Failed to load image widths from server:', e);
            }
            if (!loaded && typeof window !== 'undefined') {
                try {
                    const stored = localStorage.getItem('ntbc:image-size-settings');
                    loaded = stored ? JSON.parse(stored).widths : JSON.parse(localStorage.getItem('ntbc:cropped-image-widths') || 'null');
                } catch (e) { /* ignore */ }
            }
            if (!cancelled && loaded) setWidths({ ...DEFAULT_WIDTHS, ...loaded });
        })();
        return () => { cancelled = true; };
    }, [isOpen]);

    const handleWidthChange = (key, val) => {
        const intVal = parseInt(val, 10);
        setWidths(prev => ({
            ...prev,
            [key]: isNaN(intVal) ? '' : intVal
        }));
    };

    const handleSave = async () => {
        const finalWidths = {};
        for (const [key, val] of Object.entries(widths)) {
            const intVal = parseInt(val, 10);
            if (isNaN(intVal) || intVal <= 0) {
                Swal.fire('Error', `กรุณากรอกความกว้างภาพที่ถูกต้องสำหรับ ${key}`, 'error');
                return;
            }
            finalWidths[key] = intVal;
        }

        try {
            const res = await fetch('/api/ntbc-image-widths', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ widths: finalWidths })
            }).then(r => r.json());
            if (!res?.success) throw new Error(res?.error || 'Save failed');
            if (typeof window !== 'undefined') {
                localStorage.setItem('ntbc:cropped-image-widths', JSON.stringify(finalWidths));
            }
            Swal.fire({
                title: 'Saved!',
                text: 'บันทึกขนาดภาพเรียบร้อยแล้ว (ใช้กับทุกรายงาน รวมถึงงานเบื้องหลัง)',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                background: '#111827',
                color: '#fff'
            });
            onClose();
        } catch (e) {
            Swal.fire('Error', `Failed to save settings: ${e.message}`, 'error');
        }
    };

    const handleReset = () => {
        setWidths(DEFAULT_WIDTHS);
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

    const filteredItems = IMAGE_CONFIG_ITEMS
        .filter(i => selectedCategory === 'all' || i.category === selectedCategory)
        .filter(i => selectedType === 'all' || i.type === selectedType);

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
                                <h2 className={`text-base font-bold ${t.modalTitle}`}>Image Size Settings</h2>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono">
                                    Independent Config
                                </span>
                            </div>
                            <p className={`text-xs ${t.subText} mt-0.5`}>
                                กำหนดขนาดความกว้าง (Width px) ของภาพในรายงาน สำหรับ 📸 ภาพแคปจริง, 🧩 inapp และ 🖼️ อัปโหลดเอง
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

                    {/* Crop coordinates no longer live here — they are per preset on the debug page */}
                    <span className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/50 px-3 py-1.5 rounded-lg">
                        ✂️ พิกัดตัดรูป (Crop) ตั้งที่หน้า Debug → บันทึกลง Preset → เลือก Preset ให้ Template
                    </span>
                </div>

                {/* Variable-type filter: captured / inapp / uploaded each have their own width setting now */}
                <div className="px-5 py-2.5 border-b border-gray-800/80 bg-gray-950/20 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                    <span className="text-[11px] text-gray-500 font-semibold shrink-0">ประเภทตัวแปร:</span>
                    {[
                        { id: 'all', label: 'ทั้งหมด' },
                        { id: 'captured', label: '📸 ภาพแคปจริง' },
                        { id: 'inapp', label: '🧩 inapp' },
                        { id: 'uploaded', label: '🖼️ อัปโหลดเอง' },
                        { id: 'dashboard', label: 'Dashboard' },
                    ].map((tp) => (
                        <button
                            key={tp.id}
                            type="button"
                            onClick={() => setSelectedType(tp.id)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                                selectedType === tp.id
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'text-gray-500 hover:text-gray-300 border border-transparent'
                            }`}
                        >
                            {tp.label}
                        </button>
                    ))}
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <div className="grid grid-cols-1 gap-3.5">
                        {filteredItems.map((item) => {
                            return (
                                <div key={item.key} className={`p-4 border ${t.card || 'border-gray-800 bg-gray-900/50'} rounded-xl transition-all hover:border-gray-700/80`}>
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className={`text-sm font-bold ${t.text || 'text-gray-100'}`}>{item.label}</h3>
                                                <span className="text-[11px] font-mono text-purple-400 bg-purple-950/60 border border-purple-800/50 px-2 py-0.5 rounded">
                                                    {item.varTag}
                                                </span>
                                                {item.type === 'inapp' && (
                                                    <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/60 border border-indigo-800/50 px-1.5 py-0.5 rounded">🧩 inapp</span>
                                                )}
                                                {item.type === 'uploaded' && (
                                                    <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded">🖼️ อัปโหลดเอง</span>
                                                )}
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
