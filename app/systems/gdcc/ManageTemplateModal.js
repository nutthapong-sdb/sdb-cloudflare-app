import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Copy, FileText, LayoutTemplate, Check, MoreVertical } from 'lucide-react';
import Swal from 'sweetalert2';
import { listTemplates, createTemplate, renameTemplate, deleteTemplate } from '@/app/utils/templateApi';

export default function ManageTemplateModal({ isOpen, onClose, onEditSub, onEditDomain }) {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [renamingId, setRenamingId] = useState(null);
    const [newName, setNewName] = useState('');

    useEffect(() => {
        if (isOpen) fetchTemplates();
    }, [isOpen]);

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

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-950/50 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <LayoutTemplate className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Manage Report Templates</h2>
                            <p className="text-xs text-gray-400">Create, edit, and organize your reporting templates</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">

                    {/* Toolbar */}
                    <div className="flex justify-end">
                        <button
                            onClick={handleCreateWrapper}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/10"
                        >
                            <Plus className="w-4 h-4" />
                            Create New Template
                        </button>
                    </div>

                    {/* List */}
                    {loading ? (
                        <div className="text-center py-10 text-gray-500 animate-pulse">Loading templates...</div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-gray-800 rounded-xl bg-gray-900/50">
                            <p className="text-gray-400 mb-2">No templates found.</p>
                            <button onClick={handleCreateWrapper} className="text-blue-400 hover:underline text-sm">Create one now</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {templates.map(t => (
                                <div key={t.id} className="group bg-gray-800/40 hover:bg-gray-800 border border-gray-700/50 hover:border-blue-500/30 rounded-xl p-4 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4">

                                    {/* Info */}
                                    <div className="flex-1 min-w-[200px]">
                                        {renamingId === t.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    value={newName}
                                                    onChange={e => setNewName(e.target.value)}
                                                    className="bg-gray-950 border border-blue-500 rounded px-2 py-1 text-white text-sm w-full focus:outline-none"
                                                    autoFocus
                                                    onKeyDown={e => e.key === 'Enter' && saveRename(t.id)}
                                                />
                                                <button onClick={() => saveRename(t.id)} className="p-1 bg-green-600/20 text-green-400 rounded hover:bg-green-600/40"><Check className="w-4 h-4" /></button>
                                                <button onClick={() => setRenamingId(null)} className="p-1 bg-red-600/20 text-red-400 rounded hover:bg-red-600/40"><X className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 group/name">
                                                <h3 className="font-semibold text-gray-200">{t.name}</h3>
                                                {t.id === 'default' && <span className="px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400 text-[10px] font-mono uppercase tracking-wider border border-blue-800">Default</span>}
                                                <button onClick={() => startRename(t)} className="opacity-0 group-hover/name:opacity-100 p-1 text-gray-500 hover:text-blue-400 transition-opacity">
                                                    <Edit2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-500 mt-1 font-mono">ID: {t.id}</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">

                                        {/* Edit Content Buttons */}
                                        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                                            <button
                                                onClick={() => onEditSub(t.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-gray-800 text-xs text-gray-300 hover:text-white transition-colors"
                                                title="Edit Sub-domain Report Structure"
                                            >
                                                <FileText className="w-3.5 h-3.5 text-orange-400" />
                                                Edit Sub Report
                                            </button>
                                            <div className="w-px bg-gray-700 my-1"></div>
                                            <button
                                                onClick={() => onEditDomain(t.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-gray-800 text-xs text-gray-300 hover:text-white transition-colors"
                                                title="Edit Domain Summary Report Structure"
                                            >
                                                <LayoutTemplate className="w-3.5 h-3.5 text-purple-400" />
                                                Edit Domain Report
                                            </button>
                                        </div>

                                        {/* Delete */}
                                        {t.id !== 'default' && (
                                            <button
                                                onClick={() => handleDelete(t.id, t.name)}
                                                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
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
                <div className="p-4 border-t border-gray-800 bg-gray-950/50 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors">Close</button>
                </div>

            </div>
        </div>
    );
}
