import { NextResponse } from 'next/server';
import { getGdccDb } from '@/lib/gdcc-db';

export async function GET(request) {
    try {
        const url = new URL(request.url);
        const department_id = url.searchParams.get('department_id');

        if (!department_id) {
            return NextResponse.json({ error: 'department_id is required' }, { status: 400 });
        }

        const db = await getGdccDb();
        const domains = await db.all(`
            SELECT * FROM gdcc_department_domains 
            WHERE department_id = ?
            ORDER BY created_at DESC
        `, [department_id]);

        return NextResponse.json({ domains });
    } catch (error) {
        console.error('Error fetching department domains:', error);
        return NextResponse.json({ error: 'Failed to fetch department domains' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { department_id, domain, zone_id } = await request.json();

        if (!department_id || !domain || !zone_id) {
            return NextResponse.json({ error: 'department_id, domain, and zone_id are required' }, { status: 400 });
        }

        const db = await getGdccDb();

        // Check for duplicates
        const existing = await db.get(
            'SELECT id FROM gdcc_department_domains WHERE department_id = ? AND domain = ?', 
            [department_id, domain]
        );
        
        if (existing) {
            return NextResponse.json({ error: 'Domain already mapped to this department' }, { status: 409 });
        }

        const result = await db.run(
            'INSERT INTO gdcc_department_domains (department_id, domain, zone_id) VALUES (?, ?, ?)',
            [department_id, domain, zone_id]
        );

        return NextResponse.json({ 
            id: result.lastID, 
            department_id, 
            domain, 
            zone_id 
        }, { status: 201 });
    } catch (error) {
        console.error('Error adding domain to department:', error);
        return NextResponse.json({ error: 'Failed to add domain to department' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Domain ID is required' }, { status: 400 });
        }

        const db = await getGdccDb();
        await db.run('DELETE FROM gdcc_department_domains WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing domain from department:', error);
        return NextResponse.json({ error: 'Failed to remove domain from department' }, { status: 500 });
    }
}
