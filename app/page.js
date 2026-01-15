'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/app/utils/auth';

export default function PortalPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        // Require Auth for Portal
        const user = auth.requireAuth(router);
        if (user) {
            setCurrentUser(user);
        }
    }, []);

    if (!currentUser) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 font-sans p-8">
            {/* Header / Navbar */}
            <div className="flex justify-between items-center mb-16 max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold text-white tracking-tight">
                    <span className="text-orange-500">My</span>Apps Portal
                </h1>

                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <div className="text-white font-bold">{currentUser.ownerName || currentUser.username}</div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider">{currentUser.role}</div>
                    </div>
                    <button
                        onClick={() => auth.logout()}
                        className="bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-lg transition-all border border-red-500/30"
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto">
                <h2 className="text-2xl text-gray-300 mb-8 font-light">Select a System</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Card: SDB Dashboard */}
                    <div
                        onClick={() => router.push('/systems/sdb')}
                        className="group bg-gray-800/50 hover:bg-gradient-to-br hover:from-orange-900/40 hover:to-amber-900/40 border border-gray-700 hover:border-orange-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                            <svg className="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                        </div>

                        <div className="relative z-10">
                            <div className="bg-orange-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-orange-300 transition-colors">SDB Dashboard</h3>
                            <p className="text-gray-400 text-sm group-hover:text-gray-300">Cloudflare API Discovery & Management Tool</p>
                        </div>
                    </div>

                    {/* Card: User Management (Root Only) */}
                    {currentUser.role === 'root' && (
                        <div
                            onClick={() => router.push('/admin/users')}
                            className="group bg-gray-800/50 hover:bg-gradient-to-br hover:from-blue-900/40 hover:to-cyan-900/40 border border-gray-700 hover:border-blue-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                                <svg className="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                            </div>

                            <div className="relative z-10">
                                <div className="bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">User Management</h3>
                                <p className="text-gray-400 text-sm group-hover:text-gray-300">Manage system users and access roles</p>
                            </div>
                        </div>
                    )}

                    {/* Card: GDCC System */}
                    <div
                        onClick={() => router.push('/systems/gdcc')}
                        className="group bg-gray-800/50 hover:bg-gradient-to-br hover:from-cyan-900/40 hover:to-blue-900/40 border border-gray-700 hover:border-cyan-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                            <svg className="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        </div>

                        <div className="relative z-10">
                            <div className="bg-cyan-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">GDCC System</h3>
                            <p className="text-gray-400 text-sm group-hover:text-gray-300">Government Data Center & Cloud</p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
