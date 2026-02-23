'use client';
import { useState, useEffect } from 'react';
import { Home, LayoutDashboard, Cloud, ChevronLeft, ChevronRight, LogOut, Shield } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { auth } from '@/app/utils/auth';

import { THEMES } from '@/app/utils/themes';

export default function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [themeId, setThemeId] = useState('dark');
    const router = useRouter();
    const pathname = usePathname();

    // Theme subscription
    useEffect(() => {
        // Initial load
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('gdcc_theme');
            if (stored && THEMES[stored]) setThemeId(stored);
        }

        // Listen for custom theme change event
        const handleThemeChange = (e) => {
            const newTheme = e.detail;
            if (THEMES[newTheme]) setThemeId(newTheme);
        };

        window.addEventListener('theme-change', handleThemeChange);
        return () => window.removeEventListener('theme-change', handleThemeChange);
    }, []);

    const t = THEMES[themeId] || THEMES.dark;
    const s = t.sidebar || THEMES.dark.sidebar;

    const menuItems = [
        { name: 'Portal Home', icon: Home, path: '/', color: 'text-blue-400' },
        { name: 'API Discovery', icon: LayoutDashboard, path: '/systems/api_discovery', color: 'text-orange-400' },
        { name: 'Firewall Logs', icon: Shield, path: '/systems/firewall_logs', color: 'text-red-400' },
        { name: 'Cloudflare Report', icon: Cloud, path: '/systems/gdcc', color: 'text-purple-400' },
    ];

    return (
        <aside
            className={`${isCollapsed ? 'w-20' : 'w-64'} sticky top-0 h-screen ${s.container || 'bg-gray-900 border-gray-800'} transition-all duration-300 flex flex-col z-50 shadow-2xl shrink-0 border-r`}
        >


            {/* Logo / Header */}
            <div className={`p-6 flex items-center justify-center border-b ${s.header || 'border-gray-800'} ${themeId === 'pastel' ? 'bg-pink-50/50' : ''} h-20`}>
                <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''} w-full`}>
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex-shrink-0 animate-pulse shadow-orange-500/20 shadow-lg"></div>
                    {!isCollapsed && (
                        <div className="flex flex-col overflow-hidden">
                            <span className={`font-bold text-lg whitespace-nowrap ${themeId === 'pastel' ? 'text-pink-600' : 'text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200'}`}>
                                Cloudflare API
                            </span>
                            <span className={`text-[10px] uppercase tracking-widest ${s.headerSubText || 'text-gray-500'}`}>Dashboard</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Menu */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                <div className={`text-[10px] font-bold uppercase mb-2 px-2 tracking-wider ${s.menuLabel || 'text-gray-600'}`}>
                    {!isCollapsed ? 'Menu' : '...'}
                </div>
                {menuItems.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => router.push(item.path)}
                        className={`
                            w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group
                            ${pathname === item.path
                                ? (s.itemActive || 'bg-gray-800 text-white shadow-lg border border-gray-700/50')
                                : (s.itemInactive || 'text-gray-400 hover:bg-gray-800/50 hover:text-white')
                            }
                            ${isCollapsed ? 'justify-center px-0' : ''}
                        `}
                        title={isCollapsed ? item.name : ''}
                    >
                        <item.icon size={22} className={`${pathname === item.path && themeId === 'pastel' ? 'text-pink-500' : item.color} group-hover:scale-110 transition-transform`} />
                        {!isCollapsed && <span className="font-medium text-sm">{item.name}</span>}
                    </button>
                ))}
            </nav>

            {/* Footer Actions */}
            <div className={`p-4 border-t space-y-2 ${s.footer || 'border-gray-800 bg-gray-900/50'}`}>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={`
                        w-full flex items-center gap-3 p-3 rounded-xl transition-all border
                        ${s.collapseButton || 'text-gray-400 hover:bg-gray-800 hover:text-white border-transparent hover:border-gray-700'}
                        ${isCollapsed ? 'justify-center' : ''}
                    `}
                    title={isCollapsed ? "Expand" : "Collapse Sidebar"}
                >
                    {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    {!isCollapsed && <span className="font-medium text-sm">Collapse</span>}
                </button>
                <button
                    onClick={() => auth.logout()}
                    className={`
                        w-full flex items-center gap-3 p-3 rounded-xl transition-all border
                         ${s.logoutButton || 'text-red-400 hover:bg-red-900/20 hover:text-red-300 border-transparent hover:border-red-900/30'}
                        ${isCollapsed ? 'justify-center' : ''}
                    `}
                    title="Logout"
                >
                    <LogOut size={20} />
                    {!isCollapsed && <span className="font-medium text-sm">Logout</span>}
                </button>
            </div>
        </aside>
    );
}
