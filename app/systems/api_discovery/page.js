'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/app/utils/auth';
import { getUserProfileAction } from '@/app/actions/authActions';

// Searchable Dropdown Component
function SearchableDropdown({ options, value, onChange, placeholder, label, loading, icon }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (option.subtitle && option.subtitle.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Get selected option
  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="space-y-3 relative" ref={dropdownRef}>
      <label className="block text-orange-300 font-bold text-lg flex items-center gap-2">
        {icon}
        {label}
      </label>

      <div className="relative">
        {/* Selected value display / Search input */}
        <div
          onClick={() => !loading && setIsOpen(!isOpen)}
          className="w-full px-4 py-4 text-lg bg-gray-700/50 text-white border-2 border-gray-600 rounded-xl cursor-pointer transition-all hover:border-orange-500 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/30"
        >
          {isOpen ? (
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onBlur={(e) => {
                // ให้เวลาในการคลิกเลือก option ก่อนปิด
                setTimeout(() => setIsOpen(false), 200);
              }}
              placeholder="พิมพ์เพื่อค้นหา..."
              className="w-full bg-transparent outline-none"
              autoFocus
            />
          ) : (
            <div className="flex items-center justify-between">
              <span className={selectedOption ? 'text-white' : 'text-gray-400'}>
                {selectedOption ? selectedOption.label : placeholder}
              </span>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
        </div>

        {/* Dropdown list */}
        {isOpen && (
          <div className="absolute z-[100] w-full mt-2 bg-gray-800 border-2 border-gray-600 rounded-xl shadow-2xl max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-400">
                <svg className="animate-spin h-5 w-5 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                กำลังโหลด...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                ไม่พบข้อมูล
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onMouseDown={() => handleSelect(option.value)}
                  className={`
                    px-4 py-3 cursor-pointer transition-all
                    ${value === option.value
                      ? 'bg-orange-600 text-white'
                      : 'hover:bg-gray-700 text-gray-200'
                    }
                  `}
                >
                  <div className="font-medium">{option.label}</div>
                  {option.subtitle && (
                    <div className="text-sm opacity-70">{option.subtitle}</div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function APIDiscoveryPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

  // State for accounts and zones
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [loadingZones, setLoadingZones] = useState(false);

  // State for discovery data
  const [discoveryData, setDiscoveryData] = useState([]);
  const [rawDiscoveryData, setRawDiscoveryData] = useState(null);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);

  // Feature: Subdomain Expansion
  const [expandedItems, setExpandedItems] = useState({}); // { [rowId]: boolean }
  const [subdomainCache, setSubdomainCache] = useState({}); // { [key]: Array }
  const [loadingSubdomains, setLoadingSubdomains] = useState({}); // { [rowId]: boolean }

  // State for Filtering & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // ฟังก์ชันแสดง toast
  const showToast = (message, type = 'success') => {
    const id = Date.now();
    const newToast = { id, message, type };
    setToasts(prev => [...prev, newToast]);

    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  };

  const callAPI = async (action, params = {}, explicitToken = null, skipLoading = false) => {
    if (!skipLoading) setLoading(true);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          ...params,
          apiToken: explicitToken || currentUser?.cloudflare_api_token // Pass user token
        }),
      });

      const result = await response.json();

      if (action === 'get-api-discovery') {
        console.log('📦 Full API Response:', result);
      }

      if (result.success) {
        if (!skipLoading && action !== 'get-account-info' && action !== 'list-zones' && action !== 'get-subdomain-stats') {
          showToast(result.message, 'success');
        }
        return result;
      } else {
        showToast(result.message || 'เกิดข้อผิดพลาด', 'error');
        return null;
      }
    } catch (err) {
      showToast('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้: ' + err.message, 'error');
      return null;
    } finally {
      if (!skipLoading) setLoading(false);
    }
  };

  const loadAccounts = async (tokenOverride = null) => {
    setLoading(true);
    const result = await callAPI('get-account-info', {}, tokenOverride);
    if (result && result.data) {
      setAccounts(result.data);
      console.log('📋 Available Accounts:', result.data.map(a => a.name));
    }
    setLoading(false);
  };

  // Check Auth & Load Accounts & Refresh Token
  useEffect(() => {
    const user = auth.requireAuth(router);
    if (user) {
      setCurrentUser(user);

      if (user.cloudflare_api_token) {
        loadAccounts(user.cloudflare_api_token);
      }

      getUserProfileAction(user.id).then(res => {
        if (res.success) {
          console.log('🔄 User Profile Refreshed:', res.user.username);
          const newToken = res.user.cloudflare_api_token;
          setCurrentUser(res.user);
          localStorage.setItem('sdb_session', JSON.stringify(res.user)); // Keep session key same for compatibility
          loadAccounts(newToken);
        }
      });
    }
  }, []);

  // โหลด zones เมื่อเลือก account
  const handleAccountChange = async (accountId) => {
    setSelectedAccount(accountId);
    setSelectedZone('');
    setZones([]);
    setDiscoveryData([]);
    setExpandedItems({});
    setSubdomainCache({});

    if (!accountId) return;

    setLoadingZones(true);
    console.log('🔄 Fetching zones for Account ID:', accountId);
    const result = await callAPI('list-zones', { accountId });

    if (result && result.data) {
      console.log('✅ Loaded Zones:', result.data.length, 'zones');
      setZones(result.data);
    }
    setLoadingZones(false);
  };

  // โหลด discovery data เมื่อเลือก zone
  useEffect(() => {
    if (!selectedZone) {
      setDiscoveryData([]);
      return;
    }

    const loadDiscovery = async () => {
      setLoadingDiscovery(true);
      console.log('🔍 กำลังดึงข้อมูล Discovery สำหรับ Zone:', selectedZone);

      const result = await callAPI('get-api-discovery', { zoneId: selectedZone });
      if (result && result.data) {
        setDiscoveryData(result.data);
        setRawDiscoveryData(result.raw || null);
        setCurrentPage(1);
        setSearchTerm('');
        setFilterStatus('all');
        setExpandedItems({});
        setSubdomainCache({});
      } else {
        setDiscoveryData([]);
      }
      setLoadingDiscovery(false);
    };

    loadDiscovery();
  }, [selectedZone]);

  // Handle Expand Subdomains
  const handleExpand = async (index, item) => {
    const isExpanding = !expandedItems[index];
    setExpandedItems(prev => ({ ...prev, [index]: isExpanding }));

    if (isExpanding) {
      const cacheKey = `${selectedZone}-${item.path}-${item.method}`;

      if (!subdomainCache[cacheKey]) {
        setLoadingSubdomains(prev => ({ ...prev, [index]: true }));

        try {
          const result = await callAPI('get-subdomain-stats', {
            zoneId: selectedZone,
            method: item.method,
            path: item.path,
            host: item.host
          }, null, true); // skipLoading=true to avoid full screen loader

          if (result && result.data) {
            setSubdomainCache(prev => ({ ...prev, [cacheKey]: result.data }));
          }
        } catch (error) {
          console.error("Expand Error:", error);
        } finally {
          setLoadingSubdomains(prev => ({ ...prev, [index]: false }));
        }
      }
    }
  };

  // Format account options for searchable dropdown
  const accountOptions = accounts.map(account => ({
    value: account.id,
    label: account.name,
    subtitle: account.id
  }));

  // Format zone options for searchable dropdown
  const zoneOptions = zones.map(zone => ({
    value: zone.id,
    label: zone.name,
    subtitle: `${zone.status} - ${zone.plan}`
  }));

  // ฟังก์ชันดาวน์โหลด CSV (Advanced with Subdomains)
  const handleDownloadCSV = async () => {
    if (!discoveryData || discoveryData.length === 0) {
      showToast('ไม่มีข้อมูลสำหรับดาวน์โหลด', 'error');
      return;
    }

    showToast('กำลังเตรียมข้อมูล CSV (อาจใช้เวลาสักครู่)...', 'success');
    setLoading(true);

    try {
      // CSV Header
      const headers = ['Hostname,Method,Source,State,Path,RequestCount,Type'];
      const rows = [];

      // Process all items (filtered by current view or all? Usually all)
      const visibleData = discoveryData; // Export all loaded data

      // Use a concurrency limiter if list is large? For now, run sequential batches is safer.

      for (const item of visibleData) {
        const hasHostVar = (item.host || '').includes('{hostVar1}');
        const hasPathVar = /\{var\d+\}/.test(item.path || '');
        const isVariableType = hasHostVar || hasPathVar;

        // Base row
        // escape double quotes
        const safe = (val) => `"${String(val || '').replace(/"/g, '""')}"`;

        if (isVariableType) {
          // 1. Add Parent Row FIRST
          rows.push(`${safe(item.host)},${safe(item.method)},${safe(item.source)},${safe(item.state)},${safe(item.path)},-,Parent`);

          // Check cache first
          const cacheKey = `${selectedZone}-${item.path}-${item.method}`;
          let subs = subdomainCache[cacheKey];

          if (!subs) {
            // Fetch On Demand
            const res = await callAPI('get-subdomain-stats', {
              zoneId: selectedZone,
              method: item.method,
              path: item.path,
              host: item.host
            }, null, true);
            subs = res?.data || [];
            // Update cache for future
            setSubdomainCache(prev => ({ ...prev, [cacheKey]: subs }));
          }

          if (subs.length > 0) {
            // Add rows for each subdomain/subpath
            for (const sub of subs) {
              // Format: Subdomain Host, Method, Source, State, Path, Count, Type
              rows.push(`${safe(sub.host || item.host)},${safe(item.method)},${safe(item.source)},${safe(item.state)},${safe(sub.path || item.path)},${sub.count},Sub-Item`);
            }
          }
          // Fallback logic removed as parent row is already added above.

        } else {
          // Normal Row
          rows.push(`${safe(item.host)},${safe(item.method)},${safe(item.source)},${safe(item.state)},${safe(item.path)},-,Normal`);
        }
      }

      const csvContent = [headers, ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `api_discovery_${selectedZone}_expanded_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('ดาวน์โหลด CSV เรียบร้อยแล้ว', 'success');
    } catch (error) {
      console.error('❌ CSV Download Error:', error);
      showToast('เกิดข้อผิดพลาดในการดาวน์โหลด CSV', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Toast Notifications */}
      <div className="fixed top-6 right-6 z-50 space-y-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              max-w-md px-6 py-4 rounded-xl shadow-2xl backdrop-blur-lg
              transform transition-all duration-300 animate-slide-in
              ${toast.type === 'success'
                ? 'bg-emerald-600/90 border-2 border-emerald-400'
                : 'bg-red-600/90 border-2 border-red-400'
              }
            `}
          >
            <div className="flex items-start gap-3">
              {toast.type === 'success' ? (
                <svg className="w-6 h-6 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <p className="text-white font-medium">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Auth Controls */}
      <div className="fixed top-6 right-6 z-40 flex items-center gap-3">
        {currentUser && (
          <>
            <div className="bg-gray-800/80 text-white px-4 py-2 rounded-lg font-medium backdrop-blur-sm border border-gray-600 flex items-center gap-2">
              <span className="text-orange-400 text-sm uppercase font-bold">{currentUser.role}</span>
              <span className="text-gray-400">|</span>
              <span>{currentUser.ownerName || currentUser.username}</span>
            </div>
            <button
              onClick={() => auth.logout()}
              className="bg-red-600/80 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium backdrop-blur-sm border border-red-500/50 transition-all shadow-lg hover:shadow-red-500/30"
            >
              Logout
            </button>
          </>
        )}
      </div>

      <div className="relative min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200 mb-4 tracking-tight drop-shadow-sm">
              API Discovery
            </h1>
            <p className="text-gray-400 text-lg font-medium">
              Discover, Monitor, and Secure your API Endpoints
            </p>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-lg rounded-3xl shadow-2xl border-2 border-gray-700 mb-6">
            <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-6 rounded-t-3xl">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                ค้นหาและจัดการ API
              </h2>
            </div>

            <div className="p-8 space-y-6">
              {/* Account Searchable Dropdown */}
              <SearchableDropdown
                options={accountOptions}
                value={selectedAccount}
                onChange={handleAccountChange}
                placeholder="-- เลือก Account --"
                label="เลือก Account"
                loading={false}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                }
              />

              {/* Zone Searchable Dropdown */}
              {selectedAccount && (
                <div className="animate-slide-in">
                  <SearchableDropdown
                    options={zoneOptions}
                    value={selectedZone}
                    onChange={setSelectedZone}
                    placeholder="-- เลือก Zone --"
                    label="เลือก Zone (Domain)"
                    loading={loadingZones}
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    }
                  />
                </div>
              )}

              {/* API Discovery Data */}
              {selectedZone && (
                <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-2 border-purple-600 rounded-2xl p-6 animate-slide-in">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-purple-300">API Discovery Data</h4>
                          {discoveryData.length > 0 && (
                            <span className="bg-purple-900/50 text-purple-200 text-xs px-2 py-0.5 rounded-full border border-purple-700/50">
                              {discoveryData.length} items
                            </span>
                          )}
                        </div>

                        {discoveryData.length > 0 && (
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                            <select
                              value={pageSize}
                              onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                              }}
                              className="bg-gray-800 border border-gray-600 text-gray-300 text-xs rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                            >
                              <option value={20}>20 / page</option>
                              <option value={50}>50 / page</option>
                              <option value={100}>100 / page</option>
                            </select>

                            <select
                              value={filterStatus}
                              onChange={(e) => {
                                setFilterStatus(e.target.value);
                                setCurrentPage(1);
                              }}
                              className="bg-gray-800 border border-gray-600 text-gray-300 text-xs rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                            >
                              <option value="all">All Status</option>
                              <option value="review">Review</option>
                              <option value="saved">Saved</option>
                              <option value="ignored">Ignored</option>
                            </select>

                            <input
                              type="text"
                              className="bg-gray-800 border border-gray-600 text-gray-300 text-xs rounded-lg block w-full p-2 focus:ring-purple-500 focus:border-purple-500"
                              placeholder="Search..."
                              value={searchTerm}
                              onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                              }}
                            />

                            <button
                              onClick={handleDownloadCSV}
                              className={`bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-2 transition-colors border border-green-500 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={loading}
                              title="Download Extended CSV"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              <span>CSV</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {loadingDiscovery ? (
                        <div className="flex items-center justify-center py-8">
                          <svg className="animate-spin h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="ml-3 text-purple-300">กำลังโหลดข้อมูล Discovery...</span>
                        </div>
                      ) : discoveryData.length === 0 ? (
                        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 text-center">
                          <p className="text-gray-400">ไม่พบข้อมูล API Discovery</p>
                        </div>
                      ) : (
                        <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-900/50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-purple-300 font-semibold w-8"></th>
                                  <th className="px-4 py-3 text-left text-purple-300 font-semibold">Hostname</th>
                                  <th className="px-4 py-3 text-left text-purple-300 font-semibold">Method</th>
                                  <th className="px-4 py-3 text-left text-purple-300 font-semibold">Source</th>
                                  <th className="px-4 py-3 text-left text-purple-300 font-semibold">State</th>
                                  <th className="px-4 py-3 text-left text-purple-300 font-semibold">Path</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-700">
                                {discoveryData
                                  .filter(item => {
                                    if (filterStatus !== 'all' && item.state !== filterStatus) return false;
                                    if (!searchTerm) return true;
                                    const s = searchTerm.toLowerCase();
                                    return (item.path + item.host + item.method).toLowerCase().includes(s);
                                  })
                                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                                  .map((item, index) => {
                                    // Use absolute index ID based on data for consistent key
                                    const rowKey = `${item.method}-${item.path}-${index}`;
                                    const hasHostVar = (item.host || '').includes('{hostVar1}');
                                    const hasPathVar = /\{var\d+\}/.test(item.path || '');
                                    const hasVar = hasHostVar || hasPathVar;
                                    const isExpanded = expandedItems[rowKey];
                                    const cacheKey = `${selectedZone}-${item.path}-${item.method}`;
                                    const subStats = subdomainCache[cacheKey] || [];
                                    const isLoadingSubs = loadingSubdomains[rowKey];

                                    return (
                                      <Fragment key={rowKey}>
                                        <tr className={`hover:bg-gray-700/30 transition-colors ${isExpanded ? 'bg-gray-700/50' : ''}`}>
                                          <td className="px-2 py-3 text-center">
                                            {hasVar && (
                                              <button
                                                onClick={() => handleExpand(rowKey, item)}
                                                className="text-purple-400 hover:text-white transition-colors focus:outline-none"
                                              >
                                                {isLoadingSubs ? (
                                                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                ) : (
                                                  <svg className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                  </svg>
                                                )}
                                              </button>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-gray-300 text-xs font-semibold">{item.host}</td>
                                          <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded font-mono text-xs font-bold ${item.method === 'GET' ? 'bg-green-600/30 text-green-300' :
                                              item.method === 'POST' ? 'bg-blue-600/30 text-blue-300' :
                                                'bg-gray-600/30 text-gray-300'
                                              }`}>
                                              {item.method}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-gray-400 text-xs">{item.source || '-'}</td>
                                          <td className="px-4 py-3 text-gray-300 text-xs">{item.state}</td>
                                          <td className="px-4 py-3 text-purple-200 font-mono text-xs break-all">{item.path}</td>
                                        </tr>

                                        {isExpanded && (
                                          <tr key={`${rowKey}-ex`} className="bg-gray-800/80 animate-fade-in-fast">
                                            <td colSpan="6" className="px-4 py-3 pl-12">
                                              <div className="bg-gray-900/50 rounded-lg p-3 border border-purple-500/30">
                                                <h5 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-2">
                                                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                                                  Traffic Breakdown for <span className="text-purple-300 font-mono">{hasPathVar ? item.path : item.host}</span>
                                                </h5>
                                                {subStats.length > 0 ? (
                                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                    {subStats.map((sub, i) => {
                                                      const displayStr = hasPathVar && hasHostVar ? `${sub.host}${sub.path}` : (hasPathVar ? sub.path : sub.host);
                                                      return (
                                                        <div key={i} className="flex justify-between items-center bg-gray-800 p-2 rounded text-xs border border-gray-700">
                                                          <span className="text-gray-300 truncate font-mono" title={displayStr}>{displayStr}</span>
                                                          <span className="text-green-400 font-bold bg-green-900/30 px-1.5 rounded">{sub.count}</span>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                ) : (
                                                  <p className="text-xs text-gray-500 italic">No traffic data found for this path pattern.</p>
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
                          </div>
                          {/* Pagination Controls... simplified */}
                          <div className="bg-gray-900/50 px-4 py-3 flex justify-between">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(c => Math.max(1, c - 1))} className="text-gray-400 hover:text-white disabled:opacity-30">Prev</button>
                            <span className="text-gray-400 text-xs">Page {currentPage}</span>
                            <button onClick={() => setCurrentPage(c => c + 1)} className="text-gray-400 hover:text-white">Next</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
