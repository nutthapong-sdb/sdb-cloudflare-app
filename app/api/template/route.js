import { promises as fs } from 'fs';
import path from 'path';

const dataFilePath = path.join(process.cwd(), 'app', 'data', 'reportTemplate.json');

export async function GET() {
    try {
        const fileContent = await fs.readFile(dataFilePath, 'utf8');
        const data = JSON.parse(fileContent);
        return Response.json(data);
    } catch (error) {
        return Response.json({ template: null });
    }
}

export async function POST(req) {
    try {
        const { template } = await req.json();
        await fs.writeFile(dataFilePath, JSON.stringify({ template }, null, 2), 'utf8');
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
