'use client';

import { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Trash2, Download, AlertCircle, CheckCircle, Clock, FileText, FileArchive } from 'lucide-react';
import Swal from 'sweetalert2';

export default function BackgroundJobsModal({ isOpen, onClose, theme, currentUser }) {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const intervalRef = useRef(null);

    const fetchJobs = async () => {
        if (!currentUser?.id) return;
        try {
            const res = await fetch(`/api/gdcc/report-jobs?userId=${currentUser.id}`);
            const data = await res.json();
            if (data.success) {
                setJobs(data.data || []);
            }
        } catch (e) {
            console.error('Failed to fetch background jobs:', e);
        }
    };

    // Poll for status updates when modal is open
    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            fetchJobs().finally(() => setLoading(false));

            intervalRef.current = setInterval(() => {
                fetchJobs();
            }, 3000); // Poll every 3 seconds
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, currentUser]);

    const handleDeleteJob = async (id, e) => {
        e.stopPropagation();
        const conf = await Swal.fire({
            title: 'Delete Job Log?',
            text: 'This will remove this job log and delete the generated file if it exists.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            background: '#111827',
            color: '#fff'
        });
        
        if (!conf.isConfirmed) return;

        try {
            const res = await fetch(`/api/gdcc/report-jobs?action=delete&id=${id}`, { method: 'GET' });
            const data = await res.json();
            if (data.success) {
                Swal.fire({
                    title: 'Deleted!',
                    text: 'Job deleted successfully.',
                    icon: 'success',
                    toast: true,
                    position: 'top-end',
                    timer: 2000,
                    showConfirmButton: false
                });
                fetchJobs();
            } else {
                Swal.fire('Error', data.message || 'Failed to delete job', 'error');
            }
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className={`fixed inset-0 z-[110] flex items-center justify-center ${theme.overlay || 'bg-black/50'} p-4 backdrop-blur-sm`}
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className={`w-full max-w-4xl h-[75vh] flex flex-col rounded-xl shadow-2xl overflow-hidden border ${theme.content || 'bg-gray-900 border-gray-700'} relative`}>
                
                {/* Header */}
                <div className={`flex items-center justify-between p-4 sm:p-5 border-b ${theme.border || 'border-gray-800'} ${theme.headerBg || 'bg-gray-800/50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${theme.buttonFocus || 'bg-blue-500/20'} ${theme.textPrimary || 'text-blue-400'}`}>
                            <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div>
                            <h2 className={`text-lg sm:text-xl font-bold ${theme.text || 'text-white'}`}>Background Report Jobs</h2>
                            <p className="text-xs sm:text-sm text-gray-400">View progress and download reports generated in the background</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={fetchJobs} 
                            className={`p-2 rounded-lg ${theme.buttonHover || 'hover:bg-gray-800'} text-gray-400 hover:text-white transition-colors`}
                            title="Refresh List"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
                        </button>
                        <button onClick={onClose} className={`p-2 rounded-lg ${theme.buttonHover || 'hover:bg-gray-800'} text-gray-400 hover:text-white transition-colors`}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-900/40">
                    {jobs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                            <Clock className="w-12 h-12 text-gray-600 mb-4" />
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">No Background Jobs Found</h3>
                            <p className="text-xs text-gray-500 mt-2 max-w-sm">
                                Create a batch report and select "Generate in Background" to process large reports without keeping the screen open.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {jobs.map(job => {
                                const subdomains = JSON.parse(job.subdomains || '[]');
                                const isZip = job.export_separated === 1;
                                
                                return (
                                    <div 
                                        key={job.id} 
                                        className={`p-4 rounded-xl border ${theme.card || 'bg-gray-800'} ${theme.border || 'border-gray-700'} hover:border-gray-600 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4`}
                                    >
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            {/* Top title and status badges */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold text-sm text-gray-200 truncate max-w-[250px] lg:max-w-md">
                                                    {job.zone_name}
                                                </span>
                                                <span className="text-[10px] bg-gray-900/60 border border-gray-700 px-2 py-0.5 rounded text-gray-400 flex items-center gap-1">
                                                    {isZip ? <FileArchive className="w-3 h-3 text-amber-400" /> : <FileText className="w-3 h-3 text-blue-400" />}
                                                    {isZip ? 'ZIP (Separated)' : 'DOCX (Combined)'}
                                                </span>
                                                
                                                {/* Status badge */}
                                                {job.status === 'pending' && (
                                                    <span className="text-[10px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-medium">
                                                        <Clock className="w-3 h-3 animate-pulse" /> Queued
                                                    </span>
                                                )}
                                                {job.status === 'processing' && (
                                                    <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-medium">
                                                        <RefreshCw className="w-3 h-3 animate-spin" /> Processing ({job.progress}%)
                                                    </span>
                                                )}
                                                {job.status === 'completed' && (
                                                    <span className="text-[10px] bg-green-500/10 border border-green-500/20 text-green-400 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-medium">
                                                        <CheckCircle className="w-3 h-3" /> Completed
                                                    </span>
                                                )}
                                                {job.status === 'failed' && (
                                                    <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-medium" title={job.error_message}>
                                                        <AlertCircle className="w-3 h-3" /> Failed
                                                    </span>
                                                )}
                                            </div>

                                            {/* Subdomain details */}
                                            <p className="text-xs text-gray-400 break-words line-clamp-2">
                                                <b>Subdomains ({subdomains.length}):</b> {subdomains.join(', ')}
                                            </p>
                                            
                                            {/* Date range */}
                                            <div className="flex gap-4 text-[11px] text-gray-500">
                                                <span><b>Range:</b> {job.start_date} to {job.end_date}</span>
                                                <span><b>Created:</b> {new Date(job.created_at).toLocaleString('th-TH')}</span>
                                            </div>

                                            {/* Live progress details */}
                                            {(job.status === 'processing' || job.status === 'failed') && job.status_message && (
                                                <p className={`text-[11px] font-medium font-mono ${job.status === 'failed' ? 'text-red-400' : 'text-blue-400'}`}>
                                                    &gt; {job.status_message}
                                                </p>
                                            )}

                                            {/* Progress Bar */}
                                            {job.status === 'processing' && (
                                                <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-full h-1.5 overflow-hidden mt-2">
                                                    <div 
                                                        className="bg-blue-500 h-1.5 transition-all duration-500" 
                                                        style={{ width: `${job.progress}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                            {job.status === 'completed' && job.file_name && (
                                                <a
                                                    href={`/api/gdcc/report-jobs?action=download&fileName=${job.file_name}`}
                                                    download
                                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                                                >
                                                    <Download className="w-3.5 h-3.5" /> Download
                                                </a>
                                            )}
                                            <button
                                                onClick={(e) => handleDeleteJob(job.id, e)}
                                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                                                title="Delete Job Log"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
