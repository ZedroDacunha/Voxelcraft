#!/usr/bin/env node
// Carimba index.html com versões de cache:
//   - o importmap ganha uma entrada "./arquivo.js?v=<hash>" para cada módulo
//     local (e para os arquivos vendorizados usados pelo jogo);
//   - o <script type="module"> de entrada e os <link rel="stylesheet"> também
//     ganham "?v=<hash do próprio arquivo>".
//
// O mesmo hash resolve as imagens de `assets/`, que não passam pelo importmap:
// elas viram `asset-versions.js` (ver `renderAssetVersions`). Imagem com versão
// escrita à mão foi o bug do capim: o PNG novo era pedido na URL do velho e o
// cache devolvia a arte antiga para sempre.
//
// O hash é o sha256 do conteúdo (10 caracteres), então um módulo só muda de URL
// quando o próprio conteúdo muda — e o navegador nunca mistura versões.
// Rode depois de editar qualquer .js/.css (ou trocar uma imagem de assets/):
//
//   node tools/stamp-importmap.mjs          # atualiza index.html e asset-versions.js
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

// --- imagens de assets/ ---------------------------------------------------
//
// Código tem importmap: o hash do conteúdo vai na URL e o navegador nunca
// mistura versões. Imagem não tem — e a versão era escrita à mão no game.js
// (`grassTextureVersion`). Ela só subia se alguém lembrasse, então trocar um
// PNG mantendo o caminho deixava a URL idêntica: cache HTTP e service worker
// devolviam a arte antiga, para sempre. Aqui a versão passa a ser o hash do
// próprio arquivo, num módulo que o jogo importa.

export const ASSET_MODULE = 'asset-versions.js';

/** Imagens de `assets/` — os sons têm URL sem versão e ficam de fora. */
export function assetFiles(root = ROOT) {
    const directory = path.join(root, 'assets');
    let entries;
    try {
        entries = readdirSync(directory, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.png'))
        .map(entry => `assets/${entry.name}`)
        .sort();
}

/** `{ 'assets/x.png': '<hash>' }` — a versão de cada imagem. */
export function assetVersions(root = ROOT) {
    const versions = {};
    for (const file of assetFiles(root)) versions[file] = contentHash(root, file);
    return versions;
}

export function renderAssetVersions(root = ROOT) {
    const lines = Object.entries(assetVersions(root))
        .map(([file, hash]) => `    '${file}': '${hash}',`);
    return [
        '// Gerado por tools/stamp-importmap.mjs — não editar à mão.',
        '//',
        '// Hash do conteúdo de cada imagem de `assets/`. O jogo pede a imagem com',
        '// `?v=<hash deste arquivo>`: trocar o PNG muda a URL, e nem o cache HTTP',
        '// nem o service worker conseguem devolver a arte antiga.',
        'export const ASSET_VERSIONS = {',
        ...lines,
        '};',
        '',
    ].join('\n');
}

/** Versão da imagem para a URL (`?v=`), com vazio quando ela não está no mapa. */
export function assetVersion(root, file) {
    return assetVersions(root)[String(file).replace(/^\.\//, '')] ?? '';
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
    const check = process.argv.includes('--check');
    const stale = [];
    const write = (name, next) => {
        let current = '';
        try {
            current = readFileSync(path.join(ROOT, name), 'utf8');
        } catch {
            // Primeira vez: o arquivo ainda não existe (asset-versions.js é gerado).
        }
        if (next === current) return false;
        if (!check) writeFileSync(path.join(ROOT, name), next);
        stale.push(name);
        return true;
    };

    // A ordem importa: o hash de asset-versions.js entra no importmap, então o
    // arquivo precisa estar com o conteúdo de hoje antes de carimbar a página.
    const assets = write(ASSET_MODULE, renderAssetVersions());
    const page = write('index.html', renderIndex());

    if (!assets && !page) {
        console.log('carimbos em dia (importmap, versões de cache e imagens batem com os arquivos).');
    } else if (check) {
        console.error(`desatualizado: ${stale.join(', ')} — rode \`node tools/stamp-importmap.mjs\` e commite o resultado.`);
        process.exit(1);
    } else {
        console.log(`carimbado: ${stale.join(', ')}.`);
    }
}
