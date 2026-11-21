import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('capacete e peitoral são slots acessíveis; calças e botas continuam inativos', () => {
    const html = read('index.html');
    const section = html.match(/<div id="inv-armor"[\s\S]*?<canvas id="inv-player"/)[0];
    assert.match(section, /id="inv-armor"[^>]*hidden/);
    assert.match(section, /data-inv="armor" data-index="0" aria-label="Capacete: vazio"/);
    assert.match(section, /data-inv="armor" data-index="1" aria-label="Peitoral: vazio"/);
    assert.match(section, /Calças: espaço indisponível/);
    assert.match(section, /Botas: espaço indisponível/);
    assert.equal((section.match(/data-inv="armor"/g) || []).length, 2);
});
test('espaços são apenas no inventário pessoal e dimensionados pela grade', () => {
    const js = read('game.js'), css = read('inventory.css');
    assert.match(js, /getElementById\('inv-armor'\)\.hidden = Boolean\(station\)/);
    assert.match(css, /#inv-armor\[hidden\]\s*\{\s*display:\s*none/);
    assert.match(css, /\.armor-slot\s*\{[^}]*width:\s*var\(--inv-slot-size\);\s*height:\s*var\(--inv-slot-size\)/);
});
