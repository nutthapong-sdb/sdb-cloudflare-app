import { useState, useEffect } from 'react';
import { X, Table, RotateCcw, Check, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';

export const DEFAULT_TABLE_COLUMN_WIDTHS = {
    '@TOP_URLS_LIST': {
        col1: 10,
        col2: 70,
        col3: 20
    },
    '@TOP_IPS_LIST': {
        col1: 70,
        col2: 30
    },
    '@TOP_RULES_LIST': {
        col1: 70,
        col2: 30
    },
    '@TOP_ATTACKERS_LIST': {
        col1: 30,
        col2: 25,
        col3: 25,
        col4: 20
    },
    '@TOP_SOURCES_LIST': {
        col1: 70,
        col2: 30
    }
};

export const TABLE_CONFIGS = [
    {
        key: '@TOP_URLS_LIST',
        label: 'Top URLs Table (@TOP_URLS_LIST)',
        desc: 'ตาราง 3 อันดับ URL ยอดนิยม',
        columns: [
            { id: 'col1', label: 'ลำดับ', default: 10 },
            { id: 'col2', label: 'รายการ (URL)', default: 70 },
            { id: 'col3', label: 'จำนวน (Count)', default: 20 }
        ]
    },
    {
        key: '@TOP_IPS_LIST',
        label: 'Top Client IPs Table (@TOP_IPS_LIST)',
        desc: 'ตาราง 3 อันดับ Client IP',
        columns: [
            { id: 'col1', label: 'Client IP', default: 70 },
            { id: 'col2', label: 'จำนวน (Count)', default: 30 }
        ]
    },
    {
        key: '@TOP_RULES_LIST',
        label: 'Top WAF Rules Table (@TOP_RULES_LIST)',
        desc: 'ตาราง 3 อันดับ WAF Rules ที่ถูกใช้มากที่สุด',
        columns: [
            { id: 'col1', label: 'Rule Name (ID)', default: 70 },
            { id: 'col2', label: 'จำนวน (Count)', default: 30 }
        ]
    },
    {
        key: '@TOP_ATTACKERS_LIST',
        label: 'Top 5 Attackers Table (@TOP_ATTACKERS_LIST)',
        desc: 'ตาราง 5 อันดับ ผู้โจมตีสูงสุด',
        columns: [
            { id: 'col1', label: 'IP', default: 30 },
            { id: 'col2', label: 'ประเทศ (Country)', default: 25 },
            { id: 'col3', label: 'จำนวน (Count)', default: 25 },
            { id: 'col4', label: 'ประเภท (Type)', default: 20 }
        ]
    },
    {
        key: '@TOP_SOURCES_LIST',
        label: 'Top Security Sources Table (@TOP_SOURCES_LIST)',
        desc: 'ตาราง 5 อันดับ Security Source',
        columns: [
            { id: 'col1', label: 'Type (Security Source)', default: 70 },
            { id: 'col2', label: 'จำนวน (Count)', default: 30 }
        ]
    }
];

export default function TableSettingsModal({ isOpen, onClose, theme, storageKey = 'ntbc:table-column-widths' }) {
    const [widths, setWidths] = useState(DEFAULT_TABLE_COLUMN_WIDTHS);

    useEffect(() => {
        if (!isOpen) return;
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem(storageKey);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setWidths({ ...DEFAULT_TABLE_COLUMN_WIDTHS, ...parsed });
                }
            } catch (e) {
                console.error('Failed to load table column widths:', e);
            }
        }
    }, [isOpen, storageKey]);

    const handleColumnChange = (tableKey, colId, val) => {
        const intVal = parseFloat(val);
        setWidths(prev => ({
            ...prev,
            [tableKey]: {
                ...(prev[tableKey] || DEFAULT_TABLE_COLUMN_WIDTHS[tableKey]),
                [colId]: isNaN(intVal) ? '' : intVal
            }
        }));
    };

    const handleSave = () => {
        const finalWidths = {};
        for (const config of TABLE_CONFIGS) {
            const tableKey = config.key;
            const tableCols = widths[tableKey] || DEFAULT_TABLE_COLUMN_WIDTHS[tableKey];
            finalWidths[tableKey] = {};
            
            for (const col of config.columns) {
                const val = parseFloat(tableCols[col.id]);
                if (isNaN(val) || val <= 0) {
                    Swal.fire({
                        title: 'Invalid Width',
                        text: `Please enter a valid percentage (> 0) for ${config.label} - ${col.label}`,
                        icon: 'error',
                        background: '#111827',
                        color: '#fff'
                    });
                    return;
                }
                finalWidths[tableKey][col.id] = val;
            }
        }

        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(storageKey, JSON.stringify(finalWidths));
                Swal.fire({
                    title: 'Saved!',
                    text: 'Table column settings saved successfully.',
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
        setWidths(DEFAULT_TABLE_COLUMN_WIDTHS);
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
            <div className={`${t.modalBg} border ${t.modalBorder} rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh]`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-4 border-b ${t.modalBorder} ${t.modalHeaderBg} rounded-t-xl`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <Table className={`w-5 h-5 ${t.iconAccent || 'text-blue-400'}`} />
                        </div>
                        <div>
                            <h2 className={`text-base font-bold ${t.modalTitle}`}>Table Column Settings</h2>
                            <p className={`text-xs ${t.subText}`}>Configure column width percentages for all table variables</p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${t.modalCloseIcon}`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {TABLE_CONFIGS.map((table) => {
                        const tableCols = widths[table.key] || DEFAULT_TABLE_COLUMN_WIDTHS[table.key];
                        const totalPct = table.columns.reduce((sum, col) => sum + (parseFloat(tableCols[col.id]) || 0), 0);
                        const is100 = Math.abs(totalPct - 100) < 0.1;

                        return (
                            <div key={table.key} className={`p-4 border ${t.card || 'border-gray-800 bg-gray-900/50'} rounded-xl space-y-3`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className={`text-sm font-semibold ${t.text || 'text-gray-200'}`}>{table.label}</h3>
                                        <p className={`text-xs ${t.subText || 'text-gray-400'}`}>{table.desc}</p>
                                    </div>
                                    <div className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-medium ${is100 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                        {is100 ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                        Total: {totalPct}%
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
                                    {table.columns.map((col, idx) => (
                                        <div key={col.id} className="flex flex-col gap-1 bg-gray-950/60 p-2.5 rounded-lg border border-gray-800/80">
                                            <label className="text-[11px] font-medium text-gray-300 truncate" title={col.label}>
                                                {col.label}
                                            </label>
                                            <div className="relative flex items-center">
                                                <input
                                                    type="number"
                                                    value={tableCols[col.id] !== undefined ? tableCols[col.id] : col.default}
                                                    onChange={(e) => handleColumnChange(table.key, col.id, e.target.value)}
                                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1 text-xs text-white pr-7 focus:outline-none focus:border-blue-500"
                                                    placeholder={String(col.default)}
                                                    min="1"
                                                    max="100"
                                                    step="1"
                                                />
                                                <span className="absolute right-2 text-xs text-gray-500 font-medium">%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className={`flex items-center justify-between p-4 border-t ${t.modalBorder} ${t.modalHeaderBg} rounded-b-xl`}>
                    <button
                        onClick={handleReset}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-white/10 transition-colors ${t.subText}`}
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset to Defaults
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
