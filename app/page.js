'use client';

import { useState, useEffect, useRef } from 'react';

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

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

  // State for accounts and zones
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [loadingZones, setLoadingZones] = useState(false);

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

      if (result.success) {
        showToast(result.message, 'success');
        return result.data;
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
    const data = await callAPI('get-account-info');
    if (data) {
      setAccounts(data);
    }
    setLoading(false);
  };

  // โหลด accounts อัตโนมัติเมื่อหน้าโหลด
  useEffect(() => {
    loadAccounts();
  }, []);

  // โหลด zones เมื่อเลือก account
  const handleAccountChange = async (accountId) => {
    setSelectedAccount(accountId);
    setSelectedZone('');
    setZones([]);

    if (!accountId) return;

    setLoadingZones(true);
    const data = await callAPI('list-zones', { accountId });
    if (data) {
      setZones(data);
    }
    setLoadingZones(false);
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

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(251, 146, 60) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      <div className="relative min-h-screen p-6">
        <div className="max-w-4xl mx-auto">
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
            <h1 className="text-5xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent mb-4">
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

              {/* แสดง Zone ที่เลือก */}
              {selectedZone && (
                <div className="bg-gradient-to-br from-blue-900/50 to-cyan-900/50 border-2 border-blue-600 rounded-2xl p-6 animate-slide-in">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="font-bold text-blue-300 mb-2">Zone ที่เลือก</h4>
                      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                        {zones.find(z => z.id === selectedZone) && (
                          <div className="space-y-2 text-sm">
                            <p><strong className="text-blue-300">Domain:</strong> <span className="text-blue-400 font-mono">{zones.find(z => z.id === selectedZone).name}</span></p>
                            <p><strong className="text-blue-300">Zone ID:</strong> <span className="text-blue-400 font-mono text-xs">{selectedZone}</span></p>
                            <p><strong className="text-blue-300">Status:</strong> <span className={`font-semibold ${zones.find(z => z.id === selectedZone).status === 'active' ? 'text-emerald-400' : 'text-orange-400'}`}>{zones.find(z => z.id === selectedZone).status}</span></p>
                            <p><strong className="text-blue-300">Plan:</strong> <span className="text-blue-400">{zones.find(z => z.id === selectedZone).plan}</span></p>
                          </div>
                        )}
                      </div>
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
