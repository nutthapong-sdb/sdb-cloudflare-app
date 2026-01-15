'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/app/utils/auth';

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

        {/* Dropdown list - ใช้ z-index สูงและ fixed positioning */}
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

export default function SDBPage() {
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

  const callAPI = async (action, params = {}) => {
    setLoading(true);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...params }),
      });

      const result = await response.json();

      // Log for debugging
      if (action === 'get-api-discovery') {
        console.log('📦 Full API Response:', result);
        console.log('📊 Data sample:', result.data?.slice(0, 2));
      }

      if (result.success) {
        // ไม่แสดง Toast สำหรับ action โหลดข้อมูลพื้นฐาน เพื่อไม่ให้รกหน้าจอ
        if (action !== 'get-account-info' && action !== 'list-zones') {
          showToast(result.message, 'success');
        }
        // Return full result instead of just data
        return result;
      } else {
        showToast(result.message || 'เกิดข้อผิดพลาด', 'error');
        return null;
      }
    } catch (err) {
      showToast('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้: ' + err.message, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    setLoading(true);
    const result = await callAPI('get-account-info');
    if (result && result.data) {
      setAccounts(result.data);
      setAccounts(result.data);
      console.log('📋 Available Accounts:', result.data.map(a => a.name));
    }
    setLoading(false);
  };

  // Check Auth & Load Accounts
  useEffect(() => {
    const user = auth.requireAuth(router);
    if (user) {
      setCurrentUser(user);
      loadAccounts();
    }
  }, []);

  // Auto-select removed


  // โหลด zones เมื่อเลือก account
  const handleAccountChange = async (accountId) => {
    setSelectedAccount(accountId);
    setSelectedZone('');
    setZones([]);
    setDiscoveryData([]);

    if (!accountId) return;

    setLoadingZones(true);
    console.log('🔄 Fetching zones for Account ID:', accountId);
    const result = await callAPI('list-zones', { accountId });

    if (result && result.data) {
      console.log('✅ Loaded Zones:', result.data.length, 'zones');
      setZones(result.data);
    } else {
      console.log('❌ No zones loaded or error occurred');
    }

    setLoadingZones(false);
  };

  // Auto-select Zone removed

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
        console.log('✅ Setting discovery data:', result.data.length, 'items');
        setDiscoveryData(result.data);
        setRawDiscoveryData(result.raw || null);
        setCurrentPage(1); // Reset page to 1
        setSearchTerm(''); // Reset search
        setFilterStatus('all'); // Reset status filter
      } else {
        setDiscoveryData([]);
        setRawDiscoveryData(null);
      }
      setLoadingDiscovery(false);
    };

    loadDiscovery();
  }, [selectedZone]);

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

  // ฟังก์ชันดาวน์โหลด CSV
  const handleDownloadCSV = () => {
    if (!discoveryData || discoveryData.length === 0) {
      showToast('ไม่มีข้อมูลสำหรับดาวน์โหลด', 'error');
      return;
    }

    // CSV Header
    const headers = ['Hostname,Method,Source,State,Path'];

    // CSV Rows
    const rows = discoveryData.map(item => {
      // Escape ข้อมูลที่มี comma ด้วย double quotes
      const host = `"${(item.host || '').replace(/"/g, '""')}"`;
      const method = `"${(item.method || '').replace(/"/g, '""')}"`;
      const source = `"${(item.source || '').replace(/"/g, '""')}"`;
      const state = `"${(item.state || '').replace(/"/g, '""')}"`;
      const path = `"${(item.path || '').replace(/"/g, '""')}"`;

      return `${host},${method},${source},${state},${path}`;
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `api_discovery_${selectedZone}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

      {/* Auth Controls (Top Right) */}
      <div className="fixed top-6 right-6 z-40 flex items-center gap-3">
        {currentUser && (
          <>
            {currentUser.role === 'root' && (
              <button
                onClick={() => router.push('/admin/users')}
                className="bg-blue-600/80 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium backdrop-blur-sm border border-blue-500/50 transition-all shadow-lg hover:shadow-blue-500/30 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Manage Users
              </button>
            )}
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

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(251, 146, 60) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      <div className="relative min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-block p-4 bg-gradient-to-br from-orange-600 to-amber-700 rounded-2xl shadow-2xl mb-6 transform hover:scale-105 transition-transform duration-300 shadow-orange-500/50">
              <svg
                className="w-16 h-16 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                />
              </svg>
            </div>
            <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200 mb-4 tracking-tight drop-shadow-sm">
              Cloudflare API Dashboard
            </h1>
            <p className="text-gray-400 text-lg font-medium">
              จัดการ Cloudflare ด้วย API Token
            </p>
          </div>

          {/* Main Card - ลบ overflow-hidden */}
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-3xl shadow-2xl border-2 border-gray-700 mb-6">
            <div className="bg-gradient-to-r from-orange-600 to-amber-600 p-6 rounded-t-3xl">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                เลือก Account และ Zone
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

              {/* แสดง API Discovery Data */}
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
                            {/* Page Size Selector */}
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

                            {/* Status Filter */}
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

                            {/* Live Search */}
                            <div className="relative flex-1 sm:w-64">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                              </div>
                              <input
                                type="text"
                                className="bg-gray-800 border border-gray-600 text-gray-300 text-xs rounded-lg block w-full pl-10 p-2 focus:ring-purple-500 focus:border-purple-500"
                                placeholder="Search path, host, method..."
                                value={searchTerm}
                                onChange={(e) => {
                                  setSearchTerm(e.target.value);
                                  setCurrentPage(1);
                                }}
                              />
                            </div>

                            {/* Download CSV Button */}
                            <button
                              onClick={handleDownloadCSV}
                              className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-2 transition-colors border border-green-500"
                              title="Download CSV"
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
                          <p className="text-sm text-gray-500 mt-2">Zone นี้อาจจะยังไม่มี API endpoints ที่ถูก discover</p>
                        </div>
                      ) : (
                        <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-900/50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-purple-300 font-semibold w-1/4">Hostname</th>
                                  <th className="px-4 py-3 text-left text-purple-300 font-semibold w-1/12">Method</th>
                                  <th className="px-4 py-3 text-left text-purple-300 font-semibold w-1/12">Source</th>
                                  <th className="px-4 py-3 text-left text-purple-300 font-semibold w-1/12">State</th>
                                  <th className="px-4 py-3 text-left text-purple-300 font-semibold w-1/2">Path</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-700">
                                {discoveryData
                                  .filter(item => {
                                    // Status Filter
                                    if (filterStatus !== 'all' && item.state !== filterStatus) return false;

                                    // Search Filter
                                    if (!searchTerm) return true;
                                    const searchLower = searchTerm.toLowerCase();
                                    return (
                                      (item.path || '').toLowerCase().includes(searchLower) ||
                                      (item.host || '').toLowerCase().includes(searchLower) ||
                                      (item.method || '').toLowerCase().includes(searchLower)
                                    );
                                  })
                                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                                  .map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-700/30 transition-colors">
                                      <td className="px-4 py-3 text-gray-300 text-xs font-semibold">
                                        {item.host || '-'}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`
                                        px-2 py-1 rounded font-mono text-xs font-bold
                                        ${item.method === 'GET' ? 'bg-green-600/30 text-green-300' :
                                            item.method === 'POST' ? 'bg-blue-600/30 text-blue-300' :
                                              item.method === 'PUT' ? 'bg-yellow-600/30 text-yellow-300' :
                                                item.method === 'DELETE' ? 'bg-red-600/30 text-red-300' :
                                                  'bg-gray-600/30 text-gray-300'}
                                      `}>
                                          {item.method}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-gray-400 text-xs text-center">
                                        {item.source || '-'}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`
                                        px-2 py-1 rounded text-xs font-semibold
                                        ${item.state === 'review' ? 'bg-orange-600/30 text-orange-300' :
                                            item.state === 'saved' ? 'bg-green-600/30 text-green-300' :
                                              item.state === 'ignored' ? 'bg-gray-600/30 text-gray-400' :
                                                'bg-yellow-600/30 text-yellow-300'}
                                      `}>
                                          {item.state}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-purple-200 font-mono text-xs break-all">
                                        {item.path}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Pagination Footer */}
                          <div className="bg-gray-900/50 px-4 py-3 border-t border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <p className="text-xs text-gray-400">
                              แสดง <span className="text-white font-medium">{Math.min((currentPage - 1) * pageSize + 1, discoveryData.filter(i => (filterStatus === 'all' || i.state === filterStatus) && (!searchTerm || (i.path + i.host + i.method).toLowerCase().includes(searchTerm.toLowerCase()))).length)}</span> ถึง <span className="text-white font-medium">{Math.min(currentPage * pageSize, discoveryData.filter(i => (filterStatus === 'all' || i.state === filterStatus) && (!searchTerm || (i.path + i.host + i.method).toLowerCase().includes(searchTerm.toLowerCase()))).length)}</span> จากทั้งหมด <strong className="text-purple-300">{discoveryData.filter(i => (filterStatus === 'all' || i.state === filterStatus) && (!searchTerm || (i.path + i.host + i.method).toLowerCase().includes(searchTerm.toLowerCase()))).length}</strong> รายการ (Total: {discoveryData.length})
                            </p>

                            <div className="flex gap-2">
                              <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-xs font-medium rounded bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                ก่อนหน้า
                              </button>
                              <span className="px-3 py-1 text-xs text-gray-300 flex items-center">
                                หน้า {currentPage}
                              </span>
                              <button
                                onClick={() => setCurrentPage(p => {
                                  const filteredLen = discoveryData.filter(i => (filterStatus === 'all' || i.state === filterStatus) && (!searchTerm || (i.path + i.host + i.method).toLowerCase().includes(searchTerm.toLowerCase()))).length;
                                  const maxPage = Math.ceil(filteredLen / pageSize);
                                  return Math.min(maxPage, p + 1);
                                })}
                                disabled={currentPage >= Math.ceil(discoveryData.filter(i => (filterStatus === 'all' || i.state === filterStatus) && (!searchTerm || (i.path + i.host + i.method).toLowerCase().includes(searchTerm.toLowerCase()))).length / pageSize)}
                                className="px-3 py-1 text-xs font-medium rounded bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                ถัดไป
                              </button>
                            </div>
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
    </div >
  );
}
