import { promises as fs } from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'app', 'data');
const templatesDir = path.join(dataDir, 'templates');
const registryFile = path.join(dataDir, 'templates.json');

// Ensure directories exist
const ensureDir = async () => {
    try {
        await fs.mkdir(templatesDir, { recursive: true });
    } catch (e) { }
};

// Paths for default files
const defaultSubPath = path.join(dataDir, 'reportTemplate.json');
const defaultDomainPath = path.join(dataDir, 'staticReportTemplate.json');

export async function GET() {
    try {
        await ensureDir();
        const content = await fs.readFile(registryFile, 'utf8');
        return Response.json(JSON.parse(content));
    } catch (error) {
        // If file doesn't exist, return default only
        return Response.json([{ id: 'default', name: 'Default Template' }]);
    }
}

export async function POST(req) {
    try {
        await ensureDir();
        const { action, name, sourceId, id, newName } = await req.json();
        console.log('Template API Request:', { action, name, sourceId, id });

        // Read registry
        let templates = [];
        try {
            const content = await fs.readFile(registryFile, 'utf8');
            templates = JSON.parse(content);
        } catch (e) {
            templates = [{ id: 'default', name: 'Default Template' }];
        }

        if (action === 'create' || action === 'duplicate') {
            const newId = Date.now().toString();
            const newTemplate = { id: newId, name: name || `Copy of ${sourceId}` };

            // Determine source files
            let subContent = '{}';
            let domainContent = '{}';

            if (sourceId === 'empty') {
                // Truly empty content
                subContent = '{}';
                domainContent = '{}';
            } else {
                // Determine source files
                let srcSub = defaultSubPath;
                let srcDomain = defaultDomainPath;

                if (sourceId && sourceId !== 'default') {
                    srcSub = path.join(templatesDir, `t_${sourceId}_sub.json`);
                    srcDomain = path.join(templatesDir, `t_${sourceId}_domain.json`);
                }

                // Read source content
                try { subContent = await fs.readFile(srcSub, 'utf8'); } catch (e) { }
                try { domainContent = await fs.readFile(srcDomain, 'utf8'); } catch (e) { }
            }

            // Write new files
            await fs.writeFile(path.join(templatesDir, `t_${newId}_sub.json`), subContent, 'utf8');
            await fs.writeFile(path.join(templatesDir, `t_${newId}_domain.json`), domainContent, 'utf8');

            // Update registry
            templates.push(newTemplate);
            await fs.writeFile(registryFile, JSON.stringify(templates, null, 2), 'utf8');

            return Response.json({ success: true, template: newTemplate });
        }

        if (action === 'rename') {
            const target = templates.find(t => t.id === id);
            if (target) {
                target.name = newName;
                await fs.writeFile(registryFile, JSON.stringify(templates, null, 2), 'utf8');
                return Response.json({ success: true });
            }
            return Response.json({ success: false, error: 'Template not found' }, { status: 404 });
        }

        if (action === 'delete') {
            if (id === 'default') return Response.json({ success: false, error: 'Cannot delete default template' }, { status: 400 });

            templates = templates.filter(t => t.id !== id);
            await fs.writeFile(registryFile, JSON.stringify(templates, null, 2), 'utf8');

            // Delete files
            try { await fs.unlink(path.join(templatesDir, `t_${id}_sub.json`)); } catch (e) { }
            try { await fs.unlink(path.join(templatesDir, `t_${id}_domain.json`)); } catch (e) { }

            return Response.json({ success: true });
        }

        return Response.json({ success: false, error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Template API Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
}
