import fs from 'node:fs/promises';
import path from 'node:path';

// Serves TinyMCE assets behind /systems/* deployments.
// Maps /systems/tinymce/<file> -> /public/tinymce/<file>

const MIME = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json; charset=utf-8',
};

export async function GET(_req, { params }) {
  const resolvedParams = await params;
  const parts = Array.isArray(resolvedParams?.path) ? resolvedParams.path : [];
  const safeParts = parts
    .map((p) => String(p))
    .filter((p) => p && p !== '.' && p !== '..' && !p.includes('\\') && !p.includes('%2f') && !p.includes('%5c'));

  const publicRoot = path.join(process.cwd(), 'public', 'tinymce');
  const filePath = path.join(publicRoot, ...safeParts);

  // Prevent path traversal.
  if (!filePath.startsWith(publicRoot + path.sep) && filePath !== publicRoot) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // TinyMCE assets are versioned in our repo; cache aggressively.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (_e) {
    return new Response('Not found', { status: 404 });
  }
}
