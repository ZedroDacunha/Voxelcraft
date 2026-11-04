// Servidor estático mínimo para rodar o jogo localmente, sem dependências.
//
//   node tools/serve.mjs            # porta 8000 em 0.0.0.0
//   node tools/serve.mjs 8080       # outra porta
//   PORT=8080 HOST=127.0.0.1 node tools/serve.mjs
//
// O jogo não tem build: estes arquivos são servidos como estão. Precisa ser um
// servidor HTTP (e não `file://`) por causa de `type=module`, do importmap e do
// Web Worker.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = new Map(Object.entries({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
}));

async function resolveTarget(url) {
    let pathname;
    try {
        // `new URL()` interpretaria `//algo` como URL sem host; aqui basta o
        // caminho cru, sem query string.
        pathname = decodeURIComponent(url.split('?')[0].split('#')[0]);
    } catch {
        return null; // URL malformada (por exemplo, com `%` solto)
    }
    const target = path.resolve(ROOT, `.${pathname}`);
    if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return null; // fora da raiz
    const info = await stat(target).catch(() => null);
    if (!info) return null;
    if (info.isDirectory()) {
        const index = path.join(target, 'index.html');
        const indexInfo = await stat(index).catch(() => null);
        return indexInfo?.isFile() ? { file: index, size: indexInfo.size } : null;
    }
    return info.isFile() ? { file: target, size: info.size } : null;
}

const server = createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { allow: 'GET, HEAD' }).end('Método não suportado');
        return;
    }
    const target = await resolveTarget(req.url);
    if (!target) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Arquivo não encontrado');
        return;
    }
    const headers = {
        'content-type': MIME.get(path.extname(target.file).toLowerCase()) || 'application/octet-stream',
        'content-length': target.size,
        // Sem cache: os hashes do importmap já resolvem versionamento no jogo,
        // e servir arquivo velho em desenvolvimento confunde mais do que ajuda.
        'cache-control': 'no-store',
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
        res.end();
        return;
    }
    createReadStream(target.file).on('error', () => res.destroy()).pipe(res);
});

server.listen(PORT, HOST, () => {
    console.log(`SiteCraft em http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/`);
});
