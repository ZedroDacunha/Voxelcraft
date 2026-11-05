import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

import {
    ROOT, assetFiles, assetVersion, assetVersions, contentHash, localModules,
    renderAssetVersions, renderIndex, versionedUrl,
} from '../tools/stamp-importmap.mjs';

const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const indexHtml = () => read('index.html');
const importMap = () => JSON.parse(/<script type="importmap">([\s\S]*?)<\/script>/.exec(indexHtml())[1]);

test('index.html está carimbado (rode node tools/stamp-importmap.mjs)', () => {
    assert.equal(
        indexHtml(), renderIndex(),
        'index.html desatualizado — rode `node tools/stamp-importmap.mjs` e commite o resultado',
    );
});

test('todo módulo local e vendorizado tem URL com hash próprio no importmap', () => {
    const map = importMap();
    for (const file of localModules()) {
        assert.equal(map.imports[`./${file}`], versionedUrl(ROOT, file), `entrada de ${file}`);
    }
    assert.equal(
        map.imports['./vendor/three/three.module.js'],
        versionedUrl(ROOT, 'vendor/three/three.module.js'),
    );
    assert.equal(
        map.imports['./vendor/three/addons/controls/PointerLockControls.js'],
        versionedUrl(ROOT, 'vendor/three/addons/controls/PointerLockControls.js'),
    );
    // "three" e o arquivo do vendor precisam apontar para a mesma URL (uma
    // única instância do módulo).
    assert.equal(map.imports.three, versionedUrl(ROOT, 'vendor/three/three.module.js'));
});

test('nenhum módulo importa caminho relativo fora do importmap', () => {
    const map = importMap();
    for (const file of localModules()) {
        const src = readFileSync(path.join(ROOT, file), 'utf8');
        for (const match of src.matchAll(/(?:from\s+|import\s*\(\s*)['"](\.[^'"]+)['"]/g)) {
            const specifier = match[1].split('?')[0];
            const key = `./${specifier.replace(/^\.\//, '')}`;
            assert.ok(
                map.imports[key] !== undefined,
                `${file} importa ${specifier}, que não está no importmap (rode o stamp)`,
            );
        }
    }
});

test('versões manuais (?v=) não voltam para as importações', () => {
    for (const file of localModules()) {
        const src = readFileSync(path.join(ROOT, file), 'utf8');
        assert.ok(
            !/(?:from\s+|import\s*\(\s*)['"]\.[^'"]+\.js\?v=/.test(src),
            `${file} tem ?v= escrito à mão numa importação; deixe o importmap cuidar disso`,
        );
    }
});

test('script de entrada e CSS usam o hash do próprio conteúdo', () => {
    const html = indexHtml();
    assert.ok(
        html.includes(`<script type="module" src="world-menu.js?v=${contentHash(ROOT, 'world-menu.js')}"></script>`),
        'script de entrada sem hash (ou com hash antigo)',
    );
    for (const css of ['styles.css', 'inventory.css']) {
        assert.ok(
            html.includes(`href="${css}?v=${contentHash(ROOT, css)}"`),
            `${css} sem hash (ou com hash antigo)`,
        );
    }
});

// --- imagens de assets/ --------------------------------------------------
//
// Módulo tem importmap; imagem não tem. A versão da imagem era escrita à mão
// no game.js e não subia junto com o PNG: o arquivo novo continuava sendo
// pedido na URL do velho e o cache devolvia a arte antiga. Agora ela também é
// hash de conteúdo, carimbado em `asset-versions.js`.

test('asset-versions.js está carimbado (rode node tools/stamp-importmap.mjs)', () => {
    assert.equal(
        read('asset-versions.js'), renderAssetVersions(),
        'asset-versions.js desatualizado — rode `npm run stamp` e commite o resultado',
    );
});

test('toda imagem de assets/ tem versão, e é o hash do próprio arquivo', () => {
    const versions = assetVersions();
    const files = assetFiles();
    assert.ok(files.length >= 3, 'o capim tem três PNGs');
    assert.deepEqual(Object.keys(versions).sort(), files.sort());
    for (const file of files) {
        assert.equal(versions[file], contentHash(ROOT, file), `${file}: versão é o hash do conteúdo`);
    }
});

test('trocar um byte do PNG muda a URL pedida (o bug do capim não volta)', () => {
    const file = 'assets/tall-grass-medium-v2.png';
    const original = readFileSync(path.join(ROOT, file));
    const trocado = Buffer.from(original);
    trocado[trocado.length - 1] ^= 0xff; // um byte diferente = outro arquivo

    const hashOf = (buffer) => createHash('sha256').update(buffer).digest('hex').slice(0, 10);
    assert.notEqual(hashOf(trocado), hashOf(original), 'hash de conteúdo, não versão escrita à mão');
    assert.equal(assetVersion(ROOT, file), hashOf(original), 'e o carimbo usa exatamente esse hash');
});

test('o jogo não guarda mais versão de imagem escrita à mão', () => {
    const game = read('game.js');
    assert.ok(!/grassTextureVersion/.test(game), 'a versão saiu do game.js');
    assert.ok(!/20261029-5/.test(game), 'e a constante antiga também');
    assert.match(game, /tallGrassTextureUrl\(/, 'a URL da textura vem do módulo do capim');
});
