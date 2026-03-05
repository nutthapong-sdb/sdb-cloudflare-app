'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/app/systems/Sidebar';
import { THEMES } from '@/app/utils/themes';

export default function AdminLayout({ children }) {
  const [themeId, setThemeId] = useState('dark');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gdcc_theme');
      if (stored && THEMES[stored]) setThemeId(stored);
    }

    const handleThemeChange = (e) => {
      const newTheme = e.detail;
      if (THEMES[newTheme]) setThemeId(newTheme);
    };

    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  const t = THEMES[themeId] || THEMES.dark;

  return (
    <div className={`flex min-h-screen ${t.bg}`}>
      <Sidebar />
      <main className={`flex-1 min-w-0 relative ${t.text}`}>{children}</main>
    </div>
  );
}
