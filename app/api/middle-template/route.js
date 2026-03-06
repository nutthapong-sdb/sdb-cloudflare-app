import { promises as fs } from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'app', 'data');
const templatesDir = path.join(dataDir, 'templates');
const defaultFile = path.join(dataDir, 'middleReportTemplate.json');

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    let filePath = defaultFile;
    if (id && id !== 'default') {
        const safeId = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, '');
        if (!safeId) return Response.json({ template: null });
        filePath = path.join(templatesDir, `t_${safeId}_middle.json`);
    }

    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        return Response.json(data);
    } catch (error) {
        return Response.json({ template: null });
    }
}

export async function POST(request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const { template } = await request.json();

    let filePath = defaultFile;
    if (id && id !== 'default') {
        const safeId = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, '');
        if (!safeId) return Response.json({ success: false, error: 'Invalid ID' }, { status: 400 });

        try { await fs.mkdir(templatesDir, { recursive: true }); } catch (e) { }
        filePath = path.join(templatesDir, `t_${safeId}_middle.json`);
    }

    try {
        await fs.writeFile(filePath, JSON.stringify({ template }, null, 2), 'utf8');
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
