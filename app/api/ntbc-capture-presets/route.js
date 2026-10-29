import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const fallbackFilePath = path.join(process.cwd(), 'app', 'data', 'capture_presets.json');

// Helper to read fallback JSON file
function readFallbackPresets() {
    try {
        if (fs.existsSync(fallbackFilePath)) {
            const data = fs.readFileSync(fallbackFilePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Error reading fallback presets file:', e);
    }
    return [];
}

// Helper to write fallback JSON file
function writeFallbackPresets(presets) {
    try {
        const dir = path.dirname(fallbackFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fallbackFilePath, JSON.stringify(presets, null, 2), 'utf8');
    } catch (e) {
        console.error('Error writing fallback presets file:', e);
    }
}

// Names of the report templates whose capturePresetId is this preset.
function templatesUsingPreset(presetId) {
    try {
        const registry = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'app', 'data', 'ntbc_templates.json'), 'utf8'));
        return registry.filter(t => String(t.capturePresetId) === String(presetId)).map(t => t.name);
    } catch (e) {
        return [];
    }
}

// GET: Retrieve all presets
export async function GET() {
    try {
        let presets = [];
        try {
            const db = await getDb();
            const rows = await db.all('SELECT * FROM capture_presets ORDER BY updated_at DESC');
            presets = rows.map(r => ({
                id: r.id,
                name: r.name,
                coords: typeof r.coords === 'string' ? JSON.parse(r.coords) : r.coords,
                createdBy: r.created_by,
                createdById: r.created_by_id,
                createdByName: r.created_by_name,
                createdAt: r.created_at,
                updatedAt: r.updated_at
            }));

            // Sync with fallback file
            writeFallbackPresets(presets);
        } catch (dbErr) {
            console.warn('Database error when fetching presets, reading from fallback JSON:', dbErr.message);
            presets = readFallbackPresets();
        }

        return NextResponse.json({ success: true, presets });
    } catch (e) {
        console.error('Failed to get capture presets:', e);
        return NextResponse.json({ success: false, error: e.message, presets: [] }, { status: 500 });
    }
}

// POST: Create a new preset
export async function POST(req) {
    try {
        const body = await req.json();
        const { name, coords, user } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ success: false, error: 'Preset name is required' }, { status: 400 });
        }
        if (!coords || typeof coords !== 'object') {
            return NextResponse.json({ success: false, error: 'Valid coordinate data is required' }, { status: 400 });
        }

        const id = `preset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const now = new Date().toISOString();
        const createdBy = user?.username || 'root';
        const createdById = user?.id || 1;
        const createdByName = user?.ownerName || user?.username || 'Root Admin';

        const newPreset = {
            id,
            name: name.trim(),
            coords,
            createdBy,
            createdById,
            createdByName,
            createdAt: now,
            updatedAt: now
        };

        try {
            const db = await getDb();
            await db.run(
                `INSERT INTO capture_presets (id, name, coords, created_by, created_by_id, created_by_name, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, newPreset.name, JSON.stringify(coords), createdBy, createdById, createdByName, now, now]
            );
        } catch (dbErr) {
            console.warn('Database write failed for preset, using fallback file:', dbErr.message);
        }

        // Update fallback file
        const allPresets = readFallbackPresets().filter(p => p.id !== id);
        allPresets.unshift(newPreset);
        writeFallbackPresets(allPresets);

        return NextResponse.json({ success: true, preset: newPreset, message: 'Preset created successfully' });
    } catch (e) {
        console.error('Failed to create capture preset:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

// PUT: Update / Rename existing preset
export async function PUT(req) {
    try {
        const body = await req.json();
        const { id, name, coords, user } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Preset ID is required' }, { status: 400 });
        }

        const db = await getDb();
        const existing = await db.get('SELECT * FROM capture_presets WHERE id = ?', [id]);

        if (!existing) {
            return NextResponse.json({ success: false, error: 'Preset not found' }, { status: 404 });
        }

        // Role & Ownership check: Admin, Root, or Owner
        const userRole = user?.role || '';
        const username = user?.username || '';
        const userId = user?.id;

        const isAdmin = userRole === 'admin' || userRole === 'root';
        const isOwner = existing.created_by === username || (userId && existing.created_by_id === userId);

        if (!isAdmin && !isOwner) {
            return NextResponse.json({ 
                success: false, 
                error: 'คุณไม่มีสิทธิ์แก้ไข Preset นี้ (เฉพาะผู้สร้างหรือ Admin เท่านั้นที่มีสิทธิ์ดำเนินการ)' 
            }, { status: 403 });
        }

        const now = new Date().toISOString();
        const updatedName = name && name.trim() ? name.trim() : existing.name;
        const updatedCoords = coords && typeof coords === 'object' ? coords : JSON.parse(existing.coords);

        await db.run(
            `UPDATE capture_presets SET name = ?, coords = ?, updated_at = ? WHERE id = ?`,
            [updatedName, JSON.stringify(updatedCoords), now, id]
        );

        const updatedPreset = {
            id,
            name: updatedName,
            coords: updatedCoords,
            createdBy: existing.created_by,
            createdById: existing.created_by_id,
            createdByName: existing.created_by_name,
            createdAt: existing.created_at,
            updatedAt: now
        };

        // Update fallback file
        const allPresets = readFallbackPresets().map(p => p.id === id ? updatedPreset : p);
        writeFallbackPresets(allPresets);

        return NextResponse.json({ success: true, preset: updatedPreset, message: 'Preset updated successfully' });
    } catch (e) {
        console.error('Failed to update capture preset:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

// DELETE: Delete existing preset
export async function DELETE(req) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const username = searchParams.get('username') || '';
        const role = searchParams.get('role') || '';
        const userId = searchParams.get('userId') ? parseInt(searchParams.get('userId'), 10) : null;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Preset ID is required' }, { status: 400 });
        }

        const db = await getDb();
        const existing = await db.get('SELECT * FROM capture_presets WHERE id = ?', [id]);

        if (!existing) {
            return NextResponse.json({ success: false, error: 'Preset not found' }, { status: 404 });
        }

        // Role & Ownership check
        const isAdmin = role === 'admin' || role === 'root';
        const isOwner = existing.created_by === username || (userId && existing.created_by_id === userId);

        if (!isAdmin && !isOwner) {
            return NextResponse.json({ 
                success: false, 
                error: 'คุณไม่มีสิทธิ์ลบ Preset นี้ (เฉพาะผู้สร้างหรือ Admin เท่านั้นที่มีสิทธิ์ดำเนินการ)' 
            }, { status: 403 });
        }

        // Templates must always point at a preset, so one still in use can't be deleted.
        const usedBy = templatesUsingPreset(id);
        if (usedBy.length > 0) {
            return NextResponse.json({
                success: false,
                error: `Preset นี้ยังถูกใช้โดย Template: ${usedBy.join(', ')} — เปลี่ยน Preset ของ Template เหล่านั้นใน Manage Templates ก่อนลบ`
            }, { status: 409 });
        }

        await db.run('DELETE FROM capture_presets WHERE id = ?', [id]);

        // Update fallback file
        const allPresets = readFallbackPresets().filter(p => p.id !== id);
        writeFallbackPresets(allPresets);

        return NextResponse.json({ success: true, message: 'Preset deleted successfully' });
    } catch (e) {
        console.error('Failed to delete capture preset:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
