'use client';

import {
    loginAction,
    getUsersAction,
    addUserAction,
    deleteUserAction,
    resetPasswordAction
} from '@/app/actions/authActions';

const SESSION_KEY = 'sdb_session';

export const auth = {
    // Login function
    login: async (username, password) => {
        const result = await loginAction(username, password);
        if (result.success) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
        }
        return result;
    },

    // Logout function
    logout: () => {
        localStorage.removeItem(SESSION_KEY);
        window.location.href = '/login';
    },

    // Get current user session (from LocalStorage)
    getCurrentUser: () => {
        if (typeof window === 'undefined') return null;
        const session = localStorage.getItem(SESSION_KEY);
        return session ? JSON.parse(session) : null;
    },

    // Check if user is logged in (redirect if not)
    requireAuth: (router) => {
        if (typeof window === 'undefined') return null;
        const user = auth.getCurrentUser();
        if (!user) {
            router.push('/login');
            return null;
        }
        return user;
    },

    // --------------- User Management (Server Actions) ---------------

    // Get all users
    getUsers: async () => {
        const result = await getUsersAction();
        return result.success ? result.users : [];
    },

    // Add new user
    addUser: async (username, password, role, ownerName) => {
        return await addUserAction(username, password, role, ownerName);
    },

    // Delete user
    deleteUser: async (id) => {
        return await deleteUserAction(id);
    },

    // Reset Password
    resetPassword: async (id, newPassword) => {
        return await resetPasswordAction(id, newPassword);
    }
};
