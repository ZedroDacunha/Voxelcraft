import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
    ROOT, contentHash, localModules, renderIndex, versionedUrl,
} from '../tools/stamp-importmap.mjs';

const indexHtml = () => readFileSync(path.join(ROOT, 'index.html'), 'utf8');
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
