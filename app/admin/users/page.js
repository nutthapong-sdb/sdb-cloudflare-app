'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../../utils/auth';

export default function UserManagementPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'admin', ownerName: '' });
    const [message, setMessage] = useState({ text: '', type: '' });

    // State for Reset Password Modal
    const [resetModal, setResetModal] = useState({ isOpen: false, userId: null, username: '', newPassword: '' });

    // Load initial data and check permission
    useEffect(() => {
        const user = auth.getCurrentUser();
        if (!user) {
            router.push('/login');
            return;
        }

        // Only root can access
        if (user.role !== 'root') {
            router.push('/');
            return;
        }

        setCurrentUser(user);
        loadUsers();
    }, [router]);

    const loadUsers = async () => {
        setUsers(await auth.getUsers());
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        if (!newUser.username || !newUser.password || !newUser.ownerName) {
            setMessage({ text: 'Please fill all fields', type: 'error' });
            return;
        }

        const result = await auth.addUser(newUser.username, newUser.password, newUser.role, newUser.ownerName);
        if (result.success) {
            setMessage({ text: 'User added successfully', type: 'success' });
            setNewUser({ username: '', password: '', role: 'admin', ownerName: '' }); // Reset form
            loadUsers(); // Refresh list
        } else {
            setMessage({ text: result.message, type: 'error' });
        }

        // Clear message after 3 seconds
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    };

    const handleDeleteUser = async (id) => {
        if (confirm('Are you sure you want to delete this user?')) {
            const result = await auth.deleteUser(id);
            if (result.success) {
                setMessage({ text: 'User deleted successfully', type: 'success' });
                loadUsers();
            } else {
                setMessage({ text: result.message, type: 'error' });
            }
            setTimeout(() => setMessage({ text: '', type: '' }), 3000);
        }
    };

    const openResetModal = (user) => {
        setResetModal({ isOpen: true, userId: user.id, username: user.username, newPassword: '' });
    };

    const handleResetPassword = async () => {
        if (!resetModal.newPassword) {
            alert('Please enter a new password');
            return;
        }

        const result = await auth.resetPassword(resetModal.userId, resetModal.newPassword);
        if (result.success) {
            setMessage({ text: `Password for ${resetModal.username} reset successfully`, type: 'success' });
            setResetModal({ isOpen: false, userId: null, username: '', newPassword: '' });
            loadUsers();
        } else {
            setMessage({ text: result.message, type: 'error' });
        }
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    };

    if (!currentUser) return null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 font-sans">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8 bg-gray-800/50 p-6 rounded-2xl border border-gray-700 backdrop-blur-lg">
                    <div>
                        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200">
                            User Management
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">Manage system access (Root Only)</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/')}
                            className="text-gray-300 hover:text-white font-medium px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>

                {/* Access Control Check (UI only, logic is in useEffect) */}
                {currentUser.role !== 'root' ? (
                    <div className="text-center text-red-500 p-10 bg-gray-800 rounded-xl">
                        Access Denied. Root privileges required.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Add User Form */}
                        <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 h-fit">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                                Add New User
                            </h2>

                            <form onSubmit={handleAddUser} className="space-y-4">
                                {message.text && (
                                    <div className={`p-3 rounded-lg text-sm text-center ${message.type === 'success' ? 'bg-green-900/50 text-green-200 border border-green-500/30' : 'bg-red-900/50 text-red-200 border border-red-500/30'}`}>
                                        {message.text}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Owner Name (ชื่อเจ้าของ)</label>
                                    <input
                                        type="text"
                                        value={newUser.ownerName}
                                        onChange={(e) => setNewUser({ ...newUser, ownerName: e.target.value })}
                                        className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                        placeholder="Ex. John Doe"
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Username</label>
                                    <input
                                        type="text"
                                        value={newUser.username}
                                        onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                        className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                        placeholder="Username"
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Password</label>
                                    <input
                                        type="password"
                                        value={newUser.password}
                                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                        className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                        placeholder="Password"
                                    />
                                </div>

                                <div>
                                    <label className="block text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wide">Role</label>
                                    <select
                                        value={newUser.role}
                                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                        className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="root">Root</option>
                                    </select>
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-lg transition-all active:transform active:scale-95"
                                    >
                                        Create User
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Users List */}
                        <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                Existing Users
                            </h2>

                            <div className="space-y-3">
                                {users.map(user => (
                                    <div key={user.id} className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50 flex flex-col gap-3 group hover:border-gray-600 transition-colors">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-white text-lg">{user.ownerName || '-'}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-gray-400 text-sm font-mono bg-gray-800 px-2 py-0.5 rounded">@{user.username}</span>
                                                    {user.role === 'root' && (
                                                        <span className="bg-orange-900/50 text-orange-200 text-[10px] px-2 py-0.5 rounded-full border border-orange-500/30 font-mono">ROOT</span>
                                                    )}
                                                    {user.role === 'admin' && (
                                                        <span className="bg-blue-900/50 text-blue-200 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/30 font-mono">ADMIN</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 justify-end border-t border-gray-800 pt-3">
                                            <button
                                                onClick={() => openResetModal(user)}
                                                className="text-yellow-500 hover:text-yellow-300 text-xs px-3 py-1.5 rounded bg-yellow-900/20 hover:bg-yellow-900/40 transition-colors flex items-center gap-1"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                </svg>
                                                Reset Pwd
                                            </button>

                                            {user.role !== 'root' && user.id !== currentUser.id && (
                                                <button
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="text-red-500 hover:text-red-300 text-xs px-3 py-1.5 rounded bg-red-900/20 hover:bg-red-900/40 transition-colors flex items-center gap-1"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Reset Password Modal */}
                {resetModal.isOpen && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-gray-800 rounded-2xl border border-gray-600 p-6 max-w-sm w-full shadow-2xl">
                            <h3 className="text-xl font-bold text-white mb-4">Reset Password</h3>
                            <p className="text-gray-400 mb-4 text-sm">
                                Enter new password for <span className="text-orange-400 font-bold">{resetModal.username}</span>
                            </p>

                            <input
                                type="password"
                                value={resetModal.newPassword}
                                onChange={(e) => setResetModal({ ...resetModal, newPassword: e.target.value })}
                                className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none mb-6"
                                placeholder="New Password"
                                autoFocus
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setResetModal({ isOpen: false, userId: null, username: '', newPassword: '' })}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleResetPassword}
                                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 rounded-lg transition-colors"
                                >
                                    Save Password
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
