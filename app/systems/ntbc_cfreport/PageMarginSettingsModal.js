import { useState, useEffect } from 'react';
import { X, Layout, RotateCcw, Check, Square } from 'lucide-react';
import Swal from './utils/alert';

export const MARGIN_PRESETS = [
    {
        id: 'normal',
        name: 'Normal (ปกติ)',
        desc: 'ขอบมาตรฐาน 1 นิ้ว (2.54 ซม.) รอบด้าน',
        margins: { top: 2.54, bottom: 2.54, left: 2.54, right: 2.54 }
    },
    {
        id: 'narrow',
        name: 'Narrow (แคบ)',
        desc: 'ขอบแคบ 0.5 นิ้ว (1.27 ซม.) เพิ่มพื้นที่เนื้อหา',
        margins: { top: 1.27, bottom: 1.27, left: 1.27, right: 1.27 }
    },
    {
        id: 'moderate',
        name: 'Moderate (ปานกลาง)',
        desc: 'บน/ล่าง 2.54 ซม., ซ้าย/ขวา 1.91 ซม.',
        margins: { top: 2.54, bottom: 2.54, left: 1.91, right: 1.91 }
    },
    {
        id: 'wide',
        name: 'Wide (กว้าง)',
        desc: 'บน/ล่าง 2.54 ซม., ซ้าย/ขวา 5.08 ซม.',
        margins: { top: 2.54, bottom: 2.54, left: 5.08, right: 5.08 }
    },
    {
        id: 'custom',
        name: 'Custom (กำหนดเอง)',
        desc: 'ระบุระยะขอบแต่ละด้านได้อย่างอิสระ',
        margins: { top: 2.54, bottom: 2.54, left: 2.54, right: 2.54 }
    }
];

export const DEFAULT_PAGE_MARGINS = {
    top: 2.54,
    bottom: 2.54,
    left: 2.54,
    right: 2.54,
    presetId: 'normal'
};

export default function PageMarginSettingsModal({ isOpen, onClose, onSave, theme, storageKey = 'ntbc:page-margins' }) {
    const [margins, setMargins] = useState(DEFAULT_PAGE_MARGINS);

    useEffect(() => {
        if (!isOpen) return;
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem(storageKey);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setMargins({ ...DEFAULT_PAGE_MARGINS, ...parsed });
                }
            } catch (e) {
                console.error('Failed to load page margins:', e);
            }
        }
    }, [isOpen, storageKey]);

    const handleSelectPreset = (preset) => {
        setMargins({
            ...preset.margins,
            presetId: preset.id
        });
    };

    const handleCustomChange = (side, val) => {
        const num = parseFloat(val);
        setMargins(prev => ({
            ...prev,
            [side]: isNaN(num) ? '' : num,
            presetId: 'custom'
        }));
    };

    const handleSave = () => {
        const top = parseFloat(margins.top);
        const bottom = parseFloat(margins.bottom);
        const left = parseFloat(margins.left);
        const right = parseFloat(margins.right);

        if (isNaN(top) || top < 0 || isNaN(bottom) || bottom < 0 || isNaN(left) || left < 0 || isNaN(right) || right < 0) {
            Swal.fire({
                title: 'Invalid Margins',
                text: 'Please enter valid positive numbers for all margins (in cm)',
                icon: 'error',
                background: '#111827',
                color: '#fff'
            });
            return;
        }

        const payload = {
            top,
            bottom,
            left,
            right,
            presetId: margins.presetId || 'custom'
        };

        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(storageKey, JSON.stringify(payload));
                if (onSave) onSave(payload);
                Swal.fire({
                    title: 'Saved!',
                    text: 'Page margin settings saved successfully.',
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
        setMargins(DEFAULT_PAGE_MARGINS);
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

    // Calculate visual preview proportions (A4 ratio is 1 : 1.414)
    const scale = 20; // 1cm = 20px in scale
    const paperWidth = 160;
    const paperHeight = 226;
    const topPx = Math.min(Math.max((parseFloat(margins.top) || 0) * 12, 4), 60);
    const bottomPx = Math.min(Math.max((parseFloat(margins.bottom) || 0) * 12, 4), 60);
    const leftPx = Math.min(Math.max((parseFloat(margins.left) || 0) * 12, 4), 50);
    const rightPx = Math.min(Math.max((parseFloat(margins.right) || 0) * 12, 4), 50);

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${t.modalOverlay}`}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className={`${t.modalBg} border ${t.modalBorder} rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-4 border-b ${t.modalBorder} ${t.modalHeaderBg} rounded-t-xl`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <Layout className={`w-5 h-5 ${t.iconAccent || 'text-blue-400'}`} />
                        </div>
                        <div>
                            <h2 className={`text-base font-bold ${t.modalTitle}`}>Page Margin Settings</h2>
                            <p className={`text-xs ${t.subText}`}>Configure document margins for Word (.docx) and Report pages</p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${t.modalCloseIcon}`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        
                        {/* Left: Presets List */}
                        <div className="md:col-span-2 space-y-4">
                            <div>
                                <h3 className={`text-xs font-semibold uppercase tracking-wider ${t.subText || 'text-gray-400'} mb-2`}>
                                    Margin Presets (แบบมาตรฐาน)
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {MARGIN_PRESETS.map((preset) => {
                                        const isSelected = margins.presetId === preset.id;
                                        return (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => handleSelectPreset(preset)}
                                                className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                                                    isSelected
                                                        ? 'bg-blue-600/15 border-blue-500 shadow-sm shadow-blue-500/10'
                                                        : 'bg-gray-900/60 border-gray-800 hover:border-gray-700 hover:bg-gray-800/40'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-xs font-semibold ${isSelected ? 'text-blue-400 font-bold' : t.text || 'text-gray-200'}`}>
                                                        {preset.name}
                                                    </span>
                                                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                                                </div>
                                                <p className="text-[10px] text-gray-400">{preset.desc}</p>
                                                <div className="mt-2 text-[10px] text-gray-500 font-mono">
                                                    {preset.margins.top} / {preset.margins.bottom} / {preset.margins.left} / {preset.margins.right} cm
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Custom Inputs */}
                            <div className={`p-4 border ${t.card || 'border-gray-800 bg-gray-900/50'} rounded-xl space-y-3`}>
                                <h3 className={`text-xs font-semibold ${t.text || 'text-gray-200'} flex items-center justify-between`}>
                                    <span>Custom Margin Values (ระบุขนาดขอบกระดาษเป็น ซม.)</span>
                                    {margins.presetId === 'custom' && (
                                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                                            Custom Mode Active
                                        </span>
                                    )}
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="flex flex-col gap-1 bg-gray-950/60 p-2.5 rounded-lg border border-gray-800">
                                        <label className="text-[11px] font-medium text-gray-300">Top (บน)</label>
                                        <div className="relative flex items-center">
                                            <input
                                                type="number"
                                                value={margins.top}
                                                onChange={(e) => handleCustomChange('top', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white pr-7 focus:outline-none focus:border-blue-500"
                                                step="0.1"
                                                min="0"
                                                max="10"
                                            />
                                            <span className="absolute right-2 text-xs text-gray-500 font-medium">cm</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 bg-gray-950/60 p-2.5 rounded-lg border border-gray-800">
                                        <label className="text-[11px] font-medium text-gray-300">Bottom (ล่าง)</label>
                                        <div className="relative flex items-center">
                                            <input
                                                type="number"
                                                value={margins.bottom}
                                                onChange={(e) => handleCustomChange('bottom', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white pr-7 focus:outline-none focus:border-blue-500"
                                                step="0.1"
                                                min="0"
                                                max="10"
                                            />
                                            <span className="absolute right-2 text-xs text-gray-500 font-medium">cm</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 bg-gray-950/60 p-2.5 rounded-lg border border-gray-800">
                                        <label className="text-[11px] font-medium text-gray-300">Left (ซ้าย)</label>
                                        <div className="relative flex items-center">
                                            <input
                                                type="number"
                                                value={margins.left}
                                                onChange={(e) => handleCustomChange('left', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white pr-7 focus:outline-none focus:border-blue-500"
                                                step="0.1"
                                                min="0"
                                                max="10"
                                            />
                                            <span className="absolute right-2 text-xs text-gray-500 font-medium">cm</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 bg-gray-950/60 p-2.5 rounded-lg border border-gray-800">
                                        <label className="text-[11px] font-medium text-gray-300">Right (ขวา)</label>
                                        <div className="relative flex items-center">
                                            <input
                                                type="number"
                                                value={margins.right}
                                                onChange={(e) => handleCustomChange('right', e.target.value)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white pr-7 focus:outline-none focus:border-blue-500"
                                                step="0.1"
                                                min="0"
                                                max="10"
                                            />
                                            <span className="absolute right-2 text-xs text-gray-500 font-medium">cm</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Interactive A4 Paper Preview */}
                        <div className="flex flex-col items-center justify-center p-4 bg-gray-950/50 rounded-xl border border-gray-800/80">
                            <span className="text-[11px] font-semibold text-gray-400 mb-3">A4 Visual Preview</span>
                            
                            {/* A4 Paper Container */}
                            <div
                                style={{ width: `${paperWidth}px`, height: `${paperHeight}px` }}
                                className="bg-white rounded shadow-xl relative flex flex-col overflow-hidden border border-gray-300"
                            >
                                {/* Margin Indicators (Dotted Line / Area) */}
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: `${topPx}px`,
                                        bottom: `${bottomPx}px`,
                                        left: `${leftPx}px`,
                                        right: `${rightPx}px`,
                                    }}
                                    className="border border-dashed border-blue-500 bg-blue-50/40 flex flex-col justify-between p-1.5"
                                >
                                    <div className="space-y-1">
                                        <div className="h-1.5 bg-blue-300/80 rounded-full w-3/4"></div>
                                        <div className="h-1.5 bg-blue-200/80 rounded-full w-full"></div>
                                        <div className="h-1.5 bg-blue-200/80 rounded-full w-5/6"></div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-1.5 bg-blue-200/80 rounded-full w-full"></div>
                                        <div className="h-1.5 bg-blue-200/80 rounded-full w-2/3"></div>
                                    </div>
                                </div>

                                {/* Dimension Labels on Margins */}
                                <div className="absolute top-1 left-0 right-0 text-center text-[9px] text-gray-500 font-mono">
                                    {margins.top || 0} cm
                                </div>
                                <div className="absolute bottom-1 left-0 right-0 text-center text-[9px] text-gray-500 font-mono">
                                    {margins.bottom || 0} cm
                                </div>
                                <div className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] text-gray-500 font-mono whitespace-nowrap">
                                    {margins.left || 0} cm
                                </div>
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 rotate-90 text-[9px] text-gray-500 font-mono whitespace-nowrap">
                                    {margins.right || 0} cm
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div className={`flex items-center justify-between p-4 border-t ${t.modalBorder} ${t.modalHeaderBg} rounded-b-xl`}>
                    <button
                        onClick={handleReset}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-white/10 transition-colors ${t.subText}`}
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset to Normal (2.54 cm)
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className={`px-4 py-1.5 text-xs font-medium rounded-lg hover:bg-white/10 transition-colors ${t.button || 'bg-gray-800 text-gray-300'}`}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className={`px-4 py-1.5 text-xs font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all ${t.buttonPrimary || 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                        >
                            Save Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
