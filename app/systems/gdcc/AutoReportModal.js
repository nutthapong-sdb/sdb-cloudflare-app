'use client';

import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { Search, X, Calendar, Database, Check, Clock, Trash2, Download, AlertCircle, ChevronDown, ChevronRight, File as FileIcon, Key, Server, Globe, FileType } from 'lucide-react';
import Swal from 'sweetalert2';

function SearchableDropdown({ options, value, onChange, placeholder, label, loading, icon, theme }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const dropdownRef = useRef(null);
    const listRef = useRef(null);

    // Default theme fallback
    const t = theme ? theme.dropdown : {
        bg: 'bg-gray-900',
        border: 'border-gray-700',
        menuBg: 'bg-gray-800',
        menuBorder: 'border-gray-700',
        hover: 'hover:bg-gray-700',
        text: 'text-gray-300',
        active: 'bg-blue-600 text-white',
        label: 'text-gray-400',
        placeholder: 'text-gray-500',
        inputText: 'text-white',
        focused: 'bg-gray-700 text-white' // Helper for keyboard focus
    };

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (option.subtitle && option.subtitle.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
        setFocusedIndex(-1);
    };

    // Reset focus when options change or open
    useEffect(() => {
        setFocusedIndex(-1);
    }, [isOpen, searchTerm]);

    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
                // Scroll logic could go here
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
                break;
            case 'Enter':
                e.preventDefault();
                if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
                    handleSelect(filteredOptions[focusedIndex].value);
                } else if (filteredOptions.length === 1) {
                    // Auto select single result if enter pressed? Optional but nice.
                    handleSelect(filteredOptions[0].value);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                break;
            case 'Tab':
                setIsOpen(false);
                break;
        }
    };

    // Scroll focused item into view
    useEffect(() => {
        if (isOpen && focusedIndex >= 0 && listRef.current) {
            const focusedItem = listRef.current.children[focusedIndex];
            if (focusedItem) {
                focusedItem.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [focusedIndex, isOpen]);

    return (
        <div className="space-y-2 relative" ref={dropdownRef}>
            <label className={`${t.label} text-xs font-semibold uppercase tracking-wider flex items-center gap-2 mb-1`}>
                {icon}
                {label}
            </label>

            <div className="relative" onKeyDown={handleKeyDown}>
                <div
                    onClick={() => !loading && setIsOpen(!isOpen)}
                    className={`
             w-full px-4 py-2.5 rounded-lg cursor-pointer transition-all
             flex items-center justify-between
             ${t.bg} border ${t.border}
             ${isOpen ? 'ring-2 ring-blue-500/50 border-blue-500' : 'hover:opacity-80'}
          `}
                    tabIndex={0} // Make accessible/focusable
                >
                    {isOpen ? (
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                            placeholder="Search..."
                            className={`w-full bg-transparent outline-none text-sm ${t.inputText} placeholder-gray-500`}
                            autoFocus
                        />
                    ) : (
                        <span className={`text-sm ${selectedOption ? t.inputText : t.placeholder}`}>
                            {selectedOption ? selectedOption.label : placeholder}
                        </span>
                    )}
                    <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''} ${t.placeholder}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>

                {isOpen && (
                    <div ref={listRef} className={`absolute z-[100] w-full mt-1 ${t.menuBg} border ${t.menuBorder} rounded-lg shadow-xl max-h-60 overflow-y-auto`}>
                        {loading ? (
                            <div className="p-3 text-center text-xs text-gray-400">Loading...</div>
                        ) : filteredOptions.length === 0 ? (
                            <div className="p-3 text-center text-xs text-gray-400">No results found</div>
                        ) : (
                            filteredOptions.map((option, index) => {
                                const isFocused = index === focusedIndex;
                                return (
                                    <div
                                        key={option.value}
                                        onMouseDown={() => handleSelect(option.value)}
                                        onMouseEnter={() => setFocusedIndex(index)} // Mouse hover updates focus too
                                        className={`
                    px-4 py-2 cursor-pointer transition-colors text-sm
                    ${value === option.value ? t.active : isFocused ? (t.focused || 'bg-gray-700 text-white') : `${t.hover} ${t.text}`}
                  `}
                                    >
                                        <div className="font-medium">{option.label}</div>
                                        {option.subtitle && <div className="text-xs opacity-60">{option.subtitle}</div>}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AutoReportModal({ isOpen, onClose, accounts, theme, currentUser }) {
    const [configs, setConfigs] = useState([]);
    const [loadingConfigs, setLoadingConfigs] = useState(false);

    // Form states
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [zones, setZones] = useState([]);
    const [loadingZones, setLoadingZones] = useState(false);

    const [selectedZoneId, setSelectedZoneId] = useState('');
    const [subdomains, setSubdomains] = useState([]);
    const [loadingSubdomains, setLoadingSubdomains] = useState(false);
    const [selectedSubdomain, setSelectedSubdomain] = useState('');

    const [targetDate, setTargetDate] = useState('');
    const [intervalDays, setIntervalDays] = useState(30);
    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('default');
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    // Live search for form
    const [accountSearch, setAccountSearch] = useState('');
    const [zoneSearch, setZoneSearch] = useState('');

    // List search
    const [listSearch, setListSearch] = useState('');
    const [expandedConfig, setExpandedConfig] = useState(null);

    const callScrapeApi = async (action, bodyData = {}) => {
        try {
            const res = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    apiToken: currentUser?.cloudflare_api_token,
                    ...bodyData
                })
            });
            return await res.json();
        } catch (e) {
            return { success: false, message: e.message };
        }
    };

    const fetchConfigs = async () => {
        setLoadingConfigs(true);
        try {
            const res = await fetch('/api/auto-report');
            const data = await res.json();
            if (data.success) {
                setConfigs(data.data || []);
            }
        } catch (e) { console.error(e); }
        setLoadingConfigs(false);
    };

    const fetchTemplates = async () => {
        setLoadingTemplates(true);
        try {
            const res = await fetch('/api/templates');
            const data = await res.json();
            if (Array.isArray(data)) {
                setTemplates(data);
            }
        } catch (e) {
            console.error('Failed to fetch templates:', e);
        }
        setLoadingTemplates(false);
    };

    useEffect(() => {
        if (isOpen) {
            fetchConfigs();
            fetchTemplates();
        }
    }, [isOpen]);

    // Handle Account Change
    useEffect(() => {
        if (!isOpen || !selectedAccountId) return;
        let isMounted = true;

        const fetchZones = async () => {
            setLoadingZones(true);
            const result = await callScrapeApi('list-zones', { accountId: selectedAccountId });
            if (isMounted) {
                if (result.success && result.data) {
                    setZones(result.data);
                } else {
                    setZones([]);
                }
                setLoadingZones(false);
                setSelectedZoneId('');
                setSubdomains([]);
                setSelectedSubdomain('');
            }
        };
        fetchZones();
        return () => { isMounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedAccountId, isOpen]);

    // Handle Zone Change
    useEffect(() => {
        if (!isOpen || !selectedZoneId) return;
        let isMounted = true;

        const fetchDns = async () => {
            setLoadingSubdomains(true);
            const result = await callScrapeApi('get-dns-records', { zoneId: selectedZoneId });
            if (isMounted) {
                if (result.success && result.data) {
                    const hostSet = new Set(
                        result.data
                            .filter(r => ['A', 'AAAA', 'CNAME'].includes(r.type))
                            .map(r => r.name)
                            .filter(Boolean)
                    );
                    const zoneObj = zones.find(z => z.id === selectedZoneId);
                    if (zoneObj && zoneObj.name) hostSet.delete(zoneObj.name); // Always delete root domain so it doesn't duplicate ALL_SUBDOMAINS

                    setSubdomains(['ALL_SUBDOMAINS', ...Array.from(hostSet)].filter(Boolean));
                } else {
                    setSubdomains(['ALL_SUBDOMAINS']);
                }
                setLoadingSubdomains(false);
                setSelectedSubdomain('');
            }
        };
        fetchDns();
        return () => { isMounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedZoneId, isOpen]);

    const handleAddConfig = async () => {
        if (!selectedAccountId || !selectedZoneId || !selectedSubdomain || !targetDate || !intervalDays) {
            Swal.fire('Error', 'Please fill all required fields.', 'error');
            return;
        }

        const accountObj = accounts.find(a => a.id === selectedAccountId);
        const zoneObj = zones.find(z => z.id === selectedZoneId);

        try {
            const res = await fetch('/api/auto-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create-config',
                    accountId: selectedAccountId,
                    accountName: accountObj?.name || 'Unknown',
                    zoneId: selectedZoneId,
                    zoneName: zoneObj?.name || 'Unknown',
                    subdomain: selectedSubdomain,
                    targetDate,
                    intervalDays: parseInt(intervalDays, 10),
                    templateId: selectedTemplateId
                })
            });
            const data = await res.json();
            if (data.success) {
                Swal.fire({ title: 'Success', text: 'Auto Gen Report Configured.', icon: 'success', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
                fetchConfigs();
                // Reset form optionally
                setSelectedAccountId('');
                setSelectedZoneId('');
                setSelectedSubdomain('');
                setTargetDate('');
            } else {
                Swal.fire('Error', data.message || 'Failed to add config', 'error');
            }
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    };

    const handleDeleteConfig = async (id, e) => {
        e.stopPropagation();
        const conf = await Swal.fire({
            title: 'Delete Config?',
            text: 'This will stop auto generation for this configuration.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            background: '#111827',
            color: '#fff'
        });
        if (!conf.isConfirmed) return;

        try {
            const res = await fetch(`\/api\/auto-report?action=delete-config&id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchConfigs();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteFile = async (id, fileName, e) => {
        e.stopPropagation();
        const conf = await Swal.fire({
            title: 'Delete File?',
            text: 'This report file will be permanently deleted.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            background: '#111827',
            color: '#fff'
        });
        if (!conf.isConfirmed) return;

        try {
            const res = await fetch(`\/api\/auto-report?action=delete-file&id=${id}&fileName=${fileName}`, { method: 'DELETE' });
            if (res.ok) fetchConfigs();
        } catch (e) {
            console.error(e);
        }
    };

    const previewDates = useMemo(() => {
        if (!targetDate || !intervalDays) return '';
        const d = new Date(targetDate);
        if (isNaN(d.valueOf())) return '';
        const intv = parseInt(intervalDays, 10) || 0;

        const originalDay = d.getDate();
        const isSpecialMonthly = (intv === 30 && (originalDay === 30 || originalDay === 31));

        // Generate next 3 dates
        const runDates = [];
        let cur = new Date(d);
        for (let i = 0; i < 3; i++) {
            if (isSpecialMonthly) {
                if (i === 0) {
                    // First jump: from end of month to 1st of month+2 (skipping the immediate next month)
                    cur = new Date(cur.getFullYear(), cur.getMonth() + 2, 1);
                } else {
                    // Subsequent jumps: just add 1 month, day remains 1
                    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
                }
            } else {
                cur.setDate(cur.getDate() + intv);
            }
            runDates.push(cur.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }));
        }
        return `สร้างอีกครั้งในวันที่ ${runDates.join(', ')} ...`;
    }, [targetDate, intervalDays]);

    const filteredAccounts = accounts.filter(a => a.name.toLowerCase().includes(accountSearch.toLowerCase()));
    const filteredZones = zones.filter(z => z.name.toLowerCase().includes(zoneSearch.toLowerCase()));

    const filteredConfigs = configs.filter(c =>
        (c.account_name && c.account_name.toLowerCase().includes(listSearch.toLowerCase())) ||
        (c.zone_name && c.zone_name.toLowerCase().includes(listSearch.toLowerCase())) ||
        (c.subdomain && c.subdomain.toLowerCase().includes(listSearch.toLowerCase()))
    );

    if (!isOpen) return null;

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center ${theme.overlay || 'bg-black/50'} p-4 backdrop-blur-sm`}
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className={`w-full max-w-5xl h-[85vh] flex flex-col rounded-xl shadow-2xl overflow-hidden border ${theme.content || 'bg-gray-900 border-gray-700'} relative`}>

                {/* HEAD */}
                <div className={`flex items-center justify-between p-4 sm:p-5 border-b ${theme.border || 'border-gray-800'} ${theme.headerBg || 'bg-gray-800/50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${theme.buttonFocus || 'bg-blue-500/20'} ${theme.textPrimary || 'text-blue-400'}`}>
                            <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div>
                            <h2 className={`text-lg sm:text-xl font-bold ${theme.text || 'text-white'}`}>Auto Gen Report</h2>
                            <p className="text-xs sm:text-sm text-gray-400">Schedule automatic background report generation</p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-lg ${theme.buttonHover || 'hover:bg-gray-800'} text-gray-400 hover:text-white transition-colors`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* TOP PANEL: CONFIGURATION FORM */}
                    <div className={`w-full p-5 border-b ${theme.border || 'border-gray-800'} ${theme.bg || 'bg-gray-900'} shrink-0`}>
                        <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-400" /> New Configuration
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Account Select */}
                            <SearchableDropdown
                                theme={theme}
                                icon={<Key className="w-4 h-4 text-blue-400" />}
                                label="Cloudflare Account"
                                placeholder={loadingConfigs ? "Loading..." : "Choose an account..."}
                                options={accounts.map(acc => ({ value: acc.id, label: acc.name, subtitle: `ID: ${acc.id}` }))}
                                value={selectedAccountId}
                                onChange={setSelectedAccountId}
                            />

                            {/* Zone Select */}
                            <SearchableDropdown
                                theme={theme}
                                icon={<Server className="w-4 h-4 text-green-400" />}
                                label="Zone (Domain)"
                                placeholder={!selectedAccountId ? "Select Account first" : loadingZones ? "Loading..." : "Choose a zone..."}
                                options={zones.map(zone => ({ value: zone.id, label: zone.name, subtitle: zone.status }))}
                                value={selectedZoneId}
                                onChange={setSelectedZoneId}
                                loading={loadingZones}
                            />

                            {/* Subdomain Select */}
                            <SearchableDropdown
                                theme={theme}
                                icon={<Globe className="w-4 h-4 text-purple-400" />}
                                label="Target Subdomain"
                                placeholder={!selectedZoneId ? "Select Zone first" : "Choose Subdomain..."}
                                options={subdomains.map(sd => ({
                                    value: sd,
                                    label: sd === 'ALL_SUBDOMAINS' ? '🌐 Zone Overview (All)' : sd
                                }))}
                                value={selectedSubdomain}
                                onChange={setSelectedSubdomain}
                                loading={loadingSubdomains && subdomains.length === 0}
                            />
                        </div>

                        {/* Template Selection */}
                        <div className="mt-4">
                            <SearchableDropdown
                                theme={theme}
                                icon={<FileType className="w-4 h-4 text-orange-400" />}
                                label="Report Template"
                                placeholder={loadingTemplates ? "Loading templates..." : "Choose a template..."}
                                options={templates.map(t => ({
                                    value: t.id,
                                    label: t.name,
                                    subtitle: `ID: ${t.id}`
                                }))}
                                value={selectedTemplateId}
                                onChange={setSelectedTemplateId}
                                loading={loadingTemplates}
                            />
                        </div>

                        <div className="mt-4 space-y-4">
                            {/* Date & Interval */}
                            <div className="flex gap-4">
                                <div className="w-1/3">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Start Target Date</label>
                                    <input
                                        type="date"
                                        className={`w-full bg-gray-800 border ${theme.inputBorder || 'border-gray-700'} rounded p-2 text-sm text-gray-200 outline-none focus:border-blue-500`}
                                        value={targetDate}
                                        onChange={e => setTargetDate(e.target.value)}
                                    />
                                </div>
                                <div className="w-1/3">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Interval (Days)</label>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                min="1"
                                                className={`w-full bg-gray-800 border ${theme.inputBorder || 'border-gray-700'} rounded p-2 text-sm text-gray-200 outline-none focus:border-blue-500`}
                                                value={intervalDays}
                                                onChange={e => setIntervalDays(e.target.value)}
                                            />
                                            <span className="text-gray-400 text-xs px-2">Days</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-1/3">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Quick Select</label>
                                    <div className="flex gap-1.5 mt-0.5">
                                        <button onClick={() => setIntervalDays(1)} className="flex-1 py-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded transition-colors">Daily</button>
                                        <button onClick={() => setIntervalDays(7)} className="flex-1 py-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded transition-colors">Weekly</button>
                                        <button onClick={() => setIntervalDays(30)} className="flex-1 py-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded transition-colors">Monthly</button>
                                    </div>
                                </div>
                            </div>

                            {/* Preview */}
                            {previewDates && (
                                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-300 flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{previewDates}</span>
                                </div>
                            )}

                            <button
                                onClick={handleAddConfig}
                                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
                            >
                                <Check className="w-4 h-4" /> Add to Schedule
                            </button>
                        </div>
                    </div>

                    {/* BOTTOM PANEL: EXISTING CONFIGS & REPORTS */}
                    <div className={`w-full flex-1 flex flex-col min-h-0 ${theme.content || 'bg-gray-800/30'}`}>
                        <div className={`p-3 border-b ${theme.border || 'border-gray-800'} flex items-center justify-between`}>
                            <h3 className="text-sm font-semibold text-gray-300">Scheduled Reports ({filteredConfigs.length})</h3>
                            <div className="relative w-48">
                                <Search className="w-4 h-4 text-gray-500 absolute left-2.5 top-2" />
                                <input
                                    type="text"
                                    placeholder="Search lists..."
                                    value={listSearch}
                                    onChange={e => setListSearch(e.target.value)}
                                    className={`w-full bg-gray-900 border ${theme.inputBorder || 'border-gray-700'} text-xs text-gray-300 rounded-full pl-8 pr-3 py-1.5 focus:border-blue-500 outline-none`}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {loadingConfigs ? (
                                <div className="text-center text-gray-500 text-sm mt-10">Loading configurations...</div>
                            ) : filteredConfigs.length === 0 ? (
                                <div className="text-center text-gray-500 text-sm mt-10">
                                    No scheduled reports found.
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className={`text-xs uppercase ${theme.headerBg || 'bg-gray-900/50'} text-gray-400 border-b ${theme.border || 'border-gray-800'} sticky top-0 z-10`}>
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Domain / Subdomain</th>
                                            <th className="px-4 py-3 font-medium hidden md:table-cell">Account</th>
                                            <th className="px-4 py-3 font-medium text-center">Interval</th>
                                            <th className="px-4 py-3 font-medium hidden sm:table-cell">Start Date</th>
                                            <th className="px-4 py-3 font-medium text-center">Files</th>
                                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800/50">
                                        {filteredConfigs.map(config => {
                                            const isExpanded = expandedConfig === config.id;
                                            const files = config.files || [];
                                            return (
                                                <Fragment key={config.id}>
                                                    <tr
                                                        className={`cursor-pointer transition-colors ${theme.hover || 'hover:bg-gray-800/50'} ${isExpanded ? 'bg-gray-800/30' : ''}`}
                                                        onClick={() => setExpandedConfig(isExpanded ? null : config.id)}
                                                    >
                                                        <td className="px-4 py-3 relative">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                                                    <ChevronRight className="w-4 h-4" />
                                                                </div>
                                                                <span className="font-semibold text-gray-200 truncate max-w-[200px] lg:max-w-xs" title={config.subdomain === 'ALL_SUBDOMAINS' ? config.zone_name : config.subdomain}>
                                                                    {config.subdomain === 'ALL_SUBDOMAINS' ? config.zone_name : config.subdomain}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell truncate max-w-[150px]" title={config.account_name}>{config.account_name}</td>
                                                        <td className="px-4 py-3 text-center text-xs">
                                                            <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Every {config.interval_days} Days</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">{new Date(config.target_date).toLocaleDateString('th-TH')}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`text-xs px-2 py-0.5 rounded-full ${files.length > 0 ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                                                                {files.length}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <button
                                                                onClick={(e) => handleDeleteConfig(config.id, e)}
                                                                className="p-1.5 text-red-500 hover:bg-red-500/20 rounded transition-colors"
                                                                title="Delete Schedule"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>

                                                    {/* Expanded Files View */}
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan={6} className={`p-0 bg-black/20 border-b border-t-0 shadow-inner ${theme.border || 'border-gray-800'}`}>
                                                                <div className="px-6 py-4">
                                                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                                        <FileIcon className="w-3.5 h-3.5" /> Generated Reports
                                                                    </h4>
                                                                    {files.length === 0 ? (
                                                                        <div className="text-xs text-center text-gray-500 italic py-4 bg-gray-900/50 rounded border border-dashed border-gray-700">No report files have been generated yet.</div>
                                                                    ) : (
                                                                        <div className="grid grid-cols-1 gap-2">
                                                                            {files.map(file => (
                                                                                <div key={file.id} className={`flex items-center justify-between py-2 px-3 ${theme.card || 'bg-gray-800'} rounded border ${theme.border || 'border-gray-700'} group hover:border-blue-500/50 transition-colors`}>
                                                                                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                                                        <FileIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                                                                        <div className="flex flex-col min-w-0 flex-1">
                                                                                            <span className="text-xs text-gray-200 break-all" title={file.file_name}>{file.file_name}</span>
                                                                                            <span className="text-[10px] text-gray-500">{new Date(file.report_date).toLocaleDateString('th-TH')}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1 shrink-0 ml-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                                                        <a
                                                                                            href={`/reports/${file.file_name}`}
                                                                                            download
                                                                                            onClick={e => e.stopPropagation()}
                                                                                            className="p-1 text-green-400 hover:bg-green-400/20 rounded"
                                                                                            title="Download Report"
                                                                                        >
                                                                                            <Download className="w-3.5 h-3.5" />
                                                                                        </a>
                                                                                        <button
                                                                                            onClick={(e) => handleDeleteFile(file.id, file.file_name, e)}
                                                                                            className="p-1 text-red-500 hover:bg-red-500/20 rounded"
                                                                                            title="Delete File"
                                                                                        >
                                                                                            <X className="w-3.5 h-3.5" />
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
