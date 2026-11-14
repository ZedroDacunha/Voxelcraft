import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('quatro espaços visuais acessíveis estão antes do personagem, sem ações de inventário', () => {
    const html = read('index.html');
    const section = html.match(/<div id="inv-armor"[\s\S]*?<canvas id="inv-player"/)[0];
    assert.match(section, /id="inv-armor"[^>]*hidden/);
    for (const name of ['Capacete', 'Peitoral', 'Calças', 'Botas']) assert.match(section, new RegExp(`${name}: espaço indisponível`));
    assert.equal((section.match(/class="armor-slot"/g) || []).length, 4);
    assert.doesNotMatch(section, /class="islot"|data-inv|tabindex|<button/);
});
test('espaços são apenas no inventário pessoal e dimensionados pela grade', () => {
    const js = read('game.js'), css = read('inventory.css');
    assert.match(js, /getElementById\('inv-armor'\)\.hidden = Boolean\(station\)/);
    assert.match(css, /#inv-armor\[hidden\]\s*\{\s*display:\s*none/);
    assert.match(css, /\.armor-slot\s*\{[^}]*width:\s*var\(--inv-slot-size\);\s*height:\s*var\(--inv-slot-size\)/);
});
