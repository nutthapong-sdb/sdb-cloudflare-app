'use server';

import { getDb } from '@/lib/db';
import bcrypt from 'bcryptjs';

// Login Action
export async function loginAction(username, password) {
    try {
        if (!username || !password) {
            return { success: false, message: 'กรุณากรอก Username และ Password' };
        }

        const db = await getDb();
        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

        if (!user) {
            return { success: false, message: 'ไม่พบผู้ใช้งานนี้' };
        }

        // Verify Password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
        }

        // Return user info (excluding password)
        return {
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                ownerName: user.owner_name
            }
        };
    } catch (error) {
        console.error('Login Error:', error);
        return { success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' };
    }
}

// Get Users Action
export async function getUsersAction() {
    try {
        const db = await getDb();
        const users = await db.all('SELECT id, username, role, owner_name as ownerName FROM users');
        return { success: true, users };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Add User Action
export async function addUserAction(username, password, role, ownerName) {
    try {
        if (!username || !password) {
            return { success: false, message: 'Missing required fields' };
        }

        const db = await getDb();

        // Check duplicate
        const existingUser = await db.get('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUser) {
            return { success: false, message: 'Username already exists' };
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const finalOwnerName = ownerName || username;
        const userRole = role || 'admin';

        const result = await db.run(
            'INSERT INTO users (username, password, role, owner_name) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, userRole, finalOwnerName]
        );

        return {
            success: true,
            user: { id: result.lastID, username, role: userRole, ownerName: finalOwnerName }
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Delete User Action
export async function deleteUserAction(id) {
    try {
        if (!id) return { success: false, message: 'User ID required' };

        const db = await getDb();

        // Check root
        const user = await db.get('SELECT role FROM users WHERE id = ?', [id]);
        if (user && user.role === 'root') {
            return { success: false, message: 'Cannot delete ROOT user' };
        }

        await db.run('DELETE FROM users WHERE id = ?', [id]);
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Reset Password Action
export async function resetPasswordAction(id, newPassword) {
    try {
        if (!id || !newPassword) {
            return { success: false, message: 'Missing ID or Password' };
        }

        const db = await getDb();
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);

        return { success: true, message: 'Password updated successfully' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}
