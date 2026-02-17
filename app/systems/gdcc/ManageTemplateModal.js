import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Copy, FileText, LayoutTemplate, Check, MoreVertical } from 'lucide-react';
import Swal from 'sweetalert2';
import { listTemplates, createTemplate, renameTemplate, deleteTemplate } from '@/app/utils/templateApi';

export default function ManageTemplateModal({ isOpen, onClose, onEditSub, onEditDomain, theme, userRole }) {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [renamingId, setRenamingId] = useState(null);
    const [newName, setNewName] = useState('');

    useEffect(() => {
        if (isOpen) fetchTemplates();
    }, [isOpen]);

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

    const fetchTemplates = async () => {
        setLoading(true);
        const list = await listTemplates();
        setTemplates(list);
        setLoading(false);
    };

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

    const handleDelete = async (id, name) => {
        if (userRole !== 'root') {
            return Swal.fire('Permission Denied', 'Only root users can delete templates', 'error');
        }

        const res = await Swal.fire({
            title: 'Delete Template?',
            text: `Are you sure you want to delete "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!'
        });

        if (res.isConfirmed) {
            setLoading(true);
            const apiRes = await deleteTemplate(id);
            if (!apiRes.success) Swal.fire('Error', apiRes.error || 'Failed to delete', 'error');
            await fetchTemplates();
        }
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
        text: 'text-gray-200'
    };

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
                    <div className="flex justify-end">
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
                            {templates.map(tmp => (
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
                                                {tmp.id === 'default' && <span className="px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400 text-[10px] font-mono uppercase tracking-wider border border-blue-800">Default</span>}
                                                <button onClick={() => startRename(tmp)} className={`opacity-0 group-hover/name:opacity-100 p-1 ${t.subText} ${t.iconAccent ? `hover:${t.iconAccent}` : 'hover:text-blue-400'} transition-opacity`}>
                                                    <Edit2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                        <p className={`text-xs ${t.subText} mt-1 font-mono`}>ID: {tmp.id}</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">

                                        {/* Edit Content Buttons */}
                                        <div className={`flex ${t.sectionHeader || 'bg-gray-900 border-gray-700'} rounded-lg p-1 border`}>
                                            <button
                                                onClick={() => onEditSub(tmp.id, tmp.name)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-white/10 text-xs ${t.text} transition-colors`}
                                                title="Edit Sub-domain Report Structure"
                                            >
                                                <FileText className="w-3.5 h-3.5 text-orange-400" />
                                                Sub Report
                                            </button>
                                            <div className={`w-px ${t.modalBorder} my-1`}></div>
                                            <button
                                                onClick={() => onEditDomain(tmp.id, tmp.name)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-white/10 text-xs ${t.text} transition-colors`}
                                                title="Edit Domain Summary Report Structure"
                                            >
                                                <LayoutTemplate className="w-3.5 h-3.5 text-purple-400" />
                                                Domain Report
                                            </button>
                                        </div>

                                        {/* Delete */}
                                        {tmp.id !== 'default' && userRole === 'root' && (
                                            <button
                                                onClick={() => handleDelete(tmp.id, tmp.name)}
                                                className={`p-2 ${t.subText} hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors`}
                                                title="Delete Template"
                                            >
                                                <Trash2 className="w-4 h-4" />
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
