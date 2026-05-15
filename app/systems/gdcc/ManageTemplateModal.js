import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Edit2, Copy, FileText, LayoutTemplate, Check, MoreVertical } from 'lucide-react';
import Swal from 'sweetalert2';
import { listTemplates, createTemplate, renameTemplate, deleteTemplate } from '@/app/utils/templateApi';

export default function ManageTemplateModal({ isOpen, onClose, onEditSub, onEditMiddle, onEditDomain, theme, userRole, currentUserId }) {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [renamingId, setRenamingId] = useState(null);
    const [newName, setNewName] = useState('');
    const [showHidden, setShowHidden] = useState(false);
    const [defaultTemplateId, setDefaultTemplateId] = useState('default');
    const [hiddenTemplateIds, setHiddenTemplateIds] = useState([]);

    const userKey = useMemo(() => (currentUserId ? String(currentUserId) : 'anonymous'), [currentUserId]);
    const storageKeyDefault = useMemo(() => `gdcc:templates:${userKey}:defaultTemplateId`, [userKey]);
    const storageKeyHidden = useMemo(() => `gdcc:templates:${userKey}:hiddenTemplateIds`, [userKey]);

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
        const list = await listTemplates();
        setTemplates(Array.isArray(list) ? list : []);
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
        const { value: formValues } = await Swal.fire({
            title: 'Create New Template',
            html: `
                <input id="swal-input1" class="swal2-input" placeholder="Template Name">
                <select id="swal-input2" class="swal2-input">
                    <option value="empty">Create Empty Template</option>
                    ${templates.map(t => `<option value="${t.id}" ${t.id === 'default' ? 'selected' : ''}>Duplicate from: ${t.name}</option>`).join('')}
                </select>
            `,
            focusConfirm: false,
            showCancelButton: true,
            preConfirm: () => {
                return [
                    document.getElementById('swal-input1').value,
                    document.getElementById('swal-input2').value
                ];
            }
        });

        if (formValues) {
            const [name, sourceId] = formValues;
            if (!name) return Swal.fire('Error', 'Name is required', 'error');

            setLoading(true);
            // Pass sourceId directly (backend handles 'empty')
            const src = sourceId;

            await createTemplate(name, src);
            await fetchTemplates();
        }
    };

    const isHidden = (id) => hiddenTemplateIds.includes(String(id));

    const handleSoftDelete = async (id, name) => {
        const tid = String(id);

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
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${t.modalOverlay}`}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className={`${t.modalBg} border ${t.modalBorder} rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh]`}>

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
                    <button onClick={onClose} className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${t.modalCloseIcon}`}>
                        <X className="w-5 h-5" />
                    </button>
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
                        <button
                            onClick={handleCreateWrapper}
                            className={`flex items-center gap-2 px-4 py-2 ${t.buttonPrimary || 'bg-blue-600 text-white'} rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/10`}
                        >
                            <Plus className="w-4 h-4" />
                            Create New Template
                        </button>
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
                                <div key={tmp.id} className={`group ${t.card || 'bg-gray-800/40 border-gray-700/50'} border rounded-xl p-4 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-blue-500/30 hover:shadow-md`}>

                                    {/* Info */}
                                    <div className="flex-1 min-w-[200px]">
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
                                             <div className="flex items-center gap-2 group/name">
                                                 <h3 className={`font-semibold ${t.text || 'text-gray-200'}`}>{tmp.name}</h3>
                                                {String(tmp.id) === String(defaultTemplateId) && <span className="px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400 text-[10px] font-mono uppercase tracking-wider border border-blue-800">Default</span>}
                                                {isHidden(tmp.id) && <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 text-[10px] font-mono uppercase tracking-wider border border-gray-700">Hidden</span>}
                                                 <button onClick={() => startRename(tmp)} className={`opacity-0 group-hover/name:opacity-100 p-1 ${t.subText} ${t.iconAccent ? `hover:${t.iconAccent}` : 'hover:text-blue-400'} transition-opacity`}>
                                                     <Edit2 className="w-3 h-3" />
                                                 </button>
                                             </div>
                                         )}
                                         <p className={`text-xs ${t.subText} mt-1 font-mono`}>ID: {tmp.id}</p>
                                     </div>

                                     {/* Actions */}
                                     <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">

                                        {/* Set as default */}
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

                                        {/* Edit Content Buttons */}
                                        <div className={`flex ${t.sectionHeader || 'bg-gray-900 border-gray-700'} rounded-lg p-1 border`}>
                                            <button
                                                onClick={() => onEditDomain(tmp.id, tmp.name)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-white/10 text-xs ${t.text} transition-colors`}
                                                title="Edit Domain Summary Report Structure"
                                            >
                                                <LayoutTemplate className="w-3.5 h-3.5 text-purple-400" />
                                                Domain Report
                                            </button>
                                            <div className={`w-px ${t.modalBorder} my-1`}></div>
                                            <button
                                                onClick={() => onEditMiddle(tmp.id, tmp.name)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-white/10 text-xs ${t.text} transition-colors`}
                                                title="Edit Middle Report Header Structure"
                                            >
                                                <FileText className="w-3.5 h-3.5 text-blue-400" />
                                                Middle Report
                                            </button>
                                            <div className={`w-px ${t.modalBorder} my-1`}></div>
                                            <button
                                                onClick={() => onEditSub(tmp.id, tmp.name)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-white/10 text-xs ${t.text} transition-colors`}
                                                title="Edit Sub-domain Report Structure"
                                            >
                                                <FileText className="w-3.5 h-3.5 text-orange-400" />
                                                Sub Report
                                            </button>
                                        </div>

                                        {/* Delete (soft hide / restore) */}
                                        <button
                                            onClick={() => handleSoftDelete(tmp.id, tmp.name)}
                                            className={`p-2 ${t.subText} hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors`}
                                            title={isHidden(tmp.id) ? 'Restore Template' : 'Delete Template (Hide)'}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>

                                        {/* Hard delete */}
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
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={`p-4 border-t ${t.modalBorder} ${t.modalHeaderBg} flex justify-end rounded-b-xl`}>
                    <button onClick={onClose} className={`px-4 py-2 hover:bg-white/10 ${t.button || 'bg-gray-800 text-gray-300'} rounded-lg text-sm font-medium transition-colors`}>Close</button>
                </div>

            </div>
        </div>
    );
}
