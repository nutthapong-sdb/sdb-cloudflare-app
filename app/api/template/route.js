import { promises as fs } from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'app', 'data');
const templatesDir = path.join(dataDir, 'templates');
const defaultFile = path.join(dataDir, 'reportTemplate.json');

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    let filePath = defaultFile;
    // If ID provided and valid, use custom template
    if (id && id !== 'default') {
        filePath = path.join(templatesDir, `t_${id}_sub.json`);
    }

    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        return Response.json(data);
    } catch (error) {
        console.error(`Failed to load template ${id}:`, error);
        return Response.json({ template: null });
    }
}

export async function POST(request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const { template } = await request.json();

    let filePath = defaultFile;
    if (id && id !== 'default') {
        // Ensure directory exists
        try { await fs.mkdir(templatesDir, { recursive: true }); } catch (e) { }
        filePath = path.join(templatesDir, `t_${id}_sub.json`);
    }

    try {
        await fs.writeFile(filePath, JSON.stringify({ template }, null, 2), 'utf8');
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
