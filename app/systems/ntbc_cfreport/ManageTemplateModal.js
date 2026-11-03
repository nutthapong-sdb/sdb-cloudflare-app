import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Trash2, Edit2, FileText, LayoutTemplate, Check, Download, Upload } from 'lucide-react';
import Swal from './utils/alert';
import {
    listTemplates,
    createTemplate,
    setTemplateFormat,
    setTemplatePreset,
    setTemplateCaptureMode,
    templateCaptureMode,
    listCapturePresets,
    renameTemplate,
    deleteTemplate,
    loadTemplate,
    loadMiddleTemplate,
    loadStaticTemplate,
    saveTemplate,
    saveMiddleTemplate,
    saveStaticTemplate
} from '@/app/utils/ntbcTemplateApi';

// inline: render as a page panel (workspace tab) instead of a popup.
// Presets belong to screenshot mode only (inapp / uploaded are picked in tab 2 and need none),
// so older inapp / uploaded presets are not offered here.
const isScreenshotPreset = (p) => (p.kind || 'captured') === 'captured';
const CAPTURE_MODE_OPTIONS = [
    { id: 'captured', label: '📸 แคปรูป', active: 'bg-rose-600 text-white' },
    { id: 'inapp', label: '🧩 inapp', active: 'bg-indigo-600 text-white' },
    { id: 'uploaded', label: '🖼️ อัปโหลดเอง', active: 'bg-emerald-600 text-white' },
];

export default function ManageTemplateModal({ isOpen, onClose, onEditSub, onEditMiddle, onEditDomain, theme, userRole, currentUserId, inline = false }) {
    const [templates, setTemplates] = useState([]);
    const [allPresets, setPresets] = useState([]);
    const presets = useMemo(() => allPresets.filter(isScreenshotPreset), [allPresets]);
    const [loading, setLoading] = useState(false);
    const [renamingId, setRenamingId] = useState(null);
    const [newName, setNewName] = useState('');
    const [showHidden, setShowHidden] = useState(false);
    const [defaultTemplateId, setDefaultTemplateId] = useState('default');
    const [hiddenTemplateIds, setHiddenTemplateIds] = useState([]);
    const importInputRef = useRef(null);

    const userKey = useMemo(() => (currentUserId ? String(currentUserId) : 'anonymous'), [currentUserId]);
    const storageKeyDefault = useMemo(() => `ntbc:templates:${userKey}:defaultTemplateId`, [userKey]);
    const storageKeyHidden = useMemo(() => `ntbc:templates:${userKey}:hiddenTemplateIds`, [userKey]);

    const loadPrefs = () => {
        if (typeof window === 'undefined') return;

        const storedDefault = localStorage.getItem(storageKeyDefault) || 'default';
        let storedHidden = [];
        try {
            storedHidden = JSON.parse(localStorage.getItem(storageKeyHidden) || '[]');
        } catch (_) {
            storedHidden = [];
        }
        if (!Array.isArray(storedHidden)) storedHidden = [];

        setDefaultTemplateId(storedDefault);
        setHiddenTemplateIds(storedHidden.map(String));
    };

    const persistDefault = (id) => {
        setDefaultTemplateId(id);
        if (typeof window !== 'undefined') {
            try { localStorage.setItem(storageKeyDefault, id); } catch (_) { }
        }
    };

    const persistHidden = (ids) => {
        const next = Array.from(new Set((ids || []).map(String)));
        setHiddenTemplateIds(next);
        if (typeof window !== 'undefined') {
            try { localStorage.setItem(storageKeyHidden, JSON.stringify(next)); } catch (_) { }
        }
    };

    const fetchTemplates = async () => {
        setLoading(true);
        const [list, presetList] = await Promise.all([listTemplates(), listCapturePresets()]);
        setTemplates(Array.isArray(list) ? list : []);
        setPresets(presetList);
        setLoading(false);
    };

    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => {
            loadPrefs();
            fetchTemplates();
        }, 0);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Keep default selection valid (and avoid empty visible lists)
    useEffect(() => {
        if (!isOpen) return;
        if (templates.length === 0) return;

        const existingIds = new Set(templates.map(t => String(t.id)));
        const hidden = hiddenTemplateIds.filter(id => existingIds.has(String(id)));
        if (hidden.length !== hiddenTemplateIds.length) {
            persistHidden(hidden);
        }

        const visible = templates.filter(t => !hidden.includes(String(t.id)));
        if (visible.length === 0) {
            // Safety: if user hid everything, reset hidden list.
            persistHidden([]);
            if (!existingIds.has(String(defaultTemplateId))) {
                persistDefault('default');
            }
            return;
        }

        if (!existingIds.has(String(defaultTemplateId)) || hidden.includes(String(defaultTemplateId))) {
            persistDefault(String(visible[0].id));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templates, hiddenTemplateIds, defaultTemplateId, isOpen]);

    // ESC key to close modal
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    const handleCreateWrapper = async () => {
        const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const { value: formValues } = await Swal.fire({
            title: 'Create New Template',
            html: `
                <input id="swal-input1" class="swal2-input" placeholder="Template Name">
                <select id="swal-input2" class="swal2-input">
                    <option value="empty">Create Empty Template</option>
                    ${templates.map(t => `<option value="${t.id}" ${t.id === 'default' ? 'selected' : ''}>Duplicate from: ${esc(t.name)}</option>`).join('')}
                </select>
                <select id="swal-input3" class="swal2-input">
                    <option value="docx">Output: Word (.docx)</option>
                    <option value="pptx">Output: PowerPoint (.pptx)</option>
                </select>
                <select id="swal-input4" class="swal2-input">
                    <option value="">— รูปในรายงาน (จำเป็น) —</option>
                    <option value="inapp">🧩 inapp — ตารางจากข้อมูล ไม่ต้องแคป</option>
                    <option value="uploaded">🖼️ อัปโหลดรูปเอง</option>
                    ${presets.map(p => `<option value="preset:${esc(p.id)}" ${p.id === 'default' ? 'selected' : ''}>📸 แคปรูป · Preset: ${esc(p.name)}</option>`).join('')}
                </select>
            `,
            focusConfirm: false,
            showCancelButton: true,
            preConfirm: () => {
                const values = [
                    document.getElementById('swal-input1').value,
                    document.getElementById('swal-input2').value,
                    document.getElementById('swal-input3').value,
                    document.getElementById('swal-input4').value
                ];
                if (!values[0]) { Swal.showValidationMessage('Name is required'); return false; }
                if (!values[3]) { Swal.showValidationMessage('กรุณาเลือกรูปในรายงาน'); return false; }
                return values;
            }
        });

        if (formValues) {
            const [name, sourceId, format, imageChoice] = formValues;
            // 'preset:<id>' = screenshots cropped with that preset; otherwise the mode itself.
            const captureMode = imageChoice.startsWith('preset:') ? 'captured' : imageChoice;
            const capturePresetId = imageChoice.startsWith('preset:') ? imageChoice.slice('preset:'.length) : undefined;

            setLoading(true);
            // Pass sourceId directly (backend handles 'empty')
            const src = sourceId;

            await createTemplate(name, src, format, capturePresetId, captureMode);
            await fetchTemplates();
        }
    };

    const isHidden = (id) => hiddenTemplateIds.includes(String(id));

    const handleSoftDelete = async (id, name) => {
        const tid = String(id);

        if (tid === 'default') {
            return Swal.fire('Cannot Delete', 'The system default template cannot be deleted or hidden.', 'warning');
        }

        // Prevent hiding the last visible template, otherwise selectors become unusable.
        const visible = templates.filter(t => !isHidden(t.id));
        if (!isHidden(tid) && visible.length <= 1) {
            return Swal.fire('Cannot Delete', 'You cannot delete (hide) the last remaining template.', 'warning');
        }

        if (!isHidden(tid)) {
            // Hide
            const nextHidden = [...hiddenTemplateIds, tid];
            persistHidden(nextHidden);

            // If we hid the current default, pick the next visible as new default.
            if (defaultTemplateId === tid) {
                const nextVisible = templates.filter(t => !nextHidden.includes(String(t.id)));
                if (nextVisible.length > 0) {
                    persistDefault(String(nextVisible[0].id));
                } else {
                    persistDefault('default');
                }
            }
            return;
        }

        // Restore
        const restored = hiddenTemplateIds.filter(x => x !== tid);
        persistHidden(restored);
    };

    const handleHardDelete = async (id, name) => {
        if (userRole !== 'root') {
            return Swal.fire('Permission Denied', 'Only root users can hard delete templates', 'error');
        }
        if (String(id) === 'default') {
            return Swal.fire('Not Allowed', 'The system default template cannot be hard deleted.', 'error');
        }

        const res = await Swal.fire({
            title: 'Hard Delete Template?',
            html: `<div style="text-align:left">
                <div><b>${name}</b></div>
                <div style="margin-top:8px">This will permanently delete the template from the system (registry + files).</div>
            </div>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, hard delete'
        });

        if (!res.isConfirmed) return;

        setLoading(true);
        const apiRes = await deleteTemplate(id);
        if (!apiRes.success) {
            setLoading(false);
            return Swal.fire('Error', apiRes.error || 'Failed to delete', 'error');
        }

        // Clean up local prefs
        const tid = String(id);
        persistHidden(hiddenTemplateIds.filter(x => x !== tid));
        if (defaultTemplateId === tid) {
            persistDefault('default');
        }
        await fetchTemplates();
    };

    const handleSetAsDefault = (id) => {
        const tid = String(id);
        // If it's hidden, unhide it automatically.
        if (isHidden(tid)) {
            persistHidden(hiddenTemplateIds.filter(x => x !== tid));
        }
        persistDefault(tid);
    };

    const sanitizeFilenamePart = (value) => {
        const base = String(value || '').trim();
        if (!base) return 'template';
        return base.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    };

    const handleExportBundle = async (id, name) => {
        try {
            setLoading(true);

            const [subReport, middleReport, domainReport] = await Promise.all([
                loadTemplate(id),
                loadMiddleTemplate(id),
                loadStaticTemplate(id)
            ]);

            const payload = {
                id: String(id),
                name: String(name || ''),
                exportedAt: new Date().toISOString(),
                templates: {
                    subReport: subReport ?? '',
                    middleReport: middleReport ?? '',
                    domainReport: domainReport ?? ''
                }
            };

            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            const safeName = sanitizeFilenamePart(name);
            const safeId = sanitizeFilenamePart(id);
            a.href = url;
            a.download = `ntbc-template-${safeName}-${safeId}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export template bundle failed:', e);
            await Swal.fire('Error', e?.message || 'Failed to export template bundle', 'error');
        } finally {
            setLoading(false);
        }
    };

    const normalizeImportedBundle = (raw) => {
        if (!raw || typeof raw !== 'object') return null;
        const templatesObj = raw.templates && typeof raw.templates === 'object' ? raw.templates : null;
        if (!templatesObj) return null;

        const subReport = typeof templatesObj.subReport === 'string' ? templatesObj.subReport : '';
        const middleReport = typeof templatesObj.middleReport === 'string' ? templatesObj.middleReport : '';
        const domainReport = typeof templatesObj.domainReport === 'string' ? templatesObj.domainReport : '';

        return {
            name: typeof raw.name === 'string' ? raw.name : '',
            templates: { subReport, middleReport, domainReport }
        };
    };

    const handleImportFilePicked = async (file) => {
        if (!file) return;
        try {
            setLoading(true);

            const text = await file.text();
            let parsed;
            try {
                parsed = JSON.parse(text);
            } catch (e) {
                throw new Error('Invalid JSON file');
            }

            const normalized = normalizeImportedBundle(parsed);
            if (!normalized) {
                throw new Error('File does not look like an exported template bundle');
            }

            const suggestedName = (normalized.name || file.name.replace(/\.json$/i, '') || 'Imported Template').trim();
            const res = await Swal.fire({
                title: 'Import Template Bundle',
                html: `
                    <div style="text-align:left">
                      <div style="font-size:12px; opacity:0.85">This will create a new template and import the report structure.</div>
                      <div style="margin-top:10px">
                        <div style="font-size:12px; margin-bottom:6px">Template name</div>
                        <input id="swal-import-name" class="swal2-input" value="${suggestedName.replace(/"/g, '&quot;')}" />
                      </div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Import',
                preConfirm: () => {
                    const el = document.getElementById('swal-import-name');
                    const val = (el?.value || '').trim();
                    if (!val) {
                        Swal.showValidationMessage('Name is required');
                        return null;
                    }
                    return { name: val };
                }
            });

            if (!res.isConfirmed || !res.value?.name) return;

            const created = await createTemplate(res.value.name, 'empty');
            if (!created?.success || !created?.template?.id) {
                throw new Error(created?.error || 'Failed to create template');
            }
            const newId = String(created.template.id);

            await Promise.all([
                saveTemplate(normalized.templates.subReport, newId),
                saveMiddleTemplate(normalized.templates.middleReport, newId),
                saveStaticTemplate(normalized.templates.domainReport, newId)
            ]);

            await fetchTemplates();
            await Swal.fire('Imported', 'Template bundle imported successfully.', 'success');
        } catch (e) {
            console.error('Import failed:', e);
            await Swal.fire('Error', e?.message || 'Failed to import template bundle', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleClickImport = () => {
        if (!importInputRef.current) return;
        importInputRef.current.value = '';
        importInputRef.current.click();
    };

    const startRename = (t) => {
        setRenamingId(t.id);
        setNewName(t.name);
    };

    const saveRename = async (id) => {
        if (!newName.trim()) return;
        setLoading(true);
        await renameTemplate(id, newName);
        setRenamingId(null);
        await fetchTemplates();
    };

    if (!isOpen) return null;

    // Default theme fallback (minimal dark theme to match existing)
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
        sectionHeader: 'bg-gray-950 border-blue-500',
        text: 'text-gray-200',
        buttonDanger: 'bg-red-600 hover:bg-red-500 text-white'
    };

    const buttonBase = 'px-3 py-2 rounded-lg text-xs font-semibold transition-colors';

    return (
        <div
            className={inline ? 'w-full' : `fixed inset-0 z-50 flex items-center justify-center p-4 ${t.modalOverlay}`}
            onClick={(e) => {
                if (!inline && e.target === e.currentTarget) onClose();
            }}
        >
            <div className={`${t.modalBg} border ${t.modalBorder} rounded-xl w-full flex flex-col ${inline ? 'max-h-[75vh]' : 'max-w-4xl shadow-2xl max-h-[85vh]'}`}>

                {/* Header */}
                <div className={`flex items-center justify-between p-4 border-b ${t.modalBorder} ${t.modalHeaderBg} rounded-t-xl`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${t.iconAccent ? t.iconAccent.replace('text-', 'bg-') + '/20' : 'bg-blue-500/20'} flex items-center justify-center`}>
                            <LayoutTemplate className={`w-5 h-5 ${t.iconAccent || 'text-blue-400'}`} />
                        </div>
                        <div>
                            <h2 className={`text-lg font-bold ${t.modalTitle}`}>Manage Report Templates</h2>
                            <p className={`text-xs ${t.subText}`}>Create, edit, and organize your reporting templates</p>
                        </div>
                    </div>
                    {!inline && (
                        <button onClick={onClose} className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${t.modalCloseIcon}`}>
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">

                    {/* Toolbar */}
                    <div className="flex items-center justify-between gap-3">
                        <label className={`flex items-center gap-2 text-xs ${t.subText} select-none`}>
                            <input
                                type="checkbox"
                                checked={showHidden}
                                onChange={(e) => setShowHidden(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                            />
                            Show hidden templates
                        </label>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCreateWrapper}
                                className={`flex items-center gap-2 px-4 py-2 ${t.buttonPrimary || 'bg-blue-600 text-white'} rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/10`}
                            >
                                <Plus className="w-4 h-4" />
                                Create New Template
                            </button>

                            <input
                                ref={importInputRef}
                                type="file"
                                accept="application/json,.json"
                                className="hidden"
                                onChange={(e) => handleImportFilePicked(e.target.files?.[0])}
                            />
                            <button
                                onClick={handleClickImport}
                                className={`flex items-center gap-2 px-4 py-2 ${t.button || 'bg-gray-800 hover:bg-gray-700 text-gray-200'} border ${t.modalBorder || 'border-gray-700'} rounded-lg font-medium transition-colors`}
                                title="Import template bundle (.json)"
                            >
                                <Upload className="w-4 h-4" />
                                Import
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    {loading ? (
                        <div className={`text-center py-10 ${t.subText} animate-pulse`}>Loading templates...</div>
                    ) : templates.length === 0 ? (
                        <div className={`text-center py-10 border border-dashed ${t.modalBorder} rounded-xl ${t.modalHeaderBg}`}>
                            <p className={`${t.subText} mb-2`}>No templates found.</p>
                            <button onClick={handleCreateWrapper} className={`${t.iconAccent || 'text-blue-400'} hover:underline text-sm`}>Create one now</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {templates
                                .filter(tmp => showHidden || !isHidden(tmp.id))
                                .map(tmp => (
                                <div key={tmp.id} className={`group ${t.card || 'bg-gray-800/40 border-gray-700/50'} border rounded-xl transition-all hover:border-blue-500/30 hover:shadow-md`}>
                                    {/* Top: name + badges, then the template actions */}
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4">
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        {renamingId === tmp.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    value={newName}
                                                    onChange={e => setNewName(e.target.value)}
                                                    className={`${t.dropdown?.bg || 'bg-gray-950'} border border-blue-500 rounded px-2 py-1 ${t.dropdown?.inputText || 'text-white'} text-sm w-full focus:outline-none`}
                                                    autoFocus
                                                    onKeyDown={e => e.key === 'Enter' && saveRename(tmp.id)}
                                                />
                                                <button onClick={() => saveRename(tmp.id)} className="p-1 bg-green-600/20 text-green-400 rounded hover:bg-green-600/40"><Check className="w-4 h-4" /></button>
                                                <button onClick={() => setRenamingId(null)} className="p-1 bg-red-600/20 text-red-400 rounded hover:bg-red-600/40"><X className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                              <div className="flex flex-wrap items-center gap-2 group/name">
                                                  <h3 className={`font-semibold ${t.text || 'text-gray-200'}`}>{tmp.name}</h3>
                                                 {String(tmp.id) === String(defaultTemplateId) && <span className="px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400 text-[10px] font-mono uppercase tracking-wider border border-blue-800">Default</span>}
                                                 {isHidden(tmp.id) && <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 text-[10px] font-mono uppercase tracking-wider border border-gray-700">Hidden</span>}
                                                 {tmp.format === 'pptx'
                                                     ? <span className="px-2 py-0.5 rounded-full bg-orange-900/40 text-orange-300 text-[10px] font-mono uppercase tracking-wider border border-orange-800">PPTX</span>
                                                     : <span className="px-2 py-0.5 rounded-full bg-sky-900/40 text-sky-300 text-[10px] font-mono uppercase tracking-wider border border-sky-800">DOCX</span>}
                                                 {templateCaptureMode(tmp) === 'captured' && tmp.capturePresetId && !presets.some(p => String(p.id) === String(tmp.capturePresetId)) && (
                                                     <span className="px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 text-[10px] font-bold tracking-wider border border-amber-700 whitespace-nowrap" title="Preset ที่เลือกไว้ถูกลบไปแล้ว — เลือกใหม่ (หรือใช้ Standard Default)">⚠ ไม่พบ Preset</span>
                                                 )}
                                                  {(! (String(tmp.id) === 'default') || userRole === 'admin' || userRole === 'root') && (
                                                      <button onClick={() => startRename(tmp)} className={`opacity-0 group-hover/name:opacity-100 p-1 ${t.subText} ${t.iconAccent ? `hover:${t.iconAccent}` : 'hover:text-blue-400'} transition-opacity`}>
                                                          <Edit2 className="w-3 h-3" />
                                                      </button>
                                                  )}
                                              </div>
                                          )}
                                          <p className={`text-xs ${t.subText} mt-1 font-mono`}>ID: {tmp.id}</p>
                                      </div>


                                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => handleSetAsDefault(tmp.id)}
                                                className={`${buttonBase} border ${String(tmp.id) === String(defaultTemplateId)
                                                    ? `${t.buttonPrimary || 'bg-blue-600 hover:bg-blue-500 text-white'} border-blue-500/70`
                                                    : `${t.button || 'bg-gray-800 hover:bg-gray-700 text-gray-200'} ${t.modalBorder || 'border-gray-700'}`
                                                }`}
                                                title="Set as default (per-user)"
                                            >
                                                Set as default
                                            </button>

                                            {(String(tmp.id) !== 'default' || userRole === 'admin' || userRole === 'root') ? (
                                                <button
                                                    onClick={() => onEditDomain(tmp.id, tmp.name)}
                                                    className={`${buttonBase} flex items-center gap-1.5 border ${t.modalBorder || 'border-gray-700'} ${t.sectionHeader || 'bg-gray-900'} ${t.text || 'text-gray-200'} hover:bg-white/10`}
                                                    title="Edit Domain Summary Report Structure"
                                                >
                                                    <LayoutTemplate className="w-3.5 h-3.5 text-purple-400" />
                                                    Edit Template
                                                </button>
                                            ) : (
                                                <div className={`${buttonBase} text-gray-500 border border-gray-800 bg-gray-900/50 flex items-center gap-1.5 cursor-not-allowed`} title="Default template can only be edited by Admins">
                                                    <LayoutTemplate className="w-3.5 h-3.5 text-gray-600" />
                                                    View-Only (Admin Edit Only)
                                                </div>
                                            )}

                                            {/* Icon actions sit together, apart from the text buttons */}
                                            <div className={`flex items-center gap-1 pl-2 ml-1 border-l ${t.modalBorder || 'border-gray-700'}`}>
                                                <button
                                                    onClick={() => handleExportBundle(tmp.id, tmp.name)}
                                                    className={`p-2 ${t.subText} hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors`}
                                                    title="Export template bundle"
                                                    aria-label="Export template bundle"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                {String(tmp.id) !== 'default' && (
                                                    <button
                                                        onClick={() => handleSoftDelete(tmp.id, tmp.name)}
                                                        className={`p-2 ${t.subText} hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors`}
                                                        title={isHidden(tmp.id) ? 'Restore Template' : 'Delete Template (Hide)'}
                                                        aria-label={isHidden(tmp.id) ? 'Restore Template' : 'Delete Template (Hide)'}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>

                                            {userRole === 'root' && String(tmp.id) !== 'default' && (
                                                <button
                                                    onClick={() => handleHardDelete(tmp.id, tmp.name)}
                                                    className={`${buttonBase} border ${t.buttonDanger || 'bg-red-600 hover:bg-red-700 text-white'} border-red-500/70`}
                                                    title="Hard delete (permanent)"
                                                >
                                                    Hard delete
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom: report settings, each with its own label */}
                                    {(String(tmp.id) !== 'default' || userRole === 'admin' || userRole === 'root') && (() => {
                                        const mode = templateCaptureMode(tmp);
                                        // No preset of its own = Standard Default (offset 0)
                                        const presetValue = String(tmp.capturePresetId || 'default');
                                        const hasPreset = presets.some(p => String(p.id) === presetValue);
                                        const fieldLabel = `block text-[11px] font-semibold uppercase tracking-wide ${t.subText || 'text-gray-400'} mb-1.5`;
                                        return (
                                            <div className={`flex flex-wrap items-end gap-x-8 gap-y-4 px-4 py-3 border-t ${t.modalBorder || 'border-gray-700'} bg-black/10 rounded-b-xl`}>
                                                {String(tmp.id) !== 'default' && (
                                                    <div>
                                                        <span className={fieldLabel}>ไฟล์รายงาน</span>
                                                        <select
                                                            value={tmp.format === 'pptx' ? 'pptx' : 'docx'}
                                                            onChange={async (e) => {
                                                                const format = e.target.value;
                                                                setTemplates(prev => prev.map(x => x.id === tmp.id ? { ...x, format } : x));
                                                                const r = await setTemplateFormat(tmp.id, format);
                                                                if (!r?.success) { Swal.fire('Error', r?.error || 'Failed to change output format', 'error'); fetchTemplates(); }
                                                            }}
                                                            className={`h-9 px-3 rounded-lg text-sm ${t.dropdown?.bg || 'bg-gray-950'} ${t.dropdown?.inputText || 'text-gray-200'} border ${t.modalBorder || 'border-gray-700'}`}
                                                            title="Output file type of reports built from this template"
                                                        >
                                                            <option value="docx">Word (.docx)</option>
                                                            <option value="pptx">PowerPoint (.pptx)</option>
                                                        </select>
                                                    </div>
                                                )}

                                                <div>
                                                    <span className={fieldLabel}>รูปในรายงาน</span>
                                                    <div className={`inline-flex h-9 rounded-lg border ${t.modalBorder || 'border-gray-700'} overflow-hidden`} role="radiogroup" aria-label="รูปในรายงาน">
                                                        {CAPTURE_MODE_OPTIONS.map((opt, i) => (
                                                            <button
                                                                key={opt.id}
                                                                type="button"
                                                                role="radio"
                                                                aria-checked={mode === opt.id}
                                                                onClick={async () => {
                                                                    if (mode === opt.id) return;
                                                                    setTemplates(prev => prev.map(x => x.id === tmp.id ? { ...x, captureMode: opt.id } : x));
                                                                    const r = await setTemplateCaptureMode(tmp.id, opt.id);
                                                                    if (!r?.success) { Swal.fire('Error', r?.error || 'Failed to change image mode', 'error'); fetchTemplates(); }
                                                                }}
                                                                className={`px-4 text-sm font-semibold transition-colors cursor-pointer ${i > 0 ? `border-l ${t.modalBorder || 'border-gray-700'}` : ''} ${mode === opt.id ? opt.active : 'bg-transparent text-gray-400 hover:text-gray-100 hover:bg-gray-800'}`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {mode === 'captured' && (
                                                    <div>
                                                        <span className={fieldLabel}>Preset ตัดรูป</span>
                                                        <select
                                                            value={hasPreset ? presetValue : ''}
                                                            onChange={async (e) => {
                                                                const capturePresetId = e.target.value;
                                                                if (!capturePresetId) return;
                                                                setTemplates(prev => prev.map(x => x.id === tmp.id ? { ...x, capturePresetId } : x));
                                                                const r = await setTemplatePreset(tmp.id, capturePresetId);
                                                                if (!r?.success) { Swal.fire('Error', r?.error || 'Failed to change capture preset', 'error'); fetchTemplates(); }
                                                            }}
                                                            className={`h-9 px-3 rounded-lg text-sm min-w-[200px] max-w-[260px] ${t.dropdown?.bg || 'bg-gray-950'} ${t.dropdown?.inputText || 'text-gray-200'} border ${hasPreset ? (t.modalBorder || 'border-gray-700') : 'border-amber-500 text-amber-200'}`}
                                                            title="Preset ตัดรูป (crop) ที่รายงานจาก Template นี้ใช้"
                                                        >
                                                            <option value="" disabled>เลือก Preset…</option>
                                                            {presets.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!inline && (
                    <div className={`p-4 border-t ${t.modalBorder} ${t.modalHeaderBg} flex justify-end rounded-b-xl`}>
                        <button onClick={onClose} className={`px-4 py-2 hover:bg-white/10 ${t.button || 'bg-gray-800 text-gray-300'} rounded-lg text-sm font-medium transition-colors`}>Close</button>
                    </div>
                )}

            </div>
        </div>
    );
}
