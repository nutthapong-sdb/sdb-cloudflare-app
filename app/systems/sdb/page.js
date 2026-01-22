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

// Batch Report Modal Component
function BatchReportModal({ isOpen, onClose, hosts, onConfirm }) {
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set()); // Reset on open
    }
  }, [isOpen]);

  const toggleAll = () => {
    if (selected.size === hosts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(hosts));
    }
  };

  const toggleOne = (host) => {
    const newSet = new Set(selected);
    if (newSet.has(host)) newSet.delete(host);
    else newSet.add(host);
    setSelected(newSet);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-gray-800 border-2 border-orange-500/50 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">Batch Report Selection</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-300">Select Sub-domains to include:</span>
            <button onClick={toggleAll} className="text-sm text-orange-400 hover:text-orange-300 font-medium transition-colors">
              {selected.size === hosts.length && hosts.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          {hosts.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No sub-domains available.</div>
          ) : (
            <div className="space-y-2">
              {hosts.map(host => (
                <label key={host} className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 cursor-pointer transition-colors border border-transparent hover:border-gray-600">
                  <input
                    type="checkbox"
                    checked={selected.has(host)}
                    onChange={() => toggleOne(host)}
                    className="w-5 h-5 rounded border-gray-500 text-orange-500 focus:ring-orange-500/50 bg-gray-800"
                  />
                  <span className="text-gray-200">{host}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 font-medium transition-colors">Cancel</button>
          <button
            onClick={() => onConfirm(Array.from(selected))}
            disabled={selected.size === 0}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Generate Report
          </button>
        </div>
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
  
  // State for Batch Modal
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

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
      const host = `"${(item.host || '').replace(/