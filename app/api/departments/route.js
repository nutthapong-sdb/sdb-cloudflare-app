import { NextResponse } from 'next/server';
import { getGdccDb } from '@/lib/gdcc-db';

export async function GET(request) {
    try {
        const db = await getGdccDb();
        const departments = await db.all(`
            SELECT d.*, COUNT(dd.id) as domain_count 
            FROM gdcc_departments d
            LEFT JOIN gdcc_department_domains dd ON d.id = dd.department_id
            GROUP BY d.id
            ORDER BY d.created_at DESC
        `);
        return NextResponse.json({ departments });
    } catch (error) {
        console.error('Error fetching departments:', error);
        return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { name } = await request.json();
        
        if (!name || name.trim() === '') {
            return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
        }

        const db = await getGdccDb();
        
        // Check for duplicates
        const existing = await db.get('SELECT id FROM gdcc_departments WHERE name = ?', [name.trim()]);
        if (existing) {
            return NextResponse.json({ error: 'Department name already exists' }, { status: 409 });
        }

        const result = await db.run(
            'INSERT INTO gdcc_departments (name) VALUES (?)',
            [name.trim()]
        );
        
        return NextResponse.json({ id: result.lastID, name: name.trim() }, { status: 201 });
    } catch (error) {
        console.error('Error creating department:', error);
        return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const { id, name } = await request.json();
        
        if (!id || !name || name.trim() === '') {
            return NextResponse.json({ error: 'Department ID and name are required' }, { status: 400 });
        }

        const db = await getGdccDb();
        
        // Check for duplicates (excluding self)
        const existing = await db.get('SELECT id FROM gdcc_departments WHERE name = ? AND id != ?', [name.trim(), id]);
        if (existing) {
            return NextResponse.json({ error: 'Department name already exists' }, { status: 409 });
        }

        await db.run(
            'UPDATE gdcc_departments SET name = ? WHERE id = ?',
            [name.trim(), id]
        );
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating department:', error);
        return NextResponse.json({ error: 'Failed to update department' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        
        if (!id) {
            return NextResponse.json({ error: 'Department ID is required' }, { status: 400 });
        }

        const db = await getGdccDb();
        
        // Due to PRAGMA foreign_keys = ON in our DB logic, this will also delete associated domains
        await db.run('PRAGMA foreign_keys = ON');
        await db.run('DELETE FROM gdcc_departments WHERE id = ?', [id]);
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting department:', error);
        return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 });
    }
}
