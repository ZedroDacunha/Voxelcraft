#!/usr/bin/env node
// Carimba index.html com versões de cache:
//   - o importmap ganha uma entrada "./arquivo.js?v=<hash>" para cada módulo
//     local (e para os arquivos vendorizados usados pelo jogo);
//   - o <script type="module"> de entrada e os <link rel="stylesheet"> também
//     ganham "?v=<hash do próprio arquivo>".
//
// O hash é o sha256 do conteúdo (10 caracteres), então um módulo só muda de URL
// quando o próprio conteúdo muda — e o navegador nunca mistura versões.
// Rode depois de editar qualquer .js/.css:
//
//   node tools/stamp-importmap.mjs          # atualiza index.html
//   node tools/stamp-importmap.mjs --check  # falha se estiver desatualizado
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

// Arquivos servidos de vendor/ que o jogo importa por caminho relativo.
const VENDOR_MODULES = [
    'vendor/three/three.module.js',
    'vendor/three/addons/controls/PointerLockControls.js',
];

const START = '<!-- importmap:start';
const END = '<!-- importmap:end -->';

// O service worker é servido ao navegador, não importado por nenhum módulo —
// e ele nunca pode entrar no importmap (a URL dele precisa ser estável).
const NOT_IMPORTED_BY_PAGES = new Set(['service-worker.js']);

export function localModules(root = ROOT) {
    return readdirSync(root)
        .filter(file => file.endsWith('.js') && !NOT_IMPORTED_BY_PAGES.has(file))
        .sort();
}

export function contentHash(root, file) {
    return createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex').slice(0, 10);
}

export function versionedUrl(root, file) {
    return `./${file}?v=${contentHash(root, file)}`;
}

export function buildImportMap(root = ROOT, html) {
    const match = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html);
    if (!match) throw new Error('index.html não tem um <script type="importmap">');
    const scopes = JSON.parse(match[1]).scopes ?? {};

    const imports = {
        // "three" é o mesmo arquivo do vendor; o mapa garante uma única instância.
        three: versionedUrl(root, VENDOR_MODULES[0]),
        'three/addons/': './vendor/three/addons/',
    };
    for (const file of [...localModules(root), ...VENDOR_MODULES]) {
        imports[`./${file}`] = versionedUrl(root, file);
    }
    return { imports, scopes };
}

export function renderIndex(root = ROOT) {
    const file = path.join(root, 'index.html');
    const html = readFileSync(file, 'utf8');
    const startAt = html.indexOf(START);
    const endAt = html.indexOf(END);
    if (startAt < 0 || endAt < startAt) {
        throw new Error('marcadores <!-- importmap:start --> / <!-- importmap:end --> não encontrados em index.html');
    }

    const map = buildImportMap(root, html);
    const block = `${START} (gerado por tools/stamp-importmap.mjs; não editar à mão) -->\n`
        + `<script type="importmap">\n${JSON.stringify(map, null, 2)}\n</script>\n${END}`;

    let out = html.slice(0, startAt) + block + html.slice(endAt + END.length);
    out = out.replace(
        /<script type="module" src="([^"?]+)(?:\?v=[^"]*)?"><\/script>/g,
        (_, src) => `<script type="module" src="${src}?v=${contentHash(root, src)}"></script>`,
    );
    out = out.replace(
        /<link rel="stylesheet" href="([^"?]+)(?:\?v=[^"]*)?">/g,
        (_, href) => `<link rel="stylesheet" href="${href}?v=${contentHash(root, href)}">`,
    );
    return out;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
    const file = path.join(ROOT, 'index.html');
    const current = readFileSync(file, 'utf8');
    const next = renderIndex();
    if (next === current) {
        console.log('index.html em dia (importmap e versões de cache batem com os arquivos).');
    } else if (process.argv.includes('--check')) {
        console.error('index.html desatualizado: rode `node tools/stamp-importmap.mjs` e commite o resultado.');
        process.exit(1);
    } else {
        writeFileSync(file, next);
        console.log('index.html atualizado com as versões de cache.');
    }
}
