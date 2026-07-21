import { useState, useEffect } from 'react';
import { X, Settings, RotateCcw } from 'lucide-react';
import Swal from 'sweetalert2';

const VARIABLES = [
    { key: '@DASHBOARD_IMAGE', label: 'Full Dashboard (@DASHBOARD_IMAGE@)', desc: 'ภาพรวม Dashboard Snapshot ทั้งหมด' },
    { key: '@DASHBOARD_TOTAL_REQUESTS_TRAFFIC_VOLUME', label: 'Total Requests & Traffic Volume', desc: 'การ์ดแสดงจำนวน Request และปริมาณ Traffic' },
    { key: '@DASHBOARD_AVG_RESPONSE_TIME', label: 'Avg Response Time (TTFB)', desc: 'การ์ดแสดงเวลาตอบสนองเฉลี่ย' },
    { key: '@DASHBOARD_BLOCKED_EVENTS_FIREWALL_ACTIONS', label: 'Blocked Events & Firewall Actions', desc: 'การ์ดแสดงการสกัดกั้นและท็อปแอคชันไฟร์วอลล์' },
    { key: '@DASHBOARD_TOP_URLS', label: 'Top URLs', desc: 'การ์ดแสดงอันดับ URL ยอดนิยม' },
    { key: '@DASHBOARD_TOP_CLIENT_IPS', label: 'Top Client IPs', desc: 'การ์ดแสดงอันดับ Client IP' },
    { key: '@DASHBOARD_TOP_USER_AGENTS', label: 'Top User Agents', desc: 'การ์ดแสดงอันดับ User Agent' },
    { key: '@DASHBOARD_ATTACK_PREVENTION_HISTORY', label: 'Attack Prevention History', desc: 'กราฟประวัติการป้องกันการโจมตี' },
    { key: '@DASHBOARD_TOP_WAF_RULES', label: 'Top WAF Rules', desc: 'การ์ดแสดงอันดับกฎ WAF ที่ทำงาน' },
    { key: '@DASHBOARD_TOP_5_ATTACKERS', label: 'Top 5 Attackers', desc: 'การ์ดแสดงอันดับ 5 ผู้โจมตีสูงสุด' }
];

const DEFAULT_WIDTHS = {
    '@DASHBOARD_IMAGE': 504,
    '@DASHBOARD_TOTAL_REQUESTS_TRAFFIC_VOLUME': 504,
    '@DASHBOARD_AVG_RESPONSE_TIME': 504,
    '@DASHBOARD_BLOCKED_EVENTS_FIREWALL_ACTIONS': 504,
    '@DASHBOARD_TOP_URLS': 504,
    '@DASHBOARD_TOP_CLIENT_IPS': 504,
    '@DASHBOARD_TOP_USER_AGENTS': 504,
    '@DASHBOARD_ATTACK_PREVENTION_HISTORY': 504,
    '@DASHBOARD_TOP_WAF_RULES': 504,
    '@DASHBOARD_TOP_5_ATTACKERS': 504
};

export default function ImageSettingsModal({ isOpen, onClose, theme }) {
    const [widths, setWidths] = useState(DEFAULT_WIDTHS);

    useEffect(() => {
        if (!isOpen) return;
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem('gdcc:cropped-image-widths');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setWidths({ ...DEFAULT_WIDTHS, ...parsed });
                }
            } catch (e) {
                console.error('Failed to load image widths:', e);
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

    const handleSave = () => {
        // Validate
        const finalWidths = {};
        for (const [key, val] of Object.entries(widths)) {
            const intVal = parseInt(val, 10);
            if (isNaN(intVal) || intVal <= 0) {
                Swal.fire('Error', `Please enter a valid width for ${key}`, 'error');
                return;
            }
            finalWidths[key] = intVal;
        }

        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('gdcc:cropped-image-widths', JSON.stringify(finalWidths));
                Swal.fire({
                    title: 'Saved!',
                    text: 'Image size settings saved successfully.',
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
    };

    if (!isOpen) return null;

    const t = theme || {
        modalOverlay: 'bg-black/70 backdrop-blur-sm',
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

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${t.modalOverlay}`}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className={`${t.modalBg} border ${t.modalBorder} rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-4 border-b ${t.modalBorder} ${t.modalHeaderBg} rounded-t-xl`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center`}>
                            <Settings className={`w-5 h-5 ${t.iconAccent || 'text-blue-400'}`} />
                        </div>
                        <div>
                            <h2 className={`text-base font-bold ${t.modalTitle}`}>Image Size Settings</h2>
                            <p className={`text-xs ${t.subText}`}>Configure the width (in pixels) for exported dashboard cards</p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${t.modalCloseIcon}`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="grid grid-cols-1 gap-3">
                        {VARIABLES.map((v) => (
                            <div key={v.key} className={`flex items-center justify-between p-3 border ${t.card || 'border-gray-800 bg-gray-900/50'} rounded-lg gap-4`}>
                                <div className="flex-1">
                                    <h3 className={`text-xs font-semibold ${t.text || 'text-gray-200'}`}>{v.label}</h3>
                                    <p className={`text-[10px] ${t.subText || 'text-gray-400'} mt-0.5`}>{v.desc}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={widths[v.key]}
                                        onChange={(e) => handleWidthChange(v.key, e.target.value)}
                                        className="w-24 bg-gray-950 border border-gray-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                                        placeholder="504"
                                        min="1"
                                    />
                                    <span className="text-[10px] text-gray-500 font-mono">px</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className={`p-4 border-t ${t.modalBorder} ${t.modalHeaderBg} flex items-center justify-between rounded-b-xl`}>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                        title="Reset to default (504px)"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className={`px-4 py-2 hover:bg-white/10 rounded-lg text-xs font-semibold transition-colors ${t.button || 'bg-gray-800 text-gray-300'}`}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${t.buttonPrimary || 'bg-blue-600 text-white'}`}
                        >
                            Save Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
