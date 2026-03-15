'use client';

import { useState, useEffect } from 'react';
import { X, Users, Plus, Trash2, Check, Globe, Search, AlertCircle, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

export default function DepartmentModal({ isOpen, onClose, theme, selectedZoneId, zoneName, subdomains = [] }) {
    const [departments, setDepartments] = useState([]);
    const [loadingDepartments, setLoadingDepartments] = useState(false);
    const [selectedDeptId, setSelectedDeptId] = useState(null);
    const [deptDomains, setDeptDomains] = useState([]);
    const [loadingDomains, setLoadingDomains] = useState(false);
    const [newDeptName, setNewDeptName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Default theme fallback
    const t = theme || {
        modalOverlay: 'bg-black/50 backdrop-blur-sm',
        modalBg: 'bg-gray-900',
        modalBorder: 'border-gray-800',
        modalHeaderBg: 'bg-gray-800/50',
        modalTitle: 'text-white',
        modalCloseIcon: 'text-gray-400 hover:text-white',
        subText: 'text-gray-400',
        text: 'text-gray-200',
        accent: 'text-blue-400',
        button: 'bg-gray-800 hover:bg-gray-700 text-gray-200',
        buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
        buttonDanger: 'bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30',
        input: 'bg-gray-800 border-gray-700 text-white focus:border-blue-500',
        card: 'bg-gray-800/50 border-gray-700',
        hover: 'hover:bg-gray-800',
        dropdown: {
            bg: 'bg-gray-800',
            border: 'border-gray-700',
            inputText: 'text-white',
            placeholder: 'text-gray-500'
        }
    };

    const fetchDepartments = async () => {
        setLoadingDepartments(true);
        try {
            const url = selectedZoneId ? `/api/departments?zone_id=${selectedZoneId}` : '/api/departments';
            const res = await fetch(url);
            const data = await res.json();
            if (data.departments) {
                setDepartments(data.departments);
            }
        } catch (error) {
            console.error('Error fetching departments:', error);
        } finally {
            setLoadingDepartments(false);
        }
    };

    const fetchDeptDomains = async (deptId) => {
        if (!deptId) return;
        setLoadingDomains(true);
        try {
            const res = await fetch(`/api/department-domains?department_id=${deptId}`);
            const data = await res.json();
            if (data.domains) {
                setDeptDomains(data.domains);
            }
        } catch (error) {
            console.error('Error fetching department domains:', error);
        } finally {
            setLoadingDomains(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setSelectedDeptId(null); // Reset selection when zone changes
            fetchDepartments();
        }
    }, [isOpen, selectedZoneId]);

    useEffect(() => {
        if (selectedDeptId) {
            fetchDeptDomains(selectedDeptId);
        } else {
            setDeptDomains([]);
        }
    }, [selectedDeptId]);

    const handleAddDepartment = async () => {
        if (!newDeptName.trim()) return;
        try {
            const res = await fetch('/api/departments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newDeptName.trim(), zone_id: selectedZoneId })
            });
            const data = await res.json();
            if (res.ok) {
                setNewDeptName('');
                fetchDepartments();
                Swal.fire({ title: 'Success', text: 'Department created', icon: 'success', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
            } else {
                Swal.fire('Error', data.error || 'Failed to create department', 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Failed to create department', 'error');
        }
    };

    const handleDeleteDepartment = async (id, name) => {
        const result = await Swal.fire({
            title: 'Delete Department?',
            text: `Are you sure you want to delete "${name}"? This will also remove all domain mappings for this department.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            background: '#fff',
            color: '#000'
        });

        if (result.isConfirmed) {
            try {
                const res = await fetch(`/api/departments?id=${id}`, { method: 'DELETE' });
                if (res.ok) {
                    if (selectedDeptId === id) setSelectedDeptId(null);
                    fetchDepartments();
                    Swal.fire({ title: 'Deleted', icon: 'success', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
                }
            } catch (error) {
                console.error('Error deleting department:', error);
            }
        }
    };

    const handleAddDomain = async (domain) => {
        if (!selectedDeptId || !selectedZoneId) return;
        try {
            const res = await fetch('/api/department-domains', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    department_id: selectedDeptId,
                    domain,
                    zone_id: selectedZoneId
                })
            });
            const data = await res.json();
            if (res.ok) {
                fetchDeptDomains(selectedDeptId);
                fetchDepartments(); // Update counts
            } else if (res.status !== 409) {
                Swal.fire('Error', data.error || 'Failed to add domain', 'error');
            }
        } catch (error) {
            console.error('Error adding domain:', error);
        }
    };

    const handleRemoveDomain = async (id) => {
        try {
            const res = await fetch(`/api/department-domains?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchDeptDomains(selectedDeptId);
                fetchDepartments(); // Update counts
            }
        } catch (error) {
            console.error('Error removing domain:', error);
        }
    };

    const availableSubdomains = subdomains
        .filter(s => s !== 'ALL_SUBDOMAINS')
        .filter(s => !deptDomains.some(dd => dd.domain === s && dd.zone_id === selectedZoneId));

    if (!isOpen) return null;

    return (
        <div
            className={`fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in ${t.modalOverlay}`}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className={`${t.modalBg} ${t.modalBorder} border rounded-xl w-full max-w-4xl h-[80vh] overflow-hidden flex flex-col shadow-2xl`}>
                {/* Header */}
                <div className={`p-4 border-b ${t.modalBorder} ${t.modalHeaderBg} flex justify-between items-center`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-blue-500/10 ${t.accent}`}>
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className={`text-lg font-bold ${t.modalTitle}`}>Department Settings of {zoneName || 'Zone'}</h3>
                            <p className={`text-xs ${t.subText}`}>Manage departments and subdomain mappings</p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`${t.modalCloseIcon} transition-colors`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left Panel: Departments List */}
                    <div className={`w-1/3 border-r ${t.modalBorder} flex flex-col`}>
                        <div className="p-4 border-b border-gray-800/50">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="New department..."
                                    value={newDeptName}
                                    onChange={(e) => setNewDeptName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddDepartment()}
                                    className={`flex-1 text-xs px-3 py-2 rounded border outline-none focus:ring-1 focus:ring-blue-500 transition-all ${t.input}`}
                                />
                                <button
                                    onClick={handleAddDepartment}
                                    disabled={!newDeptName.trim()}
                                    className={`p-2 rounded transition-colors ${!newDeptName.trim() ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : t.buttonPrimary}`}
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {loadingDepartments ? (
                                <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                                    <span className="text-xs">Loading departments...</span>
                                </div>
                            ) : departments.length === 0 ? (
                                <div className="text-center py-10 text-gray-500 text-xs">No departments found</div>
                            ) : (
                                departments.map(dept => (
                                    <div
                                        key={dept.id}
                                        onClick={() => setSelectedDeptId(dept.id)}
                                        className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${selectedDeptId === dept.id ? 'bg-blue-600/20 border border-blue-500/30' : `${t.hover} border border-transparent`}`}
                                    >
                                        <div className="flex flex-col">
                                            <span className={`text-sm font-medium ${selectedDeptId === dept.id ? 'text-blue-400' : t.text}`}>{dept.name}</span>
                                            <span className="text-[10px] text-gray-500">{dept.domain_count || 0} domains mapped</span>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteDepartment(dept.id, dept.name); }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-500/20 rounded transition-all"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Panel: Domain Mapping */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-black/20">
                        {selectedDeptId ? (
                            <>
                                <div className={`p-4 border-b ${t.modalBorder} flex items-center justify-between bg-gray-800/30`}>
                                    <div className="flex items-center gap-2">
                                        <h4 className={`font-bold ${t.text}`}>{departments.find(d => d.id === selectedDeptId)?.name}</h4>
                                        <span className={`text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20`}>
                                            {deptDomains.length} Domains
                                        </span>
                                    </div>
                                    <div className="relative w-48">
                                        <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2" />
                                        <input
                                            type="text"
                                            placeholder="Search domains..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className={`w-full text-[11px] pl-8 pr-3 py-1.5 rounded-full outline-none border transition-all ${t.input}`}
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 flex overflow-hidden">
                                    {/* Subdomains in current department */}
                                    <div className={`w-1/2 border-r ${t.modalBorder} flex flex-col`}>
                                        <div className="p-3 bg-gray-800/50 border-b border-gray-800/50">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mapped Subdomains</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                            {loadingDomains ? (
                                                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-500" /></div>
                                            ) : deptDomains.length === 0 ? (
                                                <div className="text-center py-10 text-gray-500 text-xs italic">No domains mapped yet</div>
                                            ) : (
                                                deptDomains.filter(d => d.domain.toLowerCase().includes(searchTerm.toLowerCase())).map(dd => (
                                                    <div key={dd.id} className={`flex items-center justify-between p-2 rounded ${t.card} border`}>
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <Globe className="w-3 h-3 text-blue-400 shrink-0" />
                                                            <span className="text-xs truncate" title={dd.domain}>{dd.domain}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveDomain(dd.id)}
                                                            className="p-1 text-red-500 hover:bg-red-500/20 rounded transition-colors"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Available Subdomains in selected zone */}
                                    <div className="w-1/2 flex flex-col">
                                        <div className="p-3 bg-gray-800/50 border-b border-gray-800/50 flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Available in Current Zone</span>
                                            {selectedZoneId && <span className="text-[10px] text-blue-400 font-medium">Zone Active</span>}
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                            {!selectedZoneId ? (
                                                <div className="flex flex-col items-center justify-center py-10 text-gray-500 px-4 text-center">
                                                    <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                                                    <span className="text-xs">Please select a domain/zone on the dashboard first</span>
                                                </div>
                                            ) : availableSubdomains.length === 0 ? (
                                                <div className="text-center py-10 text-gray-500 text-xs italic">All subdomains already mapped</div>
                                            ) : (
                                                availableSubdomains.filter(s => s.toLowerCase().includes(searchTerm.toLowerCase())).map(s => (
                                                    <div key={s} className={`flex items-center justify-between p-2 rounded ${t.hover} transition-colors border border-transparent hover:border-blue-500/20`}>
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <Globe className="w-3 h-3 text-gray-500 shrink-0" />
                                                            <span className="text-xs truncate" title={s}>{s}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleAddDomain(s)}
                                                            className="p-1 text-blue-400 hover:bg-blue-400/20 rounded transition-colors"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-3">
                                <Users className="w-12 h-12 opacity-10" />
                                <div className="text-center">
                                    <p className="text-sm font-medium">Select a department</p>
                                    <p className="text-xs">to manage its subdomain mappings</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className={`p-4 border-t ${t.modalBorder} ${t.modalHeaderBg} flex justify-end`}>
                    <button
                        onClick={onClose}
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${t.buttonPrimary} shadow-lg shadow-blue-500/20`}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
